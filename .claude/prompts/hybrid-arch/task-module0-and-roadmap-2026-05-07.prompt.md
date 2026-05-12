# Task — Módulo 0 Enhancements + DDD Wiring
**Created**: 2026-05-07
**Stack**: FastAPI (Python 3.12) + NestJS 11 (ESM, Fastify) + React 18 (Vite)
**Status**: A1–D1 ✅ completo | E1 ✅ | E2 ✅ | E3 ✅ | E4 ✅ | E5 ✅

---

## 0. Session Context

### O que foi entregue (Fases A1–D1 — 100% completo)

| Fase | Entrega |
|------|---------|
| A1 | Refactor vision-service: separação em `services/`, `routers/`, `schemas/` |
| A2 | `quality_evaluator.py` (pose × sharpness × lighting multiplicativo), `fingerprint.py`, smoke tests |
| B1 | NestJS 11 scaffold: Fastify, ESM, pino, Swagger `/api/docs` |
| B2 | `VisionClient` + DTOs + `/v1/vision/*` (proxy controller 7 rotas) |
| B3 | `PhotoQualityModule` — `POST /v1/photo-quality/validate` com gate ALTA/MEDIA/BAIXA/REJEITADA |
| B4 | `AnalysisModule` com quality gate + `EventEmitter2` (analysis.completed, analysis.compared) |
| B5 | Stubs DDD: Diagnosis/Decision/Execution/Tracking/Identity — EventBus listeners @OnEvent |
| C1 | Frontend: `api.ts`, `PhotoQualityCard.tsx`, `CapturePage.tsx`, vite proxy `/v1` e `/api` |
| D1 | `docker-compose.yml` (vision:9015, orchestrator:9020, frontend:9016, minio:9017), nginx, justfile |

**Todos endpoints validados end-to-end:**
- `GET /v1/vision/capture-guidelines`
- `POST /v1/vision/landmarks` → 68 landmarks + qualidade
- `POST /v1/photo-quality/validate` → decision + subscores
- `POST /v1/analysis` (com e sem quality gate)
- `POST /v1/analysis/compare`
- `GET /v1/vision/results/:runId/annotated` → JPEG
- `GET /v1/vision/results/:runId/simulation/:simType` → JPEG

---

## 1. Fases Pendentes — Roadmap

### E1 — Flag Detection Heurística (Python, sem novos pacotes)
**Arquivo**: `backend/app/vision/services/quality_evaluator.py`

Atualmente `flags` retorna tudo `False`. Implementar detecção via OpenCV + dlib landmarks:

**Beard detection** (`beard: bool, beard_density: float`):
- Definir "chin ROI": landmarks 5–11 (jaw bottom) + landmarks 48–67 (mouth region), y=mouth_y até y=chin_y
- Converter ROI para LAB → canal L + canal a
- `beard_density` = (`std_dev(L)` / 50) * (1 − `mean_L` / 220) — texturas escuras/heterogêneas = alta densidade
- `beard = beard_density > 0.35`

**Glasses detection** (`glasses: bool`):
- Eye ROI: landmarks 36–47 (ambos os olhos), expandir 20px nas 4 direções
- Converter para grayscale, aplicar Sobel horizontal + vertical
- `edge_density` = `np.count_nonzero(edges > 80)` / `roi_area`
- `glasses = edge_density > 0.18` (bordas de armação criam alta densidade de bordas horizontais)

**Smile detection** (`smile: bool`):
- Landmark 48 = canto esquerdo, 54 = canto direito, 57 = centro inferior da boca
- `mouth_corners_y = (land[48][1] + land[54][1]) / 2`
- `mouth_center_y = land[57][1]`
- `lift = mouth_center_y - mouth_corners_y`  (positivo = cantos mais altos que centro = sorriso)
- `smile = lift > 4.0` (pixels)

**Interface a implementar**:
```python
def detect_flags(image_bgr: np.ndarray, landmarks: np.ndarray) -> dict:
    """Returns {beard, beard_density, glasses, smile, hair_covering}."""
    ...
```

Chamar em `evaluate()` logo após `compute_blur_score` e antes de `_build_recommendations`.

---

### E2 — Regional Penalties (Python)
**Arquivo**: `backend/app/vision/services/quality_evaluator.py`

Atualmente `regional_penalties` retorna tudo `0.0`. Fórmula por região:

| Região | Penalty quando |
|--------|----------------|
| `jaw`  | `beard_density * 0.4` — barba afeta métricas de simetria do queixo |
| `eye`  | `0.5 if glasses else 0.0` — óculos afeta eyebrow/eye metrics |
| `brow` | `0.3 if flags.hair_covering else 0.0` |
| `mouth`| `0.2 if flags.smile else 0.0` — sorriso distorce largura labial |
| `nose` | `lighting_asymmetry_delta / 100.0 * 0.4` capped at 0.5 |

