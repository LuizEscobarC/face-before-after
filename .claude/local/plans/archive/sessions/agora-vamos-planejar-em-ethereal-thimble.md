---
tenant_id: "face-before-after"
project: "face-before-after"
module: "sessions/agora-vamos-planejar-em-ethereal-thimble"
file_path: ".claude/plans/archive/sessions/agora-vamos-planejar-em-ethereal-thimble.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Hoje o backend FastAPI usa dlib 68 landmarks como única fonte de detecção/landmarks, com qualityevaluator.py já implementando o gatekeeper multiplicativo faceok × pose × sharpness × lighting × occlusion × expression, facemetrics.py fazendo métricas próprias, e o NestJS orquestran
tags:
  - "planning"
rag_keywords:
  - "agora"
  - "archive"
  - "ethereal"
  - "planejar"
  - "plans"
  - "sessions"
  - "thimble"
  - "vamos"
related_modules: []
depends_on: []
used_by: []
---
# Plano — Pipeline de Qualidade + Métricas Próprias (Módulo 0)

## Contexto

Hoje o backend FastAPI usa **dlib (68 landmarks)** como única fonte de detecção/landmarks, com `quality_evaluator.py` já implementando o gatekeeper multiplicativo (`face_ok × pose × sharpness × lighting × occlusion × expression`), `face_metrics.py` fazendo métricas próprias, e o NestJS orquestrando como gateway. O frontend faz captura **vanilla** (Canvas + getUserMedia), sem ML no cliente.

A meta é evoluir para o pipeline descrito: **MediaPipe Face Mesh (468 pts) + RetinaFace** server-side, **MediaPipe Tasks Vision (WASM)** client-side com `LandmarkPayload` viajando do browser para o NestJS, fallback transparente para o Python quando o cliente não dá conta, e governança de armazenamento de foto bruta. O NestJS continua orquestrando; FastAPI fica restrito a visão (`/vision/landmarks`, `/vision/metrics`, e o que mais for puramente visão).

A migração é cirúrgica porque o `quality_evaluator.py` e o `face_metrics.py` foram escritos contra os **índices do dlib 68** — trocar para Mesh 468 quebra todos os índices se feito sem mapeamento. Daí a divisão em prompts independentes abaixo, cada um com escopo fechado e critério de aceite claro.

---

## Pacotes externos (resposta direta à pergunta)

### Python (FastAPI) — adicionar

| Pacote | Versão alvo | Para quê | Crítica |
|---|---|---|---|
| `mediapipe` | `>=0.10.18` | Face Mesh 468 pts (server-side fallback) | Imagem Docker fica ~+500MB. WASM não roda no servidor — usa binding Python nativo. |
| `retina-face` | `>=0.0.17` (PyPI: `retinaface-pytorch` ou `retina-face`) | Detector facial robusto (single-shot) | Traz `tensorflow` ou `torch` como dependência transitiva — pesado. **Alternativa mais leve:** usar só o BlazeFace embutido no MediaPipe e dispensar RetinaFace no MVP. **Recomendação:** começar SEM RetinaFace; adicionar só se BlazeFace falhar em casos reais. |
| `onnxruntime` | `>=1.17` | Se for usar RetinaFace via ONNX (alternativa enxuta a TF/Torch) | Só entra se a opção "RetinaFace ONNX" for escolhida. |

### Python — remover (após migração)

| Pacote | Por quê |
|---|---|
| `dlib` | Substituído por MediaPipe Face Mesh. Tirar dlib **economiza compilação CMake e ~150MB no build.** Fazer só ao final do prompt 2 (paridade validada). |

### Python — manter

`opencv-python-headless`, `numpy`, `scipy`, `pillow`, `fastapi`, `uvicorn`, `pydantic-settings`, `minio`, `python-multipart` — todos já no `pyproject.toml`, todos seguem necessários.

### Frontend (React) — adicionar

| Pacote | Versão alvo | Para quê |
|---|---|---|
| `@mediapipe/tasks-vision` | `^0.10.18` | FaceLandmarker WASM/WebGL para landmarks no browser |

