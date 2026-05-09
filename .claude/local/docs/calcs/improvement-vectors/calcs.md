# Improvement vectors — sinal, cap e conversão auditados

> Audit em 2026-05-09. 4 calculadores Python + frontend OverlayLayer.tsx (sub-componente ImprovementVectors).

### convention

unit = ICU (normalised intercanthal units)
cap = ±0.3 ICU (em cada eixo, antes de qualquer escala visual)
direction = "DA posição atual PARA o ideal" — um landmark deslocado para a direita produz vec_x negativo
coords = imagem (y cresce para baixo) — vec_y negativo = "subir na imagem"
pixel_conversion = vec_x_px = vec_x × icd_px, vec_y_px = vec_y × icd_px
                   onde icd_px = distância euclidiana em pixels entre inner canthi
                   (frontend: OverlayLayer.tsx:247)

### midline_deviation → vec_x

formula = vec_x = clip(−mean_signed_x, −0.3, +0.3)
        where mean_signed_x = mean(x_nasion, x_nose_tip, x_subnasale, x_menton) em ICU, signed
file = backend/app/services/metrics/calculators/symmetry.py:139
anchor (frontend) = P_NOSE_TIP = 1 (MediaPipe Mesh-478)
sign correctness = midline para a direita (mean_signed_x > 0) → vec_x < 0 → seta puxa de volta ✓

### chin_height_ratio → vec_y

formula = vec_y = clip(−(value − ideal) × 0.8, −0.3, +0.3)
        where ideal = 0.5
unit = ICU (escala 0.8 reduz magnitude antes do cap)
file = backend/app/services/metrics/calculators/jaw.py:335
anchor (frontend) = P_MENTON = 152
sign correctness = queixo mais comprido que ideal (value > ideal) → vec_y < 0 → seta sobe ✓

### brow_height_left → vec_y

formula = vec_y = clip(−(value − ideal), −0.3, +0.3)
        where ideal = 0.35
file = backend/app/services/metrics/calculators/brows.py:241
anchor (frontend) = P_BROW_LEFT_INNER = 107
sign correctness = brow alto demais (value > ideal) → vec_y < 0 → desce ✓

### brow_height_right → vec_y

formula = vec_y = clip(−(value − ideal), −0.3, +0.3)
        where ideal = 0.35
file = backend/app/services/metrics/calculators/brows.py:273
anchor (frontend) = P_BROW_RIGHT_INNER = 336
sign correctness = idêntico ao left ✓

### color mapping (severity → arrow color)

mild     = #22c55e (green)
moderate = #eab308 (amber)
strong   = #f97316 (orange)
extreme  = #ef4444 (red)
file = frontend/src/components/OverlayLayer.tsx (ImprovementVectors)
z-order = 40 (renderizado por último no SVG, acima de eixos/grids/contornos — DEC-25)
