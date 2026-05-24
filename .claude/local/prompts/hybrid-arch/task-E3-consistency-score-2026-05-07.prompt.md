---
tenant_id: "face-before-after"
project: "face-before-after"
module: "hybrid-arch/task-E3-consistency-score-2026-05-07.prompt"
file_path: ".claude/prompts/hybrid-arch/task-E3-consistency-score-2026-05-07.prompt.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  ---
tags:
  - "task-prompt"
rag_keywords:
  - "arch"
  - "consistency"
  - "hybrid"
  - "prompt"
  - "prompts"
  - "score"
related_modules: []
depends_on: []
used_by: []
---
# Task E3 — ConsistencyScore ao Comparar Runs
**Created**: 2026-05-07
**Stack**: Python 3.12 (fingerprint.py) + NestJS 11 TypeScript (analysis.service.ts, vision.dto.ts)
**Depende de**: nada (independente de E1/E2, mas se E1 estiver pronto os buckets serão mais precisos)
**Status**: ✅ IMPLEMENTADO

---

## 0. Contexto

**Regra de negócio central**:
> Comparação oficial (before/after) só é confiável com **ConsistencyScore ≥ 0.8**.
> Abaixo disso, exibir warning — as condições de captura foram muito diferentes.

O `fingerprint.py` já gera um hash de 6 buckets (beard / glasses / smile / lighting_bucket / pose_bucket / distance_bucket), mas o hash é opaco — não permite comparação bucket a bucket.

Esta task expõe os `fingerprint_parts` como lista legível no `LandmarkPayload` e implementa a comparação no compare response.

---

## 1. Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `backend/app/vision/services/fingerprint.py` | Retornar `fingerprint_parts` junto com o hash; nova função `compute_consistency_score()` |
| `backend/app/vision/schemas/landmark_payload.py` | Adicionar `fingerprint_parts: list[str]` |
| `backend/app/vision/routers/landmarks.py` | Incluir `fingerprint_parts` no `LandmarkPayload` retornado |
| `nest/src/modules/vision/dto/vision.dto.ts` | `LandmarkResponseDto` + `CompareResponseDto` com os novos campos |
| `nest/src/modules/analysis/analysis.service.ts` | `compare()` lê `fingerprint_parts` dos dois runs e calcula ConsistencyScore |

---

## 2. Implementação

### 2.1 `fingerprint.py` — expor partes + nova função

**Modificar `build_session_fingerprint()`** para retornar também a lista de partes:

```python
def build_session_fingerprint(
    flags: dict[str, bool],
    pose: dict[str, float],
    mean_luminance: float,
    face_width_ratio: float,
) -> tuple[str, list[str]]:
    """Returns (fingerprint_hash, fingerprint_parts).

    fingerprint_parts order (fixed):
      [0] beard bucket  ('True'/'False')
      [1] glasses bucket
      [2] smile bucket
      [3] lighting bucket ('dark'/'mid'/'bright'/'overexposed')
      [4] pose bucket     ('frontal'/'slight'/'off')
      [5] distance bucket ('far'/'mid'/'close')
    """
    fingerprint_parts = [
        str(bool(flags.get("beard", False))),
        str(bool(flags.get("glasses", False))),
        str(bool(flags.get("smile", False))),
        _bucket_lighting(mean_luminance),
        _bucket_pose(pose),
        _bucket_distance(face_width_ratio),
    ]
    fingerprint_input = "|".join(fingerprint_parts)
    fingerprint_hash = hashlib.sha1(
        fingerprint_input.encode("utf-8"), usedforsecurity=False
    ).hexdigest()[:16]
    return fingerprint_hash, fingerprint_parts
```

**Adicionar `compute_consistency_score()`**:

```python
_BUCKET_LABELS = ["beard", "glasses", "smile", "lighting", "pose", "distance"]


def compute_consistency_score(
    parts_a: list[str],
    parts_b: list[str],
) -> dict:
    """Compare two fingerprint_parts lists bucket by bucket.

    Returns:
        score: float in [0, 1] — fraction of matching buckets
        issues: list[str] — human-readable descriptions of mismatches
        is_comparable: bool — True when score >= 0.8 (at least 5/6 buckets match)
    """
    if len(parts_a) != 6 or len(parts_b) != 6:
        return {"score": 0.0, "issues": ["fingerprint_parts inválido"], "is_comparable": False}

    issues: list[str] = []
    matches = 0

    for i, label in enumerate(_BUCKET_LABELS):
        if parts_a[i] == parts_b[i]:
            matches += 1
        else:
            issues.append(f"{label}: '{parts_a[i]}' → '{parts_b[i]}'")

    score = round(matches / 6, 4)
    return {
        "score": score,
        "issues": issues,
        "is_comparable": score >= 0.8,
    }
```

### 2.2 `landmark_payload.py` — adicionar `fingerprint_parts`

```python
class LandmarkPayload(BaseModel):
    ...
    fingerprint: str
    fingerprint_parts: list[str] = []   # ← adicionar
    processing_mode: ProcessingMode
    ...
```

### 2.3 `routers/landmarks.py` — passar `fingerprint_parts`

Localizar onde `build_session_fingerprint()` é chamado:

```python
# Antes
fingerprint = build_session_fingerprint(
    flags=quality["flags"],
    pose=pose,
    mean_luminance=quality.get("mean_luminance", 0.0),
    face_width_ratio=face_width_ratio,
)

# Depois
fingerprint, fingerprint_parts = build_session_fingerprint(
    flags=quality["flags"],
    pose=pose,
    mean_luminance=quality.get("mean_luminance", 0.0),
    face_width_ratio=face_width_ratio,
)
```

