# Heatmap renderer + Before/Ideal composer — round 2

> Audit em 2026-05-09. Foco: matemática numérica que pode falhar silenciosamente em casos de borda.

## ✅ heatmap_renderer.py — verificações OK

- **Colormaps em pure-numpy:** `_coolwarm_rgba` (5 anchors em [-1, +1], linhas 327-334) e `_adherence_rgba` (3 anchors em [0, 1], linhas 344-349). Interpolação linear entre stops (linha 369). Anchors cobrem o range completo declarado.
- **`fill_value=np.nan` em griddata** (linhas 297-303): extrapolação fora do convex hull mapeia para NaN → transparente. Comportamento explícito.
- **Convex hull mask via ray-casting** (linhas 231-250): pixel center em `(x+0.5, y+0.5)`, modulo `(i+1) % n` correto para fechar o polígono.
- **L1 density supression:** `grid_radius_px = LOCAL_DENSITY_RADIUS_ICU × icd_full_px × scale_mean` (linha 411-421) — conversão ICU→pixel correta com escala.
- **Mirror distance ICU:** `p_r_mirrored = [2.0 × x_axis − p_r[0], p_r[1]]` (linhas 510-513) — reflexão por midline correta (não negação simples de x).

## ⚠️ Runge phenomenon não tratado (médio)

**Arquivo:** `backend/app/vision/services/heatmap_renderer.py`
**Função:** `_interpolate_grid` chamada com `method='cubic'`
**Local:** linhas 297-303 + colormap mapping subsequente

`scipy.interpolate.griddata` com método `cubic` pode produzir **valores negativos** entre amostras (oscilação cúbica clássica de Runge), mesmo quando todas as amostras de input são positivas. O `fill_value=np.nan` cobre apenas extrapolação fora do convex hull — **não cobre oscilação interna**.

### Impacto por colormap

- **`coolwarm`** (asymmetry, range [-1, +1]): tolera negativos no input — anchor mais baixo é -1.0. Risco: zero.
- **`adherence_sequential`** (ideal_adherence, range [0, 1]): valor negativo cai **abaixo** do anchor mais baixo (0.0). O algoritmo de lookup (linha 369, `t = (safe[m] - v0) / denom`) com `safe[m] < 0` produz `t < 0` → extrapolação RGB indefinida.

### Por que não foi pego

Os 12 testes de `test_heatmap_renderer.py` cobrem:
- Anchors dos 2 colormaps ✓
- NaN → transparente ✓
- Perfect-face near-white ✓
- Perturbação aumenta redness ✓

**Nenhum** testa input com cluster denso de samples baixas onde cubic oscila. É um gap de cobertura.

### Fix sugerido (não aplicado)

Após `griddata`, antes do colormap:

```python
grid = np.clip(grid, lo, hi)   # lo=0.0, hi=1.0 para adherence; lo=-1.0, hi=1.0 para coolwarm
```

Custo: 1 linha por renderer. Side effect: zero — clip de NaN preserva NaN (não muda fill_value behavior).

## ⚠️ Magnitude cap por componente ≠ por norma euclidiana (médio)

**Arquivo:** `backend/app/vision/services/before_ideal_composer.py`
**Função:** `_clip_offset` (linhas 207-212)

Implementação atual:

```python
def _clip_offset(value):
    return max(-_OFFSET_CAP_ICU, min(_OFFSET_CAP_ICU, value))
# aplicada separadamente em dx_icu e dy_icu
```

A spec do PLAN_M3_OVERLAYS DEC-26 diz "magnitude cap ±0.3 ICU". Lido naturalmente, "magnitude" = norma euclidiana √(dx² + dy²). A implementação caps **por eixo**, então um offset (0.3, 0.3) ICU passa íntegro mesmo tendo norma 0.424 (> 0.3 da spec).

### Impacto observado

Em condições normais, calculadores Python (PR-34) emitem vetores em geral apenas em UM eixo (`vec_x` para midline_deviation, `vec_y` para chin_height/brow_height). A diagonal `(0.3, 0.3)` é rara na prática.

Em PR-22 (50 fotos reais), pode aparecer em casos atípicos (rosto com assimetria múltipla). Resultado prático: composição before/ideal mostra wireframe-alvo um pouco "exagerado" em casos diagonais — cosmético, não corrompe dado.

### Decisão recomendada

Duas opções, ambas válidas:

(a) **Atualizar spec** para "per-axis cap of ±0.3 ICU" — código atual já cumpre, sem mudança.

(b) **Mudar para norma euclidiana:**
```python
norm = math.hypot(dx, dy)
if norm > _OFFSET_CAP_ICU:
    scale = _OFFSET_CAP_ICU / norm
    dx, dy = dx * scale, dy * scale
```

A escolha é editorial — qual interpretação da spec faz mais sentido para a equipe. Não é bug, é ambiguidade resolvível.

## ✅ before_ideal_composer.py — verificações OK

- **Left pane byte-identical:** `canvas.paste(base, (0, 0))` (linhas 405-406) garante. Teste explícito (linhas 74-81): `np.array_equal(left, src_arr)`.
- **ICD degenerate guard:** `if icd_px < MIN_ICD_PX (=1.0): raise BeforeIdealComposeError` (linhas 387-394).
- **ICD = 0 silencioso?** Se ICD escapasse o guard (não escapa, mas hipoteticamente), `_apply_offsets` multiplica offsets por 0 — resultado seria deslocamento (0,0) nos landmarks. Não corrompe imagem, só vira no-op. Aceitável.