Modelo (`face_landmarker.task`, ~3MB) deve ser servido como asset estático do frontend (em `public/models/`) — **não baixar do CDN do Google em runtime** (offline-first + privacidade).

### Frontend — não adicionar (crítica)

- **face-api.js** — redundante com MediaPipe; não adicionar como segundo fallback. Se MediaPipe falhar no browser, vai direto pro servidor.
- **TensorFlow.js** — desnecessário; tasks-vision já traz o runtime que precisa.

### NestJS — sem novos pacotes

`axios` já existe e cobre o `VisionClient`. `class-validator` cobre validação dos DTOs.

---

## Prompts separados (cada um é independente e executável)

### Prompt 1 — Migrar landmarks server-side de dlib para MediaPipe Face Mesh

**Escopo:** trocar `face_detection.py` para usar MediaPipe Face Mesh (468 pts) como fonte única de landmarks no servidor. Manter dlib temporariamente atrás de um flag de ambiente (`USE_DLIB_FALLBACK=true`) por uma sprint para A/B em produção.

**Arquivos:**
- `backend/app/vision/services/face_detection.py` — reescrever com MediaPipe (`mp.solutions.face_mesh.FaceMesh(static_image_mode=True, refine_landmarks=True, max_num_faces=2)`).
- `backend/pyproject.toml` — adicionar `mediapipe>=0.10.18`.
- `backend/Dockerfile.api` — garantir libs nativas que MediaPipe pede (`libgl1`, `libglib2.0-0` — provavelmente já presentes pelo OpenCV).
- Não tocar em `quality_evaluator.py` nem `face_metrics.py` ainda — eles continuam recebendo um array `(N, 2)` de pontos. **Trade-off:** o `quality_evaluator` indexa `landmarks[5:12]`, `[36:48]`, `[48:68]`, `[8]`, `[27]`, `[57]` (índices dlib-68). Para não quebrar, este prompt produz um **subset de 68 pontos no mesmo layout do dlib**, mapeando os índices Mesh-468 → dlib-68 via tabela conhecida (`MEDIAPIPE_TO_DLIB_68 = {...}`). A versão "Mesh completo de 468" só é exposta num campo separado para uso futuro.

**Crítica:** essa estratégia preserva todos os calls atuais e é a forma menos arriscada de migrar. O custo é manter um `dict` de mapeamento ~80 linhas. **Não tente reescrever `quality_evaluator` neste prompt** — vira big-bang.

**Aceite:** mesma foto antes/depois → `quality_score` dentro de ±0.05 e mesmo `quality_grade` em ≥95% das fotos de teste.

---

### Prompt 2 — Migrar `face_metrics.py` para Mesh 468 e adicionar precisão sub-pixel

**Escopo:** uma vez validada a paridade do prompt 1, expandir `face_metrics.py` para usar landmarks Mesh-468 nativamente em métricas que se beneficiam de mais pontos (contornos labiais, íris, contorno facial). Métricas que dlib-68 já cobria bem (distância interpupilar, simetria de mandíbula) não mudam.

**Arquivos:**
- `backend/app/domain/face_metrics.py` — adicionar funções novas (`iris_diameter`, `lip_contour_asymmetry`, etc.) usando índices Mesh; manter as existentes.
- `backend/app/vision/services/metric_calculator.py` — encaminhar landmarks-468 (já disponível via prompt 1).
- Refinar cálculo de **erro/confiança por métrica**: hoje a confiança vem só do `quality_score` global. Passar a propagar `regional_penalties` por métrica conforme spec do usuário (`metricConfidenceFinal = modelConf × QualityScore × regionPenalty × ConsistencyFactor`).

**Crítica:** o `ConsistencyFactor` exige um baseline persistido — isso depende do prompt 5 (consistência longitudinal). Neste prompt, deixe `consistency_factor=1.0` como default e marque um TODO de integração.

**Remover dlib aqui:** depois que tudo passar verde, dropar `dlib` do `pyproject.toml` e do Dockerfile, eliminar `USE_DLIB_FALLBACK`.

