Já consigo ver o problema. Vou ler o JSON de métricas e o código dos overlays para entender os cálculos.
find /home/luizescobal/study/face-before-after/frontend/src -name "*.tsx" -o -name "*.ts" | xargs grep -l "third\|fifth\|terço\|quinto\|overlay\|Overlay" 2>/dev/null | head -10

find /home/luizescobal/study/face-before-after/frontend/src -name "*.tsx" -o -name "*.ts" | xargs grep -l "third\|fifth\|terço\|quinto\|overlay\|Overlay" 2>/dev/null | head -10

Agora vou criar um script de debug visual que gera a imagem com os overlays corretos e os incorretos para comparar lado a lado.

python3 -c "import json; d=json.load(open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json')); lm=d.get('landmarks_mesh') or d.get('landmarks'); print(type(lm), len(lm) if lm else 'NOT FOUND'); print(list(d.keys())[:20])"

Já identifico o problema central dos terços. Vou agora gerar a imagem de debug visual completa.





python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
out = img.copy()
h, w = img.shape[:2]

crown    = lm(10)
menton   = lm(152)
brow_l   = lm(107)
brow_r   = lm(336)
subnasale = lm(2)
zygo_l   = lm(234)
zygo_r   = lm(454)
eye_ol   = lm(33)
eye_or   = lm(263)
eye_il   = lm(133)
eye_ir   = lm(362)

face_h = menton[1] - crown[1]
y_brow = (brow_l[1] + brow_r[1]) // 2
y_sub  = subnasale[1]

# THIRDS
# Ideal (dashed) — 1/3 and 2/3 of face_h from crown
y_t1_ideal = crown[1] + face_h // 3
y_t2_ideal = crown[1] + 2 * face_h // 3

# Actual landmark lines
cv2.line(out, (0, y_brow), (w, y_brow), (0, 165, 255), 2)   # orange = real brow
cv2.line(out, (0, y_sub),  (w, y_sub),  (0, 165, 255), 2)   # orange = real subnasale
# Ideal
cv2.line(out, (0, y_t1_ideal), (w, y_t1_ideal), (180, 180, 255), 1)  # dashed sim = purple
cv2.line(out, (0, y_t2_ideal), (w, y_t2_ideal), (180, 180, 255), 1)
# Crown and menton
cv2.line(out, (0, crown[1]),  (w, crown[1]),  (255, 255, 255), 1)
cv2.line(out, (0, menton[1]), (w, menton[1]), (255, 255, 255), 1)

# Labels
def put_label(img, text, x, y, color=(255,255,255)):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0,0,0), 4)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 1)

upper_pct  = (y_brow - crown[1]) / face_h * 100
middle_pct = (y_sub  - y_brow)   / face_h * 100
lower_pct  = (menton[1] - y_sub) / face_h * 100

put_label(out, f"UPPER: {upper_pct:.1f}% (ideal 33.3%)",  w-260, crown[1] + (y_brow - crown[1])//2, (0,200,255))
put_label(out, f"MID:   {middle_pct:.1f}% (ideal 33.3%)", w-260, y_brow + (y_sub - y_brow)//2,      (0,200,255))
put_label(out, f"LOWER: {lower_pct:.1f}% (ideal 33.3%)",  w-260, y_sub  + (menton[1] - y_sub)//2,   (0,200,255))

# Mark key landmarks
for pt, label in [(crown,'Crown'), (menton,'Menton'), (brow_l,'BrowL'), (brow_r,'BrowR'), (subnasale,'Subnasale')]:
    cv2.circle(out, pt, 5, (0, 255, 0), -1)
    put_label(out, label, pt[0]+6, pt[1]-6, (0,255,0))

# FIFTHS — vertical lines
face_w = zygo_r[0] - zygo_l[0]
fifth  = face_w / 5

for i in [1,2,3,4]:
    xi = int(zygo_l[0] + i * fifth)
    cv2.line(out, (xi, crown[1]), (xi, menton[1]), (180, 180, 255), 1)

for x, label in [(eye_ol[0],'OL'), (eye_il[0],'IL'), (eye_ir[0],'IR'), (eye_or[0],'OR')]:
    cv2.line(out, (x, crown[1]), (x, menton[1]), (0, 165, 255), 1)

# Zygo bounds
cv2.line(out, (zygo_l[0], crown[1]), (zygo_l[0], menton[1]), (255, 255, 255), 1)
cv2.line(out, (zygo_r[0], crown[1]), (zygo_r[0], menton[1]), (255, 255, 255), 1)

cv2.imwrite('/tmp/debug_overlay.jpg', out)
print("Saved /tmp/debug_overlay.jpg")
EOF


debug_overlay.jpg


Diagnóstico — Overlays errados de Terços e Quintos
Problema 1 — Terços: P_FOREHEAD_CROWN = 10 é errado
O landmark 10 (MediaPipe) está sendo usado como "hairline" mas ele aponta para o meio da testa — não para o topo real da face na foto. Veja na imagem: o ponto Crown está no meio da testa, não no hairline superior.

Resultado: o terço superior fica artificialmente curto (20.1%) porque começa no meio da testa ao invés do topo da cabeça/hairline real.

Fix correto: O landmark 10 no MediaPipe Mesh-478 é forehead_center, que está bem abaixo do hairline. Para hairline real, o ponto mais próximo disponível é o topo do bounding box da face ou usar landmark 151 (forehead_top) que é mais alto. Mas a raiz do problema é conceitual: os terços faciais clássicos (Farkas 1994) são medidos de trichion (hairline) ao menton, e o MediaPipe não tem um ponto de hairline confiável — ele vai até a testa mas não acompanha o cabelo.

Problema 2 — Quintos: os landmarks estão corretos mas a amplitude facial é subestimada
Os quintos estão usando P_ZYGO_IMG_LEFT = 234 e P_ZYGO_IMG_RIGHT = 454 como bordas da face, mas esses são pontos na bochecha/arco zigomático, não nas extremidades reais horizontais da cabeça. A largura real da cabeça inclui as orelhas. Isso faz os quintos parecerem mais comprimidos.

Vou ler o contexto canônico antes de tocar no código.

Read [](file:///home/luizescobal/study/face-before-after/.claude/face-analysis/00-index.md)

Read [](file:///home/luizescobal/study/face-before-after/.claude/face-analysis/08-svg-overlays.md)

A doc diz que os bugs foram "corrigidos", mas minha análise visual agora mostra que os terços ainda estão errados. Vou verificar o estado real do código e entender o problema raiz de ponta a ponta.

Ran terminal command: python3 - <<'EOF'
import json
with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

lm = data['landmarks']

# Todos os pontos relevantes
crown = lm[10]
menton = lm[152]
brow_l = lm[107]
brow_r = lm[336]
subnasale = lm[2]
zygo_l = lm[234]
zygo_r = lm[454]

print(f"Image crop: {data['auto_crop']['crop_bbox']}")
print(f"Image (canonical) size: 847x1155 (da imagem lida)")
print()
print(f"lm[10] (crown/forehead_center): y={crown[1]:.0f}")
print(f"lm[151] (forehead_top):         y={lm[151][1]:.0f}")
print(f"lm[10] is far from top of head - real hairline should be ~y=0 area")
print()

# What percentage of the image height is crown at?
img_h = 1155  # from the image
print(f"Crown lm[10] at y={crown[1]:.0f} = {crown[1]/img_h*100:.1f}% from top of image")
print(f"This means lm[10] is NOT at the top of the head")
print()

# What does the metric say?
face_h = menton[1] - crown[1]
y_brow = (brow_l[1] + brow_r[1]) / 2
y_sub = subnasale[1]
print(f"Face height (crown→menton): {face_h:.0f}px")
print(f"Upper: {(y_brow-crown[1])/face_h*100:.1f}%  Mid: {(y_sub-y_brow)/face_h*100:.1f}%  Lower: {(menton[1]-y_sub)/face_h*100:.1f}%")
print()

# Check if backend metric_evaluations exist in JSON
blocks = data.get('measurements_blocks', {})
print("measurements_blocks keys:", list(blocks.keys())[:5])

# Check if metric data has third ratios
metric_evals = data.get('metric_evaluations', [])
print(f"metric_evaluations count: {len(metric_evals)}")
if metric_evals:
    for m in metric_evals:
        if 'third' in m.get('metric_id',''):
            print(m)
EOF


Ran terminal command: grep -n "upper_third\|lower_third\|middle_third\|FOREHEAD\|P_FOREHEAD\|landmark.*10\b" /home/luizescobal/study/face-before-after/backend/app/services/metrics/thirds.py | head -40

Ran terminal command: cat /home/luizescobal/study/face-before-after/backend/app/services/metrics/thirds.py

Agora tenho o quadro completo. Vou verificar o que o `P_FOREHEAD_CROWN=10` realmente é no MediaPipe, e entender o problema dos quintos também.

Ran terminal command: grep -n "P_FOREHEAD_CROWN\|P_MENTON\|P_BROW\|P_SUBNASALE\|= 10\b\|= 152\b" /home/luizescobal/study/face-before-after/backend/app/domain/landmarks_mesh.py | head -30

Ran terminal command: python3 - <<'EOF'
import json
with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)
lm = data['landmarks']

# Scan the top Y coordinates in the mesh to understand what landmark 10 actually is
# vs what's actually at the top of the face
top_lms = sorted(enumerate(lm), key=lambda x: x[1][1])[:15]
print("Landmarks with lowest Y (top of image):")
for idx, (x,y) in top_lms:
    print(f"  lm[{idx}]: x={x:.0f}, y={y:.0f}")

print()
print(f"lm[10]: x={lm[10][0]:.0f}, y={lm[10][1]:.0f}")
print(f"lm[151]: x={lm[151][0]:.0f}, y={lm[151][1]:.0f}")
print(f"lm[9]: x={lm[9][0]:.0f}, y={lm[9][1]:.0f}")

# What about the fifths? Let's check what the frontend calculates
zygo_l = lm[234]
zygo_r = lm[454]
eye_ol = lm[33]
eye_or = lm[263]
eye_il = lm[133]
eye_ir = lm[362]

face_w = zygo_r[0] - zygo_l[0]
fifth  = face_w / 5

print(f"\n=== FIFTHS ANALYSIS ===")
print(f"Face width (234→454): {face_w:.0f}px")
print(f"Ideal fifth: {fifth:.1f}px")
print()
print(f"Ideal edges from zygo_l ({zygo_l[0]:.0f}):")
for i in [1,2,3,4]:
    print(f"  {i}/5 = x={zygo_l[0]+i*fifth:.0f}")

print()
print(f"Actual eye corners:")
print(f"  eye outer L (lm[33]):  x={eye_ol[0]:.0f} (ideal 1/5 = {zygo_l[0]+fifth:.0f}, delta={eye_ol[0]-(zygo_l[0]+fifth):.0f}px)")
print(f"  eye inner L (lm[133]): x={eye_il[0]:.0f} (ideal 2/5 = {zygo_l[0]+2*fifth:.0f}, delta={eye_il[0]-(zygo_l[0]+2*fifth):.0f}px)")
print(f"  eye inner R (lm[362]): x={eye_ir[0]:.0f} (ideal 3/5 = {zygo_l[0]+3*fifth:.0f}, delta={eye_ir[0]-(zygo_l[0]+3*fifth):.0f}px)")
print(f"  eye outer R (lm[263]): x={eye_or[0]:.0f} (ideal 4/5 = {zygo_l[0]+4*fifth:.0f}, delta={eye_or[0]-(zygo_l[0]+4*fifth):.0f}px)")
EOF


Agora tenho o diagnóstico completo e definitivo. Vou fazer os fixes.

**Diagnóstico real:**

1. **Terços — o problema é duplo:** `lm[10]` é realmente o ponto mais alto do mesh (y=261), mas está em y=22.6% da imagem — existe cabeça/cabelo acima. O cálculo de métrica usa `lm[10]→menton` que dá upper=20%. **Isso está matematicamente correto dado que o MediaPipe não detecta acima do hairline** — o problema é que o overlay visual desenha a linha do "ideal" em `yTop + faceH/3` mas as linhas laranja "reais" mostram brow/subnasale que batem com os 20%/40% corretos. O overlay está correto mas **confuso visualmente** — a legenda T1/T2/T3 mostra os percentuais reais da face detectada, não da "face ideal".

2. **Quintos — funcionam bem:** deltas máximos de 13px (2% da largura) são aceitáveis, o overlay dual (tracejado ideal + laranja real) está correto.

O verdadeiro bug visual é: **o overlay de terços desenhando as linhas dashed "ideais" em posições absolutas (yTop + faceH/3) faz parecer que a face está errada quando o problema é que lm[10] não é o hairline real**. Preciso verificar o `GridThirds` mais cuidadosamente:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

# Simulate exactly what GridThirds does
P_FOREHEAD_CROWN = 10
P_BROW_LEFT_INNER = 107
P_BROW_RIGHT_INNER = 336
P_SUBNASALE = 2
P_MENTON = 152
P_ZYGO_IMG_RIGHT = 454
P_ZYGO_IMG_LEFT = 234

crown = lm(P_FOREHEAD_CROWN)
menton = lm(P_MENTON)
brow_l = lm(P_BROW_LEFT_INNER)
brow_r = lm(P_BROW_RIGHT_INNER)
zygo_r = lm(P_ZYGO_IMG_RIGHT)
zygo_l = lm(P_ZYGO_IMG_LEFT)
subnasale = lm(P_SUBNASALE)

yTop  = crown[1]
yBrow = (brow_l[1] + brow_r[1]) // 2
ySub  = subnasale[1]
yMen  = menton[1]

faceH = yMen - yTop
yT1   = yTop + faceH // 3   # ideal 1/3 line (dashed purple)
yT2   = yTop + 2 * faceH // 3  # ideal 2/3 line (dashed purple)

print("=== GridThirds exact simulation ===")
print(f"yTop={yTop} (lm[10] forehead crown)")
print(f"yBrow={yBrow} (brow inner midpoint) — laranja sólido")
print(f"ySub={ySub}  (subnasale) — laranja sólido")
print(f"yMen={yMen}  (menton)")
print(f"faceH={faceH}px")
print()
print(f"Ideal dashed lines: yT1={yT1} yT2={yT2}")
print(f"Real orange lines:  yBrow={yBrow} ySub={ySub}")
print()
print(f"Delta yBrow vs yT1: {yBrow - yT1}px (negative = brow ABOVE ideal 1/3)")
print(f"Delta ySub  vs yT2: {ySub  - yT2}px")
print()

# Labels - what does GridThirds render?
# The metric values from backend:
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}
upper_val  = metric_evals['upper_third_ratio']['value']
middle_val = metric_evals['middle_third_ratio']['value']
lower_val  = metric_evals['lower_third_ratio']['value']

print(f"Label rendered (from backend metric values):")
print(f"  T1: {upper_val*100:.0f}% (vs ideal 33%)")
print(f"  T2: {middle_val*100:.0f}% (vs ideal 33%)")
print(f"  T3: {lower_val*100:.0f}% (vs ideal 33%)")
print()
print("VERDICT:")
print("- lm[10] at y=261 is the HIGHEST point of MediaPipe mesh")
print("- Hair above it (~y=0..261) is NOT detected by MediaPipe")
print("- So upper_third=20% is REAL — Brad Pitt has high hairline / small upper third")
print("  within the DETECTED face region")
print()
print("The VISUAL problem is that the dashed 'ideal' lines sit at yTop+faceH/3,")
print("which looks correct, but the labels show 20%/40%/40% making it look wrong.")
print()
print("Actually the real issue: if lm[10] is the highest mesh point,")
print("the brow line at yBrow falls only 20% into the detected face — which IS correct")
print("for Brad Pitt who has a larger-than-ideal forehead relative to the 3 equal thirds.")
print("Wait — 20% upper means SHORT upper third (brow close to hairline), not long forehead.")
print()
print(f"Upper: {upper_val*100:.1f}% SHORT = brow is HIGH = forehead is SHORT relative to face")
EOF


Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

# Generate definitive visual: side-by-side comparison
# LEFT: what the current overlay draws
# RIGHT: what it SHOULD draw

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]

crown = lm(10)
menton = lm(152)
brow_l = lm(107)
brow_r = lm(336)
sub = lm(2)
zygo_l = lm(234)
zygo_r = lm(454)
eye_ol = lm(33)
eye_or = lm(263)
eye_il = lm(133)
eye_ir = lm(362)

yTop = crown[1]
yBrow = (brow_l[1] + brow_r[1]) // 2
ySub = sub[1]
yMen = menton[1]
faceH = yMen - yTop
yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

xFaceL = zygo_l[0]
xFaceR = zygo_r[0]
faceW = xFaceR - xFaceL
fifth = faceW / 5

def put_label(img, text, x, y, color=(255,255,255), scale=0.45):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

# =============================================================================
# LEFT panel: current overlay behavior
# =============================================================================
left = img.copy()

# FaceExtents box
cv2.rectangle(left, (xFaceL, yTop), (xFaceR, yMen), (255,255,255), 1)

# Thirds: ideal dashed (purple) and real orange
cv2.line(left, (0, yT1_ideal), (w, yT1_ideal), (180,130,255), 1)
cv2.line(left, (0, yT2_ideal), (w, yT2_ideal), (180,130,255), 1)
cv2.line(left, (0, yBrow),     (w, yBrow),     (0,165,255), 2)
cv2.line(left, (0, ySub),      (w, ySub),      (0,165,255), 2)

# Fifths: ideal dashed + actual orange
for i in [1,2,3,4]:
    xi = int(xFaceL + i * fifth)
    cv2.line(left, (xi, yTop), (xi, yMen), (180,130,255), 1)
for x in [eye_ol[0], eye_il[0], eye_ir[0], eye_or[0]]:
    cv2.line(left, (x, yTop), (x, yMen), (0,165,255), 1)

put_label(left, "ATUAL", 10, 30, (0,200,255), 0.7)
put_label(left, f"T1 {(yBrow-yTop)/faceH*100:.0f}%", xFaceR+5, yTop+(yBrow-yTop)//2, (0,165,255))
put_label(left, f"T2 {(ySub-yBrow)/faceH*100:.0f}%",  xFaceR+5, yBrow+(ySub-yBrow)//2, (0,165,255))
put_label(left, f"T3 {(yMen-ySub)/faceH*100:.0f}%",   xFaceR+5, ySub+(yMen-ySub)//2,  (0,165,255))

# =============================================================================
# RIGHT panel: correct overlay
# Problema raiz: lm[10] é o ponto mais alto do mesh, que está em y=261
# (23% da imagem), mas a testa real começa em ~y=0.
# O GridThirds usa yTop=lm[10] e depois traça o "ideal" como yTop+faceH/3.
# Mas as métricas (upper=20%) são calculadas com o MESMO lm[10].
# Então os terços são consistentes internamente — o visual não está "errado",
# mas a interpretação da linha laranja T1/yBrow indica que o rosto tem
# terço superior CURTO (brow alta), o que é correto para Brad Pitt.
#
# O REAL bug visual é que a linha "ideal dashed" de T1 cai em yT1=549 (64%),
# muito abaixo do brow real (y=435), mostrando um gap enorme que assusta o usuário.
# A legenda clarifica (20% vs 33%), mas visualmente parece que o overlay está quebrado.
#
# FIX: mostrar claramente nos labels O QUE CADA LINHA É.
# =============================================================================
right = img.copy()

cv2.rectangle(right, (xFaceL, yTop), (xFaceR, yMen), (255,255,255), 1)

# Ideal thirds (dashed)
for y, label in [(yT1_ideal, "ideal 1/3"), (yT2_ideal, "ideal 2/3")]:
    cv2.line(right, (0, y), (w, y), (180,130,255), 1)
    put_label(right, label, 5, y-4, (180,130,255))

# Real landmark lines (orange solid) with clear labels
cv2.line(right, (0, yBrow), (w, yBrow), (0,165,255), 2)
put_label(right, f"SOBRANCELHA (real T1={( yBrow-yTop)/faceH*100:.0f}%)", 5, yBrow-6, (0,165,255))
cv2.line(right, (0, ySub), (w, ySub), (0,165,255), 2)
put_label(right, f"SUBNASALE (real T2-end={( ySub-yTop)/faceH*100:.0f}%)", 5, ySub-6, (0,165,255))

# lm[10] and menton markers
cv2.line(right, (0, yTop), (w, yTop), (255,255,255), 1)
put_label(right, f"lm[10] hairline proxy (y={yTop})", 5, yTop+14, (255,255,255))
cv2.line(right, (0, yMen), (w, yMen), (255,255,255), 1)

# Fifths 
for i in [1,2,3,4]:
    xi = int(xFaceL + i * fifth)
    cv2.line(right, (xi, yTop), (xi, yMen), (180,130,255), 1)
for x, label in [(eye_ol[0],'OL'), (eye_il[0],'IL'), (eye_ir[0],'IR'), (eye_or[0],'OR')]:
    cv2.line(right, (x, yTop), (x, yMen), (0,165,255), 1)

put_label(right, "CORRETO (mesmo calc, labels claros)", 10, 30, (0,255,0), 0.55)
put_label(right, f"T1={( yBrow-yTop)/faceH*100:.0f}% T2={(ySub-yBrow)/faceH*100:.0f}% T3={(yMen-ySub)/faceH*100:.0f}%", 10, 55, (0,200,255))

# Combine
combined = np.hstack([left, right])
cv2.line(combined, (w, 0), (w, h), (255,255,0), 2)
cv2.imwrite('/tmp/debug_comparison.jpg', combined)
print(f"Saved /tmp/debug_comparison.jpg ({combined.shape[1]}x{combined.shape[0]})")
EOF


Read [](file:///tmp/debug_comparison.jpg)

Agora tenho o diagnóstico visual definitivo. Os dois painéis mostram **o mesmo cálculo** — o problema não é nos números, é em **como o overlay comunica o que está desenhado**. Vou agora fazer uma análise crítica completa antes de implementar qualquer fix.

**Análise crítica real:**

O overlay `GridThirds` tem **dois problemas distintos**:

1. **Problema de semântica visual:** A linha dashed "ideal" (T1 = yTop + faceH/3) fica muito abaixo da sobrancelha real, criando um gap visual enorme que faz parecer que o sistema está quebrado. O usuário vê a sobrancelha laranja acima e a linha roxa "ideal" muito abaixo — isso **inverte a intuição**: parece que o "ideal" está mais pra baixo quando na verdade T1 curto (20%) significa sobrancelha ALTA.

2. **Problema de âncora do hairline:** `lm[10]` não é o hairline real — é o ponto mais alto do mesh, que está em y=261 (23% da imagem). Existe testa real acima. Isso faz o terço superior parecer menor do que é na realidade anatômica.

Agora vou implementar os fixes corretos:

Used tool: ToolSearch

Agora vou corrigir o `GridThirds`. O problema central: as linhas dashed roxas estão em `yTop + faceH/3` (posição "onde estaria o ideal") mas a **semântica está invertida** — a linha laranja ACIMA da dashed faz parecer que o overlay está errado, quando na verdade está correto. Preciso trocar a comunicação visual.

Read [](file:///home/luizescobal/study/face-before-after/frontend/src/components/OverlayLayer.tsx)

Agora tenho clareza total. Vou fazer os fixes:

**Fix 1 — `GridThirds`:** 
- As linhas dashed estão corretas mas as linhas "real" (laranja) precisam de label direto em cima delas, não só no label lateral. Hoje o label lateral diz "T1 20% (33%)" mas isso é confuso porque a linha laranja está ACIMA da dashed, fazendo parecer que o overlay errou.
- A correção: desenhar label diretamente nas linhas laranja indicando o que são, e mudar o label lateral para mostrar o **desvio** do ideal.

**Fix 2 — `GridFifths`:**
- Os quintos estão funcionando corretamente (desvios de ~13px). O label precisa mostrar o desvio por quinto.Agora fix do `GridFifths` — adicionar desvio por quinto e label nas linhas de borda:Agora verifico o `FaceExtents` — preciso confirmar que o bounding box usa os landmarks certos:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]

# FaceExtents usa: yTop=lm[10], yMenton=lm[152], xL=lm[234], xR=lm[454]
yTop   = lm(10)[1]
yMen   = lm(152)[1]
xL     = lm(234)[0]
xR     = lm(454)[0]

print(f"FaceExtents bounding box: x=[{xL},{xR}] y=[{yTop},{yMen}]")
print(f"Image dimensions: {w}x{h}")
print(f"Box width: {xR-xL}px ({(xR-xL)/w*100:.0f}% of image width)")
print(f"Box height: {yMen-yTop}px ({(yMen-yTop)/h*100:.0f}% of image height)")
print()

# Draw FaceExtents to verify visually
out = img.copy()
cv2.rectangle(out, (xL, yTop), (xR, yMen), (255,255,255), 2)
cv2.circle(out, lm(10),  6, (0,255,0), -1)
cv2.circle(out, lm(152), 6, (0,255,0), -1)
cv2.circle(out, lm(234), 6, (0,255,255), -1)
cv2.circle(out, lm(454), 6, (0,255,255), -1)

# Does the box visually contain the face?
# Check: are eye outer corners inside the box?
eol = lm(33)
eor = lm(263)
print(f"Eye outer L: x={eol[0]} (box xL={xL}) — inside: {eol[0] > xL}")
print(f"Eye outer R: x={eor[0]} (box xR={xR}) — inside: {eor[0] < xR}")
print()
# Is crown at the top of the face or inside hair?
print(f"lm[10] y={yTop} vs image top y=0")
print(f"Hair region above crown: {yTop}px ({yTop/h*100:.0f}% of img — NOT in bounding box)")

cv2.imwrite('/tmp/face_extents_check.jpg', out)
print("Saved /tmp/face_extents_check.jpg")
EOF


Read [](file:///tmp/face_extents_check.jpg)

Aqui está o segundo problema real: **o `FaceExtents` está errado visualmente**. O box branco:
- **Topo (yTop=lm[10]):** começa no meio da testa, cortando o hairline real
- **Laterais (lm[234]/lm[454]):** os pontos zigomáticos estão na linha dos olhos (y≈583), não nas extremidades mais largas da face — o box é mais estreito que a face visível

O `FaceExtents` deveria englobar o rosto visual real. Preciso corrigir os anchors laterais para usar os pontos mais extremos da bochecha ao invés dos zigomáticos médios, e o topo para usar o ponto mais alto disponível no mesh.

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm_raw = lambda i: (landmarks[i][0], landmarks[i][1])

# Find the leftmost and rightmost points in the face mesh
all_x = [(i, landmarks[i][0], landmarks[i][1]) for i in range(478)]
leftmost  = sorted(all_x, key=lambda t: t[1])[:5]
rightmost = sorted(all_x, key=lambda t: t[1], reverse=True)[:5]
topmost   = sorted(all_x, key=lambda t: t[2])[:5]

print("5 leftmost (smallest x):")
for i, x, y in leftmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

print("\n5 rightmost (largest x):")
for i, x, y in rightmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

print("\n5 topmost (smallest y):")
for i, x, y in topmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

# Current zygo points
print(f"\nCurrent lm[234] (zygo L): x={landmarks[234][0]:.0f}, y={landmarks[234][1]:.0f}")
print(f"Current lm[454] (zygo R): x={landmarks[454][0]:.0f}, y={landmarks[454][1]:.0f}")
print(f"Current lm[10]  (crown):  x={landmarks[10][0]:.0f}, y={landmarks[10][1]:.0f}")

# Check specific candidates for wider face boundary
for idx in [234, 127, 93, 132, 58, 172, 136, 150, 149, 176, 148]:
    print(f"  lm[{idx}]: x={landmarks[idx][0]:.0f}, y={landmarks[idx][1]:.0f}")
EOF


Os pontos laterais `lm[234]` e `lm[454]` já são os mais extremos do mesh (x=91 e x=799 numa imagem de 847px). O problema não é os pontos — é que a imagem tem margem lateral de background. O `FaceExtents` está correto matematicamente; o que parece "estreito" é porque a imagem tem bastante espaço nas laterais.

O problema real do `FaceExtents` é apenas **o topo** — `lm[10]` em y=261 corta 23% da imagem acima (hairline/cabelo). Para o `FaceExtents` ter sentido visual, o topo deveria ser o **topo da imagem ou o topo do crop detectado**, não `lm[10]`.

Mas isso é uma decisão de design: o box mostra "o rosto detectável pelo mesh" (correto para fins de análise) ou "a extensão visual da cabeça" (mais intuitivo para o usuário). A correção mais honesta é adicionar uma nota no label "Hairline (mesh)" para deixar claro que o top é o limite do MediaPipe, não o topo real da cabeça.

Read [](file:///home/luizescobal/study/face-before-after/frontend/src/components/OverlayLayer.tsx)

Agora verifico o TypeScript e depois gero a imagem de revisão crítica:

Ran terminal command: cd /home/luizescobal/study/face-before-after/frontend && npx tsc --noEmit 2>&1 | head -30

TypeScript limpo. Agora gero a imagem de revisão crítica simulando exatamente o que o novo código faz:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]
out = img.copy()

def txt(img, text, x, y, color, scale=0.38):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

# === FaceExtents ===
yTop  = lm(10)[1]
yMen  = lm(152)[1]
xL    = lm(234)[0]
xR    = lm(454)[0]
WHITE = (255,255,255)
cv2.rectangle(out, (xL, yTop), (xR, yMen), WHITE, 1)
txt(out, "Trichion (mesh)", xL+4, yTop-4, WHITE)
txt(out, "Menton",          xL+4, yMen+14, WHITE)

# === GridThirds ===
yBrow = (lm(107)[1] + lm(336)[1]) // 2
ySub  = lm(2)[1]
faceH = yMen - yTop

yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

PURPLE = (200,150,255)
ORANGE = (0,165,255)

# Ideal dashed
cv2.line(out, (0, yT1_ideal), (w, yT1_ideal), PURPLE, 1)
cv2.line(out, (0, yT2_ideal), (w, yT2_ideal), PURPLE, 1)
txt(out, "ideal 1/3", xL+4, yT1_ideal-3, PURPLE)
txt(out, "ideal 2/3", xL+4, yT2_ideal-3, PURPLE)

# Real landmark lines
cv2.line(out, (0, yBrow), (w, yBrow), ORANGE, 2)
txt(out, "Sobrancelha", xL+4, yBrow-3, ORANGE)
cv2.line(out, (0, ySub),  (w, ySub),  ORANGE, 2)
txt(out, "Subnasale",    xL+4, ySub-3,  ORANGE)

# Lateral labels with deviation
thirds = [
    (yTop, yBrow, "upper_third_ratio", "T1"),
    (yBrow, ySub,  "middle_third_ratio", "T2"),
    (ySub, yMen,   "lower_third_ratio", "T3"),
]
SEV_COLORS = {"ideal":(80,200,80), "mild":(80,200,80), "moderate":(50,200,220), "strong":(0,165,255), "extreme":(0,80,255)}
for yA, yB, mid, label in thirds:
    m = metric_evals.get(mid, {})
    pct = (m.get('value', (yB-yA)/faceH)) * 100
    sev = m.get('severity_5', None)
    color = SEV_COLORS.get(sev, (150,150,150))
    dev = pct - 33.3
    devStr = f"+{dev:.0f}" if dev >= 0 else f"{dev:.0f}"
    txt(out, f"{label} {pct:.0f}% ({devStr}%)", xR+6, int((yA+yB)/2+4), color, 0.42)

# === GridFifths ===
xFaceL = lm(234)[0]
xFaceR = lm(454)[0]
faceW  = xFaceR - xFaceL
fifth  = faceW / 5

actuals = [lm(33)[0], lm(133)[0], lm(362)[0], lm(263)[0]]
names   = ["OExt.E", "OInt.E", "OInt.D", "OExt.D"]
ideals  = [xFaceL + (i+1)*fifth for i in range(4)]

# Face edges
cv2.line(out, (xFaceL, yTop), (xFaceL, yMen), WHITE, 1)
cv2.line(out, (xFaceR, yTop), (xFaceR, yMen), WHITE, 1)

# Ideal fifths dashed
for xi in ideals:
    cv2.line(out, (int(xi), yTop), (int(xi), yMen), PURPLE, 1)

# Actual eye corners + deviation
yLabel = yMen - 14
for i, (x, name) in enumerate(zip(actuals, names)):
    cv2.line(out, (x, yTop), (x, yMen), ORANGE, 1)
    dev = int(round(x - ideals[i]))
    devStr = f"+{dev}" if dev > 0 else str(dev)
    txt(out, f"{name} {devStr}px", x+2, yLabel - i*12, ORANGE, 0.35)

txt(out, "Quintos - tracejado:ideal laranja:real (desvio px)", xFaceL+2, yTop-6, PURPLE, 0.35)

cv2.imwrite('/tmp/overlay_final_review.jpg', out)
print("Saved /tmp/overlay_final_review.jpg")
EOF


Ran terminal command: cd /home/luizescobal/study/face-before-after && python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]
out = img.copy()

def txt(img, text, x, y, color, scale=0.38):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

yTop  = lm(10)[1]
yMen  = lm(152)[1]
xL    = lm(234)[0]
xR    = lm(454)[0]
WHITE  = (255,255,255)
PURPLE = (200,150,255)
ORANGE = (0,165,255)

# FaceExtents
cv2.rectangle(out, (xL, yTop), (xR, yMen), WHITE, 1)
txt(out, "Trichion (mesh)", xL+4, yTop-4, WHITE)
txt(out, "Menton", xL+4, yMen+14, WHITE)

# GridThirds
yBrow = (lm(107)[1] + lm(336)[1]) // 2
ySub  = lm(2)[1]
faceH = yMen - yTop
yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

cv2.line(out, (0, yT1_ideal), (w, yT1_ideal), PURPLE, 1)
cv2.line(out, (0, yT2_ideal), (w, yT2_ideal), PURPLE, 1)
txt(out, "ideal 1/3", xL+4, yT1_ideal-3, PURPLE)
txt(out, "ideal 2/3", xL+4, yT2_ideal-3, PURPLE)

cv2.line(out, (0, yBrow), (w, yBrow), ORANGE, 2)
txt(out, "Sobrancelha", xL+4, yBrow-3, ORANGE)
cv2.line(out, (0, ySub), (w, ySub), ORANGE, 2)
txt(out, "Subnasale", xL+4, ySub-3, ORANGE)

SEV = {"ideal":(80,200,80),"mild":(80,200,80),"moderate":(50,200,220),"strong":(0,165,255),"extreme":(0,80,255)}
for yA, yB, mid, label in [(yTop,yBrow,"upper_third_ratio","T1"),(yBrow,ySub,"middle_third_ratio","T2"),(ySub,yMen,"lower_third_ratio","T3")]:
    m = metric_evals.get(mid, {})
    pct = m.get('value', (yB-yA)/faceH) * 100
    color = SEV.get(m.get('severity_5'), (150,150,150))
    dev = pct - 33.3
    txt(out, f"{label} {pct:.0f}% ({'+' if dev>=0 else ''}{dev:.0f}%)", xR+6, int((yA+yB)/2+4), color, 0.42)

# GridFifths
faceW = xR - xL
fifth = faceW / 5
actuals = [lm(33)[0], lm(133)[0], lm(362)[0], lm(263)[0]]
names   = ["OExt.E","OInt.E","OInt.D","OExt.D"]
ideals  = [xL + (i+1)*fifth for i in range(4)]

cv2.line(out, (xL, yTop), (xL, yMen), WHITE, 1)
cv2.line(out, (xR, yTop), (xR, yMen), WHITE, 1)
for xi in ideals:
    cv2.line(out, (int(xi), yTop), (int(xi), yMen), PURPLE, 1)

yLbl = yMen - 16
for i, (x, name) in enumerate(zip(actuals, names)):
    cv2.line(out, (x, yTop), (x, yMen), ORANGE, 1)
    dev = int(round(x - ideals[i]))
    txt(out, f"{name} {'+' if dev>0 else ''}{dev}px", x+2, yLbl - i*14, ORANGE, 0.35)

txt(out, "Quintos: tracejado=ideal, laranja=real", xL+2, yTop-6, PURPLE, 0.36)

cv2.imwrite('/tmp/overlay_final_review.jpg', out)
print(f"OK {w}x{h}")
EOF

Vou ler o contexto canônico antes de tocar no código.

Read [](file:///home/luizescobal/study/face-before-after/.claude/face-analysis/00-index.md)

Read [](file:///home/luizescobal/study/face-before-after/.claude/face-analysis/08-svg-overlays.md)

A doc diz que os bugs foram "corrigidos", mas minha análise visual agora mostra que os terços ainda estão errados. Vou verificar o estado real do código e entender o problema raiz de ponta a ponta.

Ran terminal command: python3 - <<'EOF'
import json
with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

lm = data['landmarks']

# Todos os pontos relevantes
crown = lm[10]
menton = lm[152]
brow_l = lm[107]
brow_r = lm[336]
subnasale = lm[2]
zygo_l = lm[234]
zygo_r = lm[454]

print(f"Image crop: {data['auto_crop']['crop_bbox']}")
print(f"Image (canonical) size: 847x1155 (da imagem lida)")
print()
print(f"lm[10] (crown/forehead_center): y={crown[1]:.0f}")
print(f"lm[151] (forehead_top):         y={lm[151][1]:.0f}")
print(f"lm[10] is far from top of head - real hairline should be ~y=0 area")
print()

# What percentage of the image height is crown at?
img_h = 1155  # from the image
print(f"Crown lm[10] at y={crown[1]:.0f} = {crown[1]/img_h*100:.1f}% from top of image")
print(f"This means lm[10] is NOT at the top of the head")
print()

# What does the metric say?
face_h = menton[1] - crown[1]
y_brow = (brow_l[1] + brow_r[1]) / 2
y_sub = subnasale[1]
print(f"Face height (crown→menton): {face_h:.0f}px")
print(f"Upper: {(y_brow-crown[1])/face_h*100:.1f}%  Mid: {(y_sub-y_brow)/face_h*100:.1f}%  Lower: {(menton[1]-y_sub)/face_h*100:.1f}%")
print()

# Check if backend metric_evaluations exist in JSON
blocks = data.get('measurements_blocks', {})
print("measurements_blocks keys:", list(blocks.keys())[:5])

# Check if metric data has third ratios
metric_evals = data.get('metric_evaluations', [])
print(f"metric_evaluations count: {len(metric_evals)}")
if metric_evals:
    for m in metric_evals:
        if 'third' in m.get('metric_id',''):
            print(m)
EOF


Ran terminal command: grep -n "upper_third\|lower_third\|middle_third\|FOREHEAD\|P_FOREHEAD\|landmark.*10\b" /home/luizescobal/study/face-before-after/backend/app/services/metrics/thirds.py | head -40

Ran terminal command: cat /home/luizescobal/study/face-before-after/backend/app/services/metrics/thirds.py

Agora tenho o quadro completo. Vou verificar o que o `P_FOREHEAD_CROWN=10` realmente é no MediaPipe, e entender o problema dos quintos também.

Ran terminal command: grep -n "P_FOREHEAD_CROWN\|P_MENTON\|P_BROW\|P_SUBNASALE\|= 10\b\|= 152\b" /home/luizescobal/study/face-before-after/backend/app/domain/landmarks_mesh.py | head -30

Ran terminal command: python3 - <<'EOF'
import json
with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)
lm = data['landmarks']

# Scan the top Y coordinates in the mesh to understand what landmark 10 actually is
# vs what's actually at the top of the face
top_lms = sorted(enumerate(lm), key=lambda x: x[1][1])[:15]
print("Landmarks with lowest Y (top of image):")
for idx, (x,y) in top_lms:
    print(f"  lm[{idx}]: x={x:.0f}, y={y:.0f}")

print()
print(f"lm[10]: x={lm[10][0]:.0f}, y={lm[10][1]:.0f}")
print(f"lm[151]: x={lm[151][0]:.0f}, y={lm[151][1]:.0f}")
print(f"lm[9]: x={lm[9][0]:.0f}, y={lm[9][1]:.0f}")

# What about the fifths? Let's check what the frontend calculates
zygo_l = lm[234]
zygo_r = lm[454]
eye_ol = lm[33]
eye_or = lm[263]
eye_il = lm[133]
eye_ir = lm[362]

face_w = zygo_r[0] - zygo_l[0]
fifth  = face_w / 5

print(f"\n=== FIFTHS ANALYSIS ===")
print(f"Face width (234→454): {face_w:.0f}px")
print(f"Ideal fifth: {fifth:.1f}px")
print()
print(f"Ideal edges from zygo_l ({zygo_l[0]:.0f}):")
for i in [1,2,3,4]:
    print(f"  {i}/5 = x={zygo_l[0]+i*fifth:.0f}")

print()
print(f"Actual eye corners:")
print(f"  eye outer L (lm[33]):  x={eye_ol[0]:.0f} (ideal 1/5 = {zygo_l[0]+fifth:.0f}, delta={eye_ol[0]-(zygo_l[0]+fifth):.0f}px)")
print(f"  eye inner L (lm[133]): x={eye_il[0]:.0f} (ideal 2/5 = {zygo_l[0]+2*fifth:.0f}, delta={eye_il[0]-(zygo_l[0]+2*fifth):.0f}px)")
print(f"  eye inner R (lm[362]): x={eye_ir[0]:.0f} (ideal 3/5 = {zygo_l[0]+3*fifth:.0f}, delta={eye_ir[0]-(zygo_l[0]+3*fifth):.0f}px)")
print(f"  eye outer R (lm[263]): x={eye_or[0]:.0f} (ideal 4/5 = {zygo_l[0]+4*fifth:.0f}, delta={eye_or[0]-(zygo_l[0]+4*fifth):.0f}px)")
EOF


Agora tenho o diagnóstico completo e definitivo. Vou fazer os fixes.

**Diagnóstico real:**

1. **Terços — o problema é duplo:** `lm[10]` é realmente o ponto mais alto do mesh (y=261), mas está em y=22.6% da imagem — existe cabeça/cabelo acima. O cálculo de métrica usa `lm[10]→menton` que dá upper=20%. **Isso está matematicamente correto dado que o MediaPipe não detecta acima do hairline** — o problema é que o overlay visual desenha a linha do "ideal" em `yTop + faceH/3` mas as linhas laranja "reais" mostram brow/subnasale que batem com os 20%/40% corretos. O overlay está correto mas **confuso visualmente** — a legenda T1/T2/T3 mostra os percentuais reais da face detectada, não da "face ideal".

2. **Quintos — funcionam bem:** deltas máximos de 13px (2% da largura) são aceitáveis, o overlay dual (tracejado ideal + laranja real) está correto.

O verdadeiro bug visual é: **o overlay de terços desenhando as linhas dashed "ideais" em posições absolutas (yTop + faceH/3) faz parecer que a face está errada quando o problema é que lm[10] não é o hairline real**. Preciso verificar o `GridThirds` mais cuidadosamente:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

# Simulate exactly what GridThirds does
P_FOREHEAD_CROWN = 10
P_BROW_LEFT_INNER = 107
P_BROW_RIGHT_INNER = 336
P_SUBNASALE = 2
P_MENTON = 152
P_ZYGO_IMG_RIGHT = 454
P_ZYGO_IMG_LEFT = 234

crown = lm(P_FOREHEAD_CROWN)
menton = lm(P_MENTON)
brow_l = lm(P_BROW_LEFT_INNER)
brow_r = lm(P_BROW_RIGHT_INNER)
zygo_r = lm(P_ZYGO_IMG_RIGHT)
zygo_l = lm(P_ZYGO_IMG_LEFT)
subnasale = lm(P_SUBNASALE)

yTop  = crown[1]
yBrow = (brow_l[1] + brow_r[1]) // 2
ySub  = subnasale[1]
yMen  = menton[1]

faceH = yMen - yTop
yT1   = yTop + faceH // 3   # ideal 1/3 line (dashed purple)
yT2   = yTop + 2 * faceH // 3  # ideal 2/3 line (dashed purple)

print("=== GridThirds exact simulation ===")
print(f"yTop={yTop} (lm[10] forehead crown)")
print(f"yBrow={yBrow} (brow inner midpoint) — laranja sólido")
print(f"ySub={ySub}  (subnasale) — laranja sólido")
print(f"yMen={yMen}  (menton)")
print(f"faceH={faceH}px")
print()
print(f"Ideal dashed lines: yT1={yT1} yT2={yT2}")
print(f"Real orange lines:  yBrow={yBrow} ySub={ySub}")
print()
print(f"Delta yBrow vs yT1: {yBrow - yT1}px (negative = brow ABOVE ideal 1/3)")
print(f"Delta ySub  vs yT2: {ySub  - yT2}px")
print()

# Labels - what does GridThirds render?
# The metric values from backend:
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}
upper_val  = metric_evals['upper_third_ratio']['value']
middle_val = metric_evals['middle_third_ratio']['value']
lower_val  = metric_evals['lower_third_ratio']['value']

print(f"Label rendered (from backend metric values):")
print(f"  T1: {upper_val*100:.0f}% (vs ideal 33%)")
print(f"  T2: {middle_val*100:.0f}% (vs ideal 33%)")
print(f"  T3: {lower_val*100:.0f}% (vs ideal 33%)")
print()
print("VERDICT:")
print("- lm[10] at y=261 is the HIGHEST point of MediaPipe mesh")
print("- Hair above it (~y=0..261) is NOT detected by MediaPipe")
print("- So upper_third=20% is REAL — Brad Pitt has high hairline / small upper third")
print("  within the DETECTED face region")
print()
print("The VISUAL problem is that the dashed 'ideal' lines sit at yTop+faceH/3,")
print("which looks correct, but the labels show 20%/40%/40% making it look wrong.")
print()
print("Actually the real issue: if lm[10] is the highest mesh point,")
print("the brow line at yBrow falls only 20% into the detected face — which IS correct")
print("for Brad Pitt who has a larger-than-ideal forehead relative to the 3 equal thirds.")
print("Wait — 20% upper means SHORT upper third (brow close to hairline), not long forehead.")
print()
print(f"Upper: {upper_val*100:.1f}% SHORT = brow is HIGH = forehead is SHORT relative to face")
EOF


Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

# Generate definitive visual: side-by-side comparison
# LEFT: what the current overlay draws
# RIGHT: what it SHOULD draw

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]

crown = lm(10)
menton = lm(152)
brow_l = lm(107)
brow_r = lm(336)
sub = lm(2)
zygo_l = lm(234)
zygo_r = lm(454)
eye_ol = lm(33)
eye_or = lm(263)
eye_il = lm(133)
eye_ir = lm(362)

yTop = crown[1]
yBrow = (brow_l[1] + brow_r[1]) // 2
ySub = sub[1]
yMen = menton[1]
faceH = yMen - yTop
yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

xFaceL = zygo_l[0]
xFaceR = zygo_r[0]
faceW = xFaceR - xFaceL
fifth = faceW / 5

def put_label(img, text, x, y, color=(255,255,255), scale=0.45):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

# =============================================================================
# LEFT panel: current overlay behavior
# =============================================================================
left = img.copy()

# FaceExtents box
cv2.rectangle(left, (xFaceL, yTop), (xFaceR, yMen), (255,255,255), 1)

# Thirds: ideal dashed (purple) and real orange
cv2.line(left, (0, yT1_ideal), (w, yT1_ideal), (180,130,255), 1)
cv2.line(left, (0, yT2_ideal), (w, yT2_ideal), (180,130,255), 1)
cv2.line(left, (0, yBrow),     (w, yBrow),     (0,165,255), 2)
cv2.line(left, (0, ySub),      (w, ySub),      (0,165,255), 2)

# Fifths: ideal dashed + actual orange
for i in [1,2,3,4]:
    xi = int(xFaceL + i * fifth)
    cv2.line(left, (xi, yTop), (xi, yMen), (180,130,255), 1)
for x in [eye_ol[0], eye_il[0], eye_ir[0], eye_or[0]]:
    cv2.line(left, (x, yTop), (x, yMen), (0,165,255), 1)

put_label(left, "ATUAL", 10, 30, (0,200,255), 0.7)
put_label(left, f"T1 {(yBrow-yTop)/faceH*100:.0f}%", xFaceR+5, yTop+(yBrow-yTop)//2, (0,165,255))
put_label(left, f"T2 {(ySub-yBrow)/faceH*100:.0f}%",  xFaceR+5, yBrow+(ySub-yBrow)//2, (0,165,255))
put_label(left, f"T3 {(yMen-ySub)/faceH*100:.0f}%",   xFaceR+5, ySub+(yMen-ySub)//2,  (0,165,255))

# =============================================================================
# RIGHT panel: correct overlay
# Problema raiz: lm[10] é o ponto mais alto do mesh, que está em y=261
# (23% da imagem), mas a testa real começa em ~y=0.
# O GridThirds usa yTop=lm[10] e depois traça o "ideal" como yTop+faceH/3.
# Mas as métricas (upper=20%) são calculadas com o MESMO lm[10].
# Então os terços são consistentes internamente — o visual não está "errado",
# mas a interpretação da linha laranja T1/yBrow indica que o rosto tem
# terço superior CURTO (brow alta), o que é correto para Brad Pitt.
#
# O REAL bug visual é que a linha "ideal dashed" de T1 cai em yT1=549 (64%),
# muito abaixo do brow real (y=435), mostrando um gap enorme que assusta o usuário.
# A legenda clarifica (20% vs 33%), mas visualmente parece que o overlay está quebrado.
#
# FIX: mostrar claramente nos labels O QUE CADA LINHA É.
# =============================================================================
right = img.copy()

cv2.rectangle(right, (xFaceL, yTop), (xFaceR, yMen), (255,255,255), 1)

# Ideal thirds (dashed)
for y, label in [(yT1_ideal, "ideal 1/3"), (yT2_ideal, "ideal 2/3")]:
    cv2.line(right, (0, y), (w, y), (180,130,255), 1)
    put_label(right, label, 5, y-4, (180,130,255))

# Real landmark lines (orange solid) with clear labels
cv2.line(right, (0, yBrow), (w, yBrow), (0,165,255), 2)
put_label(right, f"SOBRANCELHA (real T1={( yBrow-yTop)/faceH*100:.0f}%)", 5, yBrow-6, (0,165,255))
cv2.line(right, (0, ySub), (w, ySub), (0,165,255), 2)
put_label(right, f"SUBNASALE (real T2-end={( ySub-yTop)/faceH*100:.0f}%)", 5, ySub-6, (0,165,255))

# lm[10] and menton markers
cv2.line(right, (0, yTop), (w, yTop), (255,255,255), 1)
put_label(right, f"lm[10] hairline proxy (y={yTop})", 5, yTop+14, (255,255,255))
cv2.line(right, (0, yMen), (w, yMen), (255,255,255), 1)

# Fifths 
for i in [1,2,3,4]:
    xi = int(xFaceL + i * fifth)
    cv2.line(right, (xi, yTop), (xi, yMen), (180,130,255), 1)
for x, label in [(eye_ol[0],'OL'), (eye_il[0],'IL'), (eye_ir[0],'IR'), (eye_or[0],'OR')]:
    cv2.line(right, (x, yTop), (x, yMen), (0,165,255), 1)

put_label(right, "CORRETO (mesmo calc, labels claros)", 10, 30, (0,255,0), 0.55)
put_label(right, f"T1={( yBrow-yTop)/faceH*100:.0f}% T2={(ySub-yBrow)/faceH*100:.0f}% T3={(yMen-ySub)/faceH*100:.0f}%", 10, 55, (0,200,255))

# Combine
combined = np.hstack([left, right])
cv2.line(combined, (w, 0), (w, h), (255,255,0), 2)
cv2.imwrite('/tmp/debug_comparison.jpg', combined)
print(f"Saved /tmp/debug_comparison.jpg ({combined.shape[1]}x{combined.shape[0]})")
EOF


Read [](file:///tmp/debug_comparison.jpg)

Agora tenho o diagnóstico visual definitivo. Os dois painéis mostram **o mesmo cálculo** — o problema não é nos números, é em **como o overlay comunica o que está desenhado**. Vou agora fazer uma análise crítica completa antes de implementar qualquer fix.

**Análise crítica real:**

O overlay `GridThirds` tem **dois problemas distintos**:

1. **Problema de semântica visual:** A linha dashed "ideal" (T1 = yTop + faceH/3) fica muito abaixo da sobrancelha real, criando um gap visual enorme que faz parecer que o sistema está quebrado. O usuário vê a sobrancelha laranja acima e a linha roxa "ideal" muito abaixo — isso **inverte a intuição**: parece que o "ideal" está mais pra baixo quando na verdade T1 curto (20%) significa sobrancelha ALTA.

2. **Problema de âncora do hairline:** `lm[10]` não é o hairline real — é o ponto mais alto do mesh, que está em y=261 (23% da imagem). Existe testa real acima. Isso faz o terço superior parecer menor do que é na realidade anatômica.

Agora vou implementar os fixes corretos:

Used tool: ToolSearch

Agora vou corrigir o `GridThirds`. O problema central: as linhas dashed roxas estão em `yTop + faceH/3` (posição "onde estaria o ideal") mas a **semântica está invertida** — a linha laranja ACIMA da dashed faz parecer que o overlay está errado, quando na verdade está correto. Preciso trocar a comunicação visual.

Read [](file:///home/luizescobal/study/face-before-after/frontend/src/components/OverlayLayer.tsx)

Agora tenho clareza total. Vou fazer os fixes:

**Fix 1 — `GridThirds`:** 
- As linhas dashed estão corretas mas as linhas "real" (laranja) precisam de label direto em cima delas, não só no label lateral. Hoje o label lateral diz "T1 20% (33%)" mas isso é confuso porque a linha laranja está ACIMA da dashed, fazendo parecer que o overlay errou.
- A correção: desenhar label diretamente nas linhas laranja indicando o que são, e mudar o label lateral para mostrar o **desvio** do ideal.

**Fix 2 — `GridFifths`:**
- Os quintos estão funcionando corretamente (desvios de ~13px). O label precisa mostrar o desvio por quinto.Agora fix do `GridFifths` — adicionar desvio por quinto e label nas linhas de borda:Agora verifico o `FaceExtents` — preciso confirmar que o bounding box usa os landmarks certos:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]

# FaceExtents usa: yTop=lm[10], yMenton=lm[152], xL=lm[234], xR=lm[454]
yTop   = lm(10)[1]
yMen   = lm(152)[1]
xL     = lm(234)[0]
xR     = lm(454)[0]

print(f"FaceExtents bounding box: x=[{xL},{xR}] y=[{yTop},{yMen}]")
print(f"Image dimensions: {w}x{h}")
print(f"Box width: {xR-xL}px ({(xR-xL)/w*100:.0f}% of image width)")
print(f"Box height: {yMen-yTop}px ({(yMen-yTop)/h*100:.0f}% of image height)")
print()

# Draw FaceExtents to verify visually
out = img.copy()
cv2.rectangle(out, (xL, yTop), (xR, yMen), (255,255,255), 2)
cv2.circle(out, lm(10),  6, (0,255,0), -1)
cv2.circle(out, lm(152), 6, (0,255,0), -1)
cv2.circle(out, lm(234), 6, (0,255,255), -1)
cv2.circle(out, lm(454), 6, (0,255,255), -1)

# Does the box visually contain the face?
# Check: are eye outer corners inside the box?
eol = lm(33)
eor = lm(263)
print(f"Eye outer L: x={eol[0]} (box xL={xL}) — inside: {eol[0] > xL}")
print(f"Eye outer R: x={eor[0]} (box xR={xR}) — inside: {eor[0] < xR}")
print()
# Is crown at the top of the face or inside hair?
print(f"lm[10] y={yTop} vs image top y=0")
print(f"Hair region above crown: {yTop}px ({yTop/h*100:.0f}% of img — NOT in bounding box)")

cv2.imwrite('/tmp/face_extents_check.jpg', out)
print("Saved /tmp/face_extents_check.jpg")
EOF


Read [](file:///tmp/face_extents_check.jpg)

Aqui está o segundo problema real: **o `FaceExtents` está errado visualmente**. O box branco:
- **Topo (yTop=lm[10]):** começa no meio da testa, cortando o hairline real
- **Laterais (lm[234]/lm[454]):** os pontos zigomáticos estão na linha dos olhos (y≈583), não nas extremidades mais largas da face — o box é mais estreito que a face visível

O `FaceExtents` deveria englobar o rosto visual real. Preciso corrigir os anchors laterais para usar os pontos mais extremos da bochecha ao invés dos zigomáticos médios, e o topo para usar o ponto mais alto disponível no mesh.

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm_raw = lambda i: (landmarks[i][0], landmarks[i][1])

# Find the leftmost and rightmost points in the face mesh
all_x = [(i, landmarks[i][0], landmarks[i][1]) for i in range(478)]
leftmost  = sorted(all_x, key=lambda t: t[1])[:5]
rightmost = sorted(all_x, key=lambda t: t[1], reverse=True)[:5]
topmost   = sorted(all_x, key=lambda t: t[2])[:5]

print("5 leftmost (smallest x):")
for i, x, y in leftmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

print("\n5 rightmost (largest x):")
for i, x, y in rightmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

print("\n5 topmost (smallest y):")
for i, x, y in topmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

# Current zygo points
print(f"\nCurrent lm[234] (zygo L): x={landmarks[234][0]:.0f}, y={landmarks[234][1]:.0f}")
print(f"Current lm[454] (zygo R): x={landmarks[454][0]:.0f}, y={landmarks[454][1]:.0f}")
print(f"Current lm[10]  (crown):  x={landmarks[10][0]:.0f}, y={landmarks[10][1]:.0f}")

# Check specific candidates for wider face boundary
for idx in [234, 127, 93, 132, 58, 172, 136, 150, 149, 176, 148]:
    print(f"  lm[{idx}]: x={landmarks[idx][0]:.0f}, y={landmarks[idx][1]:.0f}")
EOF


Os pontos laterais `lm[234]` e `lm[454]` já são os mais extremos do mesh (x=91 e x=799 numa imagem de 847px). O problema não é os pontos — é que a imagem tem margem lateral de background. O `FaceExtents` está correto matematicamente; o que parece "estreito" é porque a imagem tem bastante espaço nas laterais.

O problema real do `FaceExtents` é apenas **o topo** — `lm[10]` em y=261 corta 23% da imagem acima (hairline/cabelo). Para o `FaceExtents` ter sentido visual, o topo deveria ser o **topo da imagem ou o topo do crop detectado**, não `lm[10]`.

Mas isso é uma decisão de design: o box mostra "o rosto detectável pelo mesh" (correto para fins de análise) ou "a extensão visual da cabeça" (mais intuitivo para o usuário). A correção mais honesta é adicionar uma nota no label "Hairline (mesh)" para deixar claro que o top é o limite do MediaPipe, não o topo real da cabeça.

Read [](file:///home/luizescobal/study/face-before-after/frontend/src/components/OverlayLayer.tsx)

Agora verifico o TypeScript e depois gero a imagem de revisão crítica:

Ran terminal command: cd /home/luizescobal/study/face-before-after/frontend && npx tsc --noEmit 2>&1 | head -30

TypeScript limpo. Agora gero a imagem de revisão crítica simulando exatamente o que o novo código faz:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]
out = img.copy()

def txt(img, text, x, y, color, scale=0.38):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

# === FaceExtents ===
yTop  = lm(10)[1]
yMen  = lm(152)[1]
xL    = lm(234)[0]
xR    = lm(454)[0]
WHITE = (255,255,255)
cv2.rectangle(out, (xL, yTop), (xR, yMen), WHITE, 1)
txt(out, "Trichion (mesh)", xL+4, yTop-4, WHITE)
txt(out, "Menton",          xL+4, yMen+14, WHITE)

# === GridThirds ===
yBrow = (lm(107)[1] + lm(336)[1]) // 2
ySub  = lm(2)[1]
faceH = yMen - yTop

yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

PURPLE = (200,150,255)
ORANGE = (0,165,255)

# Ideal dashed
cv2.line(out, (0, yT1_ideal), (w, yT1_ideal), PURPLE, 1)
cv2.line(out, (0, yT2_ideal), (w, yT2_ideal), PURPLE, 1)
txt(out, "ideal 1/3", xL+4, yT1_ideal-3, PURPLE)
txt(out, "ideal 2/3", xL+4, yT2_ideal-3, PURPLE)

# Real landmark lines
cv2.line(out, (0, yBrow), (w, yBrow), ORANGE, 2)
txt(out, "Sobrancelha", xL+4, yBrow-3, ORANGE)
cv2.line(out, (0, ySub),  (w, ySub),  ORANGE, 2)
txt(out, "Subnasale",    xL+4, ySub-3,  ORANGE)

# Lateral labels with deviation
thirds = [
    (yTop, yBrow, "upper_third_ratio", "T1"),
    (yBrow, ySub,  "middle_third_ratio", "T2"),
    (ySub, yMen,   "lower_third_ratio", "T3"),
]
SEV_COLORS = {"ideal":(80,200,80), "mild":(80,200,80), "moderate":(50,200,220), "strong":(0,165,255), "extreme":(0,80,255)}
for yA, yB, mid, label in thirds:
    m = metric_evals.get(mid, {})
    pct = (m.get('value', (yB-yA)/faceH)) * 100
    sev = m.get('severity_5', None)
    color = SEV_COLORS.get(sev, (150,150,150))
    dev = pct - 33.3
    devStr = f"+{dev:.0f}" if dev >= 0 else f"{dev:.0f}"
    txt(out, f"{label} {pct:.0f}% ({devStr}%)", xR+6, int((yA+yB)/2+4), color, 0.42)

# === GridFifths ===
xFaceL = lm(234)[0]
xFaceR = lm(454)[0]
faceW  = xFaceR - xFaceL
fifth  = faceW / 5

actuals = [lm(33)[0], lm(133)[0], lm(362)[0], lm(263)[0]]
names   = ["OExt.E", "OInt.E", "OInt.D", "OExt.D"]
ideals  = [xFaceL + (i+1)*fifth for i in range(4)]

# Face edges
cv2.line(out, (xFaceL, yTop), (xFaceL, yMen), WHITE, 1)
cv2.line(out, (xFaceR, yTop), (xFaceR, yMen), WHITE, 1)

# Ideal fifths dashed
for xi in ideals:
    cv2.line(out, (int(xi), yTop), (int(xi), yMen), PURPLE, 1)

# Actual eye corners + deviation
yLabel = yMen - 14
for i, (x, name) in enumerate(zip(actuals, names)):
    cv2.line(out, (x, yTop), (x, yMen), ORANGE, 1)
    dev = int(round(x - ideals[i]))
    devStr = f"+{dev}" if dev > 0 else str(dev)
    txt(out, f"{name} {devStr}px", x+2, yLabel - i*12, ORANGE, 0.35)

txt(out, "Quintos - tracejado:ideal laranja:real (desvio px)", xFaceL+2, yTop-6, PURPLE, 0.35)

cv2.imwrite('/tmp/overlay_final_review.jpg', out)
print("Saved /tmp/overlay_final_review.jpg")
EOF


Ran terminal command: cd /home/luizescobal/study/face-before-after && python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]
out = img.copy()

def txt(img, text, x, y, color, scale=0.38):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

yTop  = lm(10)[1]
yMen  = lm(152)[1]
xL    = lm(234)[0]
xR    = lm(454)[0]
WHITE  = (255,255,255)
PURPLE = (200,150,255)
ORANGE = (0,165,255)

# FaceExtents
cv2.rectangle(out, (xL, yTop), (xR, yMen), WHITE, 1)
txt(out, "Trichion (mesh)", xL+4, yTop-4, WHITE)
txt(out, "Menton", xL+4, yMen+14, WHITE)

# GridThirds
yBrow = (lm(107)[1] + lm(336)[1]) // 2
ySub  = lm(2)[1]
faceH = yMen - yTop
yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

cv2.line(out, (0, yT1_ideal), (w, yT1_ideal), PURPLE, 1)
cv2.line(out, (0, yT2_ideal), (w, yT2_ideal), PURPLE, 1)
txt(out, "ideal 1/3", xL+4, yT1_ideal-3, PURPLE)
txt(out, "ideal 2/3", xL+4, yT2_ideal-3, PURPLE)

cv2.line(out, (0, yBrow), (w, yBrow), ORANGE, 2)
txt(out, "Sobrancelha", xL+4, yBrow-3, ORANGE)
cv2.line(out, (0, ySub), (w, ySub), ORANGE, 2)
txt(out, "Subnasale", xL+4, ySub-3, ORANGE)

SEV = {"ideal":(80,200,80),"mild":(80,200,80),"moderate":(50,200,220),"strong":(0,165,255),"extreme":(0,80,255)}
for yA, yB, mid, label in [(yTop,yBrow,"upper_third_ratio","T1"),(yBrow,ySub,"middle_third_ratio","T2"),(ySub,yMen,"lower_third_ratio","T3")]:
    m = metric_evals.get(mid, {})
    pct = m.get('value', (yB-yA)/faceH) * 100
    color = SEV.get(m.get('severity_5'), (150,150,150))
    dev = pct - 33.3
    txt(out, f"{label} {pct:.0f}% ({'+' if dev>=0 else ''}{dev:.0f}%)", xR+6, int((yA+yB)/2+4), color, 0.42)

# GridFifths
faceW = xR - xL
fifth = faceW / 5
actuals = [lm(33)[0], lm(133)[0], lm(362)[0], lm(263)[0]]
names   = ["OExt.E","OInt.E","OInt.D","OExt.D"]
ideals  = [xL + (i+1)*fifth for i in range(4)]

cv2.line(out, (xL, yTop), (xL, yMen), WHITE, 1)
cv2.line(out, (xR, yTop), (xR, yMen), WHITE, 1)
for xi in ideals:
    cv2.line(out, (int(xi), yTop), (int(xi), yMen), PURPLE, 1)

yLbl = yMen - 16
for i, (x, name) in enumerate(zip(actuals, names)):
    cv2.line(out, (x, yTop), (x, yMen), ORANGE, 1)
    dev = int(round(x - ideals[i]))
    txt(out, f"{name} {'+' if dev>0 else ''}{dev}px", x+2, yLbl - i*14, ORANGE, 0.35)

txt(out, "Quintos: tracejado=ideal, laranja=real", xL+2, yTop-6, PURPLE, 0.36)

cv2.imwrite('/tmp/overlay_final_review.jpg', out)
print(f"OK {w}x{h}")
EOF

Vou ler o contexto canônico antes de tocar no código.

Read [](file:///home/luizescobal/study/face-before-after/.claude/face-analysis/00-index.md)

Read [](file:///home/luizescobal/study/face-before-after/.claude/face-analysis/08-svg-overlays.md)

A doc diz que os bugs foram "corrigidos", mas minha análise visual agora mostra que os terços ainda estão errados. Vou verificar o estado real do código e entender o problema raiz de ponta a ponta.

Ran terminal command: python3 - <<'EOF'
import json
with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

lm = data['landmarks']

# Todos os pontos relevantes
crown = lm[10]
menton = lm[152]
brow_l = lm[107]
brow_r = lm[336]
subnasale = lm[2]
zygo_l = lm[234]
zygo_r = lm[454]

print(f"Image crop: {data['auto_crop']['crop_bbox']}")
print(f"Image (canonical) size: 847x1155 (da imagem lida)")
print()
print(f"lm[10] (crown/forehead_center): y={crown[1]:.0f}")
print(f"lm[151] (forehead_top):         y={lm[151][1]:.0f}")
print(f"lm[10] is far from top of head - real hairline should be ~y=0 area")
print()

# What percentage of the image height is crown at?
img_h = 1155  # from the image
print(f"Crown lm[10] at y={crown[1]:.0f} = {crown[1]/img_h*100:.1f}% from top of image")
print(f"This means lm[10] is NOT at the top of the head")
print()

# What does the metric say?
face_h = menton[1] - crown[1]
y_brow = (brow_l[1] + brow_r[1]) / 2
y_sub = subnasale[1]
print(f"Face height (crown→menton): {face_h:.0f}px")
print(f"Upper: {(y_brow-crown[1])/face_h*100:.1f}%  Mid: {(y_sub-y_brow)/face_h*100:.1f}%  Lower: {(menton[1]-y_sub)/face_h*100:.1f}%")
print()

# Check if backend metric_evaluations exist in JSON
blocks = data.get('measurements_blocks', {})
print("measurements_blocks keys:", list(blocks.keys())[:5])

# Check if metric data has third ratios
metric_evals = data.get('metric_evaluations', [])
print(f"metric_evaluations count: {len(metric_evals)}")
if metric_evals:
    for m in metric_evals:
        if 'third' in m.get('metric_id',''):
            print(m)
EOF


Ran terminal command: grep -n "upper_third\|lower_third\|middle_third\|FOREHEAD\|P_FOREHEAD\|landmark.*10\b" /home/luizescobal/study/face-before-after/backend/app/services/metrics/thirds.py | head -40

Ran terminal command: cat /home/luizescobal/study/face-before-after/backend/app/services/metrics/thirds.py

Agora tenho o quadro completo. Vou verificar o que o `P_FOREHEAD_CROWN=10` realmente é no MediaPipe, e entender o problema dos quintos também.

Ran terminal command: grep -n "P_FOREHEAD_CROWN\|P_MENTON\|P_BROW\|P_SUBNASALE\|= 10\b\|= 152\b" /home/luizescobal/study/face-before-after/backend/app/domain/landmarks_mesh.py | head -30

Ran terminal command: python3 - <<'EOF'
import json
with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)
lm = data['landmarks']

# Scan the top Y coordinates in the mesh to understand what landmark 10 actually is
# vs what's actually at the top of the face
top_lms = sorted(enumerate(lm), key=lambda x: x[1][1])[:15]
print("Landmarks with lowest Y (top of image):")
for idx, (x,y) in top_lms:
    print(f"  lm[{idx}]: x={x:.0f}, y={y:.0f}")

print()
print(f"lm[10]: x={lm[10][0]:.0f}, y={lm[10][1]:.0f}")
print(f"lm[151]: x={lm[151][0]:.0f}, y={lm[151][1]:.0f}")
print(f"lm[9]: x={lm[9][0]:.0f}, y={lm[9][1]:.0f}")

# What about the fifths? Let's check what the frontend calculates
zygo_l = lm[234]
zygo_r = lm[454]
eye_ol = lm[33]
eye_or = lm[263]
eye_il = lm[133]
eye_ir = lm[362]

face_w = zygo_r[0] - zygo_l[0]
fifth  = face_w / 5

print(f"\n=== FIFTHS ANALYSIS ===")
print(f"Face width (234→454): {face_w:.0f}px")
print(f"Ideal fifth: {fifth:.1f}px")
print()
print(f"Ideal edges from zygo_l ({zygo_l[0]:.0f}):")
for i in [1,2,3,4]:
    print(f"  {i}/5 = x={zygo_l[0]+i*fifth:.0f}")

print()
print(f"Actual eye corners:")
print(f"  eye outer L (lm[33]):  x={eye_ol[0]:.0f} (ideal 1/5 = {zygo_l[0]+fifth:.0f}, delta={eye_ol[0]-(zygo_l[0]+fifth):.0f}px)")
print(f"  eye inner L (lm[133]): x={eye_il[0]:.0f} (ideal 2/5 = {zygo_l[0]+2*fifth:.0f}, delta={eye_il[0]-(zygo_l[0]+2*fifth):.0f}px)")
print(f"  eye inner R (lm[362]): x={eye_ir[0]:.0f} (ideal 3/5 = {zygo_l[0]+3*fifth:.0f}, delta={eye_ir[0]-(zygo_l[0]+3*fifth):.0f}px)")
print(f"  eye outer R (lm[263]): x={eye_or[0]:.0f} (ideal 4/5 = {zygo_l[0]+4*fifth:.0f}, delta={eye_or[0]-(zygo_l[0]+4*fifth):.0f}px)")
EOF


Agora tenho o diagnóstico completo e definitivo. Vou fazer os fixes.

**Diagnóstico real:**

1. **Terços — o problema é duplo:** `lm[10]` é realmente o ponto mais alto do mesh (y=261), mas está em y=22.6% da imagem — existe cabeça/cabelo acima. O cálculo de métrica usa `lm[10]→menton` que dá upper=20%. **Isso está matematicamente correto dado que o MediaPipe não detecta acima do hairline** — o problema é que o overlay visual desenha a linha do "ideal" em `yTop + faceH/3` mas as linhas laranja "reais" mostram brow/subnasale que batem com os 20%/40% corretos. O overlay está correto mas **confuso visualmente** — a legenda T1/T2/T3 mostra os percentuais reais da face detectada, não da "face ideal".

2. **Quintos — funcionam bem:** deltas máximos de 13px (2% da largura) são aceitáveis, o overlay dual (tracejado ideal + laranja real) está correto.

O verdadeiro bug visual é: **o overlay de terços desenhando as linhas dashed "ideais" em posições absolutas (yTop + faceH/3) faz parecer que a face está errada quando o problema é que lm[10] não é o hairline real**. Preciso verificar o `GridThirds` mais cuidadosamente:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

# Simulate exactly what GridThirds does
P_FOREHEAD_CROWN = 10
P_BROW_LEFT_INNER = 107
P_BROW_RIGHT_INNER = 336
P_SUBNASALE = 2
P_MENTON = 152
P_ZYGO_IMG_RIGHT = 454
P_ZYGO_IMG_LEFT = 234

crown = lm(P_FOREHEAD_CROWN)
menton = lm(P_MENTON)
brow_l = lm(P_BROW_LEFT_INNER)
brow_r = lm(P_BROW_RIGHT_INNER)
zygo_r = lm(P_ZYGO_IMG_RIGHT)
zygo_l = lm(P_ZYGO_IMG_LEFT)
subnasale = lm(P_SUBNASALE)

yTop  = crown[1]
yBrow = (brow_l[1] + brow_r[1]) // 2
ySub  = subnasale[1]
yMen  = menton[1]

faceH = yMen - yTop
yT1   = yTop + faceH // 3   # ideal 1/3 line (dashed purple)
yT2   = yTop + 2 * faceH // 3  # ideal 2/3 line (dashed purple)

print("=== GridThirds exact simulation ===")
print(f"yTop={yTop} (lm[10] forehead crown)")
print(f"yBrow={yBrow} (brow inner midpoint) — laranja sólido")
print(f"ySub={ySub}  (subnasale) — laranja sólido")
print(f"yMen={yMen}  (menton)")
print(f"faceH={faceH}px")
print()
print(f"Ideal dashed lines: yT1={yT1} yT2={yT2}")
print(f"Real orange lines:  yBrow={yBrow} ySub={ySub}")
print()
print(f"Delta yBrow vs yT1: {yBrow - yT1}px (negative = brow ABOVE ideal 1/3)")
print(f"Delta ySub  vs yT2: {ySub  - yT2}px")
print()

# Labels - what does GridThirds render?
# The metric values from backend:
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}
upper_val  = metric_evals['upper_third_ratio']['value']
middle_val = metric_evals['middle_third_ratio']['value']
lower_val  = metric_evals['lower_third_ratio']['value']

print(f"Label rendered (from backend metric values):")
print(f"  T1: {upper_val*100:.0f}% (vs ideal 33%)")
print(f"  T2: {middle_val*100:.0f}% (vs ideal 33%)")
print(f"  T3: {lower_val*100:.0f}% (vs ideal 33%)")
print()
print("VERDICT:")
print("- lm[10] at y=261 is the HIGHEST point of MediaPipe mesh")
print("- Hair above it (~y=0..261) is NOT detected by MediaPipe")
print("- So upper_third=20% is REAL — Brad Pitt has high hairline / small upper third")
print("  within the DETECTED face region")
print()
print("The VISUAL problem is that the dashed 'ideal' lines sit at yTop+faceH/3,")
print("which looks correct, but the labels show 20%/40%/40% making it look wrong.")
print()
print("Actually the real issue: if lm[10] is the highest mesh point,")
print("the brow line at yBrow falls only 20% into the detected face — which IS correct")
print("for Brad Pitt who has a larger-than-ideal forehead relative to the 3 equal thirds.")
print("Wait — 20% upper means SHORT upper third (brow close to hairline), not long forehead.")
print()
print(f"Upper: {upper_val*100:.1f}% SHORT = brow is HIGH = forehead is SHORT relative to face")
EOF


Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

# Generate definitive visual: side-by-side comparison
# LEFT: what the current overlay draws
# RIGHT: what it SHOULD draw

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]

crown = lm(10)
menton = lm(152)
brow_l = lm(107)
brow_r = lm(336)
sub = lm(2)
zygo_l = lm(234)
zygo_r = lm(454)
eye_ol = lm(33)
eye_or = lm(263)
eye_il = lm(133)
eye_ir = lm(362)

yTop = crown[1]
yBrow = (brow_l[1] + brow_r[1]) // 2
ySub = sub[1]
yMen = menton[1]
faceH = yMen - yTop
yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

xFaceL = zygo_l[0]
xFaceR = zygo_r[0]
faceW = xFaceR - xFaceL
fifth = faceW / 5

def put_label(img, text, x, y, color=(255,255,255), scale=0.45):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

# =============================================================================
# LEFT panel: current overlay behavior
# =============================================================================
left = img.copy()

# FaceExtents box
cv2.rectangle(left, (xFaceL, yTop), (xFaceR, yMen), (255,255,255), 1)

# Thirds: ideal dashed (purple) and real orange
cv2.line(left, (0, yT1_ideal), (w, yT1_ideal), (180,130,255), 1)
cv2.line(left, (0, yT2_ideal), (w, yT2_ideal), (180,130,255), 1)
cv2.line(left, (0, yBrow),     (w, yBrow),     (0,165,255), 2)
cv2.line(left, (0, ySub),      (w, ySub),      (0,165,255), 2)

# Fifths: ideal dashed + actual orange
for i in [1,2,3,4]:
    xi = int(xFaceL + i * fifth)
    cv2.line(left, (xi, yTop), (xi, yMen), (180,130,255), 1)
for x in [eye_ol[0], eye_il[0], eye_ir[0], eye_or[0]]:
    cv2.line(left, (x, yTop), (x, yMen), (0,165,255), 1)

put_label(left, "ATUAL", 10, 30, (0,200,255), 0.7)
put_label(left, f"T1 {(yBrow-yTop)/faceH*100:.0f}%", xFaceR+5, yTop+(yBrow-yTop)//2, (0,165,255))
put_label(left, f"T2 {(ySub-yBrow)/faceH*100:.0f}%",  xFaceR+5, yBrow+(ySub-yBrow)//2, (0,165,255))
put_label(left, f"T3 {(yMen-ySub)/faceH*100:.0f}%",   xFaceR+5, ySub+(yMen-ySub)//2,  (0,165,255))

# =============================================================================
# RIGHT panel: correct overlay
# Problema raiz: lm[10] é o ponto mais alto do mesh, que está em y=261
# (23% da imagem), mas a testa real começa em ~y=0.
# O GridThirds usa yTop=lm[10] e depois traça o "ideal" como yTop+faceH/3.
# Mas as métricas (upper=20%) são calculadas com o MESMO lm[10].
# Então os terços são consistentes internamente — o visual não está "errado",
# mas a interpretação da linha laranja T1/yBrow indica que o rosto tem
# terço superior CURTO (brow alta), o que é correto para Brad Pitt.
#
# O REAL bug visual é que a linha "ideal dashed" de T1 cai em yT1=549 (64%),
# muito abaixo do brow real (y=435), mostrando um gap enorme que assusta o usuário.
# A legenda clarifica (20% vs 33%), mas visualmente parece que o overlay está quebrado.
#
# FIX: mostrar claramente nos labels O QUE CADA LINHA É.
# =============================================================================
right = img.copy()

cv2.rectangle(right, (xFaceL, yTop), (xFaceR, yMen), (255,255,255), 1)

# Ideal thirds (dashed)
for y, label in [(yT1_ideal, "ideal 1/3"), (yT2_ideal, "ideal 2/3")]:
    cv2.line(right, (0, y), (w, y), (180,130,255), 1)
    put_label(right, label, 5, y-4, (180,130,255))

# Real landmark lines (orange solid) with clear labels
cv2.line(right, (0, yBrow), (w, yBrow), (0,165,255), 2)
put_label(right, f"SOBRANCELHA (real T1={( yBrow-yTop)/faceH*100:.0f}%)", 5, yBrow-6, (0,165,255))
cv2.line(right, (0, ySub), (w, ySub), (0,165,255), 2)
put_label(right, f"SUBNASALE (real T2-end={( ySub-yTop)/faceH*100:.0f}%)", 5, ySub-6, (0,165,255))

# lm[10] and menton markers
cv2.line(right, (0, yTop), (w, yTop), (255,255,255), 1)
put_label(right, f"lm[10] hairline proxy (y={yTop})", 5, yTop+14, (255,255,255))
cv2.line(right, (0, yMen), (w, yMen), (255,255,255), 1)

# Fifths 
for i in [1,2,3,4]:
    xi = int(xFaceL + i * fifth)
    cv2.line(right, (xi, yTop), (xi, yMen), (180,130,255), 1)
for x, label in [(eye_ol[0],'OL'), (eye_il[0],'IL'), (eye_ir[0],'IR'), (eye_or[0],'OR')]:
    cv2.line(right, (x, yTop), (x, yMen), (0,165,255), 1)

put_label(right, "CORRETO (mesmo calc, labels claros)", 10, 30, (0,255,0), 0.55)
put_label(right, f"T1={( yBrow-yTop)/faceH*100:.0f}% T2={(ySub-yBrow)/faceH*100:.0f}% T3={(yMen-ySub)/faceH*100:.0f}%", 10, 55, (0,200,255))

# Combine
combined = np.hstack([left, right])
cv2.line(combined, (w, 0), (w, h), (255,255,0), 2)
cv2.imwrite('/tmp/debug_comparison.jpg', combined)
print(f"Saved /tmp/debug_comparison.jpg ({combined.shape[1]}x{combined.shape[0]})")
EOF


Read [](file:///tmp/debug_comparison.jpg)

Agora tenho o diagnóstico visual definitivo. Os dois painéis mostram **o mesmo cálculo** — o problema não é nos números, é em **como o overlay comunica o que está desenhado**. Vou agora fazer uma análise crítica completa antes de implementar qualquer fix.

**Análise crítica real:**

O overlay `GridThirds` tem **dois problemas distintos**:

1. **Problema de semântica visual:** A linha dashed "ideal" (T1 = yTop + faceH/3) fica muito abaixo da sobrancelha real, criando um gap visual enorme que faz parecer que o sistema está quebrado. O usuário vê a sobrancelha laranja acima e a linha roxa "ideal" muito abaixo — isso **inverte a intuição**: parece que o "ideal" está mais pra baixo quando na verdade T1 curto (20%) significa sobrancelha ALTA.

2. **Problema de âncora do hairline:** `lm[10]` não é o hairline real — é o ponto mais alto do mesh, que está em y=261 (23% da imagem). Existe testa real acima. Isso faz o terço superior parecer menor do que é na realidade anatômica.

Agora vou implementar os fixes corretos:

Used tool: ToolSearch

Agora vou corrigir o `GridThirds`. O problema central: as linhas dashed roxas estão em `yTop + faceH/3` (posição "onde estaria o ideal") mas a **semântica está invertida** — a linha laranja ACIMA da dashed faz parecer que o overlay está errado, quando na verdade está correto. Preciso trocar a comunicação visual.

Read [](file:///home/luizescobal/study/face-before-after/frontend/src/components/OverlayLayer.tsx)

Agora tenho clareza total. Vou fazer os fixes:

**Fix 1 — `GridThirds`:** 
- As linhas dashed estão corretas mas as linhas "real" (laranja) precisam de label direto em cima delas, não só no label lateral. Hoje o label lateral diz "T1 20% (33%)" mas isso é confuso porque a linha laranja está ACIMA da dashed, fazendo parecer que o overlay errou.
- A correção: desenhar label diretamente nas linhas laranja indicando o que são, e mudar o label lateral para mostrar o **desvio** do ideal.

**Fix 2 — `GridFifths`:**
- Os quintos estão funcionando corretamente (desvios de ~13px). O label precisa mostrar o desvio por quinto.Agora fix do `GridFifths` — adicionar desvio por quinto e label nas linhas de borda:Agora verifico o `FaceExtents` — preciso confirmar que o bounding box usa os landmarks certos:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]

# FaceExtents usa: yTop=lm[10], yMenton=lm[152], xL=lm[234], xR=lm[454]
yTop   = lm(10)[1]
yMen   = lm(152)[1]
xL     = lm(234)[0]
xR     = lm(454)[0]

print(f"FaceExtents bounding box: x=[{xL},{xR}] y=[{yTop},{yMen}]")
print(f"Image dimensions: {w}x{h}")
print(f"Box width: {xR-xL}px ({(xR-xL)/w*100:.0f}% of image width)")
print(f"Box height: {yMen-yTop}px ({(yMen-yTop)/h*100:.0f}% of image height)")
print()

# Draw FaceExtents to verify visually
out = img.copy()
cv2.rectangle(out, (xL, yTop), (xR, yMen), (255,255,255), 2)
cv2.circle(out, lm(10),  6, (0,255,0), -1)
cv2.circle(out, lm(152), 6, (0,255,0), -1)
cv2.circle(out, lm(234), 6, (0,255,255), -1)
cv2.circle(out, lm(454), 6, (0,255,255), -1)

# Does the box visually contain the face?
# Check: are eye outer corners inside the box?
eol = lm(33)
eor = lm(263)
print(f"Eye outer L: x={eol[0]} (box xL={xL}) — inside: {eol[0] > xL}")
print(f"Eye outer R: x={eor[0]} (box xR={xR}) — inside: {eor[0] < xR}")
print()
# Is crown at the top of the face or inside hair?
print(f"lm[10] y={yTop} vs image top y=0")
print(f"Hair region above crown: {yTop}px ({yTop/h*100:.0f}% of img — NOT in bounding box)")

cv2.imwrite('/tmp/face_extents_check.jpg', out)
print("Saved /tmp/face_extents_check.jpg")
EOF


Read [](file:///tmp/face_extents_check.jpg)

Aqui está o segundo problema real: **o `FaceExtents` está errado visualmente**. O box branco:
- **Topo (yTop=lm[10]):** começa no meio da testa, cortando o hairline real
- **Laterais (lm[234]/lm[454]):** os pontos zigomáticos estão na linha dos olhos (y≈583), não nas extremidades mais largas da face — o box é mais estreito que a face visível

O `FaceExtents` deveria englobar o rosto visual real. Preciso corrigir os anchors laterais para usar os pontos mais extremos da bochecha ao invés dos zigomáticos médios, e o topo para usar o ponto mais alto disponível no mesh.

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm_raw = lambda i: (landmarks[i][0], landmarks[i][1])

# Find the leftmost and rightmost points in the face mesh
all_x = [(i, landmarks[i][0], landmarks[i][1]) for i in range(478)]
leftmost  = sorted(all_x, key=lambda t: t[1])[:5]
rightmost = sorted(all_x, key=lambda t: t[1], reverse=True)[:5]
topmost   = sorted(all_x, key=lambda t: t[2])[:5]

print("5 leftmost (smallest x):")
for i, x, y in leftmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

print("\n5 rightmost (largest x):")
for i, x, y in rightmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

print("\n5 topmost (smallest y):")
for i, x, y in topmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

# Current zygo points
print(f"\nCurrent lm[234] (zygo L): x={landmarks[234][0]:.0f}, y={landmarks[234][1]:.0f}")
print(f"Current lm[454] (zygo R): x={landmarks[454][0]:.0f}, y={landmarks[454][1]:.0f}")
print(f"Current lm[10]  (crown):  x={landmarks[10][0]:.0f}, y={landmarks[10][1]:.0f}")

# Check specific candidates for wider face boundary
for idx in [234, 127, 93, 132, 58, 172, 136, 150, 149, 176, 148]:
    print(f"  lm[{idx}]: x={landmarks[idx][0]:.0f}, y={landmarks[idx][1]:.0f}")
EOF


Os pontos laterais `lm[234]` e `lm[454]` já são os mais extremos do mesh (x=91 e x=799 numa imagem de 847px). O problema não é os pontos — é que a imagem tem margem lateral de background. O `FaceExtents` está correto matematicamente; o que parece "estreito" é porque a imagem tem bastante espaço nas laterais.

O problema real do `FaceExtents` é apenas **o topo** — `lm[10]` em y=261 corta 23% da imagem acima (hairline/cabelo). Para o `FaceExtents` ter sentido visual, o topo deveria ser o **topo da imagem ou o topo do crop detectado**, não `lm[10]`.

Mas isso é uma decisão de design: o box mostra "o rosto detectável pelo mesh" (correto para fins de análise) ou "a extensão visual da cabeça" (mais intuitivo para o usuário). A correção mais honesta é adicionar uma nota no label "Hairline (mesh)" para deixar claro que o top é o limite do MediaPipe, não o topo real da cabeça.

Read [](file:///home/luizescobal/study/face-before-after/frontend/src/components/OverlayLayer.tsx)

Agora verifico o TypeScript e depois gero a imagem de revisão crítica:

Ran terminal command: cd /home/luizescobal/study/face-before-after/frontend && npx tsc --noEmit 2>&1 | head -30

TypeScript limpo. Agora gero a imagem de revisão crítica simulando exatamente o que o novo código faz:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]
out = img.copy()

def txt(img, text, x, y, color, scale=0.38):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

# === FaceExtents ===
yTop  = lm(10)[1]
yMen  = lm(152)[1]
xL    = lm(234)[0]
xR    = lm(454)[0]
WHITE = (255,255,255)
cv2.rectangle(out, (xL, yTop), (xR, yMen), WHITE, 1)
txt(out, "Trichion (mesh)", xL+4, yTop-4, WHITE)
txt(out, "Menton",          xL+4, yMen+14, WHITE)

# === GridThirds ===
yBrow = (lm(107)[1] + lm(336)[1]) // 2
ySub  = lm(2)[1]
faceH = yMen - yTop

yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

PURPLE = (200,150,255)
ORANGE = (0,165,255)

# Ideal dashed
cv2.line(out, (0, yT1_ideal), (w, yT1_ideal), PURPLE, 1)
cv2.line(out, (0, yT2_ideal), (w, yT2_ideal), PURPLE, 1)
txt(out, "ideal 1/3", xL+4, yT1_ideal-3, PURPLE)
txt(out, "ideal 2/3", xL+4, yT2_ideal-3, PURPLE)

# Real landmark lines
cv2.line(out, (0, yBrow), (w, yBrow), ORANGE, 2)
txt(out, "Sobrancelha", xL+4, yBrow-3, ORANGE)
cv2.line(out, (0, ySub),  (w, ySub),  ORANGE, 2)
txt(out, "Subnasale",    xL+4, ySub-3,  ORANGE)

# Lateral labels with deviation
thirds = [
    (yTop, yBrow, "upper_third_ratio", "T1"),
    (yBrow, ySub,  "middle_third_ratio", "T2"),
    (ySub, yMen,   "lower_third_ratio", "T3"),
]
SEV_COLORS = {"ideal":(80,200,80), "mild":(80,200,80), "moderate":(50,200,220), "strong":(0,165,255), "extreme":(0,80,255)}
for yA, yB, mid, label in thirds:
    m = metric_evals.get(mid, {})
    pct = (m.get('value', (yB-yA)/faceH)) * 100
    sev = m.get('severity_5', None)
    color = SEV_COLORS.get(sev, (150,150,150))
    dev = pct - 33.3
    devStr = f"+{dev:.0f}" if dev >= 0 else f"{dev:.0f}"
    txt(out, f"{label} {pct:.0f}% ({devStr}%)", xR+6, int((yA+yB)/2+4), color, 0.42)

# === GridFifths ===
xFaceL = lm(234)[0]
xFaceR = lm(454)[0]
faceW  = xFaceR - xFaceL
fifth  = faceW / 5

actuals = [lm(33)[0], lm(133)[0], lm(362)[0], lm(263)[0]]
names   = ["OExt.E", "OInt.E", "OInt.D", "OExt.D"]
ideals  = [xFaceL + (i+1)*fifth for i in range(4)]

# Face edges
cv2.line(out, (xFaceL, yTop), (xFaceL, yMen), WHITE, 1)
cv2.line(out, (xFaceR, yTop), (xFaceR, yMen), WHITE, 1)

# Ideal fifths dashed
for xi in ideals:
    cv2.line(out, (int(xi), yTop), (int(xi), yMen), PURPLE, 1)

# Actual eye corners + deviation
yLabel = yMen - 14
for i, (x, name) in enumerate(zip(actuals, names)):
    cv2.line(out, (x, yTop), (x, yMen), ORANGE, 1)
    dev = int(round(x - ideals[i]))
    devStr = f"+{dev}" if dev > 0 else str(dev)
    txt(out, f"{name} {devStr}px", x+2, yLabel - i*12, ORANGE, 0.35)

txt(out, "Quintos - tracejado:ideal laranja:real (desvio px)", xFaceL+2, yTop-6, PURPLE, 0.35)

cv2.imwrite('/tmp/overlay_final_review.jpg', out)
print("Saved /tmp/overlay_final_review.jpg")
EOF


Ran terminal command: cd /home/luizescobal/study/face-before-after && python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]
out = img.copy()

def txt(img, text, x, y, color, scale=0.38):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

yTop  = lm(10)[1]
yMen  = lm(152)[1]
xL    = lm(234)[0]
xR    = lm(454)[0]
WHITE  = (255,255,255)
PURPLE = (200,150,255)
ORANGE = (0,165,255)

# FaceExtents
cv2.rectangle(out, (xL, yTop), (xR, yMen), WHITE, 1)
txt(out, "Trichion (mesh)", xL+4, yTop-4, WHITE)
txt(out, "Menton", xL+4, yMen+14, WHITE)

# GridThirds
yBrow = (lm(107)[1] + lm(336)[1]) // 2
ySub  = lm(2)[1]
faceH = yMen - yTop
yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

cv2.line(out, (0, yT1_ideal), (w, yT1_ideal), PURPLE, 1)
cv2.line(out, (0, yT2_ideal), (w, yT2_ideal), PURPLE, 1)
txt(out, "ideal 1/3", xL+4, yT1_ideal-3, PURPLE)
txt(out, "ideal 2/3", xL+4, yT2_ideal-3, PURPLE)

cv2.line(out, (0, yBrow), (w, yBrow), ORANGE, 2)
txt(out, "Sobrancelha", xL+4, yBrow-3, ORANGE)
cv2.line(out, (0, ySub), (w, ySub), ORANGE, 2)
txt(out, "Subnasale", xL+4, ySub-3, ORANGE)

SEV = {"ideal":(80,200,80),"mild":(80,200,80),"moderate":(50,200,220),"strong":(0,165,255),"extreme":(0,80,255)}
for yA, yB, mid, label in [(yTop,yBrow,"upper_third_ratio","T1"),(yBrow,ySub,"middle_third_ratio","T2"),(ySub,yMen,"lower_third_ratio","T3")]:
    m = metric_evals.get(mid, {})
    pct = m.get('value', (yB-yA)/faceH) * 100
    color = SEV.get(m.get('severity_5'), (150,150,150))
    dev = pct - 33.3
    txt(out, f"{label} {pct:.0f}% ({'+' if dev>=0 else ''}{dev:.0f}%)", xR+6, int((yA+yB)/2+4), color, 0.42)

# GridFifths
faceW = xR - xL
fifth = faceW / 5
actuals = [lm(33)[0], lm(133)[0], lm(362)[0], lm(263)[0]]
names   = ["OExt.E","OInt.E","OInt.D","OExt.D"]
ideals  = [xL + (i+1)*fifth for i in range(4)]

cv2.line(out, (xL, yTop), (xL, yMen), WHITE, 1)
cv2.line(out, (xR, yTop), (xR, yMen), WHITE, 1)
for xi in ideals:
    cv2.line(out, (int(xi), yTop), (int(xi), yMen), PURPLE, 1)

yLbl = yMen - 16
for i, (x, name) in enumerate(zip(actuals, names)):
    cv2.line(out, (x, yTop), (x, yMen), ORANGE, 1)
    dev = int(round(x - ideals[i]))
    txt(out, f"{name} {'+' if dev>0 else ''}{dev}px", x+2, yLbl - i*14, ORANGE, 0.35)

txt(out, "Quintos: tracejado=ideal, laranja=real", xL+2, yTop-6, PURPLE, 0.36)

cv2.imwrite('/tmp/overlay_final_review.jpg', out)
print(f"OK {w}x{h}")
EOF

Vou ler o contexto canônico antes de tocar no código.

Read [](file:///home/luizescobal/study/face-before-after/.claude/face-analysis/00-index.md)

Read [](file:///home/luizescobal/study/face-before-after/.claude/face-analysis/08-svg-overlays.md)

A doc diz que os bugs foram "corrigidos", mas minha análise visual agora mostra que os terços ainda estão errados. Vou verificar o estado real do código e entender o problema raiz de ponta a ponta.

Ran terminal command: python3 - <<'EOF'
import json
with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

lm = data['landmarks']

# Todos os pontos relevantes
crown = lm[10]
menton = lm[152]
brow_l = lm[107]
brow_r = lm[336]
subnasale = lm[2]
zygo_l = lm[234]
zygo_r = lm[454]

print(f"Image crop: {data['auto_crop']['crop_bbox']}")
print(f"Image (canonical) size: 847x1155 (da imagem lida)")
print()
print(f"lm[10] (crown/forehead_center): y={crown[1]:.0f}")
print(f"lm[151] (forehead_top):         y={lm[151][1]:.0f}")
print(f"lm[10] is far from top of head - real hairline should be ~y=0 area")
print()

# What percentage of the image height is crown at?
img_h = 1155  # from the image
print(f"Crown lm[10] at y={crown[1]:.0f} = {crown[1]/img_h*100:.1f}% from top of image")
print(f"This means lm[10] is NOT at the top of the head")
print()

# What does the metric say?
face_h = menton[1] - crown[1]
y_brow = (brow_l[1] + brow_r[1]) / 2
y_sub = subnasale[1]
print(f"Face height (crown→menton): {face_h:.0f}px")
print(f"Upper: {(y_brow-crown[1])/face_h*100:.1f}%  Mid: {(y_sub-y_brow)/face_h*100:.1f}%  Lower: {(menton[1]-y_sub)/face_h*100:.1f}%")
print()

# Check if backend metric_evaluations exist in JSON
blocks = data.get('measurements_blocks', {})
print("measurements_blocks keys:", list(blocks.keys())[:5])

# Check if metric data has third ratios
metric_evals = data.get('metric_evaluations', [])
print(f"metric_evaluations count: {len(metric_evals)}")
if metric_evals:
    for m in metric_evals:
        if 'third' in m.get('metric_id',''):
            print(m)
EOF


Ran terminal command: grep -n "upper_third\|lower_third\|middle_third\|FOREHEAD\|P_FOREHEAD\|landmark.*10\b" /home/luizescobal/study/face-before-after/backend/app/services/metrics/thirds.py | head -40

Ran terminal command: cat /home/luizescobal/study/face-before-after/backend/app/services/metrics/thirds.py

Agora tenho o quadro completo. Vou verificar o que o `P_FOREHEAD_CROWN=10` realmente é no MediaPipe, e entender o problema dos quintos também.

Ran terminal command: grep -n "P_FOREHEAD_CROWN\|P_MENTON\|P_BROW\|P_SUBNASALE\|= 10\b\|= 152\b" /home/luizescobal/study/face-before-after/backend/app/domain/landmarks_mesh.py | head -30

Ran terminal command: python3 - <<'EOF'
import json
with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)
lm = data['landmarks']

# Scan the top Y coordinates in the mesh to understand what landmark 10 actually is
# vs what's actually at the top of the face
top_lms = sorted(enumerate(lm), key=lambda x: x[1][1])[:15]
print("Landmarks with lowest Y (top of image):")
for idx, (x,y) in top_lms:
    print(f"  lm[{idx}]: x={x:.0f}, y={y:.0f}")

print()
print(f"lm[10]: x={lm[10][0]:.0f}, y={lm[10][1]:.0f}")
print(f"lm[151]: x={lm[151][0]:.0f}, y={lm[151][1]:.0f}")
print(f"lm[9]: x={lm[9][0]:.0f}, y={lm[9][1]:.0f}")

# What about the fifths? Let's check what the frontend calculates
zygo_l = lm[234]
zygo_r = lm[454]
eye_ol = lm[33]
eye_or = lm[263]
eye_il = lm[133]
eye_ir = lm[362]

face_w = zygo_r[0] - zygo_l[0]
fifth  = face_w / 5

print(f"\n=== FIFTHS ANALYSIS ===")
print(f"Face width (234→454): {face_w:.0f}px")
print(f"Ideal fifth: {fifth:.1f}px")
print()
print(f"Ideal edges from zygo_l ({zygo_l[0]:.0f}):")
for i in [1,2,3,4]:
    print(f"  {i}/5 = x={zygo_l[0]+i*fifth:.0f}")

print()
print(f"Actual eye corners:")
print(f"  eye outer L (lm[33]):  x={eye_ol[0]:.0f} (ideal 1/5 = {zygo_l[0]+fifth:.0f}, delta={eye_ol[0]-(zygo_l[0]+fifth):.0f}px)")
print(f"  eye inner L (lm[133]): x={eye_il[0]:.0f} (ideal 2/5 = {zygo_l[0]+2*fifth:.0f}, delta={eye_il[0]-(zygo_l[0]+2*fifth):.0f}px)")
print(f"  eye inner R (lm[362]): x={eye_ir[0]:.0f} (ideal 3/5 = {zygo_l[0]+3*fifth:.0f}, delta={eye_ir[0]-(zygo_l[0]+3*fifth):.0f}px)")
print(f"  eye outer R (lm[263]): x={eye_or[0]:.0f} (ideal 4/5 = {zygo_l[0]+4*fifth:.0f}, delta={eye_or[0]-(zygo_l[0]+4*fifth):.0f}px)")
EOF


Agora tenho o diagnóstico completo e definitivo. Vou fazer os fixes.

**Diagnóstico real:**

1. **Terços — o problema é duplo:** `lm[10]` é realmente o ponto mais alto do mesh (y=261), mas está em y=22.6% da imagem — existe cabeça/cabelo acima. O cálculo de métrica usa `lm[10]→menton` que dá upper=20%. **Isso está matematicamente correto dado que o MediaPipe não detecta acima do hairline** — o problema é que o overlay visual desenha a linha do "ideal" em `yTop + faceH/3` mas as linhas laranja "reais" mostram brow/subnasale que batem com os 20%/40% corretos. O overlay está correto mas **confuso visualmente** — a legenda T1/T2/T3 mostra os percentuais reais da face detectada, não da "face ideal".

2. **Quintos — funcionam bem:** deltas máximos de 13px (2% da largura) são aceitáveis, o overlay dual (tracejado ideal + laranja real) está correto.

O verdadeiro bug visual é: **o overlay de terços desenhando as linhas dashed "ideais" em posições absolutas (yTop + faceH/3) faz parecer que a face está errada quando o problema é que lm[10] não é o hairline real**. Preciso verificar o `GridThirds` mais cuidadosamente:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

# Simulate exactly what GridThirds does
P_FOREHEAD_CROWN = 10
P_BROW_LEFT_INNER = 107
P_BROW_RIGHT_INNER = 336
P_SUBNASALE = 2
P_MENTON = 152
P_ZYGO_IMG_RIGHT = 454
P_ZYGO_IMG_LEFT = 234

crown = lm(P_FOREHEAD_CROWN)
menton = lm(P_MENTON)
brow_l = lm(P_BROW_LEFT_INNER)
brow_r = lm(P_BROW_RIGHT_INNER)
zygo_r = lm(P_ZYGO_IMG_RIGHT)
zygo_l = lm(P_ZYGO_IMG_LEFT)
subnasale = lm(P_SUBNASALE)

yTop  = crown[1]
yBrow = (brow_l[1] + brow_r[1]) // 2
ySub  = subnasale[1]
yMen  = menton[1]

faceH = yMen - yTop
yT1   = yTop + faceH // 3   # ideal 1/3 line (dashed purple)
yT2   = yTop + 2 * faceH // 3  # ideal 2/3 line (dashed purple)

print("=== GridThirds exact simulation ===")
print(f"yTop={yTop} (lm[10] forehead crown)")
print(f"yBrow={yBrow} (brow inner midpoint) — laranja sólido")
print(f"ySub={ySub}  (subnasale) — laranja sólido")
print(f"yMen={yMen}  (menton)")
print(f"faceH={faceH}px")
print()
print(f"Ideal dashed lines: yT1={yT1} yT2={yT2}")
print(f"Real orange lines:  yBrow={yBrow} ySub={ySub}")
print()
print(f"Delta yBrow vs yT1: {yBrow - yT1}px (negative = brow ABOVE ideal 1/3)")
print(f"Delta ySub  vs yT2: {ySub  - yT2}px")
print()

# Labels - what does GridThirds render?
# The metric values from backend:
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}
upper_val  = metric_evals['upper_third_ratio']['value']
middle_val = metric_evals['middle_third_ratio']['value']
lower_val  = metric_evals['lower_third_ratio']['value']

print(f"Label rendered (from backend metric values):")
print(f"  T1: {upper_val*100:.0f}% (vs ideal 33%)")
print(f"  T2: {middle_val*100:.0f}% (vs ideal 33%)")
print(f"  T3: {lower_val*100:.0f}% (vs ideal 33%)")
print()
print("VERDICT:")
print("- lm[10] at y=261 is the HIGHEST point of MediaPipe mesh")
print("- Hair above it (~y=0..261) is NOT detected by MediaPipe")
print("- So upper_third=20% is REAL — Brad Pitt has high hairline / small upper third")
print("  within the DETECTED face region")
print()
print("The VISUAL problem is that the dashed 'ideal' lines sit at yTop+faceH/3,")
print("which looks correct, but the labels show 20%/40%/40% making it look wrong.")
print()
print("Actually the real issue: if lm[10] is the highest mesh point,")
print("the brow line at yBrow falls only 20% into the detected face — which IS correct")
print("for Brad Pitt who has a larger-than-ideal forehead relative to the 3 equal thirds.")
print("Wait — 20% upper means SHORT upper third (brow close to hairline), not long forehead.")
print()
print(f"Upper: {upper_val*100:.1f}% SHORT = brow is HIGH = forehead is SHORT relative to face")
EOF


Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

# Generate definitive visual: side-by-side comparison
# LEFT: what the current overlay draws
# RIGHT: what it SHOULD draw

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]

crown = lm(10)
menton = lm(152)
brow_l = lm(107)
brow_r = lm(336)
sub = lm(2)
zygo_l = lm(234)
zygo_r = lm(454)
eye_ol = lm(33)
eye_or = lm(263)
eye_il = lm(133)
eye_ir = lm(362)

yTop = crown[1]
yBrow = (brow_l[1] + brow_r[1]) // 2
ySub = sub[1]
yMen = menton[1]
faceH = yMen - yTop
yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

xFaceL = zygo_l[0]
xFaceR = zygo_r[0]
faceW = xFaceR - xFaceL
fifth = faceW / 5

def put_label(img, text, x, y, color=(255,255,255), scale=0.45):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

# =============================================================================
# LEFT panel: current overlay behavior
# =============================================================================
left = img.copy()

# FaceExtents box
cv2.rectangle(left, (xFaceL, yTop), (xFaceR, yMen), (255,255,255), 1)

# Thirds: ideal dashed (purple) and real orange
cv2.line(left, (0, yT1_ideal), (w, yT1_ideal), (180,130,255), 1)
cv2.line(left, (0, yT2_ideal), (w, yT2_ideal), (180,130,255), 1)
cv2.line(left, (0, yBrow),     (w, yBrow),     (0,165,255), 2)
cv2.line(left, (0, ySub),      (w, ySub),      (0,165,255), 2)

# Fifths: ideal dashed + actual orange
for i in [1,2,3,4]:
    xi = int(xFaceL + i * fifth)
    cv2.line(left, (xi, yTop), (xi, yMen), (180,130,255), 1)
for x in [eye_ol[0], eye_il[0], eye_ir[0], eye_or[0]]:
    cv2.line(left, (x, yTop), (x, yMen), (0,165,255), 1)

put_label(left, "ATUAL", 10, 30, (0,200,255), 0.7)
put_label(left, f"T1 {(yBrow-yTop)/faceH*100:.0f}%", xFaceR+5, yTop+(yBrow-yTop)//2, (0,165,255))
put_label(left, f"T2 {(ySub-yBrow)/faceH*100:.0f}%",  xFaceR+5, yBrow+(ySub-yBrow)//2, (0,165,255))
put_label(left, f"T3 {(yMen-ySub)/faceH*100:.0f}%",   xFaceR+5, ySub+(yMen-ySub)//2,  (0,165,255))

# =============================================================================
# RIGHT panel: correct overlay
# Problema raiz: lm[10] é o ponto mais alto do mesh, que está em y=261
# (23% da imagem), mas a testa real começa em ~y=0.
# O GridThirds usa yTop=lm[10] e depois traça o "ideal" como yTop+faceH/3.
# Mas as métricas (upper=20%) são calculadas com o MESMO lm[10].
# Então os terços são consistentes internamente — o visual não está "errado",
# mas a interpretação da linha laranja T1/yBrow indica que o rosto tem
# terço superior CURTO (brow alta), o que é correto para Brad Pitt.
#
# O REAL bug visual é que a linha "ideal dashed" de T1 cai em yT1=549 (64%),
# muito abaixo do brow real (y=435), mostrando um gap enorme que assusta o usuário.
# A legenda clarifica (20% vs 33%), mas visualmente parece que o overlay está quebrado.
#
# FIX: mostrar claramente nos labels O QUE CADA LINHA É.
# =============================================================================
right = img.copy()

cv2.rectangle(right, (xFaceL, yTop), (xFaceR, yMen), (255,255,255), 1)

# Ideal thirds (dashed)
for y, label in [(yT1_ideal, "ideal 1/3"), (yT2_ideal, "ideal 2/3")]:
    cv2.line(right, (0, y), (w, y), (180,130,255), 1)
    put_label(right, label, 5, y-4, (180,130,255))

# Real landmark lines (orange solid) with clear labels
cv2.line(right, (0, yBrow), (w, yBrow), (0,165,255), 2)
put_label(right, f"SOBRANCELHA (real T1={( yBrow-yTop)/faceH*100:.0f}%)", 5, yBrow-6, (0,165,255))
cv2.line(right, (0, ySub), (w, ySub), (0,165,255), 2)
put_label(right, f"SUBNASALE (real T2-end={( ySub-yTop)/faceH*100:.0f}%)", 5, ySub-6, (0,165,255))

# lm[10] and menton markers
cv2.line(right, (0, yTop), (w, yTop), (255,255,255), 1)
put_label(right, f"lm[10] hairline proxy (y={yTop})", 5, yTop+14, (255,255,255))
cv2.line(right, (0, yMen), (w, yMen), (255,255,255), 1)

# Fifths 
for i in [1,2,3,4]:
    xi = int(xFaceL + i * fifth)
    cv2.line(right, (xi, yTop), (xi, yMen), (180,130,255), 1)
for x, label in [(eye_ol[0],'OL'), (eye_il[0],'IL'), (eye_ir[0],'IR'), (eye_or[0],'OR')]:
    cv2.line(right, (x, yTop), (x, yMen), (0,165,255), 1)

put_label(right, "CORRETO (mesmo calc, labels claros)", 10, 30, (0,255,0), 0.55)
put_label(right, f"T1={( yBrow-yTop)/faceH*100:.0f}% T2={(ySub-yBrow)/faceH*100:.0f}% T3={(yMen-ySub)/faceH*100:.0f}%", 10, 55, (0,200,255))

# Combine
combined = np.hstack([left, right])
cv2.line(combined, (w, 0), (w, h), (255,255,0), 2)
cv2.imwrite('/tmp/debug_comparison.jpg', combined)
print(f"Saved /tmp/debug_comparison.jpg ({combined.shape[1]}x{combined.shape[0]})")
EOF


Read [](file:///tmp/debug_comparison.jpg)

Agora tenho o diagnóstico visual definitivo. Os dois painéis mostram **o mesmo cálculo** — o problema não é nos números, é em **como o overlay comunica o que está desenhado**. Vou agora fazer uma análise crítica completa antes de implementar qualquer fix.

**Análise crítica real:**

O overlay `GridThirds` tem **dois problemas distintos**:

1. **Problema de semântica visual:** A linha dashed "ideal" (T1 = yTop + faceH/3) fica muito abaixo da sobrancelha real, criando um gap visual enorme que faz parecer que o sistema está quebrado. O usuário vê a sobrancelha laranja acima e a linha roxa "ideal" muito abaixo — isso **inverte a intuição**: parece que o "ideal" está mais pra baixo quando na verdade T1 curto (20%) significa sobrancelha ALTA.

2. **Problema de âncora do hairline:** `lm[10]` não é o hairline real — é o ponto mais alto do mesh, que está em y=261 (23% da imagem). Existe testa real acima. Isso faz o terço superior parecer menor do que é na realidade anatômica.

Agora vou implementar os fixes corretos:

Used tool: ToolSearch

Agora vou corrigir o `GridThirds`. O problema central: as linhas dashed roxas estão em `yTop + faceH/3` (posição "onde estaria o ideal") mas a **semântica está invertida** — a linha laranja ACIMA da dashed faz parecer que o overlay está errado, quando na verdade está correto. Preciso trocar a comunicação visual.

Read [](file:///home/luizescobal/study/face-before-after/frontend/src/components/OverlayLayer.tsx)

Agora tenho clareza total. Vou fazer os fixes:

**Fix 1 — `GridThirds`:** 
- As linhas dashed estão corretas mas as linhas "real" (laranja) precisam de label direto em cima delas, não só no label lateral. Hoje o label lateral diz "T1 20% (33%)" mas isso é confuso porque a linha laranja está ACIMA da dashed, fazendo parecer que o overlay errou.
- A correção: desenhar label diretamente nas linhas laranja indicando o que são, e mudar o label lateral para mostrar o **desvio** do ideal.

**Fix 2 — `GridFifths`:**
- Os quintos estão funcionando corretamente (desvios de ~13px). O label precisa mostrar o desvio por quinto.Agora fix do `GridFifths` — adicionar desvio por quinto e label nas linhas de borda:Agora verifico o `FaceExtents` — preciso confirmar que o bounding box usa os landmarks certos:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]

# FaceExtents usa: yTop=lm[10], yMenton=lm[152], xL=lm[234], xR=lm[454]
yTop   = lm(10)[1]
yMen   = lm(152)[1]
xL     = lm(234)[0]
xR     = lm(454)[0]

print(f"FaceExtents bounding box: x=[{xL},{xR}] y=[{yTop},{yMen}]")
print(f"Image dimensions: {w}x{h}")
print(f"Box width: {xR-xL}px ({(xR-xL)/w*100:.0f}% of image width)")
print(f"Box height: {yMen-yTop}px ({(yMen-yTop)/h*100:.0f}% of image height)")
print()

# Draw FaceExtents to verify visually
out = img.copy()
cv2.rectangle(out, (xL, yTop), (xR, yMen), (255,255,255), 2)
cv2.circle(out, lm(10),  6, (0,255,0), -1)
cv2.circle(out, lm(152), 6, (0,255,0), -1)
cv2.circle(out, lm(234), 6, (0,255,255), -1)
cv2.circle(out, lm(454), 6, (0,255,255), -1)

# Does the box visually contain the face?
# Check: are eye outer corners inside the box?
eol = lm(33)
eor = lm(263)
print(f"Eye outer L: x={eol[0]} (box xL={xL}) — inside: {eol[0] > xL}")
print(f"Eye outer R: x={eor[0]} (box xR={xR}) — inside: {eor[0] < xR}")
print()
# Is crown at the top of the face or inside hair?
print(f"lm[10] y={yTop} vs image top y=0")
print(f"Hair region above crown: {yTop}px ({yTop/h*100:.0f}% of img — NOT in bounding box)")

cv2.imwrite('/tmp/face_extents_check.jpg', out)
print("Saved /tmp/face_extents_check.jpg")
EOF


Read [](file:///tmp/face_extents_check.jpg)

Aqui está o segundo problema real: **o `FaceExtents` está errado visualmente**. O box branco:
- **Topo (yTop=lm[10]):** começa no meio da testa, cortando o hairline real
- **Laterais (lm[234]/lm[454]):** os pontos zigomáticos estão na linha dos olhos (y≈583), não nas extremidades mais largas da face — o box é mais estreito que a face visível

O `FaceExtents` deveria englobar o rosto visual real. Preciso corrigir os anchors laterais para usar os pontos mais extremos da bochecha ao invés dos zigomáticos médios, e o topo para usar o ponto mais alto disponível no mesh.

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm_raw = lambda i: (landmarks[i][0], landmarks[i][1])

# Find the leftmost and rightmost points in the face mesh
all_x = [(i, landmarks[i][0], landmarks[i][1]) for i in range(478)]
leftmost  = sorted(all_x, key=lambda t: t[1])[:5]
rightmost = sorted(all_x, key=lambda t: t[1], reverse=True)[:5]
topmost   = sorted(all_x, key=lambda t: t[2])[:5]

print("5 leftmost (smallest x):")
for i, x, y in leftmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

print("\n5 rightmost (largest x):")
for i, x, y in rightmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

print("\n5 topmost (smallest y):")
for i, x, y in topmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

# Current zygo points
print(f"\nCurrent lm[234] (zygo L): x={landmarks[234][0]:.0f}, y={landmarks[234][1]:.0f}")
print(f"Current lm[454] (zygo R): x={landmarks[454][0]:.0f}, y={landmarks[454][1]:.0f}")
print(f"Current lm[10]  (crown):  x={landmarks[10][0]:.0f}, y={landmarks[10][1]:.0f}")

# Check specific candidates for wider face boundary
for idx in [234, 127, 93, 132, 58, 172, 136, 150, 149, 176, 148]:
    print(f"  lm[{idx}]: x={landmarks[idx][0]:.0f}, y={landmarks[idx][1]:.0f}")
EOF


Os pontos laterais `lm[234]` e `lm[454]` já são os mais extremos do mesh (x=91 e x=799 numa imagem de 847px). O problema não é os pontos — é que a imagem tem margem lateral de background. O `FaceExtents` está correto matematicamente; o que parece "estreito" é porque a imagem tem bastante espaço nas laterais.

O problema real do `FaceExtents` é apenas **o topo** — `lm[10]` em y=261 corta 23% da imagem acima (hairline/cabelo). Para o `FaceExtents` ter sentido visual, o topo deveria ser o **topo da imagem ou o topo do crop detectado**, não `lm[10]`.

Mas isso é uma decisão de design: o box mostra "o rosto detectável pelo mesh" (correto para fins de análise) ou "a extensão visual da cabeça" (mais intuitivo para o usuário). A correção mais honesta é adicionar uma nota no label "Hairline (mesh)" para deixar claro que o top é o limite do MediaPipe, não o topo real da cabeça.

Read [](file:///home/luizescobal/study/face-before-after/frontend/src/components/OverlayLayer.tsx)

Agora verifico o TypeScript e depois gero a imagem de revisão crítica:

Ran terminal command: cd /home/luizescobal/study/face-before-after/frontend && npx tsc --noEmit 2>&1 | head -30

TypeScript limpo. Agora gero a imagem de revisão crítica simulando exatamente o que o novo código faz:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]
out = img.copy()

def txt(img, text, x, y, color, scale=0.38):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

# === FaceExtents ===
yTop  = lm(10)[1]
yMen  = lm(152)[1]
xL    = lm(234)[0]
xR    = lm(454)[0]
WHITE = (255,255,255)
cv2.rectangle(out, (xL, yTop), (xR, yMen), WHITE, 1)
txt(out, "Trichion (mesh)", xL+4, yTop-4, WHITE)
txt(out, "Menton",          xL+4, yMen+14, WHITE)

# === GridThirds ===
yBrow = (lm(107)[1] + lm(336)[1]) // 2
ySub  = lm(2)[1]
faceH = yMen - yTop

yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

PURPLE = (200,150,255)
ORANGE = (0,165,255)

# Ideal dashed
cv2.line(out, (0, yT1_ideal), (w, yT1_ideal), PURPLE, 1)
cv2.line(out, (0, yT2_ideal), (w, yT2_ideal), PURPLE, 1)
txt(out, "ideal 1/3", xL+4, yT1_ideal-3, PURPLE)
txt(out, "ideal 2/3", xL+4, yT2_ideal-3, PURPLE)

# Real landmark lines
cv2.line(out, (0, yBrow), (w, yBrow), ORANGE, 2)
txt(out, "Sobrancelha", xL+4, yBrow-3, ORANGE)
cv2.line(out, (0, ySub),  (w, ySub),  ORANGE, 2)
txt(out, "Subnasale",    xL+4, ySub-3,  ORANGE)

# Lateral labels with deviation
thirds = [
    (yTop, yBrow, "upper_third_ratio", "T1"),
    (yBrow, ySub,  "middle_third_ratio", "T2"),
    (ySub, yMen,   "lower_third_ratio", "T3"),
]
SEV_COLORS = {"ideal":(80,200,80), "mild":(80,200,80), "moderate":(50,200,220), "strong":(0,165,255), "extreme":(0,80,255)}
for yA, yB, mid, label in thirds:
    m = metric_evals.get(mid, {})
    pct = (m.get('value', (yB-yA)/faceH)) * 100
    sev = m.get('severity_5', None)
    color = SEV_COLORS.get(sev, (150,150,150))
    dev = pct - 33.3
    devStr = f"+{dev:.0f}" if dev >= 0 else f"{dev:.0f}"
    txt(out, f"{label} {pct:.0f}% ({devStr}%)", xR+6, int((yA+yB)/2+4), color, 0.42)

# === GridFifths ===
xFaceL = lm(234)[0]
xFaceR = lm(454)[0]
faceW  = xFaceR - xFaceL
fifth  = faceW / 5

actuals = [lm(33)[0], lm(133)[0], lm(362)[0], lm(263)[0]]
names   = ["OExt.E", "OInt.E", "OInt.D", "OExt.D"]
ideals  = [xFaceL + (i+1)*fifth for i in range(4)]

# Face edges
cv2.line(out, (xFaceL, yTop), (xFaceL, yMen), WHITE, 1)
cv2.line(out, (xFaceR, yTop), (xFaceR, yMen), WHITE, 1)

# Ideal fifths dashed
for xi in ideals:
    cv2.line(out, (int(xi), yTop), (int(xi), yMen), PURPLE, 1)

# Actual eye corners + deviation
yLabel = yMen - 14
for i, (x, name) in enumerate(zip(actuals, names)):
    cv2.line(out, (x, yTop), (x, yMen), ORANGE, 1)
    dev = int(round(x - ideals[i]))
    devStr = f"+{dev}" if dev > 0 else str(dev)
    txt(out, f"{name} {devStr}px", x+2, yLabel - i*12, ORANGE, 0.35)

txt(out, "Quintos - tracejado:ideal laranja:real (desvio px)", xFaceL+2, yTop-6, PURPLE, 0.35)

cv2.imwrite('/tmp/overlay_final_review.jpg', out)
print("Saved /tmp/overlay_final_review.jpg")
EOF


Ran terminal command: cd /home/luizescobal/study/face-before-after && python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]
out = img.copy()

def txt(img, text, x, y, color, scale=0.38):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

yTop  = lm(10)[1]
yMen  = lm(152)[1]
xL    = lm(234)[0]
xR    = lm(454)[0]
WHITE  = (255,255,255)
PURPLE = (200,150,255)
ORANGE = (0,165,255)

# FaceExtents
cv2.rectangle(out, (xL, yTop), (xR, yMen), WHITE, 1)
txt(out, "Trichion (mesh)", xL+4, yTop-4, WHITE)
txt(out, "Menton", xL+4, yMen+14, WHITE)

# GridThirds
yBrow = (lm(107)[1] + lm(336)[1]) // 2
ySub  = lm(2)[1]
faceH = yMen - yTop
yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

cv2.line(out, (0, yT1_ideal), (w, yT1_ideal), PURPLE, 1)
cv2.line(out, (0, yT2_ideal), (w, yT2_ideal), PURPLE, 1)
txt(out, "ideal 1/3", xL+4, yT1_ideal-3, PURPLE)
txt(out, "ideal 2/3", xL+4, yT2_ideal-3, PURPLE)

cv2.line(out, (0, yBrow), (w, yBrow), ORANGE, 2)
txt(out, "Sobrancelha", xL+4, yBrow-3, ORANGE)
cv2.line(out, (0, ySub), (w, ySub), ORANGE, 2)
txt(out, "Subnasale", xL+4, ySub-3, ORANGE)

SEV = {"ideal":(80,200,80),"mild":(80,200,80),"moderate":(50,200,220),"strong":(0,165,255),"extreme":(0,80,255)}
for yA, yB, mid, label in [(yTop,yBrow,"upper_third_ratio","T1"),(yBrow,ySub,"middle_third_ratio","T2"),(ySub,yMen,"lower_third_ratio","T3")]:
    m = metric_evals.get(mid, {})
    pct = m.get('value', (yB-yA)/faceH) * 100
    color = SEV.get(m.get('severity_5'), (150,150,150))
    dev = pct - 33.3
    txt(out, f"{label} {pct:.0f}% ({'+' if dev>=0 else ''}{dev:.0f}%)", xR+6, int((yA+yB)/2+4), color, 0.42)

# GridFifths
faceW = xR - xL
fifth = faceW / 5
actuals = [lm(33)[0], lm(133)[0], lm(362)[0], lm(263)[0]]
names   = ["OExt.E","OInt.E","OInt.D","OExt.D"]
ideals  = [xL + (i+1)*fifth for i in range(4)]

cv2.line(out, (xL, yTop), (xL, yMen), WHITE, 1)
cv2.line(out, (xR, yTop), (xR, yMen), WHITE, 1)
for xi in ideals:
    cv2.line(out, (int(xi), yTop), (int(xi), yMen), PURPLE, 1)

yLbl = yMen - 16
for i, (x, name) in enumerate(zip(actuals, names)):
    cv2.line(out, (x, yTop), (x, yMen), ORANGE, 1)
    dev = int(round(x - ideals[i]))
    txt(out, f"{name} {'+' if dev>0 else ''}{dev}px", x+2, yLbl - i*14, ORANGE, 0.35)

txt(out, "Quintos: tracejado=ideal, laranja=real", xL+2, yTop-6, PURPLE, 0.36)

cv2.imwrite('/tmp/overlay_final_review.jpg', out)
print(f"OK {w}x{h}")
EOF


Vou ler o contexto canônico antes de tocar no código.

Read [](file:///home/luizescobal/study/face-before-after/.claude/face-analysis/00-index.md)

Read [](file:///home/luizescobal/study/face-before-after/.claude/face-analysis/08-svg-overlays.md)

A doc diz que os bugs foram "corrigidos", mas minha análise visual agora mostra que os terços ainda estão errados. Vou verificar o estado real do código e entender o problema raiz de ponta a ponta.

Ran terminal command: python3 - <<'EOF'
import json
with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

lm = data['landmarks']

# Todos os pontos relevantes
crown = lm[10]
menton = lm[152]
brow_l = lm[107]
brow_r = lm[336]
subnasale = lm[2]
zygo_l = lm[234]
zygo_r = lm[454]

print(f"Image crop: {data['auto_crop']['crop_bbox']}")
print(f"Image (canonical) size: 847x1155 (da imagem lida)")
print()
print(f"lm[10] (crown/forehead_center): y={crown[1]:.0f}")
print(f"lm[151] (forehead_top):         y={lm[151][1]:.0f}")
print(f"lm[10] is far from top of head - real hairline should be ~y=0 area")
print()

# What percentage of the image height is crown at?
img_h = 1155  # from the image
print(f"Crown lm[10] at y={crown[1]:.0f} = {crown[1]/img_h*100:.1f}% from top of image")
print(f"This means lm[10] is NOT at the top of the head")
print()

# What does the metric say?
face_h = menton[1] - crown[1]
y_brow = (brow_l[1] + brow_r[1]) / 2
y_sub = subnasale[1]
print(f"Face height (crown→menton): {face_h:.0f}px")
print(f"Upper: {(y_brow-crown[1])/face_h*100:.1f}%  Mid: {(y_sub-y_brow)/face_h*100:.1f}%  Lower: {(menton[1]-y_sub)/face_h*100:.1f}%")
print()

# Check if backend metric_evaluations exist in JSON
blocks = data.get('measurements_blocks', {})
print("measurements_blocks keys:", list(blocks.keys())[:5])

# Check if metric data has third ratios
metric_evals = data.get('metric_evaluations', [])
print(f"metric_evaluations count: {len(metric_evals)}")
if metric_evals:
    for m in metric_evals:
        if 'third' in m.get('metric_id',''):
            print(m)
EOF


Ran terminal command: grep -n "upper_third\|lower_third\|middle_third\|FOREHEAD\|P_FOREHEAD\|landmark.*10\b" /home/luizescobal/study/face-before-after/backend/app/services/metrics/thirds.py | head -40

Ran terminal command: cat /home/luizescobal/study/face-before-after/backend/app/services/metrics/thirds.py

Agora tenho o quadro completo. Vou verificar o que o `P_FOREHEAD_CROWN=10` realmente é no MediaPipe, e entender o problema dos quintos também.

Ran terminal command: grep -n "P_FOREHEAD_CROWN\|P_MENTON\|P_BROW\|P_SUBNASALE\|= 10\b\|= 152\b" /home/luizescobal/study/face-before-after/backend/app/domain/landmarks_mesh.py | head -30

Ran terminal command: python3 - <<'EOF'
import json
with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)
lm = data['landmarks']

# Scan the top Y coordinates in the mesh to understand what landmark 10 actually is
# vs what's actually at the top of the face
top_lms = sorted(enumerate(lm), key=lambda x: x[1][1])[:15]
print("Landmarks with lowest Y (top of image):")
for idx, (x,y) in top_lms:
    print(f"  lm[{idx}]: x={x:.0f}, y={y:.0f}")

print()
print(f"lm[10]: x={lm[10][0]:.0f}, y={lm[10][1]:.0f}")
print(f"lm[151]: x={lm[151][0]:.0f}, y={lm[151][1]:.0f}")
print(f"lm[9]: x={lm[9][0]:.0f}, y={lm[9][1]:.0f}")

# What about the fifths? Let's check what the frontend calculates
zygo_l = lm[234]
zygo_r = lm[454]
eye_ol = lm[33]
eye_or = lm[263]
eye_il = lm[133]
eye_ir = lm[362]

face_w = zygo_r[0] - zygo_l[0]
fifth  = face_w / 5

print(f"\n=== FIFTHS ANALYSIS ===")
print(f"Face width (234→454): {face_w:.0f}px")
print(f"Ideal fifth: {fifth:.1f}px")
print()
print(f"Ideal edges from zygo_l ({zygo_l[0]:.0f}):")
for i in [1,2,3,4]:
    print(f"  {i}/5 = x={zygo_l[0]+i*fifth:.0f}")

print()
print(f"Actual eye corners:")
print(f"  eye outer L (lm[33]):  x={eye_ol[0]:.0f} (ideal 1/5 = {zygo_l[0]+fifth:.0f}, delta={eye_ol[0]-(zygo_l[0]+fifth):.0f}px)")
print(f"  eye inner L (lm[133]): x={eye_il[0]:.0f} (ideal 2/5 = {zygo_l[0]+2*fifth:.0f}, delta={eye_il[0]-(zygo_l[0]+2*fifth):.0f}px)")
print(f"  eye inner R (lm[362]): x={eye_ir[0]:.0f} (ideal 3/5 = {zygo_l[0]+3*fifth:.0f}, delta={eye_ir[0]-(zygo_l[0]+3*fifth):.0f}px)")
print(f"  eye outer R (lm[263]): x={eye_or[0]:.0f} (ideal 4/5 = {zygo_l[0]+4*fifth:.0f}, delta={eye_or[0]-(zygo_l[0]+4*fifth):.0f}px)")
EOF


Agora tenho o diagnóstico completo e definitivo. Vou fazer os fixes.

**Diagnóstico real:**

1. **Terços — o problema é duplo:** `lm[10]` é realmente o ponto mais alto do mesh (y=261), mas está em y=22.6% da imagem — existe cabeça/cabelo acima. O cálculo de métrica usa `lm[10]→menton` que dá upper=20%. **Isso está matematicamente correto dado que o MediaPipe não detecta acima do hairline** — o problema é que o overlay visual desenha a linha do "ideal" em `yTop + faceH/3` mas as linhas laranja "reais" mostram brow/subnasale que batem com os 20%/40% corretos. O overlay está correto mas **confuso visualmente** — a legenda T1/T2/T3 mostra os percentuais reais da face detectada, não da "face ideal".

2. **Quintos — funcionam bem:** deltas máximos de 13px (2% da largura) são aceitáveis, o overlay dual (tracejado ideal + laranja real) está correto.

O verdadeiro bug visual é: **o overlay de terços desenhando as linhas dashed "ideais" em posições absolutas (yTop + faceH/3) faz parecer que a face está errada quando o problema é que lm[10] não é o hairline real**. Preciso verificar o `GridThirds` mais cuidadosamente:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

# Simulate exactly what GridThirds does
P_FOREHEAD_CROWN = 10
P_BROW_LEFT_INNER = 107
P_BROW_RIGHT_INNER = 336
P_SUBNASALE = 2
P_MENTON = 152
P_ZYGO_IMG_RIGHT = 454
P_ZYGO_IMG_LEFT = 234

crown = lm(P_FOREHEAD_CROWN)
menton = lm(P_MENTON)
brow_l = lm(P_BROW_LEFT_INNER)
brow_r = lm(P_BROW_RIGHT_INNER)
zygo_r = lm(P_ZYGO_IMG_RIGHT)
zygo_l = lm(P_ZYGO_IMG_LEFT)
subnasale = lm(P_SUBNASALE)

yTop  = crown[1]
yBrow = (brow_l[1] + brow_r[1]) // 2
ySub  = subnasale[1]
yMen  = menton[1]

faceH = yMen - yTop
yT1   = yTop + faceH // 3   # ideal 1/3 line (dashed purple)
yT2   = yTop + 2 * faceH // 3  # ideal 2/3 line (dashed purple)

print("=== GridThirds exact simulation ===")
print(f"yTop={yTop} (lm[10] forehead crown)")
print(f"yBrow={yBrow} (brow inner midpoint) — laranja sólido")
print(f"ySub={ySub}  (subnasale) — laranja sólido")
print(f"yMen={yMen}  (menton)")
print(f"faceH={faceH}px")
print()
print(f"Ideal dashed lines: yT1={yT1} yT2={yT2}")
print(f"Real orange lines:  yBrow={yBrow} ySub={ySub}")
print()
print(f"Delta yBrow vs yT1: {yBrow - yT1}px (negative = brow ABOVE ideal 1/3)")
print(f"Delta ySub  vs yT2: {ySub  - yT2}px")
print()

# Labels - what does GridThirds render?
# The metric values from backend:
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}
upper_val  = metric_evals['upper_third_ratio']['value']
middle_val = metric_evals['middle_third_ratio']['value']
lower_val  = metric_evals['lower_third_ratio']['value']

print(f"Label rendered (from backend metric values):")
print(f"  T1: {upper_val*100:.0f}% (vs ideal 33%)")
print(f"  T2: {middle_val*100:.0f}% (vs ideal 33%)")
print(f"  T3: {lower_val*100:.0f}% (vs ideal 33%)")
print()
print("VERDICT:")
print("- lm[10] at y=261 is the HIGHEST point of MediaPipe mesh")
print("- Hair above it (~y=0..261) is NOT detected by MediaPipe")
print("- So upper_third=20% is REAL — Brad Pitt has high hairline / small upper third")
print("  within the DETECTED face region")
print()
print("The VISUAL problem is that the dashed 'ideal' lines sit at yTop+faceH/3,")
print("which looks correct, but the labels show 20%/40%/40% making it look wrong.")
print()
print("Actually the real issue: if lm[10] is the highest mesh point,")
print("the brow line at yBrow falls only 20% into the detected face — which IS correct")
print("for Brad Pitt who has a larger-than-ideal forehead relative to the 3 equal thirds.")
print("Wait — 20% upper means SHORT upper third (brow close to hairline), not long forehead.")
print()
print(f"Upper: {upper_val*100:.1f}% SHORT = brow is HIGH = forehead is SHORT relative to face")
EOF


Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

# Generate definitive visual: side-by-side comparison
# LEFT: what the current overlay draws
# RIGHT: what it SHOULD draw

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]

crown = lm(10)
menton = lm(152)
brow_l = lm(107)
brow_r = lm(336)
sub = lm(2)
zygo_l = lm(234)
zygo_r = lm(454)
eye_ol = lm(33)
eye_or = lm(263)
eye_il = lm(133)
eye_ir = lm(362)

yTop = crown[1]
yBrow = (brow_l[1] + brow_r[1]) // 2
ySub = sub[1]
yMen = menton[1]
faceH = yMen - yTop
yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

xFaceL = zygo_l[0]
xFaceR = zygo_r[0]
faceW = xFaceR - xFaceL
fifth = faceW / 5

def put_label(img, text, x, y, color=(255,255,255), scale=0.45):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

# =============================================================================
# LEFT panel: current overlay behavior
# =============================================================================
left = img.copy()

# FaceExtents box
cv2.rectangle(left, (xFaceL, yTop), (xFaceR, yMen), (255,255,255), 1)

# Thirds: ideal dashed (purple) and real orange
cv2.line(left, (0, yT1_ideal), (w, yT1_ideal), (180,130,255), 1)
cv2.line(left, (0, yT2_ideal), (w, yT2_ideal), (180,130,255), 1)
cv2.line(left, (0, yBrow),     (w, yBrow),     (0,165,255), 2)
cv2.line(left, (0, ySub),      (w, ySub),      (0,165,255), 2)

# Fifths: ideal dashed + actual orange
for i in [1,2,3,4]:
    xi = int(xFaceL + i * fifth)
    cv2.line(left, (xi, yTop), (xi, yMen), (180,130,255), 1)
for x in [eye_ol[0], eye_il[0], eye_ir[0], eye_or[0]]:
    cv2.line(left, (x, yTop), (x, yMen), (0,165,255), 1)

put_label(left, "ATUAL", 10, 30, (0,200,255), 0.7)
put_label(left, f"T1 {(yBrow-yTop)/faceH*100:.0f}%", xFaceR+5, yTop+(yBrow-yTop)//2, (0,165,255))
put_label(left, f"T2 {(ySub-yBrow)/faceH*100:.0f}%",  xFaceR+5, yBrow+(ySub-yBrow)//2, (0,165,255))
put_label(left, f"T3 {(yMen-ySub)/faceH*100:.0f}%",   xFaceR+5, ySub+(yMen-ySub)//2,  (0,165,255))

# =============================================================================
# RIGHT panel: correct overlay
# Problema raiz: lm[10] é o ponto mais alto do mesh, que está em y=261
# (23% da imagem), mas a testa real começa em ~y=0.
# O GridThirds usa yTop=lm[10] e depois traça o "ideal" como yTop+faceH/3.
# Mas as métricas (upper=20%) são calculadas com o MESMO lm[10].
# Então os terços são consistentes internamente — o visual não está "errado",
# mas a interpretação da linha laranja T1/yBrow indica que o rosto tem
# terço superior CURTO (brow alta), o que é correto para Brad Pitt.
#
# O REAL bug visual é que a linha "ideal dashed" de T1 cai em yT1=549 (64%),
# muito abaixo do brow real (y=435), mostrando um gap enorme que assusta o usuário.
# A legenda clarifica (20% vs 33%), mas visualmente parece que o overlay está quebrado.
#
# FIX: mostrar claramente nos labels O QUE CADA LINHA É.
# =============================================================================
right = img.copy()

cv2.rectangle(right, (xFaceL, yTop), (xFaceR, yMen), (255,255,255), 1)

# Ideal thirds (dashed)
for y, label in [(yT1_ideal, "ideal 1/3"), (yT2_ideal, "ideal 2/3")]:
    cv2.line(right, (0, y), (w, y), (180,130,255), 1)
    put_label(right, label, 5, y-4, (180,130,255))

# Real landmark lines (orange solid) with clear labels
cv2.line(right, (0, yBrow), (w, yBrow), (0,165,255), 2)
put_label(right, f"SOBRANCELHA (real T1={( yBrow-yTop)/faceH*100:.0f}%)", 5, yBrow-6, (0,165,255))
cv2.line(right, (0, ySub), (w, ySub), (0,165,255), 2)
put_label(right, f"SUBNASALE (real T2-end={( ySub-yTop)/faceH*100:.0f}%)", 5, ySub-6, (0,165,255))

# lm[10] and menton markers
cv2.line(right, (0, yTop), (w, yTop), (255,255,255), 1)
put_label(right, f"lm[10] hairline proxy (y={yTop})", 5, yTop+14, (255,255,255))
cv2.line(right, (0, yMen), (w, yMen), (255,255,255), 1)

# Fifths 
for i in [1,2,3,4]:
    xi = int(xFaceL + i * fifth)
    cv2.line(right, (xi, yTop), (xi, yMen), (180,130,255), 1)
for x, label in [(eye_ol[0],'OL'), (eye_il[0],'IL'), (eye_ir[0],'IR'), (eye_or[0],'OR')]:
    cv2.line(right, (x, yTop), (x, yMen), (0,165,255), 1)

put_label(right, "CORRETO (mesmo calc, labels claros)", 10, 30, (0,255,0), 0.55)
put_label(right, f"T1={( yBrow-yTop)/faceH*100:.0f}% T2={(ySub-yBrow)/faceH*100:.0f}% T3={(yMen-ySub)/faceH*100:.0f}%", 10, 55, (0,200,255))

# Combine
combined = np.hstack([left, right])
cv2.line(combined, (w, 0), (w, h), (255,255,0), 2)
cv2.imwrite('/tmp/debug_comparison.jpg', combined)
print(f"Saved /tmp/debug_comparison.jpg ({combined.shape[1]}x{combined.shape[0]})")
EOF


Read [](file:///tmp/debug_comparison.jpg)

Agora tenho o diagnóstico visual definitivo. Os dois painéis mostram **o mesmo cálculo** — o problema não é nos números, é em **como o overlay comunica o que está desenhado**. Vou agora fazer uma análise crítica completa antes de implementar qualquer fix.

**Análise crítica real:**

O overlay `GridThirds` tem **dois problemas distintos**:

1. **Problema de semântica visual:** A linha dashed "ideal" (T1 = yTop + faceH/3) fica muito abaixo da sobrancelha real, criando um gap visual enorme que faz parecer que o sistema está quebrado. O usuário vê a sobrancelha laranja acima e a linha roxa "ideal" muito abaixo — isso **inverte a intuição**: parece que o "ideal" está mais pra baixo quando na verdade T1 curto (20%) significa sobrancelha ALTA.

2. **Problema de âncora do hairline:** `lm[10]` não é o hairline real — é o ponto mais alto do mesh, que está em y=261 (23% da imagem). Existe testa real acima. Isso faz o terço superior parecer menor do que é na realidade anatômica.

Agora vou implementar os fixes corretos:

Used tool: ToolSearch

Agora vou corrigir o `GridThirds`. O problema central: as linhas dashed roxas estão em `yTop + faceH/3` (posição "onde estaria o ideal") mas a **semântica está invertida** — a linha laranja ACIMA da dashed faz parecer que o overlay está errado, quando na verdade está correto. Preciso trocar a comunicação visual.

Read [](file:///home/luizescobal/study/face-before-after/frontend/src/components/OverlayLayer.tsx)

Agora tenho clareza total. Vou fazer os fixes:

**Fix 1 — `GridThirds`:** 
- As linhas dashed estão corretas mas as linhas "real" (laranja) precisam de label direto em cima delas, não só no label lateral. Hoje o label lateral diz "T1 20% (33%)" mas isso é confuso porque a linha laranja está ACIMA da dashed, fazendo parecer que o overlay errou.
- A correção: desenhar label diretamente nas linhas laranja indicando o que são, e mudar o label lateral para mostrar o **desvio** do ideal.

**Fix 2 — `GridFifths`:**
- Os quintos estão funcionando corretamente (desvios de ~13px). O label precisa mostrar o desvio por quinto.Agora fix do `GridFifths` — adicionar desvio por quinto e label nas linhas de borda:Agora verifico o `FaceExtents` — preciso confirmar que o bounding box usa os landmarks certos:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]

# FaceExtents usa: yTop=lm[10], yMenton=lm[152], xL=lm[234], xR=lm[454]
yTop   = lm(10)[1]
yMen   = lm(152)[1]
xL     = lm(234)[0]
xR     = lm(454)[0]

print(f"FaceExtents bounding box: x=[{xL},{xR}] y=[{yTop},{yMen}]")
print(f"Image dimensions: {w}x{h}")
print(f"Box width: {xR-xL}px ({(xR-xL)/w*100:.0f}% of image width)")
print(f"Box height: {yMen-yTop}px ({(yMen-yTop)/h*100:.0f}% of image height)")
print()

# Draw FaceExtents to verify visually
out = img.copy()
cv2.rectangle(out, (xL, yTop), (xR, yMen), (255,255,255), 2)
cv2.circle(out, lm(10),  6, (0,255,0), -1)
cv2.circle(out, lm(152), 6, (0,255,0), -1)
cv2.circle(out, lm(234), 6, (0,255,255), -1)
cv2.circle(out, lm(454), 6, (0,255,255), -1)

# Does the box visually contain the face?
# Check: are eye outer corners inside the box?
eol = lm(33)
eor = lm(263)
print(f"Eye outer L: x={eol[0]} (box xL={xL}) — inside: {eol[0] > xL}")
print(f"Eye outer R: x={eor[0]} (box xR={xR}) — inside: {eor[0] < xR}")
print()
# Is crown at the top of the face or inside hair?
print(f"lm[10] y={yTop} vs image top y=0")
print(f"Hair region above crown: {yTop}px ({yTop/h*100:.0f}% of img — NOT in bounding box)")

cv2.imwrite('/tmp/face_extents_check.jpg', out)
print("Saved /tmp/face_extents_check.jpg")
EOF


Read [](file:///tmp/face_extents_check.jpg)

Aqui está o segundo problema real: **o `FaceExtents` está errado visualmente**. O box branco:
- **Topo (yTop=lm[10]):** começa no meio da testa, cortando o hairline real
- **Laterais (lm[234]/lm[454]):** os pontos zigomáticos estão na linha dos olhos (y≈583), não nas extremidades mais largas da face — o box é mais estreito que a face visível

O `FaceExtents` deveria englobar o rosto visual real. Preciso corrigir os anchors laterais para usar os pontos mais extremos da bochecha ao invés dos zigomáticos médios, e o topo para usar o ponto mais alto disponível no mesh.

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm_raw = lambda i: (landmarks[i][0], landmarks[i][1])

# Find the leftmost and rightmost points in the face mesh
all_x = [(i, landmarks[i][0], landmarks[i][1]) for i in range(478)]
leftmost  = sorted(all_x, key=lambda t: t[1])[:5]
rightmost = sorted(all_x, key=lambda t: t[1], reverse=True)[:5]
topmost   = sorted(all_x, key=lambda t: t[2])[:5]

print("5 leftmost (smallest x):")
for i, x, y in leftmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

print("\n5 rightmost (largest x):")
for i, x, y in rightmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

print("\n5 topmost (smallest y):")
for i, x, y in topmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

# Current zygo points
print(f"\nCurrent lm[234] (zygo L): x={landmarks[234][0]:.0f}, y={landmarks[234][1]:.0f}")
print(f"Current lm[454] (zygo R): x={landmarks[454][0]:.0f}, y={landmarks[454][1]:.0f}")
print(f"Current lm[10]  (crown):  x={landmarks[10][0]:.0f}, y={landmarks[10][1]:.0f}")

# Check specific candidates for wider face boundary
for idx in [234, 127, 93, 132, 58, 172, 136, 150, 149, 176, 148]:
    print(f"  lm[{idx}]: x={landmarks[idx][0]:.0f}, y={landmarks[idx][1]:.0f}")
EOF


Os pontos laterais `lm[234]` e `lm[454]` já são os mais extremos do mesh (x=91 e x=799 numa imagem de 847px). O problema não é os pontos — é que a imagem tem margem lateral de background. O `FaceExtents` está correto matematicamente; o que parece "estreito" é porque a imagem tem bastante espaço nas laterais.

O problema real do `FaceExtents` é apenas **o topo** — `lm[10]` em y=261 corta 23% da imagem acima (hairline/cabelo). Para o `FaceExtents` ter sentido visual, o topo deveria ser o **topo da imagem ou o topo do crop detectado**, não `lm[10]`.

Mas isso é uma decisão de design: o box mostra "o rosto detectável pelo mesh" (correto para fins de análise) ou "a extensão visual da cabeça" (mais intuitivo para o usuário). A correção mais honesta é adicionar uma nota no label "Hairline (mesh)" para deixar claro que o top é o limite do MediaPipe, não o topo real da cabeça.

Read [](file:///home/luizescobal/study/face-before-after/frontend/src/components/OverlayLayer.tsx)

Agora verifico o TypeScript e depois gero a imagem de revisão crítica:

Ran terminal command: cd /home/luizescobal/study/face-before-after/frontend && npx tsc --noEmit 2>&1 | head -30

TypeScript limpo. Agora gero a imagem de revisão crítica simulando exatamente o que o novo código faz:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]
out = img.copy()

def txt(img, text, x, y, color, scale=0.38):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

# === FaceExtents ===
yTop  = lm(10)[1]
yMen  = lm(152)[1]
xL    = lm(234)[0]
xR    = lm(454)[0]
WHITE = (255,255,255)
cv2.rectangle(out, (xL, yTop), (xR, yMen), WHITE, 1)
txt(out, "Trichion (mesh)", xL+4, yTop-4, WHITE)
txt(out, "Menton",          xL+4, yMen+14, WHITE)

# === GridThirds ===
yBrow = (lm(107)[1] + lm(336)[1]) // 2
ySub  = lm(2)[1]
faceH = yMen - yTop

yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

PURPLE = (200,150,255)
ORANGE = (0,165,255)

# Ideal dashed
cv2.line(out, (0, yT1_ideal), (w, yT1_ideal), PURPLE, 1)
cv2.line(out, (0, yT2_ideal), (w, yT2_ideal), PURPLE, 1)
txt(out, "ideal 1/3", xL+4, yT1_ideal-3, PURPLE)
txt(out, "ideal 2/3", xL+4, yT2_ideal-3, PURPLE)

# Real landmark lines
cv2.line(out, (0, yBrow), (w, yBrow), ORANGE, 2)
txt(out, "Sobrancelha", xL+4, yBrow-3, ORANGE)
cv2.line(out, (0, ySub),  (w, ySub),  ORANGE, 2)
txt(out, "Subnasale",    xL+4, ySub-3,  ORANGE)

# Lateral labels with deviation
thirds = [
    (yTop, yBrow, "upper_third_ratio", "T1"),
    (yBrow, ySub,  "middle_third_ratio", "T2"),
    (ySub, yMen,   "lower_third_ratio", "T3"),
]
SEV_COLORS = {"ideal":(80,200,80), "mild":(80,200,80), "moderate":(50,200,220), "strong":(0,165,255), "extreme":(0,80,255)}
for yA, yB, mid, label in thirds:
    m = metric_evals.get(mid, {})
    pct = (m.get('value', (yB-yA)/faceH)) * 100
    sev = m.get('severity_5', None)
    color = SEV_COLORS.get(sev, (150,150,150))
    dev = pct - 33.3
    devStr = f"+{dev:.0f}" if dev >= 0 else f"{dev:.0f}"
    txt(out, f"{label} {pct:.0f}% ({devStr}%)", xR+6, int((yA+yB)/2+4), color, 0.42)

# === GridFifths ===
xFaceL = lm(234)[0]
xFaceR = lm(454)[0]
faceW  = xFaceR - xFaceL
fifth  = faceW / 5

actuals = [lm(33)[0], lm(133)[0], lm(362)[0], lm(263)[0]]
names   = ["OExt.E", "OInt.E", "OInt.D", "OExt.D"]
ideals  = [xFaceL + (i+1)*fifth for i in range(4)]

# Face edges
cv2.line(out, (xFaceL, yTop), (xFaceL, yMen), WHITE, 1)
cv2.line(out, (xFaceR, yTop), (xFaceR, yMen), WHITE, 1)

# Ideal fifths dashed
for xi in ideals:
    cv2.line(out, (int(xi), yTop), (int(xi), yMen), PURPLE, 1)

# Actual eye corners + deviation
yLabel = yMen - 14
for i, (x, name) in enumerate(zip(actuals, names)):
    cv2.line(out, (x, yTop), (x, yMen), ORANGE, 1)
    dev = int(round(x - ideals[i]))
    devStr = f"+{dev}" if dev > 0 else str(dev)
    txt(out, f"{name} {devStr}px", x+2, yLabel - i*12, ORANGE, 0.35)

txt(out, "Quintos - tracejado:ideal laranja:real (desvio px)", xFaceL+2, yTop-6, PURPLE, 0.35)

cv2.imwrite('/tmp/overlay_final_review.jpg', out)
print("Saved /tmp/overlay_final_review.jpg")
EOF


Ran terminal command: cd /home/luizescobal/study/face-before-after && python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]
out = img.copy()

def txt(img, text, x, y, color, scale=0.38):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

yTop  = lm(10)[1]
yMen  = lm(152)[1]
xL    = lm(234)[0]
xR    = lm(454)[0]
WHITE  = (255,255,255)
PURPLE = (200,150,255)
ORANGE = (0,165,255)

# FaceExtents
cv2.rectangle(out, (xL, yTop), (xR, yMen), WHITE, 1)
txt(out, "Trichion (mesh)", xL+4, yTop-4, WHITE)
txt(out, "Menton", xL+4, yMen+14, WHITE)

# GridThirds
yBrow = (lm(107)[1] + lm(336)[1]) // 2
ySub  = lm(2)[1]
faceH = yMen - yTop
yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

cv2.line(out, (0, yT1_ideal), (w, yT1_ideal), PURPLE, 1)
cv2.line(out, (0, yT2_ideal), (w, yT2_ideal), PURPLE, 1)
txt(out, "ideal 1/3", xL+4, yT1_ideal-3, PURPLE)
txt(out, "ideal 2/3", xL+4, yT2_ideal-3, PURPLE)

cv2.line(out, (0, yBrow), (w, yBrow), ORANGE, 2)
txt(out, "Sobrancelha", xL+4, yBrow-3, ORANGE)
cv2.line(out, (0, ySub), (w, ySub), ORANGE, 2)
txt(out, "Subnasale", xL+4, ySub-3, ORANGE)

SEV = {"ideal":(80,200,80),"mild":(80,200,80),"moderate":(50,200,220),"strong":(0,165,255),"extreme":(0,80,255)}
for yA, yB, mid, label in [(yTop,yBrow,"upper_third_ratio","T1"),(yBrow,ySub,"middle_third_ratio","T2"),(ySub,yMen,"lower_third_ratio","T3")]:
    m = metric_evals.get(mid, {})
    pct = m.get('value', (yB-yA)/faceH) * 100
    color = SEV.get(m.get('severity_5'), (150,150,150))
    dev = pct - 33.3
    txt(out, f"{label} {pct:.0f}% ({'+' if dev>=0 else ''}{dev:.0f}%)", xR+6, int((yA+yB)/2+4), color, 0.42)

# GridFifths
faceW = xR - xL
fifth = faceW / 5
actuals = [lm(33)[0], lm(133)[0], lm(362)[0], lm(263)[0]]
names   = ["OExt.E","OInt.E","OInt.D","OExt.D"]
ideals  = [xL + (i+1)*fifth for i in range(4)]

cv2.line(out, (xL, yTop), (xL, yMen), WHITE, 1)
cv2.line(out, (xR, yTop), (xR, yMen), WHITE, 1)
for xi in ideals:
    cv2.line(out, (int(xi), yTop), (int(xi), yMen), PURPLE, 1)

yLbl = yMen - 16
for i, (x, name) in enumerate(zip(actuals, names)):
    cv2.line(out, (x, yTop), (x, yMen), ORANGE, 1)
    dev = int(round(x - ideals[i]))
    txt(out, f"{name} {'+' if dev>0 else ''}{dev}px", x+2, yLbl - i*14, ORANGE, 0.35)

txt(out, "Quintos: tracejado=ideal, laranja=real", xL+2, yTop-6, PURPLE, 0.36)

cv2.imwrite('/tmp/overlay_final_review.jpg', out)
print(f"OK {w}x{h}")
EOF

Vou ler o contexto canônico antes de tocar no código.

Read [](file:///home/luizescobal/study/face-before-after/.claude/face-analysis/00-index.md)

Read [](file:///home/luizescobal/study/face-before-after/.claude/face-analysis/08-svg-overlays.md)

A doc diz que os bugs foram "corrigidos", mas minha análise visual agora mostra que os terços ainda estão errados. Vou verificar o estado real do código e entender o problema raiz de ponta a ponta.

Ran terminal command: python3 - <<'EOF'
import json
with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

lm = data['landmarks']

# Todos os pontos relevantes
crown = lm[10]
menton = lm[152]
brow_l = lm[107]
brow_r = lm[336]
subnasale = lm[2]
zygo_l = lm[234]
zygo_r = lm[454]

print(f"Image crop: {data['auto_crop']['crop_bbox']}")
print(f"Image (canonical) size: 847x1155 (da imagem lida)")
print()
print(f"lm[10] (crown/forehead_center): y={crown[1]:.0f}")
print(f"lm[151] (forehead_top):         y={lm[151][1]:.0f}")
print(f"lm[10] is far from top of head - real hairline should be ~y=0 area")
print()

# What percentage of the image height is crown at?
img_h = 1155  # from the image
print(f"Crown lm[10] at y={crown[1]:.0f} = {crown[1]/img_h*100:.1f}% from top of image")
print(f"This means lm[10] is NOT at the top of the head")
print()

# What does the metric say?
face_h = menton[1] - crown[1]
y_brow = (brow_l[1] + brow_r[1]) / 2
y_sub = subnasale[1]
print(f"Face height (crown→menton): {face_h:.0f}px")
print(f"Upper: {(y_brow-crown[1])/face_h*100:.1f}%  Mid: {(y_sub-y_brow)/face_h*100:.1f}%  Lower: {(menton[1]-y_sub)/face_h*100:.1f}%")
print()

# Check if backend metric_evaluations exist in JSON
blocks = data.get('measurements_blocks', {})
print("measurements_blocks keys:", list(blocks.keys())[:5])

# Check if metric data has third ratios
metric_evals = data.get('metric_evaluations', [])
print(f"metric_evaluations count: {len(metric_evals)}")
if metric_evals:
    for m in metric_evals:
        if 'third' in m.get('metric_id',''):
            print(m)
EOF


Ran terminal command: grep -n "upper_third\|lower_third\|middle_third\|FOREHEAD\|P_FOREHEAD\|landmark.*10\b" /home/luizescobal/study/face-before-after/backend/app/services/metrics/thirds.py | head -40

Ran terminal command: cat /home/luizescobal/study/face-before-after/backend/app/services/metrics/thirds.py

Agora tenho o quadro completo. Vou verificar o que o `P_FOREHEAD_CROWN=10` realmente é no MediaPipe, e entender o problema dos quintos também.

Ran terminal command: grep -n "P_FOREHEAD_CROWN\|P_MENTON\|P_BROW\|P_SUBNASALE\|= 10\b\|= 152\b" /home/luizescobal/study/face-before-after/backend/app/domain/landmarks_mesh.py | head -30

Ran terminal command: python3 - <<'EOF'
import json
with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)
lm = data['landmarks']

# Scan the top Y coordinates in the mesh to understand what landmark 10 actually is
# vs what's actually at the top of the face
top_lms = sorted(enumerate(lm), key=lambda x: x[1][1])[:15]
print("Landmarks with lowest Y (top of image):")
for idx, (x,y) in top_lms:
    print(f"  lm[{idx}]: x={x:.0f}, y={y:.0f}")

print()
print(f"lm[10]: x={lm[10][0]:.0f}, y={lm[10][1]:.0f}")
print(f"lm[151]: x={lm[151][0]:.0f}, y={lm[151][1]:.0f}")
print(f"lm[9]: x={lm[9][0]:.0f}, y={lm[9][1]:.0f}")

# What about the fifths? Let's check what the frontend calculates
zygo_l = lm[234]
zygo_r = lm[454]
eye_ol = lm[33]
eye_or = lm[263]
eye_il = lm[133]
eye_ir = lm[362]

face_w = zygo_r[0] - zygo_l[0]
fifth  = face_w / 5

print(f"\n=== FIFTHS ANALYSIS ===")
print(f"Face width (234→454): {face_w:.0f}px")
print(f"Ideal fifth: {fifth:.1f}px")
print()
print(f"Ideal edges from zygo_l ({zygo_l[0]:.0f}):")
for i in [1,2,3,4]:
    print(f"  {i}/5 = x={zygo_l[0]+i*fifth:.0f}")

print()
print(f"Actual eye corners:")
print(f"  eye outer L (lm[33]):  x={eye_ol[0]:.0f} (ideal 1/5 = {zygo_l[0]+fifth:.0f}, delta={eye_ol[0]-(zygo_l[0]+fifth):.0f}px)")
print(f"  eye inner L (lm[133]): x={eye_il[0]:.0f} (ideal 2/5 = {zygo_l[0]+2*fifth:.0f}, delta={eye_il[0]-(zygo_l[0]+2*fifth):.0f}px)")
print(f"  eye inner R (lm[362]): x={eye_ir[0]:.0f} (ideal 3/5 = {zygo_l[0]+3*fifth:.0f}, delta={eye_ir[0]-(zygo_l[0]+3*fifth):.0f}px)")
print(f"  eye outer R (lm[263]): x={eye_or[0]:.0f} (ideal 4/5 = {zygo_l[0]+4*fifth:.0f}, delta={eye_or[0]-(zygo_l[0]+4*fifth):.0f}px)")
EOF


Agora tenho o diagnóstico completo e definitivo. Vou fazer os fixes.

**Diagnóstico real:**

1. **Terços — o problema é duplo:** `lm[10]` é realmente o ponto mais alto do mesh (y=261), mas está em y=22.6% da imagem — existe cabeça/cabelo acima. O cálculo de métrica usa `lm[10]→menton` que dá upper=20%. **Isso está matematicamente correto dado que o MediaPipe não detecta acima do hairline** — o problema é que o overlay visual desenha a linha do "ideal" em `yTop + faceH/3` mas as linhas laranja "reais" mostram brow/subnasale que batem com os 20%/40% corretos. O overlay está correto mas **confuso visualmente** — a legenda T1/T2/T3 mostra os percentuais reais da face detectada, não da "face ideal".

2. **Quintos — funcionam bem:** deltas máximos de 13px (2% da largura) são aceitáveis, o overlay dual (tracejado ideal + laranja real) está correto.

O verdadeiro bug visual é: **o overlay de terços desenhando as linhas dashed "ideais" em posições absolutas (yTop + faceH/3) faz parecer que a face está errada quando o problema é que lm[10] não é o hairline real**. Preciso verificar o `GridThirds` mais cuidadosamente:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

# Simulate exactly what GridThirds does
P_FOREHEAD_CROWN = 10
P_BROW_LEFT_INNER = 107
P_BROW_RIGHT_INNER = 336
P_SUBNASALE = 2
P_MENTON = 152
P_ZYGO_IMG_RIGHT = 454
P_ZYGO_IMG_LEFT = 234

crown = lm(P_FOREHEAD_CROWN)
menton = lm(P_MENTON)
brow_l = lm(P_BROW_LEFT_INNER)
brow_r = lm(P_BROW_RIGHT_INNER)
zygo_r = lm(P_ZYGO_IMG_RIGHT)
zygo_l = lm(P_ZYGO_IMG_LEFT)
subnasale = lm(P_SUBNASALE)

yTop  = crown[1]
yBrow = (brow_l[1] + brow_r[1]) // 2
ySub  = subnasale[1]
yMen  = menton[1]

faceH = yMen - yTop
yT1   = yTop + faceH // 3   # ideal 1/3 line (dashed purple)
yT2   = yTop + 2 * faceH // 3  # ideal 2/3 line (dashed purple)

print("=== GridThirds exact simulation ===")
print(f"yTop={yTop} (lm[10] forehead crown)")
print(f"yBrow={yBrow} (brow inner midpoint) — laranja sólido")
print(f"ySub={ySub}  (subnasale) — laranja sólido")
print(f"yMen={yMen}  (menton)")
print(f"faceH={faceH}px")
print()
print(f"Ideal dashed lines: yT1={yT1} yT2={yT2}")
print(f"Real orange lines:  yBrow={yBrow} ySub={ySub}")
print()
print(f"Delta yBrow vs yT1: {yBrow - yT1}px (negative = brow ABOVE ideal 1/3)")
print(f"Delta ySub  vs yT2: {ySub  - yT2}px")
print()

# Labels - what does GridThirds render?
# The metric values from backend:
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}
upper_val  = metric_evals['upper_third_ratio']['value']
middle_val = metric_evals['middle_third_ratio']['value']
lower_val  = metric_evals['lower_third_ratio']['value']

print(f"Label rendered (from backend metric values):")
print(f"  T1: {upper_val*100:.0f}% (vs ideal 33%)")
print(f"  T2: {middle_val*100:.0f}% (vs ideal 33%)")
print(f"  T3: {lower_val*100:.0f}% (vs ideal 33%)")
print()
print("VERDICT:")
print("- lm[10] at y=261 is the HIGHEST point of MediaPipe mesh")
print("- Hair above it (~y=0..261) is NOT detected by MediaPipe")
print("- So upper_third=20% is REAL — Brad Pitt has high hairline / small upper third")
print("  within the DETECTED face region")
print()
print("The VISUAL problem is that the dashed 'ideal' lines sit at yTop+faceH/3,")
print("which looks correct, but the labels show 20%/40%/40% making it look wrong.")
print()
print("Actually the real issue: if lm[10] is the highest mesh point,")
print("the brow line at yBrow falls only 20% into the detected face — which IS correct")
print("for Brad Pitt who has a larger-than-ideal forehead relative to the 3 equal thirds.")
print("Wait — 20% upper means SHORT upper third (brow close to hairline), not long forehead.")
print()
print(f"Upper: {upper_val*100:.1f}% SHORT = brow is HIGH = forehead is SHORT relative to face")
EOF


Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

# Generate definitive visual: side-by-side comparison
# LEFT: what the current overlay draws
# RIGHT: what it SHOULD draw

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]

crown = lm(10)
menton = lm(152)
brow_l = lm(107)
brow_r = lm(336)
sub = lm(2)
zygo_l = lm(234)
zygo_r = lm(454)
eye_ol = lm(33)
eye_or = lm(263)
eye_il = lm(133)
eye_ir = lm(362)

yTop = crown[1]
yBrow = (brow_l[1] + brow_r[1]) // 2
ySub = sub[1]
yMen = menton[1]
faceH = yMen - yTop
yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

xFaceL = zygo_l[0]
xFaceR = zygo_r[0]
faceW = xFaceR - xFaceL
fifth = faceW / 5

def put_label(img, text, x, y, color=(255,255,255), scale=0.45):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

# =============================================================================
# LEFT panel: current overlay behavior
# =============================================================================
left = img.copy()

# FaceExtents box
cv2.rectangle(left, (xFaceL, yTop), (xFaceR, yMen), (255,255,255), 1)

# Thirds: ideal dashed (purple) and real orange
cv2.line(left, (0, yT1_ideal), (w, yT1_ideal), (180,130,255), 1)
cv2.line(left, (0, yT2_ideal), (w, yT2_ideal), (180,130,255), 1)
cv2.line(left, (0, yBrow),     (w, yBrow),     (0,165,255), 2)
cv2.line(left, (0, ySub),      (w, ySub),      (0,165,255), 2)

# Fifths: ideal dashed + actual orange
for i in [1,2,3,4]:
    xi = int(xFaceL + i * fifth)
    cv2.line(left, (xi, yTop), (xi, yMen), (180,130,255), 1)
for x in [eye_ol[0], eye_il[0], eye_ir[0], eye_or[0]]:
    cv2.line(left, (x, yTop), (x, yMen), (0,165,255), 1)

put_label(left, "ATUAL", 10, 30, (0,200,255), 0.7)
put_label(left, f"T1 {(yBrow-yTop)/faceH*100:.0f}%", xFaceR+5, yTop+(yBrow-yTop)//2, (0,165,255))
put_label(left, f"T2 {(ySub-yBrow)/faceH*100:.0f}%",  xFaceR+5, yBrow+(ySub-yBrow)//2, (0,165,255))
put_label(left, f"T3 {(yMen-ySub)/faceH*100:.0f}%",   xFaceR+5, ySub+(yMen-ySub)//2,  (0,165,255))

# =============================================================================
# RIGHT panel: correct overlay
# Problema raiz: lm[10] é o ponto mais alto do mesh, que está em y=261
# (23% da imagem), mas a testa real começa em ~y=0.
# O GridThirds usa yTop=lm[10] e depois traça o "ideal" como yTop+faceH/3.
# Mas as métricas (upper=20%) são calculadas com o MESMO lm[10].
# Então os terços são consistentes internamente — o visual não está "errado",
# mas a interpretação da linha laranja T1/yBrow indica que o rosto tem
# terço superior CURTO (brow alta), o que é correto para Brad Pitt.
#
# O REAL bug visual é que a linha "ideal dashed" de T1 cai em yT1=549 (64%),
# muito abaixo do brow real (y=435), mostrando um gap enorme que assusta o usuário.
# A legenda clarifica (20% vs 33%), mas visualmente parece que o overlay está quebrado.
#
# FIX: mostrar claramente nos labels O QUE CADA LINHA É.
# =============================================================================
right = img.copy()

cv2.rectangle(right, (xFaceL, yTop), (xFaceR, yMen), (255,255,255), 1)

# Ideal thirds (dashed)
for y, label in [(yT1_ideal, "ideal 1/3"), (yT2_ideal, "ideal 2/3")]:
    cv2.line(right, (0, y), (w, y), (180,130,255), 1)
    put_label(right, label, 5, y-4, (180,130,255))

# Real landmark lines (orange solid) with clear labels
cv2.line(right, (0, yBrow), (w, yBrow), (0,165,255), 2)
put_label(right, f"SOBRANCELHA (real T1={( yBrow-yTop)/faceH*100:.0f}%)", 5, yBrow-6, (0,165,255))
cv2.line(right, (0, ySub), (w, ySub), (0,165,255), 2)
put_label(right, f"SUBNASALE (real T2-end={( ySub-yTop)/faceH*100:.0f}%)", 5, ySub-6, (0,165,255))

# lm[10] and menton markers
cv2.line(right, (0, yTop), (w, yTop), (255,255,255), 1)
put_label(right, f"lm[10] hairline proxy (y={yTop})", 5, yTop+14, (255,255,255))
cv2.line(right, (0, yMen), (w, yMen), (255,255,255), 1)

# Fifths 
for i in [1,2,3,4]:
    xi = int(xFaceL + i * fifth)
    cv2.line(right, (xi, yTop), (xi, yMen), (180,130,255), 1)
for x, label in [(eye_ol[0],'OL'), (eye_il[0],'IL'), (eye_ir[0],'IR'), (eye_or[0],'OR')]:
    cv2.line(right, (x, yTop), (x, yMen), (0,165,255), 1)

put_label(right, "CORRETO (mesmo calc, labels claros)", 10, 30, (0,255,0), 0.55)
put_label(right, f"T1={( yBrow-yTop)/faceH*100:.0f}% T2={(ySub-yBrow)/faceH*100:.0f}% T3={(yMen-ySub)/faceH*100:.0f}%", 10, 55, (0,200,255))

# Combine
combined = np.hstack([left, right])
cv2.line(combined, (w, 0), (w, h), (255,255,0), 2)
cv2.imwrite('/tmp/debug_comparison.jpg', combined)
print(f"Saved /tmp/debug_comparison.jpg ({combined.shape[1]}x{combined.shape[0]})")
EOF


Read [](file:///tmp/debug_comparison.jpg)

Agora tenho o diagnóstico visual definitivo. Os dois painéis mostram **o mesmo cálculo** — o problema não é nos números, é em **como o overlay comunica o que está desenhado**. Vou agora fazer uma análise crítica completa antes de implementar qualquer fix.

**Análise crítica real:**

O overlay `GridThirds` tem **dois problemas distintos**:

1. **Problema de semântica visual:** A linha dashed "ideal" (T1 = yTop + faceH/3) fica muito abaixo da sobrancelha real, criando um gap visual enorme que faz parecer que o sistema está quebrado. O usuário vê a sobrancelha laranja acima e a linha roxa "ideal" muito abaixo — isso **inverte a intuição**: parece que o "ideal" está mais pra baixo quando na verdade T1 curto (20%) significa sobrancelha ALTA.

2. **Problema de âncora do hairline:** `lm[10]` não é o hairline real — é o ponto mais alto do mesh, que está em y=261 (23% da imagem). Existe testa real acima. Isso faz o terço superior parecer menor do que é na realidade anatômica.

Agora vou implementar os fixes corretos:

Used tool: ToolSearch

Agora vou corrigir o `GridThirds`. O problema central: as linhas dashed roxas estão em `yTop + faceH/3` (posição "onde estaria o ideal") mas a **semântica está invertida** — a linha laranja ACIMA da dashed faz parecer que o overlay está errado, quando na verdade está correto. Preciso trocar a comunicação visual.

Read [](file:///home/luizescobal/study/face-before-after/frontend/src/components/OverlayLayer.tsx)

Agora tenho clareza total. Vou fazer os fixes:

**Fix 1 — `GridThirds`:** 
- As linhas dashed estão corretas mas as linhas "real" (laranja) precisam de label direto em cima delas, não só no label lateral. Hoje o label lateral diz "T1 20% (33%)" mas isso é confuso porque a linha laranja está ACIMA da dashed, fazendo parecer que o overlay errou.
- A correção: desenhar label diretamente nas linhas laranja indicando o que são, e mudar o label lateral para mostrar o **desvio** do ideal.

**Fix 2 — `GridFifths`:**
- Os quintos estão funcionando corretamente (desvios de ~13px). O label precisa mostrar o desvio por quinto.Agora fix do `GridFifths` — adicionar desvio por quinto e label nas linhas de borda:Agora verifico o `FaceExtents` — preciso confirmar que o bounding box usa os landmarks certos:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]

# FaceExtents usa: yTop=lm[10], yMenton=lm[152], xL=lm[234], xR=lm[454]
yTop   = lm(10)[1]
yMen   = lm(152)[1]
xL     = lm(234)[0]
xR     = lm(454)[0]

print(f"FaceExtents bounding box: x=[{xL},{xR}] y=[{yTop},{yMen}]")
print(f"Image dimensions: {w}x{h}")
print(f"Box width: {xR-xL}px ({(xR-xL)/w*100:.0f}% of image width)")
print(f"Box height: {yMen-yTop}px ({(yMen-yTop)/h*100:.0f}% of image height)")
print()

# Draw FaceExtents to verify visually
out = img.copy()
cv2.rectangle(out, (xL, yTop), (xR, yMen), (255,255,255), 2)
cv2.circle(out, lm(10),  6, (0,255,0), -1)
cv2.circle(out, lm(152), 6, (0,255,0), -1)
cv2.circle(out, lm(234), 6, (0,255,255), -1)
cv2.circle(out, lm(454), 6, (0,255,255), -1)

# Does the box visually contain the face?
# Check: are eye outer corners inside the box?
eol = lm(33)
eor = lm(263)
print(f"Eye outer L: x={eol[0]} (box xL={xL}) — inside: {eol[0] > xL}")
print(f"Eye outer R: x={eor[0]} (box xR={xR}) — inside: {eor[0] < xR}")
print()
# Is crown at the top of the face or inside hair?
print(f"lm[10] y={yTop} vs image top y=0")
print(f"Hair region above crown: {yTop}px ({yTop/h*100:.0f}% of img — NOT in bounding box)")

cv2.imwrite('/tmp/face_extents_check.jpg', out)
print("Saved /tmp/face_extents_check.jpg")
EOF


Read [](file:///tmp/face_extents_check.jpg)

Aqui está o segundo problema real: **o `FaceExtents` está errado visualmente**. O box branco:
- **Topo (yTop=lm[10]):** começa no meio da testa, cortando o hairline real
- **Laterais (lm[234]/lm[454]):** os pontos zigomáticos estão na linha dos olhos (y≈583), não nas extremidades mais largas da face — o box é mais estreito que a face visível

O `FaceExtents` deveria englobar o rosto visual real. Preciso corrigir os anchors laterais para usar os pontos mais extremos da bochecha ao invés dos zigomáticos médios, e o topo para usar o ponto mais alto disponível no mesh.

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm_raw = lambda i: (landmarks[i][0], landmarks[i][1])

# Find the leftmost and rightmost points in the face mesh
all_x = [(i, landmarks[i][0], landmarks[i][1]) for i in range(478)]
leftmost  = sorted(all_x, key=lambda t: t[1])[:5]
rightmost = sorted(all_x, key=lambda t: t[1], reverse=True)[:5]
topmost   = sorted(all_x, key=lambda t: t[2])[:5]

print("5 leftmost (smallest x):")
for i, x, y in leftmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

print("\n5 rightmost (largest x):")
for i, x, y in rightmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

print("\n5 topmost (smallest y):")
for i, x, y in topmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

# Current zygo points
print(f"\nCurrent lm[234] (zygo L): x={landmarks[234][0]:.0f}, y={landmarks[234][1]:.0f}")
print(f"Current lm[454] (zygo R): x={landmarks[454][0]:.0f}, y={landmarks[454][1]:.0f}")
print(f"Current lm[10]  (crown):  x={landmarks[10][0]:.0f}, y={landmarks[10][1]:.0f}")

# Check specific candidates for wider face boundary
for idx in [234, 127, 93, 132, 58, 172, 136, 150, 149, 176, 148]:
    print(f"  lm[{idx}]: x={landmarks[idx][0]:.0f}, y={landmarks[idx][1]:.0f}")
EOF


Os pontos laterais `lm[234]` e `lm[454]` já são os mais extremos do mesh (x=91 e x=799 numa imagem de 847px). O problema não é os pontos — é que a imagem tem margem lateral de background. O `FaceExtents` está correto matematicamente; o que parece "estreito" é porque a imagem tem bastante espaço nas laterais.

O problema real do `FaceExtents` é apenas **o topo** — `lm[10]` em y=261 corta 23% da imagem acima (hairline/cabelo). Para o `FaceExtents` ter sentido visual, o topo deveria ser o **topo da imagem ou o topo do crop detectado**, não `lm[10]`.

Mas isso é uma decisão de design: o box mostra "o rosto detectável pelo mesh" (correto para fins de análise) ou "a extensão visual da cabeça" (mais intuitivo para o usuário). A correção mais honesta é adicionar uma nota no label "Hairline (mesh)" para deixar claro que o top é o limite do MediaPipe, não o topo real da cabeça.

Read [](file:///home/luizescobal/study/face-before-after/frontend/src/components/OverlayLayer.tsx)

Agora verifico o TypeScript e depois gero a imagem de revisão crítica:

Ran terminal command: cd /home/luizescobal/study/face-before-after/frontend && npx tsc --noEmit 2>&1 | head -30

TypeScript limpo. Agora gero a imagem de revisão crítica simulando exatamente o que o novo código faz:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]
out = img.copy()

def txt(img, text, x, y, color, scale=0.38):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

# === FaceExtents ===
yTop  = lm(10)[1]
yMen  = lm(152)[1]
xL    = lm(234)[0]
xR    = lm(454)[0]
WHITE = (255,255,255)
cv2.rectangle(out, (xL, yTop), (xR, yMen), WHITE, 1)
txt(out, "Trichion (mesh)", xL+4, yTop-4, WHITE)
txt(out, "Menton",          xL+4, yMen+14, WHITE)

# === GridThirds ===
yBrow = (lm(107)[1] + lm(336)[1]) // 2
ySub  = lm(2)[1]
faceH = yMen - yTop

yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

PURPLE = (200,150,255)
ORANGE = (0,165,255)

# Ideal dashed
cv2.line(out, (0, yT1_ideal), (w, yT1_ideal), PURPLE, 1)
cv2.line(out, (0, yT2_ideal), (w, yT2_ideal), PURPLE, 1)
txt(out, "ideal 1/3", xL+4, yT1_ideal-3, PURPLE)
txt(out, "ideal 2/3", xL+4, yT2_ideal-3, PURPLE)

# Real landmark lines
cv2.line(out, (0, yBrow), (w, yBrow), ORANGE, 2)
txt(out, "Sobrancelha", xL+4, yBrow-3, ORANGE)
cv2.line(out, (0, ySub),  (w, ySub),  ORANGE, 2)
txt(out, "Subnasale",    xL+4, ySub-3,  ORANGE)

# Lateral labels with deviation
thirds = [
    (yTop, yBrow, "upper_third_ratio", "T1"),
    (yBrow, ySub,  "middle_third_ratio", "T2"),
    (ySub, yMen,   "lower_third_ratio", "T3"),
]
SEV_COLORS = {"ideal":(80,200,80), "mild":(80,200,80), "moderate":(50,200,220), "strong":(0,165,255), "extreme":(0,80,255)}
for yA, yB, mid, label in thirds:
    m = metric_evals.get(mid, {})
    pct = (m.get('value', (yB-yA)/faceH)) * 100
    sev = m.get('severity_5', None)
    color = SEV_COLORS.get(sev, (150,150,150))
    dev = pct - 33.3
    devStr = f"+{dev:.0f}" if dev >= 0 else f"{dev:.0f}"
    txt(out, f"{label} {pct:.0f}% ({devStr}%)", xR+6, int((yA+yB)/2+4), color, 0.42)

# === GridFifths ===
xFaceL = lm(234)[0]
xFaceR = lm(454)[0]
faceW  = xFaceR - xFaceL
fifth  = faceW / 5

actuals = [lm(33)[0], lm(133)[0], lm(362)[0], lm(263)[0]]
names   = ["OExt.E", "OInt.E", "OInt.D", "OExt.D"]
ideals  = [xFaceL + (i+1)*fifth for i in range(4)]

# Face edges
cv2.line(out, (xFaceL, yTop), (xFaceL, yMen), WHITE, 1)
cv2.line(out, (xFaceR, yTop), (xFaceR, yMen), WHITE, 1)

# Ideal fifths dashed
for xi in ideals:
    cv2.line(out, (int(xi), yTop), (int(xi), yMen), PURPLE, 1)

# Actual eye corners + deviation
yLabel = yMen - 14
for i, (x, name) in enumerate(zip(actuals, names)):
    cv2.line(out, (x, yTop), (x, yMen), ORANGE, 1)
    dev = int(round(x - ideals[i]))
    devStr = f"+{dev}" if dev > 0 else str(dev)
    txt(out, f"{name} {devStr}px", x+2, yLabel - i*12, ORANGE, 0.35)

txt(out, "Quintos - tracejado:ideal laranja:real (desvio px)", xFaceL+2, yTop-6, PURPLE, 0.35)

cv2.imwrite('/tmp/overlay_final_review.jpg', out)
print("Saved /tmp/overlay_final_review.jpg")
EOF


Ran terminal command: cd /home/luizescobal/study/face-before-after && python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]
out = img.copy()

def txt(img, text, x, y, color, scale=0.38):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

yTop  = lm(10)[1]
yMen  = lm(152)[1]
xL    = lm(234)[0]
xR    = lm(454)[0]
WHITE  = (255,255,255)
PURPLE = (200,150,255)
ORANGE = (0,165,255)

# FaceExtents
cv2.rectangle(out, (xL, yTop), (xR, yMen), WHITE, 1)
txt(out, "Trichion (mesh)", xL+4, yTop-4, WHITE)
txt(out, "Menton", xL+4, yMen+14, WHITE)

# GridThirds
yBrow = (lm(107)[1] + lm(336)[1]) // 2
ySub  = lm(2)[1]
faceH = yMen - yTop
yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

cv2.line(out, (0, yT1_ideal), (w, yT1_ideal), PURPLE, 1)
cv2.line(out, (0, yT2_ideal), (w, yT2_ideal), PURPLE, 1)
txt(out, "ideal 1/3", xL+4, yT1_ideal-3, PURPLE)
txt(out, "ideal 2/3", xL+4, yT2_ideal-3, PURPLE)

cv2.line(out, (0, yBrow), (w, yBrow), ORANGE, 2)
txt(out, "Sobrancelha", xL+4, yBrow-3, ORANGE)
cv2.line(out, (0, ySub), (w, ySub), ORANGE, 2)
txt(out, "Subnasale", xL+4, ySub-3, ORANGE)

SEV = {"ideal":(80,200,80),"mild":(80,200,80),"moderate":(50,200,220),"strong":(0,165,255),"extreme":(0,80,255)}
for yA, yB, mid, label in [(yTop,yBrow,"upper_third_ratio","T1"),(yBrow,ySub,"middle_third_ratio","T2"),(ySub,yMen,"lower_third_ratio","T3")]:
    m = metric_evals.get(mid, {})
    pct = m.get('value', (yB-yA)/faceH) * 100
    color = SEV.get(m.get('severity_5'), (150,150,150))
    dev = pct - 33.3
    txt(out, f"{label} {pct:.0f}% ({'+' if dev>=0 else ''}{dev:.0f}%)", xR+6, int((yA+yB)/2+4), color, 0.42)

# GridFifths
faceW = xR - xL
fifth = faceW / 5
actuals = [lm(33)[0], lm(133)[0], lm(362)[0], lm(263)[0]]
names   = ["OExt.E","OInt.E","OInt.D","OExt.D"]
ideals  = [xL + (i+1)*fifth for i in range(4)]

cv2.line(out, (xL, yTop), (xL, yMen), WHITE, 1)
cv2.line(out, (xR, yTop), (xR, yMen), WHITE, 1)
for xi in ideals:
    cv2.line(out, (int(xi), yTop), (int(xi), yMen), PURPLE, 1)

yLbl = yMen - 16
for i, (x, name) in enumerate(zip(actuals, names)):
    cv2.line(out, (x, yTop), (x, yMen), ORANGE, 1)
    dev = int(round(x - ideals[i]))
    txt(out, f"{name} {'+' if dev>0 else ''}{dev}px", x+2, yLbl - i*14, ORANGE, 0.35)

txt(out, "Quintos: tracejado=ideal, laranja=real", xL+2, yTop-6, PURPLE, 0.36)

cv2.imwrite('/tmp/overlay_final_review.jpg', out)
print(f"OK {w}x{h}")
EOF
Vou ler o contexto canônico antes de tocar no código.

Read [](file:///home/luizescobal/study/face-before-after/.claude/face-analysis/00-index.md)

Read [](file:///home/luizescobal/study/face-before-after/.claude/face-analysis/08-svg-overlays.md)

A doc diz que os bugs foram "corrigidos", mas minha análise visual agora mostra que os terços ainda estão errados. Vou verificar o estado real do código e entender o problema raiz de ponta a ponta.

Ran terminal command: python3 - <<'EOF'
import json
with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

lm = data['landmarks']

# Todos os pontos relevantes
crown = lm[10]
menton = lm[152]
brow_l = lm[107]
brow_r = lm[336]
subnasale = lm[2]
zygo_l = lm[234]
zygo_r = lm[454]

print(f"Image crop: {data['auto_crop']['crop_bbox']}")
print(f"Image (canonical) size: 847x1155 (da imagem lida)")
print()
print(f"lm[10] (crown/forehead_center): y={crown[1]:.0f}")
print(f"lm[151] (forehead_top):         y={lm[151][1]:.0f}")
print(f"lm[10] is far from top of head - real hairline should be ~y=0 area")
print()

# What percentage of the image height is crown at?
img_h = 1155  # from the image
print(f"Crown lm[10] at y={crown[1]:.0f} = {crown[1]/img_h*100:.1f}% from top of image")
print(f"This means lm[10] is NOT at the top of the head")
print()

# What does the metric say?
face_h = menton[1] - crown[1]
y_brow = (brow_l[1] + brow_r[1]) / 2
y_sub = subnasale[1]
print(f"Face height (crown→menton): {face_h:.0f}px")
print(f"Upper: {(y_brow-crown[1])/face_h*100:.1f}%  Mid: {(y_sub-y_brow)/face_h*100:.1f}%  Lower: {(menton[1]-y_sub)/face_h*100:.1f}%")
print()

# Check if backend metric_evaluations exist in JSON
blocks = data.get('measurements_blocks', {})
print("measurements_blocks keys:", list(blocks.keys())[:5])

# Check if metric data has third ratios
metric_evals = data.get('metric_evaluations', [])
print(f"metric_evaluations count: {len(metric_evals)}")
if metric_evals:
    for m in metric_evals:
        if 'third' in m.get('metric_id',''):
            print(m)
EOF


Ran terminal command: grep -n "upper_third\|lower_third\|middle_third\|FOREHEAD\|P_FOREHEAD\|landmark.*10\b" /home/luizescobal/study/face-before-after/backend/app/services/metrics/thirds.py | head -40

Ran terminal command: cat /home/luizescobal/study/face-before-after/backend/app/services/metrics/thirds.py

Agora tenho o quadro completo. Vou verificar o que o `P_FOREHEAD_CROWN=10` realmente é no MediaPipe, e entender o problema dos quintos também.

Ran terminal command: grep -n "P_FOREHEAD_CROWN\|P_MENTON\|P_BROW\|P_SUBNASALE\|= 10\b\|= 152\b" /home/luizescobal/study/face-before-after/backend/app/domain/landmarks_mesh.py | head -30

Ran terminal command: python3 - <<'EOF'
import json
with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)
lm = data['landmarks']

# Scan the top Y coordinates in the mesh to understand what landmark 10 actually is
# vs what's actually at the top of the face
top_lms = sorted(enumerate(lm), key=lambda x: x[1][1])[:15]
print("Landmarks with lowest Y (top of image):")
for idx, (x,y) in top_lms:
    print(f"  lm[{idx}]: x={x:.0f}, y={y:.0f}")

print()
print(f"lm[10]: x={lm[10][0]:.0f}, y={lm[10][1]:.0f}")
print(f"lm[151]: x={lm[151][0]:.0f}, y={lm[151][1]:.0f}")
print(f"lm[9]: x={lm[9][0]:.0f}, y={lm[9][1]:.0f}")

# What about the fifths? Let's check what the frontend calculates
zygo_l = lm[234]
zygo_r = lm[454]
eye_ol = lm[33]
eye_or = lm[263]
eye_il = lm[133]
eye_ir = lm[362]

face_w = zygo_r[0] - zygo_l[0]
fifth  = face_w / 5

print(f"\n=== FIFTHS ANALYSIS ===")
print(f"Face width (234→454): {face_w:.0f}px")
print(f"Ideal fifth: {fifth:.1f}px")
print()
print(f"Ideal edges from zygo_l ({zygo_l[0]:.0f}):")
for i in [1,2,3,4]:
    print(f"  {i}/5 = x={zygo_l[0]+i*fifth:.0f}")

print()
print(f"Actual eye corners:")
print(f"  eye outer L (lm[33]):  x={eye_ol[0]:.0f} (ideal 1/5 = {zygo_l[0]+fifth:.0f}, delta={eye_ol[0]-(zygo_l[0]+fifth):.0f}px)")
print(f"  eye inner L (lm[133]): x={eye_il[0]:.0f} (ideal 2/5 = {zygo_l[0]+2*fifth:.0f}, delta={eye_il[0]-(zygo_l[0]+2*fifth):.0f}px)")
print(f"  eye inner R (lm[362]): x={eye_ir[0]:.0f} (ideal 3/5 = {zygo_l[0]+3*fifth:.0f}, delta={eye_ir[0]-(zygo_l[0]+3*fifth):.0f}px)")
print(f"  eye outer R (lm[263]): x={eye_or[0]:.0f} (ideal 4/5 = {zygo_l[0]+4*fifth:.0f}, delta={eye_or[0]-(zygo_l[0]+4*fifth):.0f}px)")
EOF


Agora tenho o diagnóstico completo e definitivo. Vou fazer os fixes.

**Diagnóstico real:**

1. **Terços — o problema é duplo:** `lm[10]` é realmente o ponto mais alto do mesh (y=261), mas está em y=22.6% da imagem — existe cabeça/cabelo acima. O cálculo de métrica usa `lm[10]→menton` que dá upper=20%. **Isso está matematicamente correto dado que o MediaPipe não detecta acima do hairline** — o problema é que o overlay visual desenha a linha do "ideal" em `yTop + faceH/3` mas as linhas laranja "reais" mostram brow/subnasale que batem com os 20%/40% corretos. O overlay está correto mas **confuso visualmente** — a legenda T1/T2/T3 mostra os percentuais reais da face detectada, não da "face ideal".

2. **Quintos — funcionam bem:** deltas máximos de 13px (2% da largura) são aceitáveis, o overlay dual (tracejado ideal + laranja real) está correto.

O verdadeiro bug visual é: **o overlay de terços desenhando as linhas dashed "ideais" em posições absolutas (yTop + faceH/3) faz parecer que a face está errada quando o problema é que lm[10] não é o hairline real**. Preciso verificar o `GridThirds` mais cuidadosamente:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

# Simulate exactly what GridThirds does
P_FOREHEAD_CROWN = 10
P_BROW_LEFT_INNER = 107
P_BROW_RIGHT_INNER = 336
P_SUBNASALE = 2
P_MENTON = 152
P_ZYGO_IMG_RIGHT = 454
P_ZYGO_IMG_LEFT = 234

crown = lm(P_FOREHEAD_CROWN)
menton = lm(P_MENTON)
brow_l = lm(P_BROW_LEFT_INNER)
brow_r = lm(P_BROW_RIGHT_INNER)
zygo_r = lm(P_ZYGO_IMG_RIGHT)
zygo_l = lm(P_ZYGO_IMG_LEFT)
subnasale = lm(P_SUBNASALE)

yTop  = crown[1]
yBrow = (brow_l[1] + brow_r[1]) // 2
ySub  = subnasale[1]
yMen  = menton[1]

faceH = yMen - yTop
yT1   = yTop + faceH // 3   # ideal 1/3 line (dashed purple)
yT2   = yTop + 2 * faceH // 3  # ideal 2/3 line (dashed purple)

print("=== GridThirds exact simulation ===")
print(f"yTop={yTop} (lm[10] forehead crown)")
print(f"yBrow={yBrow} (brow inner midpoint) — laranja sólido")
print(f"ySub={ySub}  (subnasale) — laranja sólido")
print(f"yMen={yMen}  (menton)")
print(f"faceH={faceH}px")
print()
print(f"Ideal dashed lines: yT1={yT1} yT2={yT2}")
print(f"Real orange lines:  yBrow={yBrow} ySub={ySub}")
print()
print(f"Delta yBrow vs yT1: {yBrow - yT1}px (negative = brow ABOVE ideal 1/3)")
print(f"Delta ySub  vs yT2: {ySub  - yT2}px")
print()

# Labels - what does GridThirds render?
# The metric values from backend:
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}
upper_val  = metric_evals['upper_third_ratio']['value']
middle_val = metric_evals['middle_third_ratio']['value']
lower_val  = metric_evals['lower_third_ratio']['value']

print(f"Label rendered (from backend metric values):")
print(f"  T1: {upper_val*100:.0f}% (vs ideal 33%)")
print(f"  T2: {middle_val*100:.0f}% (vs ideal 33%)")
print(f"  T3: {lower_val*100:.0f}% (vs ideal 33%)")
print()
print("VERDICT:")
print("- lm[10] at y=261 is the HIGHEST point of MediaPipe mesh")
print("- Hair above it (~y=0..261) is NOT detected by MediaPipe")
print("- So upper_third=20% is REAL — Brad Pitt has high hairline / small upper third")
print("  within the DETECTED face region")
print()
print("The VISUAL problem is that the dashed 'ideal' lines sit at yTop+faceH/3,")
print("which looks correct, but the labels show 20%/40%/40% making it look wrong.")
print()
print("Actually the real issue: if lm[10] is the highest mesh point,")
print("the brow line at yBrow falls only 20% into the detected face — which IS correct")
print("for Brad Pitt who has a larger-than-ideal forehead relative to the 3 equal thirds.")
print("Wait — 20% upper means SHORT upper third (brow close to hairline), not long forehead.")
print()
print(f"Upper: {upper_val*100:.1f}% SHORT = brow is HIGH = forehead is SHORT relative to face")
EOF


Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

# Generate definitive visual: side-by-side comparison
# LEFT: what the current overlay draws
# RIGHT: what it SHOULD draw

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]

crown = lm(10)
menton = lm(152)
brow_l = lm(107)
brow_r = lm(336)
sub = lm(2)
zygo_l = lm(234)
zygo_r = lm(454)
eye_ol = lm(33)
eye_or = lm(263)
eye_il = lm(133)
eye_ir = lm(362)

yTop = crown[1]
yBrow = (brow_l[1] + brow_r[1]) // 2
ySub = sub[1]
yMen = menton[1]
faceH = yMen - yTop
yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

xFaceL = zygo_l[0]
xFaceR = zygo_r[0]
faceW = xFaceR - xFaceL
fifth = faceW / 5

def put_label(img, text, x, y, color=(255,255,255), scale=0.45):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

# =============================================================================
# LEFT panel: current overlay behavior
# =============================================================================
left = img.copy()

# FaceExtents box
cv2.rectangle(left, (xFaceL, yTop), (xFaceR, yMen), (255,255,255), 1)

# Thirds: ideal dashed (purple) and real orange
cv2.line(left, (0, yT1_ideal), (w, yT1_ideal), (180,130,255), 1)
cv2.line(left, (0, yT2_ideal), (w, yT2_ideal), (180,130,255), 1)
cv2.line(left, (0, yBrow),     (w, yBrow),     (0,165,255), 2)
cv2.line(left, (0, ySub),      (w, ySub),      (0,165,255), 2)

# Fifths: ideal dashed + actual orange
for i in [1,2,3,4]:
    xi = int(xFaceL + i * fifth)
    cv2.line(left, (xi, yTop), (xi, yMen), (180,130,255), 1)
for x in [eye_ol[0], eye_il[0], eye_ir[0], eye_or[0]]:
    cv2.line(left, (x, yTop), (x, yMen), (0,165,255), 1)

put_label(left, "ATUAL", 10, 30, (0,200,255), 0.7)
put_label(left, f"T1 {(yBrow-yTop)/faceH*100:.0f}%", xFaceR+5, yTop+(yBrow-yTop)//2, (0,165,255))
put_label(left, f"T2 {(ySub-yBrow)/faceH*100:.0f}%",  xFaceR+5, yBrow+(ySub-yBrow)//2, (0,165,255))
put_label(left, f"T3 {(yMen-ySub)/faceH*100:.0f}%",   xFaceR+5, ySub+(yMen-ySub)//2,  (0,165,255))

# =============================================================================
# RIGHT panel: correct overlay
# Problema raiz: lm[10] é o ponto mais alto do mesh, que está em y=261
# (23% da imagem), mas a testa real começa em ~y=0.
# O GridThirds usa yTop=lm[10] e depois traça o "ideal" como yTop+faceH/3.
# Mas as métricas (upper=20%) são calculadas com o MESMO lm[10].
# Então os terços são consistentes internamente — o visual não está "errado",
# mas a interpretação da linha laranja T1/yBrow indica que o rosto tem
# terço superior CURTO (brow alta), o que é correto para Brad Pitt.
#
# O REAL bug visual é que a linha "ideal dashed" de T1 cai em yT1=549 (64%),
# muito abaixo do brow real (y=435), mostrando um gap enorme que assusta o usuário.
# A legenda clarifica (20% vs 33%), mas visualmente parece que o overlay está quebrado.
#
# FIX: mostrar claramente nos labels O QUE CADA LINHA É.
# =============================================================================
right = img.copy()

cv2.rectangle(right, (xFaceL, yTop), (xFaceR, yMen), (255,255,255), 1)

# Ideal thirds (dashed)
for y, label in [(yT1_ideal, "ideal 1/3"), (yT2_ideal, "ideal 2/3")]:
    cv2.line(right, (0, y), (w, y), (180,130,255), 1)
    put_label(right, label, 5, y-4, (180,130,255))

# Real landmark lines (orange solid) with clear labels
cv2.line(right, (0, yBrow), (w, yBrow), (0,165,255), 2)
put_label(right, f"SOBRANCELHA (real T1={( yBrow-yTop)/faceH*100:.0f}%)", 5, yBrow-6, (0,165,255))
cv2.line(right, (0, ySub), (w, ySub), (0,165,255), 2)
put_label(right, f"SUBNASALE (real T2-end={( ySub-yTop)/faceH*100:.0f}%)", 5, ySub-6, (0,165,255))

# lm[10] and menton markers
cv2.line(right, (0, yTop), (w, yTop), (255,255,255), 1)
put_label(right, f"lm[10] hairline proxy (y={yTop})", 5, yTop+14, (255,255,255))
cv2.line(right, (0, yMen), (w, yMen), (255,255,255), 1)

# Fifths 
for i in [1,2,3,4]:
    xi = int(xFaceL + i * fifth)
    cv2.line(right, (xi, yTop), (xi, yMen), (180,130,255), 1)
for x, label in [(eye_ol[0],'OL'), (eye_il[0],'IL'), (eye_ir[0],'IR'), (eye_or[0],'OR')]:
    cv2.line(right, (x, yTop), (x, yMen), (0,165,255), 1)

put_label(right, "CORRETO (mesmo calc, labels claros)", 10, 30, (0,255,0), 0.55)
put_label(right, f"T1={( yBrow-yTop)/faceH*100:.0f}% T2={(ySub-yBrow)/faceH*100:.0f}% T3={(yMen-ySub)/faceH*100:.0f}%", 10, 55, (0,200,255))

# Combine
combined = np.hstack([left, right])
cv2.line(combined, (w, 0), (w, h), (255,255,0), 2)
cv2.imwrite('/tmp/debug_comparison.jpg', combined)
print(f"Saved /tmp/debug_comparison.jpg ({combined.shape[1]}x{combined.shape[0]})")
EOF


Read [](file:///tmp/debug_comparison.jpg)

Agora tenho o diagnóstico visual definitivo. Os dois painéis mostram **o mesmo cálculo** — o problema não é nos números, é em **como o overlay comunica o que está desenhado**. Vou agora fazer uma análise crítica completa antes de implementar qualquer fix.

**Análise crítica real:**

O overlay `GridThirds` tem **dois problemas distintos**:

1. **Problema de semântica visual:** A linha dashed "ideal" (T1 = yTop + faceH/3) fica muito abaixo da sobrancelha real, criando um gap visual enorme que faz parecer que o sistema está quebrado. O usuário vê a sobrancelha laranja acima e a linha roxa "ideal" muito abaixo — isso **inverte a intuição**: parece que o "ideal" está mais pra baixo quando na verdade T1 curto (20%) significa sobrancelha ALTA.

2. **Problema de âncora do hairline:** `lm[10]` não é o hairline real — é o ponto mais alto do mesh, que está em y=261 (23% da imagem). Existe testa real acima. Isso faz o terço superior parecer menor do que é na realidade anatômica.

Agora vou implementar os fixes corretos:

Used tool: ToolSearch

Agora vou corrigir o `GridThirds`. O problema central: as linhas dashed roxas estão em `yTop + faceH/3` (posição "onde estaria o ideal") mas a **semântica está invertida** — a linha laranja ACIMA da dashed faz parecer que o overlay está errado, quando na verdade está correto. Preciso trocar a comunicação visual.

Read [](file:///home/luizescobal/study/face-before-after/frontend/src/components/OverlayLayer.tsx)

Agora tenho clareza total. Vou fazer os fixes:

**Fix 1 — `GridThirds`:** 
- As linhas dashed estão corretas mas as linhas "real" (laranja) precisam de label direto em cima delas, não só no label lateral. Hoje o label lateral diz "T1 20% (33%)" mas isso é confuso porque a linha laranja está ACIMA da dashed, fazendo parecer que o overlay errou.
- A correção: desenhar label diretamente nas linhas laranja indicando o que são, e mudar o label lateral para mostrar o **desvio** do ideal.

**Fix 2 — `GridFifths`:**
- Os quintos estão funcionando corretamente (desvios de ~13px). O label precisa mostrar o desvio por quinto.Agora fix do `GridFifths` — adicionar desvio por quinto e label nas linhas de borda:Agora verifico o `FaceExtents` — preciso confirmar que o bounding box usa os landmarks certos:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]

# FaceExtents usa: yTop=lm[10], yMenton=lm[152], xL=lm[234], xR=lm[454]
yTop   = lm(10)[1]
yMen   = lm(152)[1]
xL     = lm(234)[0]
xR     = lm(454)[0]

print(f"FaceExtents bounding box: x=[{xL},{xR}] y=[{yTop},{yMen}]")
print(f"Image dimensions: {w}x{h}")
print(f"Box width: {xR-xL}px ({(xR-xL)/w*100:.0f}% of image width)")
print(f"Box height: {yMen-yTop}px ({(yMen-yTop)/h*100:.0f}% of image height)")
print()

# Draw FaceExtents to verify visually
out = img.copy()
cv2.rectangle(out, (xL, yTop), (xR, yMen), (255,255,255), 2)
cv2.circle(out, lm(10),  6, (0,255,0), -1)
cv2.circle(out, lm(152), 6, (0,255,0), -1)
cv2.circle(out, lm(234), 6, (0,255,255), -1)
cv2.circle(out, lm(454), 6, (0,255,255), -1)

# Does the box visually contain the face?
# Check: are eye outer corners inside the box?
eol = lm(33)
eor = lm(263)
print(f"Eye outer L: x={eol[0]} (box xL={xL}) — inside: {eol[0] > xL}")
print(f"Eye outer R: x={eor[0]} (box xR={xR}) — inside: {eor[0] < xR}")
print()
# Is crown at the top of the face or inside hair?
print(f"lm[10] y={yTop} vs image top y=0")
print(f"Hair region above crown: {yTop}px ({yTop/h*100:.0f}% of img — NOT in bounding box)")

cv2.imwrite('/tmp/face_extents_check.jpg', out)
print("Saved /tmp/face_extents_check.jpg")
EOF


Read [](file:///tmp/face_extents_check.jpg)

Aqui está o segundo problema real: **o `FaceExtents` está errado visualmente**. O box branco:
- **Topo (yTop=lm[10]):** começa no meio da testa, cortando o hairline real
- **Laterais (lm[234]/lm[454]):** os pontos zigomáticos estão na linha dos olhos (y≈583), não nas extremidades mais largas da face — o box é mais estreito que a face visível

O `FaceExtents` deveria englobar o rosto visual real. Preciso corrigir os anchors laterais para usar os pontos mais extremos da bochecha ao invés dos zigomáticos médios, e o topo para usar o ponto mais alto disponível no mesh.

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm_raw = lambda i: (landmarks[i][0], landmarks[i][1])

# Find the leftmost and rightmost points in the face mesh
all_x = [(i, landmarks[i][0], landmarks[i][1]) for i in range(478)]
leftmost  = sorted(all_x, key=lambda t: t[1])[:5]
rightmost = sorted(all_x, key=lambda t: t[1], reverse=True)[:5]
topmost   = sorted(all_x, key=lambda t: t[2])[:5]

print("5 leftmost (smallest x):")
for i, x, y in leftmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

print("\n5 rightmost (largest x):")
for i, x, y in rightmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

print("\n5 topmost (smallest y):")
for i, x, y in topmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

# Current zygo points
print(f"\nCurrent lm[234] (zygo L): x={landmarks[234][0]:.0f}, y={landmarks[234][1]:.0f}")
print(f"Current lm[454] (zygo R): x={landmarks[454][0]:.0f}, y={landmarks[454][1]:.0f}")
print(f"Current lm[10]  (crown):  x={landmarks[10][0]:.0f}, y={landmarks[10][1]:.0f}")

# Check specific candidates for wider face boundary
for idx in [234, 127, 93, 132, 58, 172, 136, 150, 149, 176, 148]:
    print(f"  lm[{idx}]: x={landmarks[idx][0]:.0f}, y={landmarks[idx][1]:.0f}")
EOF


Os pontos laterais `lm[234]` e `lm[454]` já são os mais extremos do mesh (x=91 e x=799 numa imagem de 847px). O problema não é os pontos — é que a imagem tem margem lateral de background. O `FaceExtents` está correto matematicamente; o que parece "estreito" é porque a imagem tem bastante espaço nas laterais.

O problema real do `FaceExtents` é apenas **o topo** — `lm[10]` em y=261 corta 23% da imagem acima (hairline/cabelo). Para o `FaceExtents` ter sentido visual, o topo deveria ser o **topo da imagem ou o topo do crop detectado**, não `lm[10]`.

Mas isso é uma decisão de design: o box mostra "o rosto detectável pelo mesh" (correto para fins de análise) ou "a extensão visual da cabeça" (mais intuitivo para o usuário). A correção mais honesta é adicionar uma nota no label "Hairline (mesh)" para deixar claro que o top é o limite do MediaPipe, não o topo real da cabeça.

Read [](file:///home/luizescobal/study/face-before-after/frontend/src/components/OverlayLayer.tsx)

Agora verifico o TypeScript e depois gero a imagem de revisão crítica:

Ran terminal command: cd /home/luizescobal/study/face-before-after/frontend && npx tsc --noEmit 2>&1 | head -30

TypeScript limpo. Agora gero a imagem de revisão crítica simulando exatamente o que o novo código faz:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]
out = img.copy()

def txt(img, text, x, y, color, scale=0.38):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

# === FaceExtents ===
yTop  = lm(10)[1]
yMen  = lm(152)[1]
xL    = lm(234)[0]
xR    = lm(454)[0]
WHITE = (255,255,255)
cv2.rectangle(out, (xL, yTop), (xR, yMen), WHITE, 1)
txt(out, "Trichion (mesh)", xL+4, yTop-4, WHITE)
txt(out, "Menton",          xL+4, yMen+14, WHITE)

# === GridThirds ===
yBrow = (lm(107)[1] + lm(336)[1]) // 2
ySub  = lm(2)[1]
faceH = yMen - yTop

yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

PURPLE = (200,150,255)
ORANGE = (0,165,255)

# Ideal dashed
cv2.line(out, (0, yT1_ideal), (w, yT1_ideal), PURPLE, 1)
cv2.line(out, (0, yT2_ideal), (w, yT2_ideal), PURPLE, 1)
txt(out, "ideal 1/3", xL+4, yT1_ideal-3, PURPLE)
txt(out, "ideal 2/3", xL+4, yT2_ideal-3, PURPLE)

# Real landmark lines
cv2.line(out, (0, yBrow), (w, yBrow), ORANGE, 2)
txt(out, "Sobrancelha", xL+4, yBrow-3, ORANGE)
cv2.line(out, (0, ySub),  (w, ySub),  ORANGE, 2)
txt(out, "Subnasale",    xL+4, ySub-3,  ORANGE)

# Lateral labels with deviation
thirds = [
    (yTop, yBrow, "upper_third_ratio", "T1"),
    (yBrow, ySub,  "middle_third_ratio", "T2"),
    (ySub, yMen,   "lower_third_ratio", "T3"),
]
SEV_COLORS = {"ideal":(80,200,80), "mild":(80,200,80), "moderate":(50,200,220), "strong":(0,165,255), "extreme":(0,80,255)}
for yA, yB, mid, label in thirds:
    m = metric_evals.get(mid, {})
    pct = (m.get('value', (yB-yA)/faceH)) * 100
    sev = m.get('severity_5', None)
    color = SEV_COLORS.get(sev, (150,150,150))
    dev = pct - 33.3
    devStr = f"+{dev:.0f}" if dev >= 0 else f"{dev:.0f}"
    txt(out, f"{label} {pct:.0f}% ({devStr}%)", xR+6, int((yA+yB)/2+4), color, 0.42)

# === GridFifths ===
xFaceL = lm(234)[0]
xFaceR = lm(454)[0]
faceW  = xFaceR - xFaceL
fifth  = faceW / 5

actuals = [lm(33)[0], lm(133)[0], lm(362)[0], lm(263)[0]]
names   = ["OExt.E", "OInt.E", "OInt.D", "OExt.D"]
ideals  = [xFaceL + (i+1)*fifth for i in range(4)]

# Face edges
cv2.line(out, (xFaceL, yTop), (xFaceL, yMen), WHITE, 1)
cv2.line(out, (xFaceR, yTop), (xFaceR, yMen), WHITE, 1)

# Ideal fifths dashed
for xi in ideals:
    cv2.line(out, (int(xi), yTop), (int(xi), yMen), PURPLE, 1)

# Actual eye corners + deviation
yLabel = yMen - 14
for i, (x, name) in enumerate(zip(actuals, names)):
    cv2.line(out, (x, yTop), (x, yMen), ORANGE, 1)
    dev = int(round(x - ideals[i]))
    devStr = f"+{dev}" if dev > 0 else str(dev)
    txt(out, f"{name} {devStr}px", x+2, yLabel - i*12, ORANGE, 0.35)

txt(out, "Quintos - tracejado:ideal laranja:real (desvio px)", xFaceL+2, yTop-6, PURPLE, 0.35)

cv2.imwrite('/tmp/overlay_final_review.jpg', out)
print("Saved /tmp/overlay_final_review.jpg")
EOF


Ran terminal command: cd /home/luizescobal/study/face-before-after && python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]
out = img.copy()

def txt(img, text, x, y, color, scale=0.38):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

yTop  = lm(10)[1]
yMen  = lm(152)[1]
xL    = lm(234)[0]
xR    = lm(454)[0]
WHITE  = (255,255,255)
PURPLE = (200,150,255)
ORANGE = (0,165,255)

# FaceExtents
cv2.rectangle(out, (xL, yTop), (xR, yMen), WHITE, 1)
txt(out, "Trichion (mesh)", xL+4, yTop-4, WHITE)
txt(out, "Menton", xL+4, yMen+14, WHITE)

# GridThirds
yBrow = (lm(107)[1] + lm(336)[1]) // 2
ySub  = lm(2)[1]
faceH = yMen - yTop
yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

cv2.line(out, (0, yT1_ideal), (w, yT1_ideal), PURPLE, 1)
cv2.line(out, (0, yT2_ideal), (w, yT2_ideal), PURPLE, 1)
txt(out, "ideal 1/3", xL+4, yT1_ideal-3, PURPLE)
txt(out, "ideal 2/3", xL+4, yT2_ideal-3, PURPLE)

cv2.line(out, (0, yBrow), (w, yBrow), ORANGE, 2)
txt(out, "Sobrancelha", xL+4, yBrow-3, ORANGE)
cv2.line(out, (0, ySub), (w, ySub), ORANGE, 2)
txt(out, "Subnasale", xL+4, ySub-3, ORANGE)

SEV = {"ideal":(80,200,80),"mild":(80,200,80),"moderate":(50,200,220),"strong":(0,165,255),"extreme":(0,80,255)}
for yA, yB, mid, label in [(yTop,yBrow,"upper_third_ratio","T1"),(yBrow,ySub,"middle_third_ratio","T2"),(ySub,yMen,"lower_third_ratio","T3")]:
    m = metric_evals.get(mid, {})
    pct = m.get('value', (yB-yA)/faceH) * 100
    color = SEV.get(m.get('severity_5'), (150,150,150))
    dev = pct - 33.3
    txt(out, f"{label} {pct:.0f}% ({'+' if dev>=0 else ''}{dev:.0f}%)", xR+6, int((yA+yB)/2+4), color, 0.42)

# GridFifths
faceW = xR - xL
fifth = faceW / 5
actuals = [lm(33)[0], lm(133)[0], lm(362)[0], lm(263)[0]]
names   = ["OExt.E","OInt.E","OInt.D","OExt.D"]
ideals  = [xL + (i+1)*fifth for i in range(4)]

cv2.line(out, (xL, yTop), (xL, yMen), WHITE, 1)
cv2.line(out, (xR, yTop), (xR, yMen), WHITE, 1)
for xi in ideals:
    cv2.line(out, (int(xi), yTop), (int(xi), yMen), PURPLE, 1)

yLbl = yMen - 16
for i, (x, name) in enumerate(zip(actuals, names)):
    cv2.line(out, (x, yTop), (x, yMen), ORANGE, 1)
    dev = int(round(x - ideals[i]))
    txt(out, f"{name} {'+' if dev>0 else ''}{dev}px", x+2, yLbl - i*14, ORANGE, 0.35)

txt(out, "Quintos: tracejado=ideal, laranja=real", xL+2, yTop-6, PURPLE, 0.36)

cv2.imwrite('/tmp/overlay_final_review.jpg', out)
print(f"OK {w}x{h}")
EOF




Diagnóstico real:

Terços — o problema é duplo: lm[10] é realmente o ponto mais alto do mesh (y=261), mas está em y=22.6% da imagem — existe cabeça/cabelo acima. O cálculo de métrica usa lm[10]→menton que dá upper=20%. Isso está matematicamente correto dado que o MediaPipe não detecta acima do hairline — o problema é que o overlay visual desenha a linha do "ideal" em yTop + faceH/3 mas as linhas laranja "reais" mostram brow/subnasale que batem com os 20%/40% corretos. O overlay está correto mas confuso visualmente — a legenda T1/T2/T3 mostra os percentuais reais da face detectada, não da "face ideal".

Quintos — funcionam bem: deltas máximos de 13px (2% da largura) são aceitáveis, o overlay dual (tracejado ideal + laranja real) está correto.

O verdadeiro bug visual é: o overlay de terços desenhando as linhas dashed "ideais" em posições absolutas (yTop + faceH/3) faz parecer que a face está errada quando o problema é que lm[10] não é o hairline real. Preciso verificar o GridThirds mais cuidadosamente:


Agora tenho o diagnóstico visual definitivo. Os dois painéis mostram o mesmo cálculo — o problema não é nos números, é em como o overlay comunica o que está desenhado. Vou agora fazer uma análise crítica completa antes de implementar qualquer fix.





Análise crítica real:

O overlay GridThirds tem dois problemas distintos:

Problema de semântica visual: A linha dashed "ideal" (T1 = yTop + faceH/3) fica muito abaixo da sobrancelha real, criando um gap visual enorme que faz parecer que o sistema está quebrado. O usuário vê a sobrancelha laranja acima e a linha roxa "ideal" muito abaixo — isso inverte a intuição: parece que o "ideal" está mais pra baixo quando na verdade T1 curto (20%) significa sobrancelha ALTA.

Problema de âncora do hairline: lm[10] não é o hairline real — é o ponto mais alto do mesh, que está em y=261 (23% da imagem). Existe testa real acima. Isso faz o terço superior parecer menor do que é na realidade anatômica.

Vou ler o contexto canônico antes de tocar no código.

Read [](file:///home/luizescobal/study/face-before-after/.claude/face-analysis/00-index.md)

Read [](file:///home/luizescobal/study/face-before-after/.claude/face-analysis/08-svg-overlays.md)

A doc diz que os bugs foram "corrigidos", mas minha análise visual agora mostra que os terços ainda estão errados. Vou verificar o estado real do código e entender o problema raiz de ponta a ponta.

Ran terminal command: python3 - <<'EOF'
import json
with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

lm = data['landmarks']

# Todos os pontos relevantes
crown = lm[10]
menton = lm[152]
brow_l = lm[107]
brow_r = lm[336]
subnasale = lm[2]
zygo_l = lm[234]
zygo_r = lm[454]

print(f"Image crop: {data['auto_crop']['crop_bbox']}")
print(f"Image (canonical) size: 847x1155 (da imagem lida)")
print()
print(f"lm[10] (crown/forehead_center): y={crown[1]:.0f}")
print(f"lm[151] (forehead_top):         y={lm[151][1]:.0f}")
print(f"lm[10] is far from top of head - real hairline should be ~y=0 area")
print()

# What percentage of the image height is crown at?
img_h = 1155  # from the image
print(f"Crown lm[10] at y={crown[1]:.0f} = {crown[1]/img_h*100:.1f}% from top of image")
print(f"This means lm[10] is NOT at the top of the head")
print()

# What does the metric say?
face_h = menton[1] - crown[1]
y_brow = (brow_l[1] + brow_r[1]) / 2
y_sub = subnasale[1]
print(f"Face height (crown→menton): {face_h:.0f}px")
print(f"Upper: {(y_brow-crown[1])/face_h*100:.1f}%  Mid: {(y_sub-y_brow)/face_h*100:.1f}%  Lower: {(menton[1]-y_sub)/face_h*100:.1f}%")
print()

# Check if backend metric_evaluations exist in JSON
blocks = data.get('measurements_blocks', {})
print("measurements_blocks keys:", list(blocks.keys())[:5])

# Check if metric data has third ratios
metric_evals = data.get('metric_evaluations', [])
print(f"metric_evaluations count: {len(metric_evals)}")
if metric_evals:
    for m in metric_evals:
        if 'third' in m.get('metric_id',''):
            print(m)
EOF


Ran terminal command: grep -n "upper_third\|lower_third\|middle_third\|FOREHEAD\|P_FOREHEAD\|landmark.*10\b" /home/luizescobal/study/face-before-after/backend/app/services/metrics/thirds.py | head -40

Ran terminal command: cat /home/luizescobal/study/face-before-after/backend/app/services/metrics/thirds.py

Agora tenho o quadro completo. Vou verificar o que o `P_FOREHEAD_CROWN=10` realmente é no MediaPipe, e entender o problema dos quintos também.

Ran terminal command: grep -n "P_FOREHEAD_CROWN\|P_MENTON\|P_BROW\|P_SUBNASALE\|= 10\b\|= 152\b" /home/luizescobal/study/face-before-after/backend/app/domain/landmarks_mesh.py | head -30

Ran terminal command: python3 - <<'EOF'
import json
with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)
lm = data['landmarks']

# Scan the top Y coordinates in the mesh to understand what landmark 10 actually is
# vs what's actually at the top of the face
top_lms = sorted(enumerate(lm), key=lambda x: x[1][1])[:15]
print("Landmarks with lowest Y (top of image):")
for idx, (x,y) in top_lms:
    print(f"  lm[{idx}]: x={x:.0f}, y={y:.0f}")

print()
print(f"lm[10]: x={lm[10][0]:.0f}, y={lm[10][1]:.0f}")
print(f"lm[151]: x={lm[151][0]:.0f}, y={lm[151][1]:.0f}")
print(f"lm[9]: x={lm[9][0]:.0f}, y={lm[9][1]:.0f}")

# What about the fifths? Let's check what the frontend calculates
zygo_l = lm[234]
zygo_r = lm[454]
eye_ol = lm[33]
eye_or = lm[263]
eye_il = lm[133]
eye_ir = lm[362]

face_w = zygo_r[0] - zygo_l[0]
fifth  = face_w / 5

print(f"\n=== FIFTHS ANALYSIS ===")
print(f"Face width (234→454): {face_w:.0f}px")
print(f"Ideal fifth: {fifth:.1f}px")
print()
print(f"Ideal edges from zygo_l ({zygo_l[0]:.0f}):")
for i in [1,2,3,4]:
    print(f"  {i}/5 = x={zygo_l[0]+i*fifth:.0f}")

print()
print(f"Actual eye corners:")
print(f"  eye outer L (lm[33]):  x={eye_ol[0]:.0f} (ideal 1/5 = {zygo_l[0]+fifth:.0f}, delta={eye_ol[0]-(zygo_l[0]+fifth):.0f}px)")
print(f"  eye inner L (lm[133]): x={eye_il[0]:.0f} (ideal 2/5 = {zygo_l[0]+2*fifth:.0f}, delta={eye_il[0]-(zygo_l[0]+2*fifth):.0f}px)")
print(f"  eye inner R (lm[362]): x={eye_ir[0]:.0f} (ideal 3/5 = {zygo_l[0]+3*fifth:.0f}, delta={eye_ir[0]-(zygo_l[0]+3*fifth):.0f}px)")
print(f"  eye outer R (lm[263]): x={eye_or[0]:.0f} (ideal 4/5 = {zygo_l[0]+4*fifth:.0f}, delta={eye_or[0]-(zygo_l[0]+4*fifth):.0f}px)")
EOF


Agora tenho o diagnóstico completo e definitivo. Vou fazer os fixes.

**Diagnóstico real:**

1. **Terços — o problema é duplo:** `lm[10]` é realmente o ponto mais alto do mesh (y=261), mas está em y=22.6% da imagem — existe cabeça/cabelo acima. O cálculo de métrica usa `lm[10]→menton` que dá upper=20%. **Isso está matematicamente correto dado que o MediaPipe não detecta acima do hairline** — o problema é que o overlay visual desenha a linha do "ideal" em `yTop + faceH/3` mas as linhas laranja "reais" mostram brow/subnasale que batem com os 20%/40% corretos. O overlay está correto mas **confuso visualmente** — a legenda T1/T2/T3 mostra os percentuais reais da face detectada, não da "face ideal".

2. **Quintos — funcionam bem:** deltas máximos de 13px (2% da largura) são aceitáveis, o overlay dual (tracejado ideal + laranja real) está correto.

O verdadeiro bug visual é: **o overlay de terços desenhando as linhas dashed "ideais" em posições absolutas (yTop + faceH/3) faz parecer que a face está errada quando o problema é que lm[10] não é o hairline real**. Preciso verificar o `GridThirds` mais cuidadosamente:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

# Simulate exactly what GridThirds does
P_FOREHEAD_CROWN = 10
P_BROW_LEFT_INNER = 107
P_BROW_RIGHT_INNER = 336
P_SUBNASALE = 2
P_MENTON = 152
P_ZYGO_IMG_RIGHT = 454
P_ZYGO_IMG_LEFT = 234

crown = lm(P_FOREHEAD_CROWN)
menton = lm(P_MENTON)
brow_l = lm(P_BROW_LEFT_INNER)
brow_r = lm(P_BROW_RIGHT_INNER)
zygo_r = lm(P_ZYGO_IMG_RIGHT)
zygo_l = lm(P_ZYGO_IMG_LEFT)
subnasale = lm(P_SUBNASALE)

yTop  = crown[1]
yBrow = (brow_l[1] + brow_r[1]) // 2
ySub  = subnasale[1]
yMen  = menton[1]

faceH = yMen - yTop
yT1   = yTop + faceH // 3   # ideal 1/3 line (dashed purple)
yT2   = yTop + 2 * faceH // 3  # ideal 2/3 line (dashed purple)

print("=== GridThirds exact simulation ===")
print(f"yTop={yTop} (lm[10] forehead crown)")
print(f"yBrow={yBrow} (brow inner midpoint) — laranja sólido")
print(f"ySub={ySub}  (subnasale) — laranja sólido")
print(f"yMen={yMen}  (menton)")
print(f"faceH={faceH}px")
print()
print(f"Ideal dashed lines: yT1={yT1} yT2={yT2}")
print(f"Real orange lines:  yBrow={yBrow} ySub={ySub}")
print()
print(f"Delta yBrow vs yT1: {yBrow - yT1}px (negative = brow ABOVE ideal 1/3)")
print(f"Delta ySub  vs yT2: {ySub  - yT2}px")
print()

# Labels - what does GridThirds render?
# The metric values from backend:
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}
upper_val  = metric_evals['upper_third_ratio']['value']
middle_val = metric_evals['middle_third_ratio']['value']
lower_val  = metric_evals['lower_third_ratio']['value']

print(f"Label rendered (from backend metric values):")
print(f"  T1: {upper_val*100:.0f}% (vs ideal 33%)")
print(f"  T2: {middle_val*100:.0f}% (vs ideal 33%)")
print(f"  T3: {lower_val*100:.0f}% (vs ideal 33%)")
print()
print("VERDICT:")
print("- lm[10] at y=261 is the HIGHEST point of MediaPipe mesh")
print("- Hair above it (~y=0..261) is NOT detected by MediaPipe")
print("- So upper_third=20% is REAL — Brad Pitt has high hairline / small upper third")
print("  within the DETECTED face region")
print()
print("The VISUAL problem is that the dashed 'ideal' lines sit at yTop+faceH/3,")
print("which looks correct, but the labels show 20%/40%/40% making it look wrong.")
print()
print("Actually the real issue: if lm[10] is the highest mesh point,")
print("the brow line at yBrow falls only 20% into the detected face — which IS correct")
print("for Brad Pitt who has a larger-than-ideal forehead relative to the 3 equal thirds.")
print("Wait — 20% upper means SHORT upper third (brow close to hairline), not long forehead.")
print()
print(f"Upper: {upper_val*100:.1f}% SHORT = brow is HIGH = forehead is SHORT relative to face")
EOF


Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

# Generate definitive visual: side-by-side comparison
# LEFT: what the current overlay draws
# RIGHT: what it SHOULD draw

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]

crown = lm(10)
menton = lm(152)
brow_l = lm(107)
brow_r = lm(336)
sub = lm(2)
zygo_l = lm(234)
zygo_r = lm(454)
eye_ol = lm(33)
eye_or = lm(263)
eye_il = lm(133)
eye_ir = lm(362)

yTop = crown[1]
yBrow = (brow_l[1] + brow_r[1]) // 2
ySub = sub[1]
yMen = menton[1]
faceH = yMen - yTop
yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

xFaceL = zygo_l[0]
xFaceR = zygo_r[0]
faceW = xFaceR - xFaceL
fifth = faceW / 5

def put_label(img, text, x, y, color=(255,255,255), scale=0.45):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

# =============================================================================
# LEFT panel: current overlay behavior
# =============================================================================
left = img.copy()

# FaceExtents box
cv2.rectangle(left, (xFaceL, yTop), (xFaceR, yMen), (255,255,255), 1)

# Thirds: ideal dashed (purple) and real orange
cv2.line(left, (0, yT1_ideal), (w, yT1_ideal), (180,130,255), 1)
cv2.line(left, (0, yT2_ideal), (w, yT2_ideal), (180,130,255), 1)
cv2.line(left, (0, yBrow),     (w, yBrow),     (0,165,255), 2)
cv2.line(left, (0, ySub),      (w, ySub),      (0,165,255), 2)

# Fifths: ideal dashed + actual orange
for i in [1,2,3,4]:
    xi = int(xFaceL + i * fifth)
    cv2.line(left, (xi, yTop), (xi, yMen), (180,130,255), 1)
for x in [eye_ol[0], eye_il[0], eye_ir[0], eye_or[0]]:
    cv2.line(left, (x, yTop), (x, yMen), (0,165,255), 1)

put_label(left, "ATUAL", 10, 30, (0,200,255), 0.7)
put_label(left, f"T1 {(yBrow-yTop)/faceH*100:.0f}%", xFaceR+5, yTop+(yBrow-yTop)//2, (0,165,255))
put_label(left, f"T2 {(ySub-yBrow)/faceH*100:.0f}%",  xFaceR+5, yBrow+(ySub-yBrow)//2, (0,165,255))
put_label(left, f"T3 {(yMen-ySub)/faceH*100:.0f}%",   xFaceR+5, ySub+(yMen-ySub)//2,  (0,165,255))

# =============================================================================
# RIGHT panel: correct overlay
# Problema raiz: lm[10] é o ponto mais alto do mesh, que está em y=261
# (23% da imagem), mas a testa real começa em ~y=0.
# O GridThirds usa yTop=lm[10] e depois traça o "ideal" como yTop+faceH/3.
# Mas as métricas (upper=20%) são calculadas com o MESMO lm[10].
# Então os terços são consistentes internamente — o visual não está "errado",
# mas a interpretação da linha laranja T1/yBrow indica que o rosto tem
# terço superior CURTO (brow alta), o que é correto para Brad Pitt.
#
# O REAL bug visual é que a linha "ideal dashed" de T1 cai em yT1=549 (64%),
# muito abaixo do brow real (y=435), mostrando um gap enorme que assusta o usuário.
# A legenda clarifica (20% vs 33%), mas visualmente parece que o overlay está quebrado.
#
# FIX: mostrar claramente nos labels O QUE CADA LINHA É.
# =============================================================================
right = img.copy()

cv2.rectangle(right, (xFaceL, yTop), (xFaceR, yMen), (255,255,255), 1)

# Ideal thirds (dashed)
for y, label in [(yT1_ideal, "ideal 1/3"), (yT2_ideal, "ideal 2/3")]:
    cv2.line(right, (0, y), (w, y), (180,130,255), 1)
    put_label(right, label, 5, y-4, (180,130,255))

# Real landmark lines (orange solid) with clear labels
cv2.line(right, (0, yBrow), (w, yBrow), (0,165,255), 2)
put_label(right, f"SOBRANCELHA (real T1={( yBrow-yTop)/faceH*100:.0f}%)", 5, yBrow-6, (0,165,255))
cv2.line(right, (0, ySub), (w, ySub), (0,165,255), 2)
put_label(right, f"SUBNASALE (real T2-end={( ySub-yTop)/faceH*100:.0f}%)", 5, ySub-6, (0,165,255))

# lm[10] and menton markers
cv2.line(right, (0, yTop), (w, yTop), (255,255,255), 1)
put_label(right, f"lm[10] hairline proxy (y={yTop})", 5, yTop+14, (255,255,255))
cv2.line(right, (0, yMen), (w, yMen), (255,255,255), 1)

# Fifths 
for i in [1,2,3,4]:
    xi = int(xFaceL + i * fifth)
    cv2.line(right, (xi, yTop), (xi, yMen), (180,130,255), 1)
for x, label in [(eye_ol[0],'OL'), (eye_il[0],'IL'), (eye_ir[0],'IR'), (eye_or[0],'OR')]:
    cv2.line(right, (x, yTop), (x, yMen), (0,165,255), 1)

put_label(right, "CORRETO (mesmo calc, labels claros)", 10, 30, (0,255,0), 0.55)
put_label(right, f"T1={( yBrow-yTop)/faceH*100:.0f}% T2={(ySub-yBrow)/faceH*100:.0f}% T3={(yMen-ySub)/faceH*100:.0f}%", 10, 55, (0,200,255))

# Combine
combined = np.hstack([left, right])
cv2.line(combined, (w, 0), (w, h), (255,255,0), 2)
cv2.imwrite('/tmp/debug_comparison.jpg', combined)
print(f"Saved /tmp/debug_comparison.jpg ({combined.shape[1]}x{combined.shape[0]})")
EOF


Read [](file:///tmp/debug_comparison.jpg)

Agora tenho o diagnóstico visual definitivo. Os dois painéis mostram **o mesmo cálculo** — o problema não é nos números, é em **como o overlay comunica o que está desenhado**. Vou agora fazer uma análise crítica completa antes de implementar qualquer fix.

**Análise crítica real:**

O overlay `GridThirds` tem **dois problemas distintos**:

1. **Problema de semântica visual:** A linha dashed "ideal" (T1 = yTop + faceH/3) fica muito abaixo da sobrancelha real, criando um gap visual enorme que faz parecer que o sistema está quebrado. O usuário vê a sobrancelha laranja acima e a linha roxa "ideal" muito abaixo — isso **inverte a intuição**: parece que o "ideal" está mais pra baixo quando na verdade T1 curto (20%) significa sobrancelha ALTA.

2. **Problema de âncora do hairline:** `lm[10]` não é o hairline real — é o ponto mais alto do mesh, que está em y=261 (23% da imagem). Existe testa real acima. Isso faz o terço superior parecer menor do que é na realidade anatômica.

Agora vou implementar os fixes corretos:

Used tool: ToolSearch

Agora vou corrigir o `GridThirds`. O problema central: as linhas dashed roxas estão em `yTop + faceH/3` (posição "onde estaria o ideal") mas a **semântica está invertida** — a linha laranja ACIMA da dashed faz parecer que o overlay está errado, quando na verdade está correto. Preciso trocar a comunicação visual.

Read [](file:///home/luizescobal/study/face-before-after/frontend/src/components/OverlayLayer.tsx)

Agora tenho clareza total. Vou fazer os fixes:

**Fix 1 — `GridThirds`:** 
- As linhas dashed estão corretas mas as linhas "real" (laranja) precisam de label direto em cima delas, não só no label lateral. Hoje o label lateral diz "T1 20% (33%)" mas isso é confuso porque a linha laranja está ACIMA da dashed, fazendo parecer que o overlay errou.
- A correção: desenhar label diretamente nas linhas laranja indicando o que são, e mudar o label lateral para mostrar o **desvio** do ideal.

**Fix 2 — `GridFifths`:**
- Os quintos estão funcionando corretamente (desvios de ~13px). O label precisa mostrar o desvio por quinto.Agora fix do `GridFifths` — adicionar desvio por quinto e label nas linhas de borda:Agora verifico o `FaceExtents` — preciso confirmar que o bounding box usa os landmarks certos:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]

# FaceExtents usa: yTop=lm[10], yMenton=lm[152], xL=lm[234], xR=lm[454]
yTop   = lm(10)[1]
yMen   = lm(152)[1]
xL     = lm(234)[0]
xR     = lm(454)[0]

print(f"FaceExtents bounding box: x=[{xL},{xR}] y=[{yTop},{yMen}]")
print(f"Image dimensions: {w}x{h}")
print(f"Box width: {xR-xL}px ({(xR-xL)/w*100:.0f}% of image width)")
print(f"Box height: {yMen-yTop}px ({(yMen-yTop)/h*100:.0f}% of image height)")
print()

# Draw FaceExtents to verify visually
out = img.copy()
cv2.rectangle(out, (xL, yTop), (xR, yMen), (255,255,255), 2)
cv2.circle(out, lm(10),  6, (0,255,0), -1)
cv2.circle(out, lm(152), 6, (0,255,0), -1)
cv2.circle(out, lm(234), 6, (0,255,255), -1)
cv2.circle(out, lm(454), 6, (0,255,255), -1)

# Does the box visually contain the face?
# Check: are eye outer corners inside the box?
eol = lm(33)
eor = lm(263)
print(f"Eye outer L: x={eol[0]} (box xL={xL}) — inside: {eol[0] > xL}")
print(f"Eye outer R: x={eor[0]} (box xR={xR}) — inside: {eor[0] < xR}")
print()
# Is crown at the top of the face or inside hair?
print(f"lm[10] y={yTop} vs image top y=0")
print(f"Hair region above crown: {yTop}px ({yTop/h*100:.0f}% of img — NOT in bounding box)")

cv2.imwrite('/tmp/face_extents_check.jpg', out)
print("Saved /tmp/face_extents_check.jpg")
EOF


Read [](file:///tmp/face_extents_check.jpg)

Aqui está o segundo problema real: **o `FaceExtents` está errado visualmente**. O box branco:
- **Topo (yTop=lm[10]):** começa no meio da testa, cortando o hairline real
- **Laterais (lm[234]/lm[454]):** os pontos zigomáticos estão na linha dos olhos (y≈583), não nas extremidades mais largas da face — o box é mais estreito que a face visível

O `FaceExtents` deveria englobar o rosto visual real. Preciso corrigir os anchors laterais para usar os pontos mais extremos da bochecha ao invés dos zigomáticos médios, e o topo para usar o ponto mais alto disponível no mesh.

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm_raw = lambda i: (landmarks[i][0], landmarks[i][1])

# Find the leftmost and rightmost points in the face mesh
all_x = [(i, landmarks[i][0], landmarks[i][1]) for i in range(478)]
leftmost  = sorted(all_x, key=lambda t: t[1])[:5]
rightmost = sorted(all_x, key=lambda t: t[1], reverse=True)[:5]
topmost   = sorted(all_x, key=lambda t: t[2])[:5]

print("5 leftmost (smallest x):")
for i, x, y in leftmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

print("\n5 rightmost (largest x):")
for i, x, y in rightmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

print("\n5 topmost (smallest y):")
for i, x, y in topmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

# Current zygo points
print(f"\nCurrent lm[234] (zygo L): x={landmarks[234][0]:.0f}, y={landmarks[234][1]:.0f}")
print(f"Current lm[454] (zygo R): x={landmarks[454][0]:.0f}, y={landmarks[454][1]:.0f}")
print(f"Current lm[10]  (crown):  x={landmarks[10][0]:.0f}, y={landmarks[10][1]:.0f}")

# Check specific candidates for wider face boundary
for idx in [234, 127, 93, 132, 58, 172, 136, 150, 149, 176, 148]:
    print(f"  lm[{idx}]: x={landmarks[idx][0]:.0f}, y={landmarks[idx][1]:.0f}")
EOF


Os pontos laterais `lm[234]` e `lm[454]` já são os mais extremos do mesh (x=91 e x=799 numa imagem de 847px). O problema não é os pontos — é que a imagem tem margem lateral de background. O `FaceExtents` está correto matematicamente; o que parece "estreito" é porque a imagem tem bastante espaço nas laterais.

O problema real do `FaceExtents` é apenas **o topo** — `lm[10]` em y=261 corta 23% da imagem acima (hairline/cabelo). Para o `FaceExtents` ter sentido visual, o topo deveria ser o **topo da imagem ou o topo do crop detectado**, não `lm[10]`.

Mas isso é uma decisão de design: o box mostra "o rosto detectável pelo mesh" (correto para fins de análise) ou "a extensão visual da cabeça" (mais intuitivo para o usuário). A correção mais honesta é adicionar uma nota no label "Hairline (mesh)" para deixar claro que o top é o limite do MediaPipe, não o topo real da cabeça.

Read [](file:///home/luizescobal/study/face-before-after/frontend/src/components/OverlayLayer.tsx)

Agora verifico o TypeScript e depois gero a imagem de revisão crítica:

Ran terminal command: cd /home/luizescobal/study/face-before-after/frontend && npx tsc --noEmit 2>&1 | head -30

TypeScript limpo. Agora gero a imagem de revisão crítica simulando exatamente o que o novo código faz:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]
out = img.copy()

def txt(img, text, x, y, color, scale=0.38):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

# === FaceExtents ===
yTop  = lm(10)[1]
yMen  = lm(152)[1]
xL    = lm(234)[0]
xR    = lm(454)[0]
WHITE = (255,255,255)
cv2.rectangle(out, (xL, yTop), (xR, yMen), WHITE, 1)
txt(out, "Trichion (mesh)", xL+4, yTop-4, WHITE)
txt(out, "Menton",          xL+4, yMen+14, WHITE)

# === GridThirds ===
yBrow = (lm(107)[1] + lm(336)[1]) // 2
ySub  = lm(2)[1]
faceH = yMen - yTop

yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

PURPLE = (200,150,255)
ORANGE = (0,165,255)

# Ideal dashed
cv2.line(out, (0, yT1_ideal), (w, yT1_ideal), PURPLE, 1)
cv2.line(out, (0, yT2_ideal), (w, yT2_ideal), PURPLE, 1)
txt(out, "ideal 1/3", xL+4, yT1_ideal-3, PURPLE)
txt(out, "ideal 2/3", xL+4, yT2_ideal-3, PURPLE)

# Real landmark lines
cv2.line(out, (0, yBrow), (w, yBrow), ORANGE, 2)
txt(out, "Sobrancelha", xL+4, yBrow-3, ORANGE)
cv2.line(out, (0, ySub),  (w, ySub),  ORANGE, 2)
txt(out, "Subnasale",    xL+4, ySub-3,  ORANGE)

# Lateral labels with deviation
thirds = [
    (yTop, yBrow, "upper_third_ratio", "T1"),
    (yBrow, ySub,  "middle_third_ratio", "T2"),
    (ySub, yMen,   "lower_third_ratio", "T3"),
]
SEV_COLORS = {"ideal":(80,200,80), "mild":(80,200,80), "moderate":(50,200,220), "strong":(0,165,255), "extreme":(0,80,255)}
for yA, yB, mid, label in thirds:
    m = metric_evals.get(mid, {})
    pct = (m.get('value', (yB-yA)/faceH)) * 100
    sev = m.get('severity_5', None)
    color = SEV_COLORS.get(sev, (150,150,150))
    dev = pct - 33.3
    devStr = f"+{dev:.0f}" if dev >= 0 else f"{dev:.0f}"
    txt(out, f"{label} {pct:.0f}% ({devStr}%)", xR+6, int((yA+yB)/2+4), color, 0.42)

# === GridFifths ===
xFaceL = lm(234)[0]
xFaceR = lm(454)[0]
faceW  = xFaceR - xFaceL
fifth  = faceW / 5

actuals = [lm(33)[0], lm(133)[0], lm(362)[0], lm(263)[0]]
names   = ["OExt.E", "OInt.E", "OInt.D", "OExt.D"]
ideals  = [xFaceL + (i+1)*fifth for i in range(4)]

# Face edges
cv2.line(out, (xFaceL, yTop), (xFaceL, yMen), WHITE, 1)
cv2.line(out, (xFaceR, yTop), (xFaceR, yMen), WHITE, 1)

# Ideal fifths dashed
for xi in ideals:
    cv2.line(out, (int(xi), yTop), (int(xi), yMen), PURPLE, 1)

# Actual eye corners + deviation
yLabel = yMen - 14
for i, (x, name) in enumerate(zip(actuals, names)):
    cv2.line(out, (x, yTop), (x, yMen), ORANGE, 1)
    dev = int(round(x - ideals[i]))
    devStr = f"+{dev}" if dev > 0 else str(dev)
    txt(out, f"{name} {devStr}px", x+2, yLabel - i*12, ORANGE, 0.35)

txt(out, "Quintos - tracejado:ideal laranja:real (desvio px)", xFaceL+2, yTop-6, PURPLE, 0.35)

cv2.imwrite('/tmp/overlay_final_review.jpg', out)
print("Saved /tmp/overlay_final_review.jpg")
EOF


Ran terminal command: cd /home/luizescobal/study/face-before-after && python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]
out = img.copy()

def txt(img, text, x, y, color, scale=0.38):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

yTop  = lm(10)[1]
yMen  = lm(152)[1]
xL    = lm(234)[0]
xR    = lm(454)[0]
WHITE  = (255,255,255)
PURPLE = (200,150,255)
ORANGE = (0,165,255)

# FaceExtents
cv2.rectangle(out, (xL, yTop), (xR, yMen), WHITE, 1)
txt(out, "Trichion (mesh)", xL+4, yTop-4, WHITE)
txt(out, "Menton", xL+4, yMen+14, WHITE)

# GridThirds
yBrow = (lm(107)[1] + lm(336)[1]) // 2
ySub  = lm(2)[1]
faceH = yMen - yTop
yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

cv2.line(out, (0, yT1_ideal), (w, yT1_ideal), PURPLE, 1)
cv2.line(out, (0, yT2_ideal), (w, yT2_ideal), PURPLE, 1)
txt(out, "ideal 1/3", xL+4, yT1_ideal-3, PURPLE)
txt(out, "ideal 2/3", xL+4, yT2_ideal-3, PURPLE)

cv2.line(out, (0, yBrow), (w, yBrow), ORANGE, 2)
txt(out, "Sobrancelha", xL+4, yBrow-3, ORANGE)
cv2.line(out, (0, ySub), (w, ySub), ORANGE, 2)
txt(out, "Subnasale", xL+4, ySub-3, ORANGE)

SEV = {"ideal":(80,200,80),"mild":(80,200,80),"moderate":(50,200,220),"strong":(0,165,255),"extreme":(0,80,255)}
for yA, yB, mid, label in [(yTop,yBrow,"upper_third_ratio","T1"),(yBrow,ySub,"middle_third_ratio","T2"),(ySub,yMen,"lower_third_ratio","T3")]:
    m = metric_evals.get(mid, {})
    pct = m.get('value', (yB-yA)/faceH) * 100
    color = SEV.get(m.get('severity_5'), (150,150,150))
    dev = pct - 33.3
    txt(out, f"{label} {pct:.0f}% ({'+' if dev>=0 else ''}{dev:.0f}%)", xR+6, int((yA+yB)/2+4), color, 0.42)

# GridFifths
faceW = xR - xL
fifth = faceW / 5
actuals = [lm(33)[0], lm(133)[0], lm(362)[0], lm(263)[0]]
names   = ["OExt.E","OInt.E","OInt.D","OExt.D"]
ideals  = [xL + (i+1)*fifth for i in range(4)]

cv2.line(out, (xL, yTop), (xL, yMen), WHITE, 1)
cv2.line(out, (xR, yTop), (xR, yMen), WHITE, 1)
for xi in ideals:
    cv2.line(out, (int(xi), yTop), (int(xi), yMen), PURPLE, 1)

yLbl = yMen - 16
for i, (x, name) in enumerate(zip(actuals, names)):
    cv2.line(out, (x, yTop), (x, yMen), ORANGE, 1)
    dev = int(round(x - ideals[i]))
    txt(out, f"{name} {'+' if dev>0 else ''}{dev}px", x+2, yLbl - i*14, ORANGE, 0.35)

txt(out, "Quintos: tracejado=ideal, laranja=real", xL+2, yTop-6, PURPLE, 0.36)

cv2.imwrite('/tmp/overlay_final_review.jpg', out)
print(f"OK {w}x{h}")
EOF
Vou ler o contexto canônico antes de tocar no código.

Read [](file:///home/luizescobal/study/face-before-after/.claude/face-analysis/00-index.md)

Read [](file:///home/luizescobal/study/face-before-after/.claude/face-analysis/08-svg-overlays.md)

A doc diz que os bugs foram "corrigidos", mas minha análise visual agora mostra que os terços ainda estão errados. Vou verificar o estado real do código e entender o problema raiz de ponta a ponta.

Ran terminal command: python3 - <<'EOF'
import json
with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

lm = data['landmarks']

# Todos os pontos relevantes
crown = lm[10]
menton = lm[152]
brow_l = lm[107]
brow_r = lm[336]
subnasale = lm[2]
zygo_l = lm[234]
zygo_r = lm[454]

print(f"Image crop: {data['auto_crop']['crop_bbox']}")
print(f"Image (canonical) size: 847x1155 (da imagem lida)")
print()
print(f"lm[10] (crown/forehead_center): y={crown[1]:.0f}")
print(f"lm[151] (forehead_top):         y={lm[151][1]:.0f}")
print(f"lm[10] is far from top of head - real hairline should be ~y=0 area")
print()

# What percentage of the image height is crown at?
img_h = 1155  # from the image
print(f"Crown lm[10] at y={crown[1]:.0f} = {crown[1]/img_h*100:.1f}% from top of image")
print(f"This means lm[10] is NOT at the top of the head")
print()

# What does the metric say?
face_h = menton[1] - crown[1]
y_brow = (brow_l[1] + brow_r[1]) / 2
y_sub = subnasale[1]
print(f"Face height (crown→menton): {face_h:.0f}px")
print(f"Upper: {(y_brow-crown[1])/face_h*100:.1f}%  Mid: {(y_sub-y_brow)/face_h*100:.1f}%  Lower: {(menton[1]-y_sub)/face_h*100:.1f}%")
print()

# Check if backend metric_evaluations exist in JSON
blocks = data.get('measurements_blocks', {})
print("measurements_blocks keys:", list(blocks.keys())[:5])

# Check if metric data has third ratios
metric_evals = data.get('metric_evaluations', [])
print(f"metric_evaluations count: {len(metric_evals)}")
if metric_evals:
    for m in metric_evals:
        if 'third' in m.get('metric_id',''):
            print(m)
EOF


Ran terminal command: grep -n "upper_third\|lower_third\|middle_third\|FOREHEAD\|P_FOREHEAD\|landmark.*10\b" /home/luizescobal/study/face-before-after/backend/app/services/metrics/thirds.py | head -40

Ran terminal command: cat /home/luizescobal/study/face-before-after/backend/app/services/metrics/thirds.py

Agora tenho o quadro completo. Vou verificar o que o `P_FOREHEAD_CROWN=10` realmente é no MediaPipe, e entender o problema dos quintos também.

Ran terminal command: grep -n "P_FOREHEAD_CROWN\|P_MENTON\|P_BROW\|P_SUBNASALE\|= 10\b\|= 152\b" /home/luizescobal/study/face-before-after/backend/app/domain/landmarks_mesh.py | head -30

Ran terminal command: python3 - <<'EOF'
import json
with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)
lm = data['landmarks']

# Scan the top Y coordinates in the mesh to understand what landmark 10 actually is
# vs what's actually at the top of the face
top_lms = sorted(enumerate(lm), key=lambda x: x[1][1])[:15]
print("Landmarks with lowest Y (top of image):")
for idx, (x,y) in top_lms:
    print(f"  lm[{idx}]: x={x:.0f}, y={y:.0f}")

print()
print(f"lm[10]: x={lm[10][0]:.0f}, y={lm[10][1]:.0f}")
print(f"lm[151]: x={lm[151][0]:.0f}, y={lm[151][1]:.0f}")
print(f"lm[9]: x={lm[9][0]:.0f}, y={lm[9][1]:.0f}")

# What about the fifths? Let's check what the frontend calculates
zygo_l = lm[234]
zygo_r = lm[454]
eye_ol = lm[33]
eye_or = lm[263]
eye_il = lm[133]
eye_ir = lm[362]

face_w = zygo_r[0] - zygo_l[0]
fifth  = face_w / 5

print(f"\n=== FIFTHS ANALYSIS ===")
print(f"Face width (234→454): {face_w:.0f}px")
print(f"Ideal fifth: {fifth:.1f}px")
print()
print(f"Ideal edges from zygo_l ({zygo_l[0]:.0f}):")
for i in [1,2,3,4]:
    print(f"  {i}/5 = x={zygo_l[0]+i*fifth:.0f}")

print()
print(f"Actual eye corners:")
print(f"  eye outer L (lm[33]):  x={eye_ol[0]:.0f} (ideal 1/5 = {zygo_l[0]+fifth:.0f}, delta={eye_ol[0]-(zygo_l[0]+fifth):.0f}px)")
print(f"  eye inner L (lm[133]): x={eye_il[0]:.0f} (ideal 2/5 = {zygo_l[0]+2*fifth:.0f}, delta={eye_il[0]-(zygo_l[0]+2*fifth):.0f}px)")
print(f"  eye inner R (lm[362]): x={eye_ir[0]:.0f} (ideal 3/5 = {zygo_l[0]+3*fifth:.0f}, delta={eye_ir[0]-(zygo_l[0]+3*fifth):.0f}px)")
print(f"  eye outer R (lm[263]): x={eye_or[0]:.0f} (ideal 4/5 = {zygo_l[0]+4*fifth:.0f}, delta={eye_or[0]-(zygo_l[0]+4*fifth):.0f}px)")
EOF


Agora tenho o diagnóstico completo e definitivo. Vou fazer os fixes.

**Diagnóstico real:**

1. **Terços — o problema é duplo:** `lm[10]` é realmente o ponto mais alto do mesh (y=261), mas está em y=22.6% da imagem — existe cabeça/cabelo acima. O cálculo de métrica usa `lm[10]→menton` que dá upper=20%. **Isso está matematicamente correto dado que o MediaPipe não detecta acima do hairline** — o problema é que o overlay visual desenha a linha do "ideal" em `yTop + faceH/3` mas as linhas laranja "reais" mostram brow/subnasale que batem com os 20%/40% corretos. O overlay está correto mas **confuso visualmente** — a legenda T1/T2/T3 mostra os percentuais reais da face detectada, não da "face ideal".

2. **Quintos — funcionam bem:** deltas máximos de 13px (2% da largura) são aceitáveis, o overlay dual (tracejado ideal + laranja real) está correto.

O verdadeiro bug visual é: **o overlay de terços desenhando as linhas dashed "ideais" em posições absolutas (yTop + faceH/3) faz parecer que a face está errada quando o problema é que lm[10] não é o hairline real**. Preciso verificar o `GridThirds` mais cuidadosamente:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

# Simulate exactly what GridThirds does
P_FOREHEAD_CROWN = 10
P_BROW_LEFT_INNER = 107
P_BROW_RIGHT_INNER = 336
P_SUBNASALE = 2
P_MENTON = 152
P_ZYGO_IMG_RIGHT = 454
P_ZYGO_IMG_LEFT = 234

crown = lm(P_FOREHEAD_CROWN)
menton = lm(P_MENTON)
brow_l = lm(P_BROW_LEFT_INNER)
brow_r = lm(P_BROW_RIGHT_INNER)
zygo_r = lm(P_ZYGO_IMG_RIGHT)
zygo_l = lm(P_ZYGO_IMG_LEFT)
subnasale = lm(P_SUBNASALE)

yTop  = crown[1]
yBrow = (brow_l[1] + brow_r[1]) // 2
ySub  = subnasale[1]
yMen  = menton[1]

faceH = yMen - yTop
yT1   = yTop + faceH // 3   # ideal 1/3 line (dashed purple)
yT2   = yTop + 2 * faceH // 3  # ideal 2/3 line (dashed purple)

print("=== GridThirds exact simulation ===")
print(f"yTop={yTop} (lm[10] forehead crown)")
print(f"yBrow={yBrow} (brow inner midpoint) — laranja sólido")
print(f"ySub={ySub}  (subnasale) — laranja sólido")
print(f"yMen={yMen}  (menton)")
print(f"faceH={faceH}px")
print()
print(f"Ideal dashed lines: yT1={yT1} yT2={yT2}")
print(f"Real orange lines:  yBrow={yBrow} ySub={ySub}")
print()
print(f"Delta yBrow vs yT1: {yBrow - yT1}px (negative = brow ABOVE ideal 1/3)")
print(f"Delta ySub  vs yT2: {ySub  - yT2}px")
print()

# Labels - what does GridThirds render?
# The metric values from backend:
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}
upper_val  = metric_evals['upper_third_ratio']['value']
middle_val = metric_evals['middle_third_ratio']['value']
lower_val  = metric_evals['lower_third_ratio']['value']

print(f"Label rendered (from backend metric values):")
print(f"  T1: {upper_val*100:.0f}% (vs ideal 33%)")
print(f"  T2: {middle_val*100:.0f}% (vs ideal 33%)")
print(f"  T3: {lower_val*100:.0f}% (vs ideal 33%)")
print()
print("VERDICT:")
print("- lm[10] at y=261 is the HIGHEST point of MediaPipe mesh")
print("- Hair above it (~y=0..261) is NOT detected by MediaPipe")
print("- So upper_third=20% is REAL — Brad Pitt has high hairline / small upper third")
print("  within the DETECTED face region")
print()
print("The VISUAL problem is that the dashed 'ideal' lines sit at yTop+faceH/3,")
print("which looks correct, but the labels show 20%/40%/40% making it look wrong.")
print()
print("Actually the real issue: if lm[10] is the highest mesh point,")
print("the brow line at yBrow falls only 20% into the detected face — which IS correct")
print("for Brad Pitt who has a larger-than-ideal forehead relative to the 3 equal thirds.")
print("Wait — 20% upper means SHORT upper third (brow close to hairline), not long forehead.")
print()
print(f"Upper: {upper_val*100:.1f}% SHORT = brow is HIGH = forehead is SHORT relative to face")
EOF


Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

# Generate definitive visual: side-by-side comparison
# LEFT: what the current overlay draws
# RIGHT: what it SHOULD draw

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]

crown = lm(10)
menton = lm(152)
brow_l = lm(107)
brow_r = lm(336)
sub = lm(2)
zygo_l = lm(234)
zygo_r = lm(454)
eye_ol = lm(33)
eye_or = lm(263)
eye_il = lm(133)
eye_ir = lm(362)

yTop = crown[1]
yBrow = (brow_l[1] + brow_r[1]) // 2
ySub = sub[1]
yMen = menton[1]
faceH = yMen - yTop
yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

xFaceL = zygo_l[0]
xFaceR = zygo_r[0]
faceW = xFaceR - xFaceL
fifth = faceW / 5

def put_label(img, text, x, y, color=(255,255,255), scale=0.45):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

# =============================================================================
# LEFT panel: current overlay behavior
# =============================================================================
left = img.copy()

# FaceExtents box
cv2.rectangle(left, (xFaceL, yTop), (xFaceR, yMen), (255,255,255), 1)

# Thirds: ideal dashed (purple) and real orange
cv2.line(left, (0, yT1_ideal), (w, yT1_ideal), (180,130,255), 1)
cv2.line(left, (0, yT2_ideal), (w, yT2_ideal), (180,130,255), 1)
cv2.line(left, (0, yBrow),     (w, yBrow),     (0,165,255), 2)
cv2.line(left, (0, ySub),      (w, ySub),      (0,165,255), 2)

# Fifths: ideal dashed + actual orange
for i in [1,2,3,4]:
    xi = int(xFaceL + i * fifth)
    cv2.line(left, (xi, yTop), (xi, yMen), (180,130,255), 1)
for x in [eye_ol[0], eye_il[0], eye_ir[0], eye_or[0]]:
    cv2.line(left, (x, yTop), (x, yMen), (0,165,255), 1)

put_label(left, "ATUAL", 10, 30, (0,200,255), 0.7)
put_label(left, f"T1 {(yBrow-yTop)/faceH*100:.0f}%", xFaceR+5, yTop+(yBrow-yTop)//2, (0,165,255))
put_label(left, f"T2 {(ySub-yBrow)/faceH*100:.0f}%",  xFaceR+5, yBrow+(ySub-yBrow)//2, (0,165,255))
put_label(left, f"T3 {(yMen-ySub)/faceH*100:.0f}%",   xFaceR+5, ySub+(yMen-ySub)//2,  (0,165,255))

# =============================================================================
# RIGHT panel: correct overlay
# Problema raiz: lm[10] é o ponto mais alto do mesh, que está em y=261
# (23% da imagem), mas a testa real começa em ~y=0.
# O GridThirds usa yTop=lm[10] e depois traça o "ideal" como yTop+faceH/3.
# Mas as métricas (upper=20%) são calculadas com o MESMO lm[10].
# Então os terços são consistentes internamente — o visual não está "errado",
# mas a interpretação da linha laranja T1/yBrow indica que o rosto tem
# terço superior CURTO (brow alta), o que é correto para Brad Pitt.
#
# O REAL bug visual é que a linha "ideal dashed" de T1 cai em yT1=549 (64%),
# muito abaixo do brow real (y=435), mostrando um gap enorme que assusta o usuário.
# A legenda clarifica (20% vs 33%), mas visualmente parece que o overlay está quebrado.
#
# FIX: mostrar claramente nos labels O QUE CADA LINHA É.
# =============================================================================
right = img.copy()

cv2.rectangle(right, (xFaceL, yTop), (xFaceR, yMen), (255,255,255), 1)

# Ideal thirds (dashed)
for y, label in [(yT1_ideal, "ideal 1/3"), (yT2_ideal, "ideal 2/3")]:
    cv2.line(right, (0, y), (w, y), (180,130,255), 1)
    put_label(right, label, 5, y-4, (180,130,255))

# Real landmark lines (orange solid) with clear labels
cv2.line(right, (0, yBrow), (w, yBrow), (0,165,255), 2)
put_label(right, f"SOBRANCELHA (real T1={( yBrow-yTop)/faceH*100:.0f}%)", 5, yBrow-6, (0,165,255))
cv2.line(right, (0, ySub), (w, ySub), (0,165,255), 2)
put_label(right, f"SUBNASALE (real T2-end={( ySub-yTop)/faceH*100:.0f}%)", 5, ySub-6, (0,165,255))

# lm[10] and menton markers
cv2.line(right, (0, yTop), (w, yTop), (255,255,255), 1)
put_label(right, f"lm[10] hairline proxy (y={yTop})", 5, yTop+14, (255,255,255))
cv2.line(right, (0, yMen), (w, yMen), (255,255,255), 1)

# Fifths 
for i in [1,2,3,4]:
    xi = int(xFaceL + i * fifth)
    cv2.line(right, (xi, yTop), (xi, yMen), (180,130,255), 1)
for x, label in [(eye_ol[0],'OL'), (eye_il[0],'IL'), (eye_ir[0],'IR'), (eye_or[0],'OR')]:
    cv2.line(right, (x, yTop), (x, yMen), (0,165,255), 1)

put_label(right, "CORRETO (mesmo calc, labels claros)", 10, 30, (0,255,0), 0.55)
put_label(right, f"T1={( yBrow-yTop)/faceH*100:.0f}% T2={(ySub-yBrow)/faceH*100:.0f}% T3={(yMen-ySub)/faceH*100:.0f}%", 10, 55, (0,200,255))

# Combine
combined = np.hstack([left, right])
cv2.line(combined, (w, 0), (w, h), (255,255,0), 2)
cv2.imwrite('/tmp/debug_comparison.jpg', combined)
print(f"Saved /tmp/debug_comparison.jpg ({combined.shape[1]}x{combined.shape[0]})")
EOF


Read [](file:///tmp/debug_comparison.jpg)

Agora tenho o diagnóstico visual definitivo. Os dois painéis mostram **o mesmo cálculo** — o problema não é nos números, é em **como o overlay comunica o que está desenhado**. Vou agora fazer uma análise crítica completa antes de implementar qualquer fix.

**Análise crítica real:**

O overlay `GridThirds` tem **dois problemas distintos**:

1. **Problema de semântica visual:** A linha dashed "ideal" (T1 = yTop + faceH/3) fica muito abaixo da sobrancelha real, criando um gap visual enorme que faz parecer que o sistema está quebrado. O usuário vê a sobrancelha laranja acima e a linha roxa "ideal" muito abaixo — isso **inverte a intuição**: parece que o "ideal" está mais pra baixo quando na verdade T1 curto (20%) significa sobrancelha ALTA.

2. **Problema de âncora do hairline:** `lm[10]` não é o hairline real — é o ponto mais alto do mesh, que está em y=261 (23% da imagem). Existe testa real acima. Isso faz o terço superior parecer menor do que é na realidade anatômica.

Agora vou implementar os fixes corretos:

Used tool: ToolSearch

Agora vou corrigir o `GridThirds`. O problema central: as linhas dashed roxas estão em `yTop + faceH/3` (posição "onde estaria o ideal") mas a **semântica está invertida** — a linha laranja ACIMA da dashed faz parecer que o overlay está errado, quando na verdade está correto. Preciso trocar a comunicação visual.

Read [](file:///home/luizescobal/study/face-before-after/frontend/src/components/OverlayLayer.tsx)

Agora tenho clareza total. Vou fazer os fixes:

**Fix 1 — `GridThirds`:** 
- As linhas dashed estão corretas mas as linhas "real" (laranja) precisam de label direto em cima delas, não só no label lateral. Hoje o label lateral diz "T1 20% (33%)" mas isso é confuso porque a linha laranja está ACIMA da dashed, fazendo parecer que o overlay errou.
- A correção: desenhar label diretamente nas linhas laranja indicando o que são, e mudar o label lateral para mostrar o **desvio** do ideal.

**Fix 2 — `GridFifths`:**
- Os quintos estão funcionando corretamente (desvios de ~13px). O label precisa mostrar o desvio por quinto.Agora fix do `GridFifths` — adicionar desvio por quinto e label nas linhas de borda:Agora verifico o `FaceExtents` — preciso confirmar que o bounding box usa os landmarks certos:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]

# FaceExtents usa: yTop=lm[10], yMenton=lm[152], xL=lm[234], xR=lm[454]
yTop   = lm(10)[1]
yMen   = lm(152)[1]
xL     = lm(234)[0]
xR     = lm(454)[0]

print(f"FaceExtents bounding box: x=[{xL},{xR}] y=[{yTop},{yMen}]")
print(f"Image dimensions: {w}x{h}")
print(f"Box width: {xR-xL}px ({(xR-xL)/w*100:.0f}% of image width)")
print(f"Box height: {yMen-yTop}px ({(yMen-yTop)/h*100:.0f}% of image height)")
print()

# Draw FaceExtents to verify visually
out = img.copy()
cv2.rectangle(out, (xL, yTop), (xR, yMen), (255,255,255), 2)
cv2.circle(out, lm(10),  6, (0,255,0), -1)
cv2.circle(out, lm(152), 6, (0,255,0), -1)
cv2.circle(out, lm(234), 6, (0,255,255), -1)
cv2.circle(out, lm(454), 6, (0,255,255), -1)

# Does the box visually contain the face?
# Check: are eye outer corners inside the box?
eol = lm(33)
eor = lm(263)
print(f"Eye outer L: x={eol[0]} (box xL={xL}) — inside: {eol[0] > xL}")
print(f"Eye outer R: x={eor[0]} (box xR={xR}) — inside: {eor[0] < xR}")
print()
# Is crown at the top of the face or inside hair?
print(f"lm[10] y={yTop} vs image top y=0")
print(f"Hair region above crown: {yTop}px ({yTop/h*100:.0f}% of img — NOT in bounding box)")

cv2.imwrite('/tmp/face_extents_check.jpg', out)
print("Saved /tmp/face_extents_check.jpg")
EOF


Read [](file:///tmp/face_extents_check.jpg)

Aqui está o segundo problema real: **o `FaceExtents` está errado visualmente**. O box branco:
- **Topo (yTop=lm[10]):** começa no meio da testa, cortando o hairline real
- **Laterais (lm[234]/lm[454]):** os pontos zigomáticos estão na linha dos olhos (y≈583), não nas extremidades mais largas da face — o box é mais estreito que a face visível

O `FaceExtents` deveria englobar o rosto visual real. Preciso corrigir os anchors laterais para usar os pontos mais extremos da bochecha ao invés dos zigomáticos médios, e o topo para usar o ponto mais alto disponível no mesh.

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm_raw = lambda i: (landmarks[i][0], landmarks[i][1])

# Find the leftmost and rightmost points in the face mesh
all_x = [(i, landmarks[i][0], landmarks[i][1]) for i in range(478)]
leftmost  = sorted(all_x, key=lambda t: t[1])[:5]
rightmost = sorted(all_x, key=lambda t: t[1], reverse=True)[:5]
topmost   = sorted(all_x, key=lambda t: t[2])[:5]

print("5 leftmost (smallest x):")
for i, x, y in leftmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

print("\n5 rightmost (largest x):")
for i, x, y in rightmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

print("\n5 topmost (smallest y):")
for i, x, y in topmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

# Current zygo points
print(f"\nCurrent lm[234] (zygo L): x={landmarks[234][0]:.0f}, y={landmarks[234][1]:.0f}")
print(f"Current lm[454] (zygo R): x={landmarks[454][0]:.0f}, y={landmarks[454][1]:.0f}")
print(f"Current lm[10]  (crown):  x={landmarks[10][0]:.0f}, y={landmarks[10][1]:.0f}")

# Check specific candidates for wider face boundary
for idx in [234, 127, 93, 132, 58, 172, 136, 150, 149, 176, 148]:
    print(f"  lm[{idx}]: x={landmarks[idx][0]:.0f}, y={landmarks[idx][1]:.0f}")
EOF


Os pontos laterais `lm[234]` e `lm[454]` já são os mais extremos do mesh (x=91 e x=799 numa imagem de 847px). O problema não é os pontos — é que a imagem tem margem lateral de background. O `FaceExtents` está correto matematicamente; o que parece "estreito" é porque a imagem tem bastante espaço nas laterais.

O problema real do `FaceExtents` é apenas **o topo** — `lm[10]` em y=261 corta 23% da imagem acima (hairline/cabelo). Para o `FaceExtents` ter sentido visual, o topo deveria ser o **topo da imagem ou o topo do crop detectado**, não `lm[10]`.

Mas isso é uma decisão de design: o box mostra "o rosto detectável pelo mesh" (correto para fins de análise) ou "a extensão visual da cabeça" (mais intuitivo para o usuário). A correção mais honesta é adicionar uma nota no label "Hairline (mesh)" para deixar claro que o top é o limite do MediaPipe, não o topo real da cabeça.

Read [](file:///home/luizescobal/study/face-before-after/frontend/src/components/OverlayLayer.tsx)

Agora verifico o TypeScript e depois gero a imagem de revisão crítica:

Ran terminal command: cd /home/luizescobal/study/face-before-after/frontend && npx tsc --noEmit 2>&1 | head -30

TypeScript limpo. Agora gero a imagem de revisão crítica simulando exatamente o que o novo código faz:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]
out = img.copy()

def txt(img, text, x, y, color, scale=0.38):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

# === FaceExtents ===
yTop  = lm(10)[1]
yMen  = lm(152)[1]
xL    = lm(234)[0]
xR    = lm(454)[0]
WHITE = (255,255,255)
cv2.rectangle(out, (xL, yTop), (xR, yMen), WHITE, 1)
txt(out, "Trichion (mesh)", xL+4, yTop-4, WHITE)
txt(out, "Menton",          xL+4, yMen+14, WHITE)

# === GridThirds ===
yBrow = (lm(107)[1] + lm(336)[1]) // 2
ySub  = lm(2)[1]
faceH = yMen - yTop

yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

PURPLE = (200,150,255)
ORANGE = (0,165,255)

# Ideal dashed
cv2.line(out, (0, yT1_ideal), (w, yT1_ideal), PURPLE, 1)
cv2.line(out, (0, yT2_ideal), (w, yT2_ideal), PURPLE, 1)
txt(out, "ideal 1/3", xL+4, yT1_ideal-3, PURPLE)
txt(out, "ideal 2/3", xL+4, yT2_ideal-3, PURPLE)

# Real landmark lines
cv2.line(out, (0, yBrow), (w, yBrow), ORANGE, 2)
txt(out, "Sobrancelha", xL+4, yBrow-3, ORANGE)
cv2.line(out, (0, ySub),  (w, ySub),  ORANGE, 2)
txt(out, "Subnasale",    xL+4, ySub-3,  ORANGE)

# Lateral labels with deviation
thirds = [
    (yTop, yBrow, "upper_third_ratio", "T1"),
    (yBrow, ySub,  "middle_third_ratio", "T2"),
    (ySub, yMen,   "lower_third_ratio", "T3"),
]
SEV_COLORS = {"ideal":(80,200,80), "mild":(80,200,80), "moderate":(50,200,220), "strong":(0,165,255), "extreme":(0,80,255)}
for yA, yB, mid, label in thirds:
    m = metric_evals.get(mid, {})
    pct = (m.get('value', (yB-yA)/faceH)) * 100
    sev = m.get('severity_5', None)
    color = SEV_COLORS.get(sev, (150,150,150))
    dev = pct - 33.3
    devStr = f"+{dev:.0f}" if dev >= 0 else f"{dev:.0f}"
    txt(out, f"{label} {pct:.0f}% ({devStr}%)", xR+6, int((yA+yB)/2+4), color, 0.42)

# === GridFifths ===
xFaceL = lm(234)[0]
xFaceR = lm(454)[0]
faceW  = xFaceR - xFaceL
fifth  = faceW / 5

actuals = [lm(33)[0], lm(133)[0], lm(362)[0], lm(263)[0]]
names   = ["OExt.E", "OInt.E", "OInt.D", "OExt.D"]
ideals  = [xFaceL + (i+1)*fifth for i in range(4)]

# Face edges
cv2.line(out, (xFaceL, yTop), (xFaceL, yMen), WHITE, 1)
cv2.line(out, (xFaceR, yTop), (xFaceR, yMen), WHITE, 1)

# Ideal fifths dashed
for xi in ideals:
    cv2.line(out, (int(xi), yTop), (int(xi), yMen), PURPLE, 1)

# Actual eye corners + deviation
yLabel = yMen - 14
for i, (x, name) in enumerate(zip(actuals, names)):
    cv2.line(out, (x, yTop), (x, yMen), ORANGE, 1)
    dev = int(round(x - ideals[i]))
    devStr = f"+{dev}" if dev > 0 else str(dev)
    txt(out, f"{name} {devStr}px", x+2, yLabel - i*12, ORANGE, 0.35)

txt(out, "Quintos - tracejado:ideal laranja:real (desvio px)", xFaceL+2, yTop-6, PURPLE, 0.35)

cv2.imwrite('/tmp/overlay_final_review.jpg', out)
print("Saved /tmp/overlay_final_review.jpg")
EOF


Ran terminal command: cd /home/luizescobal/study/face-before-after && python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]
out = img.copy()

def txt(img, text, x, y, color, scale=0.38):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

yTop  = lm(10)[1]
yMen  = lm(152)[1]
xL    = lm(234)[0]
xR    = lm(454)[0]
WHITE  = (255,255,255)
PURPLE = (200,150,255)
ORANGE = (0,165,255)

# FaceExtents
cv2.rectangle(out, (xL, yTop), (xR, yMen), WHITE, 1)
txt(out, "Trichion (mesh)", xL+4, yTop-4, WHITE)
txt(out, "Menton", xL+4, yMen+14, WHITE)

# GridThirds
yBrow = (lm(107)[1] + lm(336)[1]) // 2
ySub  = lm(2)[1]
faceH = yMen - yTop
yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

cv2.line(out, (0, yT1_ideal), (w, yT1_ideal), PURPLE, 1)
cv2.line(out, (0, yT2_ideal), (w, yT2_ideal), PURPLE, 1)
txt(out, "ideal 1/3", xL+4, yT1_ideal-3, PURPLE)
txt(out, "ideal 2/3", xL+4, yT2_ideal-3, PURPLE)

cv2.line(out, (0, yBrow), (w, yBrow), ORANGE, 2)
txt(out, "Sobrancelha", xL+4, yBrow-3, ORANGE)
cv2.line(out, (0, ySub), (w, ySub), ORANGE, 2)
txt(out, "Subnasale", xL+4, ySub-3, ORANGE)

SEV = {"ideal":(80,200,80),"mild":(80,200,80),"moderate":(50,200,220),"strong":(0,165,255),"extreme":(0,80,255)}
for yA, yB, mid, label in [(yTop,yBrow,"upper_third_ratio","T1"),(yBrow,ySub,"middle_third_ratio","T2"),(ySub,yMen,"lower_third_ratio","T3")]:
    m = metric_evals.get(mid, {})
    pct = m.get('value', (yB-yA)/faceH) * 100
    color = SEV.get(m.get('severity_5'), (150,150,150))
    dev = pct - 33.3
    txt(out, f"{label} {pct:.0f}% ({'+' if dev>=0 else ''}{dev:.0f}%)", xR+6, int((yA+yB)/2+4), color, 0.42)

# GridFifths
faceW = xR - xL
fifth = faceW / 5
actuals = [lm(33)[0], lm(133)[0], lm(362)[0], lm(263)[0]]
names   = ["OExt.E","OInt.E","OInt.D","OExt.D"]
ideals  = [xL + (i+1)*fifth for i in range(4)]

cv2.line(out, (xL, yTop), (xL, yMen), WHITE, 1)
cv2.line(out, (xR, yTop), (xR, yMen), WHITE, 1)
for xi in ideals:
    cv2.line(out, (int(xi), yTop), (int(xi), yMen), PURPLE, 1)

yLbl = yMen - 16
for i, (x, name) in enumerate(zip(actuals, names)):
    cv2.line(out, (x, yTop), (x, yMen), ORANGE, 1)
    dev = int(round(x - ideals[i]))
    txt(out, f"{name} {'+' if dev>0 else ''}{dev}px", x+2, yLbl - i*14, ORANGE, 0.35)

txt(out, "Quintos: tracejado=ideal, laranja=real", xL+2, yTop-6, PURPLE, 0.36)

cv2.imwrite('/tmp/overlay_final_review.jpg', out)
print(f"OK {w}x{h}")
EOF

Vou ler o contexto canônico antes de tocar no código.

Read [](file:///home/luizescobal/study/face-before-after/.claude/face-analysis/00-index.md)

Read [](file:///home/luizescobal/study/face-before-after/.claude/face-analysis/08-svg-overlays.md)

A doc diz que os bugs foram "corrigidos", mas minha análise visual agora mostra que os terços ainda estão errados. Vou verificar o estado real do código e entender o problema raiz de ponta a ponta.

Ran terminal command: python3 - <<'EOF'
import json
with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

lm = data['landmarks']

# Todos os pontos relevantes
crown = lm[10]
menton = lm[152]
brow_l = lm[107]
brow_r = lm[336]
subnasale = lm[2]
zygo_l = lm[234]
zygo_r = lm[454]

print(f"Image crop: {data['auto_crop']['crop_bbox']}")
print(f"Image (canonical) size: 847x1155 (da imagem lida)")
print()
print(f"lm[10] (crown/forehead_center): y={crown[1]:.0f}")
print(f"lm[151] (forehead_top):         y={lm[151][1]:.0f}")
print(f"lm[10] is far from top of head - real hairline should be ~y=0 area")
print()

# What percentage of the image height is crown at?
img_h = 1155  # from the image
print(f"Crown lm[10] at y={crown[1]:.0f} = {crown[1]/img_h*100:.1f}% from top of image")
print(f"This means lm[10] is NOT at the top of the head")
print()

# What does the metric say?
face_h = menton[1] - crown[1]
y_brow = (brow_l[1] + brow_r[1]) / 2
y_sub = subnasale[1]
print(f"Face height (crown→menton): {face_h:.0f}px")
print(f"Upper: {(y_brow-crown[1])/face_h*100:.1f}%  Mid: {(y_sub-y_brow)/face_h*100:.1f}%  Lower: {(menton[1]-y_sub)/face_h*100:.1f}%")
print()

# Check if backend metric_evaluations exist in JSON
blocks = data.get('measurements_blocks', {})
print("measurements_blocks keys:", list(blocks.keys())[:5])

# Check if metric data has third ratios
metric_evals = data.get('metric_evaluations', [])
print(f"metric_evaluations count: {len(metric_evals)}")
if metric_evals:
    for m in metric_evals:
        if 'third' in m.get('metric_id',''):
            print(m)
EOF


Ran terminal command: grep -n "upper_third\|lower_third\|middle_third\|FOREHEAD\|P_FOREHEAD\|landmark.*10\b" /home/luizescobal/study/face-before-after/backend/app/services/metrics/thirds.py | head -40

Ran terminal command: cat /home/luizescobal/study/face-before-after/backend/app/services/metrics/thirds.py

Agora tenho o quadro completo. Vou verificar o que o `P_FOREHEAD_CROWN=10` realmente é no MediaPipe, e entender o problema dos quintos também.

Ran terminal command: grep -n "P_FOREHEAD_CROWN\|P_MENTON\|P_BROW\|P_SUBNASALE\|= 10\b\|= 152\b" /home/luizescobal/study/face-before-after/backend/app/domain/landmarks_mesh.py | head -30

Ran terminal command: python3 - <<'EOF'
import json
with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)
lm = data['landmarks']

# Scan the top Y coordinates in the mesh to understand what landmark 10 actually is
# vs what's actually at the top of the face
top_lms = sorted(enumerate(lm), key=lambda x: x[1][1])[:15]
print("Landmarks with lowest Y (top of image):")
for idx, (x,y) in top_lms:
    print(f"  lm[{idx}]: x={x:.0f}, y={y:.0f}")

print()
print(f"lm[10]: x={lm[10][0]:.0f}, y={lm[10][1]:.0f}")
print(f"lm[151]: x={lm[151][0]:.0f}, y={lm[151][1]:.0f}")
print(f"lm[9]: x={lm[9][0]:.0f}, y={lm[9][1]:.0f}")

# What about the fifths? Let's check what the frontend calculates
zygo_l = lm[234]
zygo_r = lm[454]
eye_ol = lm[33]
eye_or = lm[263]
eye_il = lm[133]
eye_ir = lm[362]

face_w = zygo_r[0] - zygo_l[0]
fifth  = face_w / 5

print(f"\n=== FIFTHS ANALYSIS ===")
print(f"Face width (234→454): {face_w:.0f}px")
print(f"Ideal fifth: {fifth:.1f}px")
print()
print(f"Ideal edges from zygo_l ({zygo_l[0]:.0f}):")
for i in [1,2,3,4]:
    print(f"  {i}/5 = x={zygo_l[0]+i*fifth:.0f}")

print()
print(f"Actual eye corners:")
print(f"  eye outer L (lm[33]):  x={eye_ol[0]:.0f} (ideal 1/5 = {zygo_l[0]+fifth:.0f}, delta={eye_ol[0]-(zygo_l[0]+fifth):.0f}px)")
print(f"  eye inner L (lm[133]): x={eye_il[0]:.0f} (ideal 2/5 = {zygo_l[0]+2*fifth:.0f}, delta={eye_il[0]-(zygo_l[0]+2*fifth):.0f}px)")
print(f"  eye inner R (lm[362]): x={eye_ir[0]:.0f} (ideal 3/5 = {zygo_l[0]+3*fifth:.0f}, delta={eye_ir[0]-(zygo_l[0]+3*fifth):.0f}px)")
print(f"  eye outer R (lm[263]): x={eye_or[0]:.0f} (ideal 4/5 = {zygo_l[0]+4*fifth:.0f}, delta={eye_or[0]-(zygo_l[0]+4*fifth):.0f}px)")
EOF


Agora tenho o diagnóstico completo e definitivo. Vou fazer os fixes.

**Diagnóstico real:**

1. **Terços — o problema é duplo:** `lm[10]` é realmente o ponto mais alto do mesh (y=261), mas está em y=22.6% da imagem — existe cabeça/cabelo acima. O cálculo de métrica usa `lm[10]→menton` que dá upper=20%. **Isso está matematicamente correto dado que o MediaPipe não detecta acima do hairline** — o problema é que o overlay visual desenha a linha do "ideal" em `yTop + faceH/3` mas as linhas laranja "reais" mostram brow/subnasale que batem com os 20%/40% corretos. O overlay está correto mas **confuso visualmente** — a legenda T1/T2/T3 mostra os percentuais reais da face detectada, não da "face ideal".

2. **Quintos — funcionam bem:** deltas máximos de 13px (2% da largura) são aceitáveis, o overlay dual (tracejado ideal + laranja real) está correto.

O verdadeiro bug visual é: **o overlay de terços desenhando as linhas dashed "ideais" em posições absolutas (yTop + faceH/3) faz parecer que a face está errada quando o problema é que lm[10] não é o hairline real**. Preciso verificar o `GridThirds` mais cuidadosamente:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

# Simulate exactly what GridThirds does
P_FOREHEAD_CROWN = 10
P_BROW_LEFT_INNER = 107
P_BROW_RIGHT_INNER = 336
P_SUBNASALE = 2
P_MENTON = 152
P_ZYGO_IMG_RIGHT = 454
P_ZYGO_IMG_LEFT = 234

crown = lm(P_FOREHEAD_CROWN)
menton = lm(P_MENTON)
brow_l = lm(P_BROW_LEFT_INNER)
brow_r = lm(P_BROW_RIGHT_INNER)
zygo_r = lm(P_ZYGO_IMG_RIGHT)
zygo_l = lm(P_ZYGO_IMG_LEFT)
subnasale = lm(P_SUBNASALE)

yTop  = crown[1]
yBrow = (brow_l[1] + brow_r[1]) // 2
ySub  = subnasale[1]
yMen  = menton[1]

faceH = yMen - yTop
yT1   = yTop + faceH // 3   # ideal 1/3 line (dashed purple)
yT2   = yTop + 2 * faceH // 3  # ideal 2/3 line (dashed purple)

print("=== GridThirds exact simulation ===")
print(f"yTop={yTop} (lm[10] forehead crown)")
print(f"yBrow={yBrow} (brow inner midpoint) — laranja sólido")
print(f"ySub={ySub}  (subnasale) — laranja sólido")
print(f"yMen={yMen}  (menton)")
print(f"faceH={faceH}px")
print()
print(f"Ideal dashed lines: yT1={yT1} yT2={yT2}")
print(f"Real orange lines:  yBrow={yBrow} ySub={ySub}")
print()
print(f"Delta yBrow vs yT1: {yBrow - yT1}px (negative = brow ABOVE ideal 1/3)")
print(f"Delta ySub  vs yT2: {ySub  - yT2}px")
print()

# Labels - what does GridThirds render?
# The metric values from backend:
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}
upper_val  = metric_evals['upper_third_ratio']['value']
middle_val = metric_evals['middle_third_ratio']['value']
lower_val  = metric_evals['lower_third_ratio']['value']

print(f"Label rendered (from backend metric values):")
print(f"  T1: {upper_val*100:.0f}% (vs ideal 33%)")
print(f"  T2: {middle_val*100:.0f}% (vs ideal 33%)")
print(f"  T3: {lower_val*100:.0f}% (vs ideal 33%)")
print()
print("VERDICT:")
print("- lm[10] at y=261 is the HIGHEST point of MediaPipe mesh")
print("- Hair above it (~y=0..261) is NOT detected by MediaPipe")
print("- So upper_third=20% is REAL — Brad Pitt has high hairline / small upper third")
print("  within the DETECTED face region")
print()
print("The VISUAL problem is that the dashed 'ideal' lines sit at yTop+faceH/3,")
print("which looks correct, but the labels show 20%/40%/40% making it look wrong.")
print()
print("Actually the real issue: if lm[10] is the highest mesh point,")
print("the brow line at yBrow falls only 20% into the detected face — which IS correct")
print("for Brad Pitt who has a larger-than-ideal forehead relative to the 3 equal thirds.")
print("Wait — 20% upper means SHORT upper third (brow close to hairline), not long forehead.")
print()
print(f"Upper: {upper_val*100:.1f}% SHORT = brow is HIGH = forehead is SHORT relative to face")
EOF


Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

# Generate definitive visual: side-by-side comparison
# LEFT: what the current overlay draws
# RIGHT: what it SHOULD draw

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]

crown = lm(10)
menton = lm(152)
brow_l = lm(107)
brow_r = lm(336)
sub = lm(2)
zygo_l = lm(234)
zygo_r = lm(454)
eye_ol = lm(33)
eye_or = lm(263)
eye_il = lm(133)
eye_ir = lm(362)

yTop = crown[1]
yBrow = (brow_l[1] + brow_r[1]) // 2
ySub = sub[1]
yMen = menton[1]
faceH = yMen - yTop
yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

xFaceL = zygo_l[0]
xFaceR = zygo_r[0]
faceW = xFaceR - xFaceL
fifth = faceW / 5

def put_label(img, text, x, y, color=(255,255,255), scale=0.45):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

# =============================================================================
# LEFT panel: current overlay behavior
# =============================================================================
left = img.copy()

# FaceExtents box
cv2.rectangle(left, (xFaceL, yTop), (xFaceR, yMen), (255,255,255), 1)

# Thirds: ideal dashed (purple) and real orange
cv2.line(left, (0, yT1_ideal), (w, yT1_ideal), (180,130,255), 1)
cv2.line(left, (0, yT2_ideal), (w, yT2_ideal), (180,130,255), 1)
cv2.line(left, (0, yBrow),     (w, yBrow),     (0,165,255), 2)
cv2.line(left, (0, ySub),      (w, ySub),      (0,165,255), 2)

# Fifths: ideal dashed + actual orange
for i in [1,2,3,4]:
    xi = int(xFaceL + i * fifth)
    cv2.line(left, (xi, yTop), (xi, yMen), (180,130,255), 1)
for x in [eye_ol[0], eye_il[0], eye_ir[0], eye_or[0]]:
    cv2.line(left, (x, yTop), (x, yMen), (0,165,255), 1)

put_label(left, "ATUAL", 10, 30, (0,200,255), 0.7)
put_label(left, f"T1 {(yBrow-yTop)/faceH*100:.0f}%", xFaceR+5, yTop+(yBrow-yTop)//2, (0,165,255))
put_label(left, f"T2 {(ySub-yBrow)/faceH*100:.0f}%",  xFaceR+5, yBrow+(ySub-yBrow)//2, (0,165,255))
put_label(left, f"T3 {(yMen-ySub)/faceH*100:.0f}%",   xFaceR+5, ySub+(yMen-ySub)//2,  (0,165,255))

# =============================================================================
# RIGHT panel: correct overlay
# Problema raiz: lm[10] é o ponto mais alto do mesh, que está em y=261
# (23% da imagem), mas a testa real começa em ~y=0.
# O GridThirds usa yTop=lm[10] e depois traça o "ideal" como yTop+faceH/3.
# Mas as métricas (upper=20%) são calculadas com o MESMO lm[10].
# Então os terços são consistentes internamente — o visual não está "errado",
# mas a interpretação da linha laranja T1/yBrow indica que o rosto tem
# terço superior CURTO (brow alta), o que é correto para Brad Pitt.
#
# O REAL bug visual é que a linha "ideal dashed" de T1 cai em yT1=549 (64%),
# muito abaixo do brow real (y=435), mostrando um gap enorme que assusta o usuário.
# A legenda clarifica (20% vs 33%), mas visualmente parece que o overlay está quebrado.
#
# FIX: mostrar claramente nos labels O QUE CADA LINHA É.
# =============================================================================
right = img.copy()

cv2.rectangle(right, (xFaceL, yTop), (xFaceR, yMen), (255,255,255), 1)

# Ideal thirds (dashed)
for y, label in [(yT1_ideal, "ideal 1/3"), (yT2_ideal, "ideal 2/3")]:
    cv2.line(right, (0, y), (w, y), (180,130,255), 1)
    put_label(right, label, 5, y-4, (180,130,255))

# Real landmark lines (orange solid) with clear labels
cv2.line(right, (0, yBrow), (w, yBrow), (0,165,255), 2)
put_label(right, f"SOBRANCELHA (real T1={( yBrow-yTop)/faceH*100:.0f}%)", 5, yBrow-6, (0,165,255))
cv2.line(right, (0, ySub), (w, ySub), (0,165,255), 2)
put_label(right, f"SUBNASALE (real T2-end={( ySub-yTop)/faceH*100:.0f}%)", 5, ySub-6, (0,165,255))

# lm[10] and menton markers
cv2.line(right, (0, yTop), (w, yTop), (255,255,255), 1)
put_label(right, f"lm[10] hairline proxy (y={yTop})", 5, yTop+14, (255,255,255))
cv2.line(right, (0, yMen), (w, yMen), (255,255,255), 1)

# Fifths 
for i in [1,2,3,4]:
    xi = int(xFaceL + i * fifth)
    cv2.line(right, (xi, yTop), (xi, yMen), (180,130,255), 1)
for x, label in [(eye_ol[0],'OL'), (eye_il[0],'IL'), (eye_ir[0],'IR'), (eye_or[0],'OR')]:
    cv2.line(right, (x, yTop), (x, yMen), (0,165,255), 1)

put_label(right, "CORRETO (mesmo calc, labels claros)", 10, 30, (0,255,0), 0.55)
put_label(right, f"T1={( yBrow-yTop)/faceH*100:.0f}% T2={(ySub-yBrow)/faceH*100:.0f}% T3={(yMen-ySub)/faceH*100:.0f}%", 10, 55, (0,200,255))

# Combine
combined = np.hstack([left, right])
cv2.line(combined, (w, 0), (w, h), (255,255,0), 2)
cv2.imwrite('/tmp/debug_comparison.jpg', combined)
print(f"Saved /tmp/debug_comparison.jpg ({combined.shape[1]}x{combined.shape[0]})")
EOF


Read [](file:///tmp/debug_comparison.jpg)

Agora tenho o diagnóstico visual definitivo. Os dois painéis mostram **o mesmo cálculo** — o problema não é nos números, é em **como o overlay comunica o que está desenhado**. Vou agora fazer uma análise crítica completa antes de implementar qualquer fix.

**Análise crítica real:**

O overlay `GridThirds` tem **dois problemas distintos**:

1. **Problema de semântica visual:** A linha dashed "ideal" (T1 = yTop + faceH/3) fica muito abaixo da sobrancelha real, criando um gap visual enorme que faz parecer que o sistema está quebrado. O usuário vê a sobrancelha laranja acima e a linha roxa "ideal" muito abaixo — isso **inverte a intuição**: parece que o "ideal" está mais pra baixo quando na verdade T1 curto (20%) significa sobrancelha ALTA.

2. **Problema de âncora do hairline:** `lm[10]` não é o hairline real — é o ponto mais alto do mesh, que está em y=261 (23% da imagem). Existe testa real acima. Isso faz o terço superior parecer menor do que é na realidade anatômica.

Agora vou implementar os fixes corretos:

Used tool: ToolSearch

Agora vou corrigir o `GridThirds`. O problema central: as linhas dashed roxas estão em `yTop + faceH/3` (posição "onde estaria o ideal") mas a **semântica está invertida** — a linha laranja ACIMA da dashed faz parecer que o overlay está errado, quando na verdade está correto. Preciso trocar a comunicação visual.

Read [](file:///home/luizescobal/study/face-before-after/frontend/src/components/OverlayLayer.tsx)

Agora tenho clareza total. Vou fazer os fixes:

**Fix 1 — `GridThirds`:** 
- As linhas dashed estão corretas mas as linhas "real" (laranja) precisam de label direto em cima delas, não só no label lateral. Hoje o label lateral diz "T1 20% (33%)" mas isso é confuso porque a linha laranja está ACIMA da dashed, fazendo parecer que o overlay errou.
- A correção: desenhar label diretamente nas linhas laranja indicando o que são, e mudar o label lateral para mostrar o **desvio** do ideal.

**Fix 2 — `GridFifths`:**
- Os quintos estão funcionando corretamente (desvios de ~13px). O label precisa mostrar o desvio por quinto.Agora fix do `GridFifths` — adicionar desvio por quinto e label nas linhas de borda:Agora verifico o `FaceExtents` — preciso confirmar que o bounding box usa os landmarks certos:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]

# FaceExtents usa: yTop=lm[10], yMenton=lm[152], xL=lm[234], xR=lm[454]
yTop   = lm(10)[1]
yMen   = lm(152)[1]
xL     = lm(234)[0]
xR     = lm(454)[0]

print(f"FaceExtents bounding box: x=[{xL},{xR}] y=[{yTop},{yMen}]")
print(f"Image dimensions: {w}x{h}")
print(f"Box width: {xR-xL}px ({(xR-xL)/w*100:.0f}% of image width)")
print(f"Box height: {yMen-yTop}px ({(yMen-yTop)/h*100:.0f}% of image height)")
print()

# Draw FaceExtents to verify visually
out = img.copy()
cv2.rectangle(out, (xL, yTop), (xR, yMen), (255,255,255), 2)
cv2.circle(out, lm(10),  6, (0,255,0), -1)
cv2.circle(out, lm(152), 6, (0,255,0), -1)
cv2.circle(out, lm(234), 6, (0,255,255), -1)
cv2.circle(out, lm(454), 6, (0,255,255), -1)

# Does the box visually contain the face?
# Check: are eye outer corners inside the box?
eol = lm(33)
eor = lm(263)
print(f"Eye outer L: x={eol[0]} (box xL={xL}) — inside: {eol[0] > xL}")
print(f"Eye outer R: x={eor[0]} (box xR={xR}) — inside: {eor[0] < xR}")
print()
# Is crown at the top of the face or inside hair?
print(f"lm[10] y={yTop} vs image top y=0")
print(f"Hair region above crown: {yTop}px ({yTop/h*100:.0f}% of img — NOT in bounding box)")

cv2.imwrite('/tmp/face_extents_check.jpg', out)
print("Saved /tmp/face_extents_check.jpg")
EOF


Read [](file:///tmp/face_extents_check.jpg)

Aqui está o segundo problema real: **o `FaceExtents` está errado visualmente**. O box branco:
- **Topo (yTop=lm[10]):** começa no meio da testa, cortando o hairline real
- **Laterais (lm[234]/lm[454]):** os pontos zigomáticos estão na linha dos olhos (y≈583), não nas extremidades mais largas da face — o box é mais estreito que a face visível

O `FaceExtents` deveria englobar o rosto visual real. Preciso corrigir os anchors laterais para usar os pontos mais extremos da bochecha ao invés dos zigomáticos médios, e o topo para usar o ponto mais alto disponível no mesh.

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm_raw = lambda i: (landmarks[i][0], landmarks[i][1])

# Find the leftmost and rightmost points in the face mesh
all_x = [(i, landmarks[i][0], landmarks[i][1]) for i in range(478)]
leftmost  = sorted(all_x, key=lambda t: t[1])[:5]
rightmost = sorted(all_x, key=lambda t: t[1], reverse=True)[:5]
topmost   = sorted(all_x, key=lambda t: t[2])[:5]

print("5 leftmost (smallest x):")
for i, x, y in leftmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

print("\n5 rightmost (largest x):")
for i, x, y in rightmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

print("\n5 topmost (smallest y):")
for i, x, y in topmost:
    print(f"  lm[{i}]: x={x:.0f}, y={y:.0f}")

# Current zygo points
print(f"\nCurrent lm[234] (zygo L): x={landmarks[234][0]:.0f}, y={landmarks[234][1]:.0f}")
print(f"Current lm[454] (zygo R): x={landmarks[454][0]:.0f}, y={landmarks[454][1]:.0f}")
print(f"Current lm[10]  (crown):  x={landmarks[10][0]:.0f}, y={landmarks[10][1]:.0f}")

# Check specific candidates for wider face boundary
for idx in [234, 127, 93, 132, 58, 172, 136, 150, 149, 176, 148]:
    print(f"  lm[{idx}]: x={landmarks[idx][0]:.0f}, y={landmarks[idx][1]:.0f}")
EOF


Os pontos laterais `lm[234]` e `lm[454]` já são os mais extremos do mesh (x=91 e x=799 numa imagem de 847px). O problema não é os pontos — é que a imagem tem margem lateral de background. O `FaceExtents` está correto matematicamente; o que parece "estreito" é porque a imagem tem bastante espaço nas laterais.

O problema real do `FaceExtents` é apenas **o topo** — `lm[10]` em y=261 corta 23% da imagem acima (hairline/cabelo). Para o `FaceExtents` ter sentido visual, o topo deveria ser o **topo da imagem ou o topo do crop detectado**, não `lm[10]`.

Mas isso é uma decisão de design: o box mostra "o rosto detectável pelo mesh" (correto para fins de análise) ou "a extensão visual da cabeça" (mais intuitivo para o usuário). A correção mais honesta é adicionar uma nota no label "Hairline (mesh)" para deixar claro que o top é o limite do MediaPipe, não o topo real da cabeça.

Read [](file:///home/luizescobal/study/face-before-after/frontend/src/components/OverlayLayer.tsx)

Agora verifico o TypeScript e depois gero a imagem de revisão crítica:

Ran terminal command: cd /home/luizescobal/study/face-before-after/frontend && npx tsc --noEmit 2>&1 | head -30

TypeScript limpo. Agora gero a imagem de revisão crítica simulando exatamente o que o novo código faz:

Ran terminal command: python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]
out = img.copy()

def txt(img, text, x, y, color, scale=0.38):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

# === FaceExtents ===
yTop  = lm(10)[1]
yMen  = lm(152)[1]
xL    = lm(234)[0]
xR    = lm(454)[0]
WHITE = (255,255,255)
cv2.rectangle(out, (xL, yTop), (xR, yMen), WHITE, 1)
txt(out, "Trichion (mesh)", xL+4, yTop-4, WHITE)
txt(out, "Menton",          xL+4, yMen+14, WHITE)

# === GridThirds ===
yBrow = (lm(107)[1] + lm(336)[1]) // 2
ySub  = lm(2)[1]
faceH = yMen - yTop

yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

PURPLE = (200,150,255)
ORANGE = (0,165,255)

# Ideal dashed
cv2.line(out, (0, yT1_ideal), (w, yT1_ideal), PURPLE, 1)
cv2.line(out, (0, yT2_ideal), (w, yT2_ideal), PURPLE, 1)
txt(out, "ideal 1/3", xL+4, yT1_ideal-3, PURPLE)
txt(out, "ideal 2/3", xL+4, yT2_ideal-3, PURPLE)

# Real landmark lines
cv2.line(out, (0, yBrow), (w, yBrow), ORANGE, 2)
txt(out, "Sobrancelha", xL+4, yBrow-3, ORANGE)
cv2.line(out, (0, ySub),  (w, ySub),  ORANGE, 2)
txt(out, "Subnasale",    xL+4, ySub-3,  ORANGE)

# Lateral labels with deviation
thirds = [
    (yTop, yBrow, "upper_third_ratio", "T1"),
    (yBrow, ySub,  "middle_third_ratio", "T2"),
    (ySub, yMen,   "lower_third_ratio", "T3"),
]
SEV_COLORS = {"ideal":(80,200,80), "mild":(80,200,80), "moderate":(50,200,220), "strong":(0,165,255), "extreme":(0,80,255)}
for yA, yB, mid, label in thirds:
    m = metric_evals.get(mid, {})
    pct = (m.get('value', (yB-yA)/faceH)) * 100
    sev = m.get('severity_5', None)
    color = SEV_COLORS.get(sev, (150,150,150))
    dev = pct - 33.3
    devStr = f"+{dev:.0f}" if dev >= 0 else f"{dev:.0f}"
    txt(out, f"{label} {pct:.0f}% ({devStr}%)", xR+6, int((yA+yB)/2+4), color, 0.42)

# === GridFifths ===
xFaceL = lm(234)[0]
xFaceR = lm(454)[0]
faceW  = xFaceR - xFaceL
fifth  = faceW / 5

actuals = [lm(33)[0], lm(133)[0], lm(362)[0], lm(263)[0]]
names   = ["OExt.E", "OInt.E", "OInt.D", "OExt.D"]
ideals  = [xFaceL + (i+1)*fifth for i in range(4)]

# Face edges
cv2.line(out, (xFaceL, yTop), (xFaceL, yMen), WHITE, 1)
cv2.line(out, (xFaceR, yTop), (xFaceR, yMen), WHITE, 1)

# Ideal fifths dashed
for xi in ideals:
    cv2.line(out, (int(xi), yTop), (int(xi), yMen), PURPLE, 1)

# Actual eye corners + deviation
yLabel = yMen - 14
for i, (x, name) in enumerate(zip(actuals, names)):
    cv2.line(out, (x, yTop), (x, yMen), ORANGE, 1)
    dev = int(round(x - ideals[i]))
    devStr = f"+{dev}" if dev > 0 else str(dev)
    txt(out, f"{name} {devStr}px", x+2, yLabel - i*12, ORANGE, 0.35)

txt(out, "Quintos - tracejado:ideal laranja:real (desvio px)", xFaceL+2, yTop-6, PURPLE, 0.35)

cv2.imwrite('/tmp/overlay_final_review.jpg', out)
print("Saved /tmp/overlay_final_review.jpg")
EOF


Ran terminal command: cd /home/luizescobal/study/face-before-after && python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

landmarks = data['landmarks']
lm = lambda i: (int(landmarks[i][0]), int(landmarks[i][1]))
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]
out = img.copy()

def txt(img, text, x, y, color, scale=0.38):
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

yTop  = lm(10)[1]
yMen  = lm(152)[1]
xL    = lm(234)[0]
xR    = lm(454)[0]
WHITE  = (255,255,255)
PURPLE = (200,150,255)
ORANGE = (0,165,255)

# FaceExtents
cv2.rectangle(out, (xL, yTop), (xR, yMen), WHITE, 1)
txt(out, "Trichion (mesh)", xL+4, yTop-4, WHITE)
txt(out, "Menton", xL+4, yMen+14, WHITE)

# GridThirds
yBrow = (lm(107)[1] + lm(336)[1]) // 2
ySub  = lm(2)[1]
faceH = yMen - yTop
yT1_ideal = yTop + faceH // 3
yT2_ideal = yTop + 2 * faceH // 3

cv2.line(out, (0, yT1_ideal), (w, yT1_ideal), PURPLE, 1)
cv2.line(out, (0, yT2_ideal), (w, yT2_ideal), PURPLE, 1)
txt(out, "ideal 1/3", xL+4, yT1_ideal-3, PURPLE)
txt(out, "ideal 2/3", xL+4, yT2_ideal-3, PURPLE)

cv2.line(out, (0, yBrow), (w, yBrow), ORANGE, 2)
txt(out, "Sobrancelha", xL+4, yBrow-3, ORANGE)
cv2.line(out, (0, ySub), (w, ySub), ORANGE, 2)
txt(out, "Subnasale", xL+4, ySub-3, ORANGE)

SEV = {"ideal":(80,200,80),"mild":(80,200,80),"moderate":(50,200,220),"strong":(0,165,255),"extreme":(0,80,255)}
for yA, yB, mid, label in [(yTop,yBrow,"upper_third_ratio","T1"),(yBrow,ySub,"middle_third_ratio","T2"),(ySub,yMen,"lower_third_ratio","T3")]:
    m = metric_evals.get(mid, {})
    pct = m.get('value', (yB-yA)/faceH) * 100
    color = SEV.get(m.get('severity_5'), (150,150,150))
    dev = pct - 33.3
    txt(out, f"{label} {pct:.0f}% ({'+' if dev>=0 else ''}{dev:.0f}%)", xR+6, int((yA+yB)/2+4), color, 0.42)

# GridFifths
faceW = xR - xL
fifth = faceW / 5
actuals = [lm(33)[0], lm(133)[0], lm(362)[0], lm(263)[0]]
names   = ["OExt.E","OInt.E","OInt.D","OExt.D"]
ideals  = [xL + (i+1)*fifth for i in range(4)]

cv2.line(out, (xL, yTop), (xL, yMen), WHITE, 1)
cv2.line(out, (xR, yTop), (xR, yMen), WHITE, 1)
for xi in ideals:
    cv2.line(out, (int(xi), yTop), (int(xi), yMen), PURPLE, 1)

yLbl = yMen - 16
for i, (x, name) in enumerate(zip(actuals, names)):
    cv2.line(out, (x, yTop), (x, yMen), ORANGE, 1)
    dev = int(round(x - ideals[i]))
    txt(out, f"{name} {'+' if dev>0 else ''}{dev}px", x+2, yLbl - i*14, ORANGE, 0.35)

txt(out, "Quintos: tracejado=ideal, laranja=real", xL+2, yTop-6, PURPLE, 0.36)

cv2.imwrite('/tmp/overlay_final_review.jpg', out)
print(f"OK {w}x{h}")
EOF

Read overlay_final_review.jpg

Now I can see the final review image. Let me critically analyze what I see:

Terços (Thirds):

The orange "Sobrancelha" line is above the purple "ideal 1/3" line — this is correct visually, meaning the brow is higher than the ideal 1/3 position, so T1 is short (20%)

The "Subnasale" orange line is above the purple "ideal 2/3" line — also correct

Labels T1 20%, T2 39%, T3 41% are cut off on the right side (showing "T1 20..." etc.)

The labels are positioned outside the image boundaries and getting clipped

Quintos (Fifths):

The five vertical lines look good — purple dashed ideal, orange real landmarks
Deviation labels at the bottom show: OExt.E -13px, OInt.E -13px, OInt.D +9px, OExt.D +12px
These are small deviations, confirming the fifths are nearly correct
Issues I notice in the current review image:

Labels T1, T2, T3 are cut off on the right side — I need to adjust the SVG overlay positioning to keep them within bounds
The "ideal 1/3" label placement between the Sobrancelha and ideal line is a bit confusing
The fifths deviation labels at the bottom are overlapping
Looking at the label positioning logic, I'm calculating labelX = xR + 8 where xR is around 798 in an 847px wide image, which pushes labels to x=806 — just barely within the viewBox but likely getting clipped in practice. The inline labels at xL + 4 are fine since xL starts at 90, keeping them safely inside the image boundaries.

The real problem I'm noticing is that the "ideal 1/3" and "ideal 2/3" labels are overlapping with the Sobrancelha and Subnasale line labels, which makes the visualization harder to read.

I also need to verify that the xL variable I'm using in the GridThirds component is properly defined — I added it to pull the left zygomatic landmark, but I should double-check that it's actually being set correctly in the code.

For the GridFifths component, the deviation labels are positioned at intervals of 14 pixels below the mentonion point, which should give them enough vertical spacing to avoid overlap.

Looking at the actual rendered output, the overlay is working as intended with orange marks for real landmarks and purple dashed lines for ideal positions, though the T1/T2/T3 labels on the right edge are getting slightly cut off — they're still readable but could use some adjustment.

Now examining the measurements more carefully: T1 shows around 20% (indicating a compressed upper third), T2 is 39% (extended middle third), and T3 is 41% (extended lower third), which matches Brad Pitt's facial proportions in this photo. However, I'm noticing something odd about the positioning — the brow landmark appears to be sitting above where the ideal first third line should be, which suggests there might be a calculation issue I need to investigate. ABOVE the ideal 1/3 position. In terms of facial thirds:

Upper third = hairline to brow = 20% of face (SHORTER than ideal 33%)
This means: the brow is positioned too HIGH relative to the face as a whole
This IS correct clinically — it means Brad Pitt has a small/compressed forehead (brow sits high = less space between hairline and brow). But visually it looks weird because Brad Pitt appears to have a normal or even large forehead.

Wait, I need to reconsider. lm[10] is at y=261, and the brow is at y=435. That's 174px between hairline and brow. The total face height is 864px. So 174/864 = 20%.

Looking at the actual photo, the distance from the top of the detected mesh (y=261) to the brow IS relatively short compared to the total face. But visually, Brad Pitt has a good amount of forehead. The issue is that lm[10] isn't actually at the hairline — the real hair starts much higher up in the image. So the mesh is measuring from the middle of the forehead rather than the true hairline edge, which systematically makes the upper third appear smaller than it actually is. This is a known limitation of MediaPipe's mesh — it doesn't extend all the way to the top of the skull.

I've decided to relabel lm[10] as "Trichion (mesh)" instead of "Hairline" to be honest about this limitation. The calculation itself is consistent since both backend and frontend use the same reference point, so the reported ratios are reliable even if they're using a proxy rather than the true hairline.

Now I'm doing a final review before updating the documentation. I need to check that the TypeScript compiles, verify the GridFifths deviation labels aren't overlapping, and make sure the "ideal 1/3" and "ideal 2/3" text positioning looks clean. The overlay is reading much better now with the orange lines clearly visible.

Checking the label positions more carefully, the "ideal 1/3" and "ideal 2/3" text sit well above the Sobrancelha and Subnasale labels respectively, so there's no overlap. The visualization looks solid and ready to go.


Vou ler a imagem de revisão que acabei de gerar.

Read [](file:///tmp/overlay_final_review.jpg)

Revisão crítica visual do resultado. Vejo o seguinte:

Ran terminal command: python3 - <<'EOF'
import json

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

lm = data['landmarks']
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}

# Verify all critical positions that the overlay draws
yTop  = lm[10][1]   # 261
yMen  = lm[152][1]  # 1125
yBrow = (lm[107][1] + lm[336][1]) / 2  # 435
ySub  = lm[2][1]    # 775
xL    = lm[234][0]  # 91
xR    = lm[454][0]  # 798
vbW   = 847  # image width

faceH = yMen - yTop  # 864

# Critical check: do the T1/T2/T3 labels fit at xR+8?
labelX = xR + 8  # 806
print(f"Label X: {labelX}, viewBox width: {vbW}")
print(f"Space for labels: {vbW - labelX}px  (needs ~80px for 'T3 41% (+8%)')")
print()

# Check: yT1_ideal vs yBrow — do the two label lines for inline text overlap?
yT1_ideal = yTop + faceH / 3   # 549
yT2_ideal = yTop + 2*faceH / 3 # 837

print("Inline label Y positions (text rendered above each line):")
print(f"  'Sobrancelha' at y={yBrow-3:.0f}  (line at y={yBrow:.0f})")
print(f"  'ideal 1/3'   at y={yT1_ideal-3:.0f}  (line at y={yT1_ideal:.0f})")
print(f"  'Subnasale'   at y={ySub-3:.0f}  (line at y={ySub:.0f})")
print(f"  'ideal 2/3'   at y={yT2_ideal-3:.0f}  (line at y={yT2_ideal:.0f})")
print()

# Check overlap between inline labels (font ~10px height, so need 12px gap)
print(f"Gap Sobrancelha→ideal1/3: {yT1_ideal-3 - (yBrow-3):.0f}px (need >12)")
print(f"Gap Subnasale→ideal2/3:   {yT2_ideal-3 - (ySub-3):.0f}px (need >12)")
print()

# Fifths check: deviation labels overlap?
faceW = xR - xL  # 708
fifth = faceW / 5  # 141.6
ideals = [xL + (i+1)*fifth for i in range(4)]
actuals = [lm[33][0], lm[133][0], lm[362][0], lm[263][0]]
print("Fifths deviation labels (placed at x=actual+2):")
for i, (x, xi) in enumerate(zip(actuals, ideals)):
    dev = int(round(x - xi))
    print(f"  [{i}] actual x={x}, ideal x={xi:.0f}, dev={dev:+d}px, label at x={x+2}")

# Check if fifths label positions overlap each other
prev_x = 0
for i, x in enumerate(actuals):
    print(f"  Gap from prev: {x - prev_x:.0f}px")
    prev_x = x
EOF


Problema crítico identificado: **os labels T1/T2/T3 têm apenas 40px de espaço em `xR+8`** — vão ser clipados no SVG. Preciso reposicioná-los para dentro da face. Corrijo agora:

Read [](file:///home/luizescobal/study/face-before-after/frontend/src/components/OverlayLayer.tsx)

Agora o mesmo problema existe no `GridFifths` — os labels de desvio podem sobrepor as linhas. Vou também verificar e corrigir:

Read [](file:///home/luizescobal/study/face-before-after/frontend/src/components/OverlayLayer.tsx)

O `GridFifths` está OK — os 4 labels ficam no mesmo Y mas os X têm 140-219px de gap entre si, então não sobrepõem. Verifico TypeScript:

Ran terminal command: cd /home/luizescobal/study/face-before-after/frontend && npx tsc --noEmit 2>&1

Zero erros. Agora gero a imagem de revisão final com o fix do `textAnchor="end"` simulado:

Ran terminal command: cd /home/luizescobal/study/face-before-after && python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

lm_raw = data['landmarks']
lm = lambda i: (int(lm_raw[i][0]), int(lm_raw[i][1]))
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]
out = img.copy()

PURPLE = (220, 160, 255)
ORANGE = (0, 165, 255)
WHITE  = (255, 255, 255)
SEV = {"ideal":(80,200,80),"mild":(80,200,80),"moderate":(50,210,210),"strong":(0,165,255),"extreme":(0,80,255)}

def txt(img, text, x, y, color, scale=0.38, right_align=False):
    if right_align:
        (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, scale, 1)
        x = x - tw
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

# --- FaceExtents ---
yTop = lm(10)[1]; yMen = lm(152)[1]
xL   = lm(234)[0]; xR  = lm(454)[0]
cv2.rectangle(out, (xL, yTop), (xR, yMen), WHITE, 1)
txt(out, "Trichion (mesh)", xL+4, yTop-4, WHITE)
txt(out, "Menton",          xL+4, yMen+14, WHITE)

# --- GridThirds ---
yBrow = (lm(107)[1] + lm(336)[1]) // 2
ySub  = lm(2)[1]
faceH = yMen - yTop
yT1   = yTop + faceH // 3
yT2   = yTop + 2 * faceH // 3

# Ideal dashed
cv2.line(out, (0, yT1), (w, yT1), PURPLE, 1)
cv2.line(out, (0, yT2), (w, yT2), PURPLE, 1)
txt(out, "ideal 1/3", xL+4, yT1-3, PURPLE)
txt(out, "ideal 2/3", xL+4, yT2-3, PURPLE)

# Real orange
cv2.line(out, (0, yBrow), (w, yBrow), ORANGE, 2)
txt(out, "Sobrancelha", xL+4, yBrow-3, ORANGE)
cv2.line(out, (0, ySub), (w, ySub), ORANGE, 2)
txt(out, "Subnasale", xL+4, ySub-3, ORANGE)

# T1/T2/T3 labels — right-aligned to vbW-4 (textAnchor="end" fix)
for yA, yB, mid, label in [
    (yTop, yBrow, "upper_third_ratio",  "T1"),
    (yBrow, ySub, "middle_third_ratio", "T2"),
    (ySub,  yMen, "lower_third_ratio",  "T3"),
]:
    m = metric_evals.get(mid, {})
    pct = m.get('value', (yB-yA)/faceH) * 100
    color = SEV.get(m.get('severity_5'), (150,150,150))
    dev = pct - 33.3
    txt(out, f"{label} {pct:.0f}% ({'+' if dev>=0 else ''}{dev:.0f}%)",
        w - 4, int((yA+yB)/2 + 4), color, 0.42, right_align=True)

# --- GridFifths ---
faceW = xR - xL; fifth = faceW / 5
ideals  = [xL + (i+1)*fifth for i in range(4)]
actuals = [lm(33)[0], lm(133)[0], lm(362)[0], lm(263)[0]]
names   = ["OExt.E","OInt.E","OInt.D","OExt.D"]

cv2.line(out, (xL, yTop), (xL, yMen), WHITE, 1)
cv2.line(out, (xR, yTop), (xR, yMen), WHITE, 1)
for xi in ideals:
    cv2.line(out, (int(xi), yTop), (int(xi), yMen), PURPLE, 1)

yLbl = yMen - 10
for i, (x, name) in enumerate(zip(actuals, names)):
    cv2.line(out, (x, yTop), (x, yMen), ORANGE, 1)
    dev = int(round(x - ideals[i]))
    txt(out, f"{name} {'+' if dev>0 else ''}{dev}px", x+2, yLbl, ORANGE, 0.35)

txt(out, "Quintos: tracejado=ideal  laranja=real", xL+2, yTop-6, PURPLE, 0.36)

cv2.imwrite('/tmp/overlay_final_v2.jpg', out)
print(f"Saved: {w}x{h}")
EOF


Read [](file:///tmp/overlay_final_v2.jpg)

O overlay está correto e legível. Faço a revisão crítica final do código completo para garantir que não há inconsistências:

Read [](file:///home/luizescobal/study/face-before-after/frontend/src/components/OverlayLayer.tsx)

O código está correto. Faço a revisão crítica final — **o que mudou, o que está certo, o que ainda tem limitação**:---

## Revisão crítica — o que foi feito e o que ainda é limitação real

### O que foi corrigido (`OverlayLayer.tsx`)

**GridThirds:**
- Labels `"ideal 1/3"` / `"ideal 2/3"` agora ficam diretamente nas linhas tracejadas roxas, deixando claro que são posições de referência — não landmarks
- Labels `"Sobrancelha"` / `"Subnasale"` ficam diretamente nas linhas laranja, identificando o que cada landmark é
- Labels laterais T1/T2/T3 agora mostram **desvio do ideal** (`T1 20% (-13%)`) e usam `textAnchor="end"` fixado em `vbW-4`, eliminando o clipping que existia com `xR+8`

**GridFifths:**
- Cada linha laranja real tem o **desvio em px** do ideal (`OExt.E -13px`) — antes não havia nenhuma medida
- Bordas brancas laterais (`xFaceL`/`xFaceR`) explicitam o referencial da largura

**FaceExtents:**
- Label `"Hairline"` → `"Trichion (mesh)"` — comunica honestamente que o ponto topo é o limite do MediaPipe, não o hairline anatômico real

---

### Limitação que **não** foi corrigida (e não deve ser)

O `upper_third=20%` para Brad Pitt é matematicamente correto dado `lm[10]` como âncora. O MediaPipe Mesh-478 não detecta acima do hairline — `lm[10]` é o ponto mais alto do mesh e fica no meio da testa (y=261 numa imagem de 1155px). Isso faz o terço superior parecer sistematicamente menor do que seria com um hairline anatômico real.

**Não corrigi isso no backend** porque: (1) é uma limitação do detector, não um bug de cálculo; (2) é consistente entre todos os usuários; (3) mudar o ponto âncora quebraria a calibração dos 88 ideais no banco. A correção correta seria detectar o hairline via segmentação de cabelo — escopo separado.

OverlayLayer.tsx
Looking at the GridFifths deviation labels - they're all placed at the same yLabel = yMen - 10. Since the actual x-positions are spread across the face width with gaps of 142-219px, there's plenty of horizontal separation. The issue from the review image was that they looked a bit stacked but looking at the actual x positions:

OExt.E at x=219, label at x=221

OInt.E at x=360, label at x=362 (gap of 141px)

OInt.D at x=524, label at x=526 (gap of 164px)

OExt.D at x=668, label at x=670 (gap of 143px)

All labels sit on the same Y line at yMen - 10, which works fine given the ~140px horizontal spacing between them. The staggering I see in the debug image came from the Python script, not the actual TSX code. But wait—the labels are positioned below the line endpoints, not at them.

Looking at the character width in SVG, "OExt.E -13px" at font-size 9 is roughly 65-78px, and with gaps of 141-219px between labels, there's plenty of room. The TSX places all four labels at the same yLabel value, which keeps them aligned horizontally. I think this is fine as-is. about whether this causes issues:

If all labels are at y = yMen - 10, and the text is {names[i]} {devStr}px, with:

[0] at x=221: "OExt.E -13px" (width ~70px) → extends to x=291
[1] at x=362: "OInt.E -13px" → extends to x=432 (gap of 71px from end of [0])
[2] at x=526: "OInt.D +9px" → extends to x=591 (gap of 94px from end of [1])
[3] at x=670: "OExt.D +11px" → extends to x=735 (gap of 79px from end of [2])
These don't overlap at all! The labels are well-spaced. The TSX code is correct.

So the only real issue was the T1/T2/T3 labels overflowing at the right edge, which I've fixed by right-aligning them and positioning them near the viewbox boundary. Now I'll run the TypeScript compiler to verify everything checks out.

O GridFifths está OK — os 4 labels ficam no mesmo Y mas os X têm 140-219px de gap entre si, então não sobrepõem. Verifico TypeScript:
Vou ler a imagem de revisão que acabei de gerar.

Read [](file:///tmp/overlay_final_review.jpg)

Revisão crítica visual do resultado. Vejo o seguinte:

Ran terminal command: python3 - <<'EOF'
import json

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

lm = data['landmarks']
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}

# Verify all critical positions that the overlay draws
yTop  = lm[10][1]   # 261
yMen  = lm[152][1]  # 1125
yBrow = (lm[107][1] + lm[336][1]) / 2  # 435
ySub  = lm[2][1]    # 775
xL    = lm[234][0]  # 91
xR    = lm[454][0]  # 798
vbW   = 847  # image width

faceH = yMen - yTop  # 864

# Critical check: do the T1/T2/T3 labels fit at xR+8?
labelX = xR + 8  # 806
print(f"Label X: {labelX}, viewBox width: {vbW}")
print(f"Space for labels: {vbW - labelX}px  (needs ~80px for 'T3 41% (+8%)')")
print()

# Check: yT1_ideal vs yBrow — do the two label lines for inline text overlap?
yT1_ideal = yTop + faceH / 3   # 549
yT2_ideal = yTop + 2*faceH / 3 # 837

print("Inline label Y positions (text rendered above each line):")
print(f"  'Sobrancelha' at y={yBrow-3:.0f}  (line at y={yBrow:.0f})")
print(f"  'ideal 1/3'   at y={yT1_ideal-3:.0f}  (line at y={yT1_ideal:.0f})")
print(f"  'Subnasale'   at y={ySub-3:.0f}  (line at y={ySub:.0f})")
print(f"  'ideal 2/3'   at y={yT2_ideal-3:.0f}  (line at y={yT2_ideal:.0f})")
print()

# Check overlap between inline labels (font ~10px height, so need 12px gap)
print(f"Gap Sobrancelha→ideal1/3: {yT1_ideal-3 - (yBrow-3):.0f}px (need >12)")
print(f"Gap Subnasale→ideal2/3:   {yT2_ideal-3 - (ySub-3):.0f}px (need >12)")
print()

# Fifths check: deviation labels overlap?
faceW = xR - xL  # 708
fifth = faceW / 5  # 141.6
ideals = [xL + (i+1)*fifth for i in range(4)]
actuals = [lm[33][0], lm[133][0], lm[362][0], lm[263][0]]
print("Fifths deviation labels (placed at x=actual+2):")
for i, (x, xi) in enumerate(zip(actuals, ideals)):
    dev = int(round(x - xi))
    print(f"  [{i}] actual x={x}, ideal x={xi:.0f}, dev={dev:+d}px, label at x={x+2}")

# Check if fifths label positions overlap each other
prev_x = 0
for i, x in enumerate(actuals):
    print(f"  Gap from prev: {x - prev_x:.0f}px")
    prev_x = x
EOF


Problema crítico identificado: **os labels T1/T2/T3 têm apenas 40px de espaço em `xR+8`** — vão ser clipados no SVG. Preciso reposicioná-los para dentro da face. Corrijo agora:

Read [](file:///home/luizescobal/study/face-before-after/frontend/src/components/OverlayLayer.tsx)

Agora o mesmo problema existe no `GridFifths` — os labels de desvio podem sobrepor as linhas. Vou também verificar e corrigir:

Read [](file:///home/luizescobal/study/face-before-after/frontend/src/components/OverlayLayer.tsx)

O `GridFifths` está OK — os 4 labels ficam no mesmo Y mas os X têm 140-219px de gap entre si, então não sobrepõem. Verifico TypeScript:

Ran terminal command: cd /home/luizescobal/study/face-before-after/frontend && npx tsc --noEmit 2>&1

Zero erros. Agora gero a imagem de revisão final com o fix do `textAnchor="end"` simulado:

Ran terminal command: cd /home/luizescobal/study/face-before-after && python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

lm_raw = data['landmarks']
lm = lambda i: (int(lm_raw[i][0]), int(lm_raw[i][1]))
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]
out = img.copy()

PURPLE = (220, 160, 255)
ORANGE = (0, 165, 255)
WHITE  = (255, 255, 255)
SEV = {"ideal":(80,200,80),"mild":(80,200,80),"moderate":(50,210,210),"strong":(0,165,255),"extreme":(0,80,255)}

def txt(img, text, x, y, color, scale=0.38, right_align=False):
    if right_align:
        (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, scale, 1)
        x = x - tw
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

# --- FaceExtents ---
yTop = lm(10)[1]; yMen = lm(152)[1]
xL   = lm(234)[0]; xR  = lm(454)[0]
cv2.rectangle(out, (xL, yTop), (xR, yMen), WHITE, 1)
txt(out, "Trichion (mesh)", xL+4, yTop-4, WHITE)
txt(out, "Menton",          xL+4, yMen+14, WHITE)

# --- GridThirds ---
yBrow = (lm(107)[1] + lm(336)[1]) // 2
ySub  = lm(2)[1]
faceH = yMen - yTop
yT1   = yTop + faceH // 3
yT2   = yTop + 2 * faceH // 3

# Ideal dashed
cv2.line(out, (0, yT1), (w, yT1), PURPLE, 1)
cv2.line(out, (0, yT2), (w, yT2), PURPLE, 1)
txt(out, "ideal 1/3", xL+4, yT1-3, PURPLE)
txt(out, "ideal 2/3", xL+4, yT2-3, PURPLE)

# Real orange
cv2.line(out, (0, yBrow), (w, yBrow), ORANGE, 2)
txt(out, "Sobrancelha", xL+4, yBrow-3, ORANGE)
cv2.line(out, (0, ySub), (w, ySub), ORANGE, 2)
txt(out, "Subnasale", xL+4, ySub-3, ORANGE)

# T1/T2/T3 labels — right-aligned to vbW-4 (textAnchor="end" fix)
for yA, yB, mid, label in [
    (yTop, yBrow, "upper_third_ratio",  "T1"),
    (yBrow, ySub, "middle_third_ratio", "T2"),
    (ySub,  yMen, "lower_third_ratio",  "T3"),
]:
    m = metric_evals.get(mid, {})
    pct = m.get('value', (yB-yA)/faceH) * 100
    color = SEV.get(m.get('severity_5'), (150,150,150))
    dev = pct - 33.3
    txt(out, f"{label} {pct:.0f}% ({'+' if dev>=0 else ''}{dev:.0f}%)",
        w - 4, int((yA+yB)/2 + 4), color, 0.42, right_align=True)

# --- GridFifths ---
faceW = xR - xL; fifth = faceW / 5
ideals  = [xL + (i+1)*fifth for i in range(4)]
actuals = [lm(33)[0], lm(133)[0], lm(362)[0], lm(263)[0]]
names   = ["OExt.E","OInt.E","OInt.D","OExt.D"]

cv2.line(out, (xL, yTop), (xL, yMen), WHITE, 1)
cv2.line(out, (xR, yTop), (xR, yMen), WHITE, 1)
for xi in ideals:
    cv2.line(out, (int(xi), yTop), (int(xi), yMen), PURPLE, 1)

yLbl = yMen - 10
for i, (x, name) in enumerate(zip(actuals, names)):
    cv2.line(out, (x, yTop), (x, yMen), ORANGE, 1)
    dev = int(round(x - ideals[i]))
    txt(out, f"{name} {'+' if dev>0 else ''}{dev}px", x+2, yLbl, ORANGE, 0.35)

txt(out, "Quintos: tracejado=ideal  laranja=real", xL+2, yTop-6, PURPLE, 0.36)

cv2.imwrite('/tmp/overlay_final_v2.jpg', out)
print(f"Saved: {w}x{h}")
EOF


Read [](file:///tmp/overlay_final_v2.jpg)

O overlay está correto e legível. Faço a revisão crítica final do código completo para garantir que não há inconsistências:

Read [](file:///home/luizescobal/study/face-before-after/frontend/src/components/OverlayLayer.tsx)

O código está correto. Faço a revisão crítica final — **o que mudou, o que está certo, o que ainda tem limitação**:---

## Revisão crítica — o que foi feito e o que ainda é limitação real

### O que foi corrigido (`OverlayLayer.tsx`)

**GridThirds:**
- Labels `"ideal 1/3"` / `"ideal 2/3"` agora ficam diretamente nas linhas tracejadas roxas, deixando claro que são posições de referência — não landmarks
- Labels `"Sobrancelha"` / `"Subnasale"` ficam diretamente nas linhas laranja, identificando o que cada landmark é
- Labels laterais T1/T2/T3 agora mostram **desvio do ideal** (`T1 20% (-13%)`) e usam `textAnchor="end"` fixado em `vbW-4`, eliminando o clipping que existia com `xR+8`

**GridFifths:**
- Cada linha laranja real tem o **desvio em px** do ideal (`OExt.E -13px`) — antes não havia nenhuma medida
- Bordas brancas laterais (`xFaceL`/`xFaceR`) explicitam o referencial da largura

**FaceExtents:**
- Label `"Hairline"` → `"Trichion (mesh)"` — comunica honestamente que o ponto topo é o limite do MediaPipe, não o hairline anatômico real

---

### Limitação que **não** foi corrigida (e não deve ser)

O `upper_third=20%` para Brad Pitt é matematicamente correto dado `lm[10]` como âncora. O MediaPipe Mesh-478 não detecta acima do hairline — `lm[10]` é o ponto mais alto do mesh e fica no meio da testa (y=261 numa imagem de 1155px). Isso faz o terço superior parecer sistematicamente menor do que seria com um hairline anatômico real.

**Não corrigi isso no backend** porque: (1) é uma limitação do detector, não um bug de cálculo; (2) é consistente entre todos os usuários; (3) mudar o ponto âncora quebraria a calibração dos 88 ideais no banco. A correção correta seria detectar o hairline via segmentação de cabelo — escopo separado.

Vou ler a imagem de revisão que acabei de gerar.

Read [](file:///tmp/overlay_final_review.jpg)

Revisão crítica visual do resultado. Vejo o seguinte:

Ran terminal command: python3 - <<'EOF'
import json

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

lm = data['landmarks']
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}

# Verify all critical positions that the overlay draws
yTop  = lm[10][1]   # 261
yMen  = lm[152][1]  # 1125
yBrow = (lm[107][1] + lm[336][1]) / 2  # 435
ySub  = lm[2][1]    # 775
xL    = lm[234][0]  # 91
xR    = lm[454][0]  # 798
vbW   = 847  # image width

faceH = yMen - yTop  # 864

# Critical check: do the T1/T2/T3 labels fit at xR+8?
labelX = xR + 8  # 806
print(f"Label X: {labelX}, viewBox width: {vbW}")
print(f"Space for labels: {vbW - labelX}px  (needs ~80px for 'T3 41% (+8%)')")
print()

# Check: yT1_ideal vs yBrow — do the two label lines for inline text overlap?
yT1_ideal = yTop + faceH / 3   # 549
yT2_ideal = yTop + 2*faceH / 3 # 837

print("Inline label Y positions (text rendered above each line):")
print(f"  'Sobrancelha' at y={yBrow-3:.0f}  (line at y={yBrow:.0f})")
print(f"  'ideal 1/3'   at y={yT1_ideal-3:.0f}  (line at y={yT1_ideal:.0f})")
print(f"  'Subnasale'   at y={ySub-3:.0f}  (line at y={ySub:.0f})")
print(f"  'ideal 2/3'   at y={yT2_ideal-3:.0f}  (line at y={yT2_ideal:.0f})")
print()

# Check overlap between inline labels (font ~10px height, so need 12px gap)
print(f"Gap Sobrancelha→ideal1/3: {yT1_ideal-3 - (yBrow-3):.0f}px (need >12)")
print(f"Gap Subnasale→ideal2/3:   {yT2_ideal-3 - (ySub-3):.0f}px (need >12)")
print()

# Fifths check: deviation labels overlap?
faceW = xR - xL  # 708
fifth = faceW / 5  # 141.6
ideals = [xL + (i+1)*fifth for i in range(4)]
actuals = [lm[33][0], lm[133][0], lm[362][0], lm[263][0]]
print("Fifths deviation labels (placed at x=actual+2):")
for i, (x, xi) in enumerate(zip(actuals, ideals)):
    dev = int(round(x - xi))
    print(f"  [{i}] actual x={x}, ideal x={xi:.0f}, dev={dev:+d}px, label at x={x+2}")

# Check if fifths label positions overlap each other
prev_x = 0
for i, x in enumerate(actuals):
    print(f"  Gap from prev: {x - prev_x:.0f}px")
    prev_x = x
EOF


Problema crítico identificado: **os labels T1/T2/T3 têm apenas 40px de espaço em `xR+8`** — vão ser clipados no SVG. Preciso reposicioná-los para dentro da face. Corrijo agora:

Read [](file:///home/luizescobal/study/face-before-after/frontend/src/components/OverlayLayer.tsx)

Agora o mesmo problema existe no `GridFifths` — os labels de desvio podem sobrepor as linhas. Vou também verificar e corrigir:

Read [](file:///home/luizescobal/study/face-before-after/frontend/src/components/OverlayLayer.tsx)

O `GridFifths` está OK — os 4 labels ficam no mesmo Y mas os X têm 140-219px de gap entre si, então não sobrepõem. Verifico TypeScript:

Ran terminal command: cd /home/luizescobal/study/face-before-after/frontend && npx tsc --noEmit 2>&1

Zero erros. Agora gero a imagem de revisão final com o fix do `textAnchor="end"` simulado:

Ran terminal command: cd /home/luizescobal/study/face-before-after && python3 - <<'EOF'
import json, cv2, numpy as np

with open('resultado_api/82cd331ab8ed/bradpitt-reference_mvp_report.json') as f:
    data = json.load(f)

lm_raw = data['landmarks']
lm = lambda i: (int(lm_raw[i][0]), int(lm_raw[i][1]))
metric_evals = {m['metric_id']: m for m in data['metric_evaluations']}

img = cv2.imread('resultado_api/82cd331ab8ed/bradpitt-reference.jpg')
h, w = img.shape[:2]
out = img.copy()

PURPLE = (220, 160, 255)
ORANGE = (0, 165, 255)
WHITE  = (255, 255, 255)
SEV = {"ideal":(80,200,80),"mild":(80,200,80),"moderate":(50,210,210),"strong":(0,165,255),"extreme":(0,80,255)}

def txt(img, text, x, y, color, scale=0.38, right_align=False):
    if right_align:
        (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, scale, 1)
        x = x - tw
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 1)

# --- FaceExtents ---
yTop = lm(10)[1]; yMen = lm(152)[1]
xL   = lm(234)[0]; xR  = lm(454)[0]
cv2.rectangle(out, (xL, yTop), (xR, yMen), WHITE, 1)
txt(out, "Trichion (mesh)", xL+4, yTop-4, WHITE)
txt(out, "Menton",          xL+4, yMen+14, WHITE)

# --- GridThirds ---
yBrow = (lm(107)[1] + lm(336)[1]) // 2
ySub  = lm(2)[1]
faceH = yMen - yTop
yT1   = yTop + faceH // 3
yT2   = yTop + 2 * faceH // 3

# Ideal dashed
cv2.line(out, (0, yT1), (w, yT1), PURPLE, 1)
cv2.line(out, (0, yT2), (w, yT2), PURPLE, 1)
txt(out, "ideal 1/3", xL+4, yT1-3, PURPLE)
txt(out, "ideal 2/3", xL+4, yT2-3, PURPLE)

# Real orange
cv2.line(out, (0, yBrow), (w, yBrow), ORANGE, 2)
txt(out, "Sobrancelha", xL+4, yBrow-3, ORANGE)
cv2.line(out, (0, ySub), (w, ySub), ORANGE, 2)
txt(out, "Subnasale", xL+4, ySub-3, ORANGE)

# T1/T2/T3 labels — right-aligned to vbW-4 (textAnchor="end" fix)
for yA, yB, mid, label in [
    (yTop, yBrow, "upper_third_ratio",  "T1"),
    (yBrow, ySub, "middle_third_ratio", "T2"),
    (ySub,  yMen, "lower_third_ratio",  "T3"),
]:
    m = metric_evals.get(mid, {})
    pct = m.get('value', (yB-yA)/faceH) * 100
    color = SEV.get(m.get('severity_5'), (150,150,150))
    dev = pct - 33.3
    txt(out, f"{label} {pct:.0f}% ({'+' if dev>=0 else ''}{dev:.0f}%)",
        w - 4, int((yA+yB)/2 + 4), color, 0.42, right_align=True)

# --- GridFifths ---
faceW = xR - xL; fifth = faceW / 5
ideals  = [xL + (i+1)*fifth for i in range(4)]
actuals = [lm(33)[0], lm(133)[0], lm(362)[0], lm(263)[0]]
names   = ["OExt.E","OInt.E","OInt.D","OExt.D"]

cv2.line(out, (xL, yTop), (xL, yMen), WHITE, 1)
cv2.line(out, (xR, yTop), (xR, yMen), WHITE, 1)
for xi in ideals:
    cv2.line(out, (int(xi), yTop), (int(xi), yMen), PURPLE, 1)

yLbl = yMen - 10
for i, (x, name) in enumerate(zip(actuals, names)):
    cv2.line(out, (x, yTop), (x, yMen), ORANGE, 1)
    dev = int(round(x - ideals[i]))
    txt(out, f"{name} {'+' if dev>0 else ''}{dev}px", x+2, yLbl, ORANGE, 0.35)

txt(out, "Quintos: tracejado=ideal  laranja=real", xL+2, yTop-6, PURPLE, 0.36)

cv2.imwrite('/tmp/overlay_final_v2.jpg', out)
print(f"Saved: {w}x{h}")
EOF


Read [](file:///tmp/overlay_final_v2.jpg)

O overlay está correto e legível. Faço a revisão crítica final do código completo para garantir que não há inconsistências:

Read [](file:///home/luizescobal/study/face-before-after/frontend/src/components/OverlayLayer.tsx)

O código está correto. Faço a revisão crítica final — **o que mudou, o que está certo, o que ainda tem limitação**:---

## Revisão crítica — o que foi feito e o que ainda é limitação real

### O que foi corrigido (`OverlayLayer.tsx`)

**GridThirds:**
- Labels `"ideal 1/3"` / `"ideal 2/3"` agora ficam diretamente nas linhas tracejadas roxas, deixando claro que são posições de referência — não landmarks
- Labels `"Sobrancelha"` / `"Subnasale"` ficam diretamente nas linhas laranja, identificando o que cada landmark é
- Labels laterais T1/T2/T3 agora mostram **desvio do ideal** (`T1 20% (-13%)`) e usam `textAnchor="end"` fixado em `vbW-4`, eliminando o clipping que existia com `xR+8`

**GridFifths:**
- Cada linha laranja real tem o **desvio em px** do ideal (`OExt.E -13px`) — antes não havia nenhuma medida
- Bordas brancas laterais (`xFaceL`/`xFaceR`) explicitam o referencial da largura

**FaceExtents:**
- Label `"Hairline"` → `"Trichion (mesh)"` — comunica honestamente que o ponto topo é o limite do MediaPipe, não o hairline anatômico real

---

### Limitação que **não** foi corrigida (e não deve ser)

O `upper_third=20%` para Brad Pitt é matematicamente correto dado `lm[10]` como âncora. O MediaPipe Mesh-478 não detecta acima do hairline — `lm[10]` é o ponto mais alto do mesh e fica no meio da testa (y=261 numa imagem de 1155px). Isso faz o terço superior parecer sistematicamente menor do que seria com um hairline anatômico real.

**Não corrigi isso no backend** porque: (1) é uma limitação do detector, não um bug de cálculo; (2) é consistente entre todos os usuários; (3) mudar o ponto âncora quebraria a calibração dos 88 ideais no banco. A correção correta seria detectar o hairline via segmentação de cabelo — escopo separado.

Read overlay_final_v2.jpg

The overlay looks much better now. Let me do the critical review of what I see in the image:

Terços:

"Sobrancelha" label correctly marks the orange brow line
"ideal 1/3" and "ideal 2/3" in purple/dashed correctly show where ideal positions would be
T1 20% (-13%), T2 39% (+6%), T3 41% (+7%) — right-aligned, no clipping ✓
The labels are clear and readable
Quintos:

OExt.E -13px, OInt.E -13px, OInt.D +9px, OExt.D +12px — all visible at the bottom ✓

Purple dashed lines represent the ideal proportions while orange shows the actual measurements ✓

The math checks out on the terço deviation — the -13% indicates the upper third is about 13 percentage points shorter than the ideal 33.3%, which is accurate even if it might seem counterintuitive at first glance. Visually, the purple ideal line sits noticeably below the orange brow line, which matches what the numbers are telling us.

Now I'm doing a final review of the OverlayLayer component to make sure all the proportions, calculations, and visual elements are consistent throughout.


Revisão crítica — o que foi feito e o que ainda é limitação real
O que foi corrigido (OverlayLayer.tsx)
GridThirds:

Labels "ideal 1/3" / "ideal 2/3" agora ficam diretamente nas linhas tracejadas roxas, deixando claro que são posições de referência — não landmarks
Labels "Sobrancelha" / "Subnasale" ficam diretamente nas linhas laranja, identificando o que cada landmark é
Labels laterais T1/T2/T3 agora mostram desvio do ideal (T1 20% (-13%)) e usam textAnchor="end" fixado em vbW-4, eliminando o clipping que existia com xR+8
GridFifths:

Cada linha laranja real tem o desvio em px do ideal (OExt.E -13px) — antes não havia nenhuma medida
Bordas brancas laterais (xFaceL/xFaceR) explicitam o referencial da largura
FaceExtents:

Label "Hairline" → "Trichion (mesh)" — comunica honestamente que o ponto topo é o limite do MediaPipe, não o hairline anatômico real
Limitação que não foi corrigida (e não deve ser)
O upper_third=20% para Brad Pitt é matematicamente correto dado lm[10] como âncora. O MediaPipe Mesh-478 não detecta acima do hairline — lm[10] é o ponto mais alto do mesh e fica no meio da testa (y=261 numa imagem de 1155px). Isso faz o terço superior parecer sistematicamente menor do que seria com um hairline anatômico real.

Não corrigi isso no backend porque: (1) é uma limitação do detector, não um bug de cálculo; (2) é consistente entre todos os usuários; (3) mudar o ponto âncora quebraria a calibração dos 88 ideais no banco. A correção correta seria detectar o hairline via segmentação de cabelo — escopo separado.


PLAnejar e executar com auto-pilot:

a gente tinha bolado um pipeline para vc mesmo testar durante a sessão e ir acertando os calculos de overlay.

gere um script automatico para fazer isso e anexe no justfile, após isso começe as analises e fixes com autopilot.


quero que nesse script contenha todas as visualizações do front:

Mapa de métricas
detectadas
Proporções
ideais
Comparativo
original vs simetrizado
Overlays
linhas de referência
Mapa de métricas
Eixo vertical

Eixo intercantal

Terços faciais

Quintos faciais

Contorno facial

Extremidades da face

Vetores de melhoria

Mapa de calor — assimetria

Mapa de calor — aderência


assim tornando o fluxo de analise com agente mais automatizado e efetivo.


