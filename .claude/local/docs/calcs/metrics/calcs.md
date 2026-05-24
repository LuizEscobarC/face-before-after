---
tenant_id: "face-before-after"
project: "face-before-after"
module: "metrics/calcs"
file_path: ".claude/docs/calcs/metrics/calcs.md"
doc_type: "concept"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  > Audit em 2026-05-09. 8 calculadores principais auditados contra Farkas 1994, Naini 2011, Powell & Humphreys 1984, literatura cefalométrica clássica.
tags:
  - "calculations"
  - "metrics"
rag_keywords:
  - "calcs"
  - "docs"
  - "metrics"
related_modules: []
depends_on: []
used_by: []
---
# Métricas faciais — fórmulas auditadas

> Audit em 2026-05-09. 8 calculadores principais auditados contra Farkas 1994, Naini 2011, Powell & Humphreys 1984, literatura cefalométrica clássica.

### midline_deviation

formula = mean(|x_nasion|, |x_nose_tip|, |x_subnasale|, |x_menton|)
unit = ICU (intercanthal units)
file = backend/app/services/metrics/calculators/symmetry.py:108
confidence_raw saturation = 0.5 ICU
source = simétrica em torno da midline (Naini 2011 §2)

### chin_height_ratio

formula = (menton.y − lower_lip_bot.y) / (menton.y − subnasale.y)
unit = ratio (adimensional)
file = backend/app/services/metrics/calculators/jaw.py:309
guard = lower_third > 1e-9 → fallback 0.5 em segmentos coincidentes
source = Naini 2011 §3 (proporção do terço inferior)

### brow_height_left / brow_height_right

formula = eye_inner.y − brow_inner.y
unit = ICU
file = backend/app/services/metrics/calculators/brows.py:221 / :255
ideal = 0.35
source = Farkas 1994 (~11mm @ 32mm ICD → 0.34; adopted 0.35)

### brow_arch_peak_left

formula = (apex.x − inner.x) / (outer.x − inner.x)
        where apex = landmark with min y in the brow
unit = ratio
file = backend/app/services/metrics/calculators/brows.py:287
ideal = 0.67
source = Farkas / Romo 2006 (apex em 2/3 do eixo)
edge case = span degenerado → fallback 0.5

### jaw_width_ratio

formula = |left_gonion.x − right_gonion.x| / |left_zygomatic.x − right_zygomatic.x|
unit = ratio
file = backend/app/services/metrics/calculators/jaw.py:162
guard = bizygomatic > 1e-9
ideal = 0.80 (Farkas 1994: 128mm/102mm)
source = Farkas 1994

### gonial_angle_left / right

formula = acos((u·v) / (|u|·|v|))
        u = zygomatic → gonion
        v = gonion → menton
unit = degrees
file = backend/app/services/metrics/calculators/jaw.py:191
guard = nu > 1e-9 and nv > 1e-9 → fallback 125° em degenerate
clipping = cos_t clamped to [−1, 1] before acos (previne NaN)
ideal = 125°
source = Tweed/Steiner cephalometric (clássico)

### mandibular_plane_angle

formula = mean(atan2(|menton.y − gonion_l.y|, |menton.x − gonion_l.x|),
               atan2(|menton.y − gonion_r.y|, |menton.x − gonion_r.x|))
unit = degrees
file = backend/app/services/metrics/calculators/jaw.py:271
guard = dx > 1e-9 → fallback 90° em colinear-x
ideal = 27°
source = Steiner cephalometric
KNOWN GAP: atan2 não-normalizado para [0, 180°] — ver gaps.md