**Integração com MetricResult**:
- Em `metric_calculator.py`, na função `_confidence()`, multiplicar confiança base pela regional penalty da região inferida:
  ```python
  region_penalty = quality_context.get("regional_penalties", {}).get(region, 0.0)
  final_confidence = base_confidence * quality_score * (1.0 - region_penalty)
  ```

---

### E3 — ConsistencyScore ao Comparar Runs (NestJS + Python)
**Arquivos**:
- `backend/app/vision/services/fingerprint.py` — nova função `compute_consistency_score()`
- `nest/src/modules/analysis/analysis.service.ts` — chamar score ao comparar
- `nest/src/modules/vision/dto/vision.dto.ts` — novo campo em `CompareResponseDto`

**Regra de negócio**:
> Comparação oficial (before/after) só é confiável se ConsistencyScore ≥ 0.8.
> Fingerpint tem 6 buckets: beard / glasses / smile / lighting_bucket / pose_bucket / distance_bucket

Implementar em `fingerprint.py`:
```python
def compute_consistency_score(fp_a: str, fp_b: str) -> dict:
    """
    Cada fingerprint hex[:16] é um sha1. Mas guardar os buckets separados
    também no LandmarkPayload (campo 'fingerprint_parts: list[str]') para
    poder comparar bucket a bucket.
    Retorna {score: float, issues: list[str], is_comparable: bool}
    """
```

**Nota**: Para funcionar, o `LandmarkPayload` precisa expor `fingerprint_parts: list[str]` além do hash.
O campo já existe em memória em `build_session_fingerprint` — basta retorná-lo junto.

**Regra**: `score = (buckets_iguais / 6)`, cada bucket diferente ≠ adiciona entry em `issues`.

**NestJS**: Em `analysis.service.ts`, no `compare()`, buscar os dois `LandmarkPayload` dos runs (via `vision.fetchBinary` ou via stored JSON) e chamar `fingerprint.compute_consistency_score(partsA, partsB)`. Adicionar ao response.

---

### E4 — DiagnosisModule: Lógica Real (NestJS)
**Arquivo**: `nest/src/modules/diagnosis/diagnosis.service.ts`

Atualmente `@OnEvent('analysis.completed')` só loga. Implementar:

1. Receber `{ session_id, run_id, result }` do evento
2. Extrair do `result` os top-3 metrics com menor score (campo `score` de cada metric)
3. Gerar `DiagnosisReport`:
   ```typescript
   interface DiagnosisReport {
     run_id: string;
     top_concerns: Array<{ metric_id: string; score: number; region: string }>;
     summary: string;  // "Assimetria moderada detectada em região nasal e orbital"
     timestamp: string;
   }
   ```
4. Emitir `diagnosis.completed` com o relatório
5. (Opcional) Persistir em mapa em memória `Map<run_id, DiagnosisReport>` para `GET /v1/diagnosis/:runId`

---

### E5 — Frontend: PhotoQualityCard Melhorias
**Arquivo**: `frontend/src/components/PhotoQualityCard.tsx`

Melhorias de UX com dados já disponíveis no payload:

1. **Subscore bars**: barra horizontal para cada subscore (pose, sharpness, lighting, expression, occlusion) com cor relativa ao valor (verde ≥0.8, âmbar ≥0.6, vermelho <0.6)
2. **Pose indicator**: exibir `yaw/pitch/roll` em graus com ícone de rotação; vermelho se fora da faixa ideal
3. **Flag chips**: chips "Barba detectada", "Óculos detectado", "Sorriso detectado" quando `flags.*` for `true`
4. **ConsistencyWarning**: após compare, se `consistency_score < 0.7`, exibir banner âmbar "Condições diferentes detectadas: [issue list]"

---

## 2. Arquivos-Chave

### Backend (Python)
```
backend/
  app/
    vision/
      services/
        quality_evaluator.py   ← E1 + E2 (flag detection + regional penalties)
        fingerprint.py         ← E3 (expose fingerprint_parts + compute_consistency_score)
        metric_calculator.py   ← E2 (wire regional penalties into _confidence)
      schemas/
        landmark_payload.py    ← E3 (adicionar fingerprint_parts: list[str])
      routers/
        landmarks.py           ← E3 (incluir fingerprint_parts no return)
        compare.py             ← E3 (aceitar fingerprint_parts no request ou buscar dos runs)
```

### Backend (NestJS)
```
nest/
  src/
    modules/
      analysis/
        analysis.service.ts     ← E3 (consistency_score no compare response)
      diagnosis/
        diagnosis.service.ts    ← E4 (lógica real + DiagnosisReport)
      vision/
        dto/vision.dto.ts       ← E3 (CompareResponseDto com consistency_score)
```

### Frontend
```
frontend/
  src/
    components/
      PhotoQualityCard.tsx      ← E5
    api.ts                      ← E3 (type para consistency_score no compare response)
```

---

## 3. Dependências e Ordem de Implementação

