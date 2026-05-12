# Task E2 — Regional Penalties + Propagação no MetricResult
**Created**: 2026-05-07
**Stack**: FastAPI / Python 3.12, OpenCV, numpy
**Depende de**: E1 (beard_density, glasses, smile devem estar em `flags`)
**Status**: ✅ IMPLEMENTADO

---

## 0. Contexto

Com E1 entregue, `flags` agora tem `beard_density`, `glasses` e `smile` com valores reais.

Atualmente `regional_penalties` retorna **tudo `0.0`** e `MetricResult.confidence` ignora qualidade.

Esta task:
1. Popula `regional_penalties` em `quality_evaluator.evaluate()` usando os flags de E1
2. Propaga as penalidades na confiança final de cada `MetricResult` em `metric_calculator._confidence()`

A fórmula garante que métricas afetadas por barba, óculos ou má iluminação recebam confiança reduzida automaticamente.

---

## 1. Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `backend/app/vision/services/quality_evaluator.py` | Preencher `regional_penalties` com base nos flags |
| `backend/app/vision/services/metric_calculator.py` | `_confidence()` multiplica por `(1 - region_penalty)` |

---

## 2. Implementação

### 2.1 Regional Penalties em `quality_evaluator.evaluate()`

Após chamar `detect_flags()` (E1), calcular as penalidades regionais:

```python
def _compute_regional_penalties(
    flags: dict,
    lighting_asymmetry_delta: float,
) -> dict:
    """Map each facial region to a confidence penalty in [0.0, 1.0].

    Higher penalty = lower confidence for metrics in that region.
    """
    beard_density = float(flags.get("beard_density", 0.0))
    glasses = bool(flags.get("glasses", False))
    hair_covering = bool(flags.get("hair_covering", False))
    smile = bool(flags.get("smile", False))

    nose_penalty = min(0.5, (lighting_asymmetry_delta / 100.0) * 0.4)

    return {
        "jaw":   round(min(1.0, beard_density * 0.4), 4),
        "eye":   0.5 if glasses else 0.0,
        "brow":  0.3 if hair_covering else 0.0,
        "mouth": 0.2 if smile else 0.0,
        "nose":  round(nose_penalty, 4),
    }
```

Adicionar essa função no arquivo e chamá-la em `evaluate()` **após** `detect_flags()`:

```python
    flags = detect_flags(image_bgr, landmarks)
    regional_penalties = _compute_regional_penalties(flags, lighting_asymmetry_delta)

    return {
        ...
        "regional_penalties": regional_penalties,
        "flags": flags,
        ...
    }
```

### 2.2 Propagação em `metric_calculator._confidence()`

Localizar `_confidence()` em `metric_calculator.py`. A assinatura atual provavelmente é:

```python
def _confidence(metric_id: str, raw: dict, quality_score: float) -> float:
```

Modificar para aceitar `regional_penalties` e aplicar o desconto:

```python
def _confidence(
    metric_id: str,
    pipeline_output: dict,
    quality_score: float,
    regional_penalties: dict[str, float] | None = None,
) -> float:
    """Confidence = base_model_confidence × quality_score × (1 − region_penalty).

    base_model_confidence: fixed per metric (0.75–0.95 range based on dlib accuracy).
    quality_score: multiplicative score from quality_evaluator (0–1).
    region_penalty: from regional_penalties[region] — reduces confidence for metrics
                    affected by beard/glasses/smile/lighting.
    """
    base = _base_confidence(metric_id)  # existing helper or inline dict
    region = _infer_region(metric_id)
    penalties = regional_penalties or {}
    region_penalty = penalties.get(region, 0.0)
    raw_confidence = base * quality_score * (1.0 - region_penalty)
    return round(max(0.0, min(1.0, raw_confidence)), 4)
```

