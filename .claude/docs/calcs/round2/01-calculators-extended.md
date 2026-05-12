# Calculadores estendidos — round 2

> Audit em 2026-05-09. Cobre as ~58 calculadoras NÃO vistas na round 1 (eyes, nose, mouth, thirds, fifths, cheekbones, forehead, global_shape, phi, brows não-auditadas, jaw não-auditadas).

## ✅ Famílias inteiramente limpas

Sem achados — guards apropriados, ICU consistente, sem `acos`/`atan2` problemáticos:

- `eyes/*` (6 calculadores)
- `nose/*` (7 calculadores)
- `mouth/*` (7 calculadores)
- `thirds/*` (4 calculadores)
- `fifths/*` (6 calculadores)
- `phi_golden/*` (4 calculadores presentation_only) — **defensivo**: divisão com guard, fallback para `_null_mv` (value=None, confidence=0), nunca mascara degenerate como rosto válido
- `brows/*` (calculadores não-auditados na round 1) — `_brow_arch_fraction` cai pra 0.5 em span degenerado, valor neutro que não engana
- `jaw/*` (calculadores não-auditados na round 1) — `_angle_at_vertex_deg` (jaw.py:118) clipa `cos_t ∈ [-1, 1]` antes de `acos` (proteção perfeita contra NaN). `mandibular_plane_angle` mantém o gap conhecido da round 1.

## ⚠️ Padrão "fallback 0.0 com confiança moderada" (5 ocorrências)

Esse é o achado dominante da round 2. Padrão repetido:

```python
v = numerator / denominator if denominator > 1e-9 else 0.0
confidence_raw = _conf_raw(v, ideal, tol)
```

Quando o denominador colapsa (landmark mal-detectado, foto borrada, oclusão), o calculador devolve `value=0.0`. A `_conf_raw(0.0, ideal, tol)` calcula confiança baseada na distância de 0.0 ao ideal — e 0.0 está suficientemente longe do ideal para a confiança cair, mas **não a zero**. Resultado: métrica reporta "rosto com proporção zero, com confiança 0.7-0.95".

Isso é semanticamente errado porque:

1. O valor "0.0" foi inventado pelo fallback, não medido.
2. A confiança alta sobrevive os gates DEC-7 (≥0.4 para exibir métrica) e DEC-8 (≥0.5 para entrar no score regional).
3. Overlay e score são exibidos como se a região tivesse sido medida com sucesso.
4. PR-22 (calibração com 50 fotos reais) vai expor isso — fotos com hairline cortado, ângulo ruim ou oclusão lateral disparam o branch `else 0.0`.

| arquivo:linha | metric_id | conf_raw resultante | ideal |
|---|---|---|---|
| `backend/app/services/metrics/calculators/forehead.py:181` | `forehead_width_ratio` | 0.767 | 0.70 |
| `backend/app/services/metrics/calculators/forehead.py:216` | `temporal_width_ratio` | 0.75 | — |
| `backend/app/services/metrics/calculators/cheekbones.py:204` | `malar_projection_index` | 0.733 | 1.33 |
| `backend/app/services/metrics/calculators/cheekbones.py:269` | `cheekbone_to_jaw_ratio` | ~0.94 | 1.25 |
| `backend/app/services/metrics/calculators/global_shape.py:224` | `face_height_to_width_ratio` | 0.8 | 1.35 |

## Padrão de fix sugerido (não aplicado nesta iteração)

`phi_golden.py` já implementa a forma correta — usar como referência:

```python
if face_height <= 0.0:
    return _null_mv(...)   # value=None, confidence=0
```

Os 5 calculadores acima deveriam seguir o mesmo padrão. Custo: ~5 linhas por calculador. Risco: zero em testes existentes (suite atual não testa o branch degenerate dessas razões — confirmar com cobertura antes de fixar).

## Confirmações secundárias

- **`presentation_only=true`** (não devem produzir score): `face_shape_classification` (global_shape.py:266), `phi_*` (4 métricas em phi_golden.py), `brow_thickness_l/r` (brows.py:358/387). Todos respeitam DEC-6.
- **`requires_pixel_analysis=true`** (stubs DEC-10): `hairline_curvature_index` (forehead.py:252), `e_line_deviation` (global_shape.py:355). Ambos retornam `direction="not_computed"` ou `"stub_requires_depth_data"` com confiança zero.
- **Nenhum `atan2` adicional não-normalizado** além de `mandibular_plane_angle`.
- **Nenhuma inconsistência ICU↔pixel** detectada.