```
E1 (flag detection)
  └─→ E2 (regional penalties) — depende de E1 ter beard_density/glasses/smile
        └─→ métricas com confidence correta
E3 (consistency score) — independente, mas depende de fingerprint_parts estar em LandmarkPayload
E4 (DiagnosisModule) — independente, consome events que já são emitidos
E5 (frontend card) — independente; E5 flag chips depende de E1 estar pronto
```

**Ordem sugerida**: E1 → E2 → E3 → E4 → E5

---

## 4. Regras de Negócio Críticas

1. **Sem novos pacotes Python** — usar apenas OpenCV, numpy, dlib (já instalados). Nenhum `pip install`.
2. **Grades imutáveis**: ALTA ≥ 0.85, MEDIA ≥ 0.70, BAIXA ≥ 0.55, REJEITADA < 0.55
3. **Multiplicative score**: `quality_score = face_ok × pose × sharpness × lighting × occlusion × expression`
4. **Consistência para comparação**: apenas runs com `ConsistencyScore ≥ 0.8` devem exibir delta confiável; abaixo disso → warning
5. **V2 fora de escopo**: MediaPipe WASM, RetinaFace, detecção ML de barba/óculos — não implementar agora
6. **Idioma do código**: inglês (variáveis, métodos, tipos). Português apenas em strings de recomendações pt-BR.

---

## 5. Verificação

```bash
# Certificar stack up
docker compose ps

# E1/E2: landmark com flags reais
curl -s -X POST http://localhost:9020/v1/photo-quality/validate \
  -H "Content-Type: application/json" \
  -d "{\"image_base64\":\"$(base64 -w0 bkp/antes.png)\"}" \
  | jq '{decision, grade, quality_score, flags: .subscore_breakdown}'

# E1: verificar que beard_density é float (não sempre zero)
curl -s -X POST http://localhost:9015/vision/landmarks \
  -H "Content-Type: application/json" \
  -d "{\"image_base64\":\"$(base64 -w0 bkp/antes.png)\"}" \
  | jq '{flags, regional_penalties, fingerprint}'

# E3: consistency_score presente no compare response
# (exige dois run_ids; substituir abaixo)
curl -s -X POST http://localhost:9020/v1/analysis/compare \
  -H "Content-Type: application/json" \
  -d '{"run_id_before":"<RUN1>","run_id_after":"<RUN2>"}' \
  | jq '{score_delta, consistency_score, consistency_issues}'

# E4: DiagnosisReport após analysis
curl -s -X POST http://localhost:9020/v1/analysis \
  -H "Content-Type: application/json" \
  -d "{\"image_base64\":\"$(base64 -w0 bkp/antes.png)\",\"mode\":\"premium\",\"skip_quality_gate\":true}" \
  | jq '.run_id'
# Consultar diagnóstico gerado:
# curl http://localhost:9020/v1/diagnosis/<run_id>
```

---

## 6. Checklist de Entrega

- [x] `detect_flags()` em `quality_evaluator.py` — beard/glasses/smile sem novos pacotes
- [x] `beard_density: float` exposto em `QualityFlags` schema + retornado no `LandmarkPayload`
- [x] `regional_penalties` populados corretamente (não todos zeros)
- [x] `MetricResult.confidence` multiplica `quality_score × (1 - region_penalty)`
- [x] `fingerprint_parts: list[str]` no `LandmarkPayload` + schema Pydantic atualizado
- [x] `compute_consistency_score(parts_a, parts_b) -> dict` em `fingerprint.py`
- [x] `CompareResponseDto` com `consistency_score: number`, `consistency_issues: string[]`, `is_comparable: boolean`
- [x] `DiagnosisService.handleAnalysisCompleted` gera `DiagnosisReport` (top 3 métricas)
- [x] `PhotoQualityCard.tsx` exibe subscore bars + flag chips
- [x] Smoke tests Python passando: `docker exec face-vision-service python -m pytest backend/tests/ -v`
- [x] TypeScript compila: `cd nest && npm run build`
- [x] Stack up, todos endpoints respondendo 200

---

## 7. Deploy

```bash
# Rebuild completo
just stack-up

# Logs em tempo real
just stack-logs

# Rebuild apenas vision-service (para mudanças Python)
just vision-restart

# Rebuild apenas orchestrator (para mudanças NestJS)
just nest-docker-build && just stack-up
```

---

## 8. Contexto V2 (Referência — não implementar agora)

- **DeviceCapabilityDetector**: detecta se browser suporta WebAssembly SIMD + worker threads → escolhe `CLIENT_SIDE` (MediaPipe) ou `SERVER_FALLBACK` (atual)
- **ClientPhotoProcessor**: worker com MediaPipe FaceMesh (468 landmarks) compilado para WASM — enviaria `LandmarkPayload` diretamente ao NestJS sem passar pela vision-service
- **RetinaFace**: substituir dlib HOG detector para faces small/occluded
- **Multi-capture median**: tirar 3–5 fotos, calcular mediana dos landmarks para reduzir ruído
- **ConsistencyScore UI**: exibir no compare view se as condições foram consistentes o suficiente para comparação oficial