**Aceite:** todas as métricas existentes mantêm valores ±2% vs. dlib; novas métricas (íris, contorno labial) aparecem no response.

---

### Prompt 3 — Client-side MediaPipe Tasks Vision + `LandmarkPayload` contract

**Escopo:** processar landmarks no browser e enviar `LandmarkPayload` para o NestJS. O servidor pula detecção quando recebe payload válido.

**Arquivos:**
- `frontend/package.json` — `@mediapipe/tasks-vision`.
- `frontend/public/models/face_landmarker.task` — baixar e versionar (não fazer fetch do CDN do Google em runtime).
- `frontend/src/vision/ClientPhotoProcessor.ts` (novo) — `capture()`, `runMediaPipe()`, `validateRealtimeFeedback()`.
- `frontend/src/vision/DeviceCapabilityDetector.ts` (novo) — `supportsWASM()`, `meetsPerformanceThreshold()` (benchmark de 1 frame), `shouldFallback()`.
- `frontend/src/components/CaptureSourceTabs.tsx` — integrar processador antes do upload.
- `frontend/src/api.ts` — novo método `submitLandmarkPayload()`.
- `nest/src/vision/dto/landmark-payload.dto.ts` (novo) — DTO com `class-validator`.
- `nest/src/vision/vision.client.ts` — método `submitLandmarks()` que repassa para `POST /vision/metrics` no FastAPI **sem** chamar `/vision/landmarks`.
- `backend/app/vision/routers/metrics.py` — aceitar landmarks vindos do client (já é parcialmente o caso); adicionar `processing_mode` no schema.

**Crítica:** o feedback em tempo real (a cada frame) **não pode** rodar o Mesh completo — é caro. Use a versão `tasks-vision` com `runningMode: 'VIDEO'` e rode só pose+luz a cada N frames. O Mesh completo roda **uma vez** quando o usuário clica "capturar". Sem essa otimização, vai travar em celular médio.

**Aceite:** captura em iPhone 12 / Android Pixel 4a roda <100ms por frame de feedback; payload enviado tem `processing_mode: "CLIENT_SIDE"` e o servidor não chama `/vision/landmarks`.

---

### Prompt 4 — Fallback server-side transparente + política de armazenamento

**Escopo:** quando o cliente falha (`shouldFallback() === true`), envia foto bruta. Servidor processa e retorna o mesmo `LandmarkPayload`. Persistência de foto bruta vira **opt-in**.

**Arquivos:**
- `frontend/src/vision/ClientPhotoProcessor.ts` — branch de fallback que faz upload da foto.
- `nest/src/vision/vision.client.ts` — método `submitFallbackPhoto()`.
- `nest/src/photo-quality/application/photo-quality.orchestrator.ts` — registra `processing_mode: "SERVER_FALLBACK"`.
- `backend/app/vision/services/fallback_processor.py` (novo) — orquestra detecção (BlazeFace via MediaPipe) + Mesh + qualidade e produz `LandmarkPayload` idêntico ao do cliente.
- `nest/src/photo-quality/domain/value-objects/photo-storage-policy.ts` (novo) — `shouldStore({ userConsented, purpose })`.
- Schema do `PhotoQualityReport` (NestJS + DB se houver) — adicionar `processing_mode`, `storage_policy_decision`.

**Crítica:** a tentação aqui é fazer "salva sempre, deleta depois" — não. Se `userConsented === false`, **não escreve no MinIO**. Foto vira `np.array` em memória, processa, descarta. Único hook de auditoria é o `LandmarkPayload` persistido (que não tem dados crus).

**Aceite:** desligando WASM no browser, o pipeline ainda funciona end-to-end; sem consentimento, MinIO não recebe a foto bruta (verificável via `mc ls`).

---

### Prompt 5 — Consistência longitudinal (ConsistencyScore + baselineGroupId)