E no `return LandmarkPayload(...)`, adicionar `fingerprint_parts=fingerprint_parts`.

### 2.4 `vision.dto.ts` — campos novos

Em `LandmarkResponseDto`, adicionar:
```typescript
@ApiProperty({ type: [String] })
fingerprint_parts!: string[];
```

Criar (ou atualizar) `CompareResponseDto`:
```typescript
export class CompareResponseDto {
  @ApiProperty() score_delta!: number;
  @ApiPropertyOptional() consistency_score?: number;
  @ApiPropertyOptional({ type: [String] }) consistency_issues?: string[];
  @ApiPropertyOptional() is_comparable?: boolean;
  @ApiProperty() result!: Record<string, unknown>;
}
```

### 2.5 `analysis.service.ts` — calcular ConsistencyScore no compare

No método `compare()`, após buscar os dois runs:

```typescript
// Checar se os dois LandmarkPayloads têm fingerprint_parts
const partsA: string[] = landmarkBefore?.fingerprint_parts ?? [];
const partsB: string[] = landmarkAfter?.fingerprint_parts ?? [];

let consistencyResult: { score: number; issues: string[]; is_comparable: boolean } | null = null;
if (partsA.length === 6 && partsB.length === 6) {
  // Chamar vision-service ou calcular inline
  // Opção simples: calcular inline em TS (mesma lógica do Python)
  const BUCKET_LABELS = ['beard', 'glasses', 'smile', 'lighting', 'pose', 'distance'];
  const issues: string[] = [];
  let matches = 0;
  for (let i = 0; i < 6; i++) {
    if (partsA[i] === partsB[i]) matches++;
    else issues.push(`${BUCKET_LABELS[i]}: '${partsA[i]}' → '${partsB[i]}'`);
  }
  const score = Math.round((matches / 6) * 10000) / 10000;
  consistencyResult = { score, issues, is_comparable: score >= 0.8 };
}

return {
  ...compareResult,
  consistency_score: consistencyResult?.score,
  consistency_issues: consistencyResult?.issues,
  is_comparable: consistencyResult?.is_comparable,
};
```

> **Nota sobre onde buscar `fingerprint_parts`**: Se os runs já salvam o `LandmarkPayload` em disco (como JSON, via MinIO ou pasta local), carregar de lá. Se não existe persistência de `fingerprint_parts`, os campos virão `[]` e o score não será calculado — isso é aceitável por ora.

---

## 3. Regras de Negócio

- `fingerprint_parts` tem sempre exatamente 6 elementos, na ordem fixa: `[beard, glasses, smile, lighting, pose, distance]`
- `is_comparable = score >= 0.8` (5 ou 6 buckets iguais)
- Se partes ausentes (listas vazias), não calcular o score — retornar `null` nos campos opcionais
- Não bloquear o compare — o resultado sempre retorna; o score é informativo

---

## 4. Verificação

```bash
# Rebuild
docker compose build vision-service && docker compose up -d vision-service

# Checar fingerprint_parts no response de landmarks
curl -s -X POST http://localhost:9015/vision/landmarks \
  -H "Content-Type: application/json" \
  -d "{\"image_base64\":\"$(base64 -w0 bkp/antes.png)\"}" \
  | jq '{fingerprint, fingerprint_parts}'
# Esperado: fingerprint_parts = ["False","False","False","mid","frontal","mid"] (valores variam)

# Testar compute_consistency_score direto
docker exec face-vision-service python -c "
from app.vision.services.fingerprint import compute_consistency_score
# Condições idênticas → score 1.0
r = compute_consistency_score(['False','False','False','mid','frontal','mid'],
                               ['False','False','False','mid','frontal','mid'])
assert r['score'] == 1.0 and r['is_comparable'] == True
# Condições diferentes → score < 0.8
r2 = compute_consistency_score(['False','False','False','mid','frontal','mid'],
                                ['True','True','False','dark','off','close'])
assert r2['score'] < 0.8 and len(r2['issues']) > 0
print('consistency_score OK:', r, r2)
"

# Compare response com consistency_score (requer dois run_ids)
# RUN1=\$(curl -s -X POST http://localhost:9020/v1/analysis \
#   -H 'Content-Type: application/json' \
#   -d "{\"image_base64\":\"\$(base64 -w0 bkp/antes.png)\",\"mode\":\"premium\",\"skip_quality_gate\":true}" \
#   | jq -r '.run_id')
# curl -s -X POST http://localhost:9020/v1/analysis/compare \
#   -H 'Content-Type: application/json' \
#   -d "{\"run_id_before\":\"$RUN1\",\"run_id_after\":\"$RUN1\"}" \
#   | jq '{score_delta, consistency_score, is_comparable}'
```

---

## 5. Checklist

- [x] `build_session_fingerprint()` retorna `(str, list[str])` — tuple em vez de só `str`
- [x] `compute_consistency_score(parts_a, parts_b)` implementada em `fingerprint.py`
- [x] `LandmarkPayload.fingerprint_parts: list[str]` adicionado ao schema
- [x] `routers/landmarks.py` desempacota tuple e passa `fingerprint_parts` ao payload
- [x] `LandmarkResponseDto` (NestJS) com campo `fingerprint_parts: string[]`
- [x] `CompareResponseDto` com `consistency_score`, `consistency_issues`, `is_comparable`
- [x] `analysis.service.ts` calcula score no `compare()` quando partes disponíveis
- [x] TypeScript compila: `cd nest && npm run build`
- [x] Python smoke tests passando