> Se `_base_confidence()` não existir ainda, criar uma função inline:
> ```python
> _BASE_CONFIDENCE: dict[str, float] = {}  # defaults to 0.80 via .get()
> def _base_confidence(metric_id: str) -> float:
>     return _BASE_CONFIDENCE.get(metric_id, 0.80)
> ```

### 2.3 Atualizar chamada em `compute_metrics()`

Localizar onde `_confidence()` é chamada e passar `quality_context["regional_penalties"]`:

```python
# Antes
confidence = _confidence(metric_id, pipeline_output, quality_context.get("quality_score", 1.0))

# Depois
confidence = _confidence(
    metric_id,
    pipeline_output,
    quality_context.get("quality_score", 1.0),
    quality_context.get("regional_penalties"),
)
```

---

## 3. Tabela de Penalidades

| Região | Trigger | Penalty |
|--------|---------|---------|
| `jaw`  | `beard_density` alto | `beard_density × 0.4` (max 0.4) |
| `eye`  | `glasses = True` | `0.5` fixo |
| `brow` | `hair_covering = True` | `0.3` fixo |
| `mouth`| `smile = True` | `0.2` fixo |
| `nose` | `lighting_asymmetry_delta` alto | `(asym / 100) × 0.4` (max 0.5) |

Exemplo: barba densa (`beard_density = 0.8`) → `jaw_penalty = 0.32` → métricas da região `jaw` têm confiança multiplicada por `0.68`.

---

## 4. Regras de Negócio

- Penalidades são **informativas**, não gates — não bloqueiam análise
- `quality_score` já está em [0,1]; `confidence` final também deve estar em [0,1]
- A propagação só acontece se `quality_context` for passado — a assinatura é retrocompatível (`None` default)
- Não alterar as fórmulas dos scores das métricas — apenas a `confidence` muda

---

## 5. Verificação

```bash
# Rebuild
docker compose build vision-service && docker compose up -d vision-service

# E2: regional penalties não mais todos zeros (depende da foto)
curl -s -X POST http://localhost:9015/vision/landmarks \
  -H "Content-Type: application/json" \
  -d "{\"image_base64\":\"$(base64 -w0 bkp/antes.png)\"}" \
  | jq '.regional_penalties'
# Esperado: pelo menos nose_penalty > 0.0 se houver assimetria de iluminação

# E2: MetricResult.confidence propagado
curl -s -X POST http://localhost:9015/vision/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "landmarks": [[0,0]],
    "quality_context": {
      "quality_score": 0.75,
      "regional_penalties": {"jaw": 0.3, "eye": 0.0, "brow": 0.0, "mouth": 0.0, "nose": 0.1}
    }
  }' | jq '[.metrics[] | {id: .metric_id, conf: .confidence}] | sort_by(.conf)'
# Métricas da região jaw devem ter confidence × 0.7 vs métricas de outras regiões

# Smoke tests
docker exec face-vision-service python -m pytest backend/tests/ -v

# Compile check
docker exec face-vision-service python -c "
from app.vision.services.quality_evaluator import _compute_regional_penalties
r = _compute_regional_penalties({'beard': True, 'beard_density': 0.8, 'glasses': True, 'smile': False, 'hair_covering': False}, 30.0)
assert r['jaw'] > 0
assert r['eye'] == 0.5
print('regional_penalties OK:', r)
"
```

---

## 6. Checklist

- [x] `_compute_regional_penalties()` adicionada em `quality_evaluator.py`
- [x] `evaluate()` chama `_compute_regional_penalties(flags, lighting_asymmetry_delta)` e retorna resultado
- [x] `regional_penalties` no response de `/vision/landmarks` tem valores não-zero quando relevante
- [x] `_confidence()` em `metric_calculator.py` aceita `regional_penalties` e aplica desconto
- [x] `compute_metrics()` passa `quality_context["regional_penalties"]` para `_confidence()`
- [x] `confidence` final sempre em [0.0, 1.0]
- [x] Smoke tests passando