**Escopo:** comparar foto atual com baseline do mesmo usuário e produzir `ConsistencyScore`. Bloqueia "comparação oficial" quando baixo. Cria trilhas separadas (`baselineGroupId`) por estado (com/sem barba, com/sem óculos).

**Arquivos:**
- `backend/app/vision/services/consistency_evaluator.py` (novo) — recebe payload atual + payload baseline; compara: barba, óculos, expressão, pose, distância (tamanho relativo do rosto), padrão de iluminação esquerda/direita.
- `backend/app/vision/services/fingerprint.py` — já existe; estender para gerar o `baselineGroupId` determinístico.
- `nest/src/tracking/` — armazenar `baselineGroupId` por usuário; expor endpoint `GET /tracking/baseline-groups`.
- `frontend` — quando `consistency_score < 0.8`, badge "comparação não oficial".

**Crítica:** este prompt depende de ter **persistência de payloads anteriores** por usuário. Se ainda não há esquema de tracking de usuário/sessão consolidado, este prompt vira épico — então deixe-o **por último** e considere reduzir o MVP a "compara contra a foto imediatamente anterior" em vez de "baseline group".

**Aceite:** raspar barba entre fotos → `consistency_score` cai para <0.7 e UI mostra warning; mesmas condições → score >0.9.

---

## Ordem de execução recomendada

1. **Prompt 1** (dlib → Mesh 68-subset) — destrava tudo, baixo risco.
2. **Prompt 3** (client-side Mesh) — pode rodar em paralelo ao 2 se houver dois devs.
3. **Prompt 2** (Mesh 468 nativo + confiança por métrica).
4. **Prompt 4** (fallback + storage policy).
5. **Prompt 5** (consistência longitudinal) — depende de tracking estar pronto.

---

## Crítica geral ao plano original do usuário

- **RetinaFace é overkill no MVP.** BlazeFace embutido no MediaPipe já cobre o caso e evita 500MB de TensorFlow/PyTorch. Adicione RetinaFace só se métricas em produção mostrarem detecção falhando >2% das vezes.
- **"Treinar a confiança por métrica" sem baseline ≠ útil.** A fórmula `metricConfidenceFinal = modelConf × QualityScore × regionPenalty × ConsistencyFactor` exige consistência (prompt 5). Antes disso, `ConsistencyFactor=1.0` e o nome do campo confunde — chame de `provisional_confidence` até o prompt 5 entrar.
- **`expressionScore = 0.93` é arbitrário.** Hoje está hardcoded no `quality_evaluator.py:290`. Vale calibrar com 50 fotos rotuladas (sorriso vs. neutro) e ver se o impacto real nas métricas justifica o número — provavelmente é menor que 7%.
- **`hair_covering: False` está sempre falso.** O placeholder em `quality_evaluator.py:177` precisa ou ser implementado (segmentação simples de cabelo na testa via cor + posição) ou removido até virar real — caso contrário gera falsa sensação de cobertura.
- **MediaPipe não tem licença permissiva idêntica a Apache 2.0** — é Apache 2.0, ok, mas o **modelo** `face_landmarker.task` tem termos próprios do Google. Verificar antes do commit em produção comercial.

---

## Verificação end-to-end

1. `just frontend-deploy` + restart do backend.
2. Browser moderno: capturar uma foto → DevTools Network deve mostrar payload com `landmarks: [...]` (sem imagem). Endpoint chamado: `POST /v1/photo-quality/submit-landmarks` (NestJS) → `POST /vision/metrics` (FastAPI).
3. Browser sem WASM (Chrome flag `--js-flags="--noexpose-wasm"` ou simulando): mesma foto → fallback dispara, payload tem `image_base64`, response tem `processing_mode: "SERVER_FALLBACK"`.
4. Foto com barba forte: `flags.beard === true`, `regional_penalties.jaw > 0`, métricas de mandíbula com `confidence` reduzida.
5. Foto com sombra lateral: `lighting_asymmetry > 20`, `regional_penalties.eye > 0`.
6. Tempo total p95 client-side: <1.5s do clique ao resultado. Fallback p95: <3s.
