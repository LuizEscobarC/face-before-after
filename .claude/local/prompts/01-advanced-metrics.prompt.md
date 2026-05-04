# Prompt 01 — Adicionar análises científicas avançadas + mini frontend

Pipeline atual: detecta 68 landmarks (dlib), alinha rosto, gera heatmap de assimetria,
calcula métricas em px e normalizadas em %IPD, salva JSON por foto e gera relatório
texto comparativo. Falta um conjunto de métricas científicas frontais e um relatório
HTML autocontido.

## Objetivo

1. Criar módulo `face_metrics.py` com métricas anatômicas/estéticas adicionais.
2. Integrar ao pipeline existente sem quebrar o schema do JSON.
3. Atualizar `compare_report.py` com novas seções.
4. Gerar relatório HTML autocontido (`relatorio.html`) com cards e métricas.
5. Adicionar testes pytest com landmarks sintéticos.

## Restrições

- Apenas dlib + opencv + numpy (sem novas dependências).
- Tudo em pt-BR.
- HTML deve abrir via `file://` (imagens em base64).
- Métricas normalizadas pela distância interpupilar (IPD) sempre que possível.
- Linha média vertical = bissetriz perpendicular à linha dos olhos, ancorada na média
  (eye_midpoint, glabella). Nunca ajustada por pontos assimétricos.
- Pose frontal: |yaw| ≤ 7° e |pitch| ≤ 7°.
- Severidade (% IPD): <1 excelente, 1–2 leve, 2–4 moderada, 4–8 acentuada, >8 severa.
- JSON: apenas adicionar novos sub-blocos (`advanced`, `photo_quality`, `skin`),
  nunca renomear/remover.

## Métricas a implementar em `face_metrics.py`

### A) Proporções clássicas (`proportions`)
- Terços faciais (superior/médio/inferior) e desvio padrão
- Quintos horizontais e desvio padrão
- fWHR (largura bizigomática / altura sup.) — ideal ~1.85
- Razão do terço inferior — ideal ~0.56 (masculino)
- Largura bizigomática (px) e bigonial (px)

### B) Masculinidade / dimorfismo (`masculinity`)
- Largura mandibular (% IPD)
- Razão zigomática/bigonial
- Ângulo gonial (esq, dir, médio)
- Projeção do mento (% IPD)
- Score de definição da linha mandibular (curvatura/jaw def)

### C) Olhos (`eyes`)
- Canthal tilt esq/dir/médio (positivo = canto lateral mais alto, desejável)
- EAR (Eye Aspect Ratio) esq/dir
- Razão intercanthal / largura do olho (~1.0)
- Distância sobrancelha–pálpebra (% IPD)
- Tilt das sobrancelhas

### D) Nariz (`nose`)
- Razão nariz/boca (largura) ~0.70
- Alinhamento alar–intercanthal (% IPD)
- Comprimento nasal (% altura facial)
- Largura alar (% IPD)

### E) Boca (`mouth`)
- Razão boca / IPD (~1.50)
- Razão lábio sup/inf
- Filtro nasolabial (% IPD)
- Espessura dos lábios (% IPD)

### F) Forma facial (`face_shape`)
- Razão altura/largura
- Razão zigomática/bigonial
- Label: oblongo/oval/retangular/quadrado/diamante/redondo

### G) Marquardt — desvio bilateral global (`marquardt_deviation`)
- Para cada par (li, ri), reflete ri sobre a linha média x e calcula RMSE
- Reporta px e %IPD

### H) Pose da cabeça (`head_pose`)
- `cv2.solvePnP` com modelo 3D de 6 pontos (nose tip, chin, eye outers, mouth corners)
- Decompor em yaw/pitch/roll (graus)
- Flag `frontal_ok` e `warning` legível

### I) Qualidade da foto (`photo_quality`)
- Inclui head_pose
- Distorção focal: largura alar / largura zigomática (warn se >0.55)
- Sharpness Laplaciana
- ΔE Lab esq vs dir (iluminação assimétrica)
- Largura facial em px (warn se < 400)
- Lista consolidada de `warnings`

### J) Pele (`skin`)
- ROIs: bochecha esq, bochecha dir, testa
- Uniformidade (std no Lab) por ROI
- ΔE Lab esq vs dir
- Olheiras: razão luminância (sob-olho / bochecha) esq/dir

### Severidade
- Dicionário `ADVANCED_IDEALS = {key: (ideal, tol)}` cobrindo todas as métricas-chave.
- Função `severity_for(key, value) -> str` retornando excelente/leve/moderada/acentuada/severa.

### API pública
```python
def compute_all(image_bgr: np.ndarray, lm: np.ndarray, face_rect_w: int = 0) -> dict:
    """Retorna {'advanced': {...}, 'photo_quality': {...}, 'skin': {...}}"""
```
Todos os valores devem passar por `_round_dict` (3 casas).

## Integração

1. Em `face_asymmetry.py`, dentro de `analyze()`, depois do heatmap, em try/except:
   ```python
   face_w = (aligned_face_rect.width() if aligned_face_rect is not None
             else face_rect.width())
   extra = face_metrics.compute_all(self.aligned_image, aligned_landmarks, face_w)
   self.asymmetry_data['advanced']      = extra['advanced']
   self.asymmetry_data['photo_quality'] = extra['photo_quality']
   self.asymmetry_data['skin']          = extra['skin']
   ```
   Falhas registram apenas warning, nunca quebram o pipeline.

2. Em `compare_report.py`, adicionar **antes** do bloco final:
   - Seção **ANÁLISE AVANÇADA**: tabela com métrica/antes/depois/ideal/severidade
     para `fwhr`, `lower_third_ratio`, `canthal_tilt_mean_deg`,
     `intercanthal_to_eyewidth_ratio`, `nasal_to_mouth_width_ratio`,
     `mouth_to_ipd_ratio`, `thirds_std_dev`, `marquardt_deviation_pct_ipd`,
     `jawline_definition_score`, `face_shape_label` (transição textual).
   - Seção **QUALIDADE DAS FOTOS**: yaw/pitch/roll, sharpness, ΔE_lr e lista de warnings.

3. Criar `build_html_report.py` (CLI: `--before --after --label-before --label-after --output`):
   - Template HTML inline com CSS embutido, dark theme.
   - Banner colorido conforme score final.
   - Cards: resumo executivo, tabela das métricas básicas, fotos (annotated, aligned,
     heatmap, landmarks) lado a lado, ANÁLISE AVANÇADA, QUALIDADE DAS FOTOS.
   - Imagens convertidas a `data:image/...;base64,...`.
   - `ADVANCED_DISPLAY` com (key, label, ideal_str, (ideal_num, tol)) e helper
     `adv_severity(key, val)` reutilizando os ideais.

4. Atualizar `Makefile`:
   - Alvo `web` chama `build_html_report.py` com os JSONs corretos.
   - `make all` = antes + depois + report (txt) + web (html).

## Testes (`tests/test_face_metrics.py`)

Construir 68 landmarks bilateralmente simétricos sobre x=0 (face anatomicamente
plausível). Cobrir:
- `marquardt_deviation_pct_ipd ≈ 0`
- canthal tilt esq ≈ dir (mesmo sinal)
- EAR esq ≈ dir
- `proportions` retorna razões somando ~1.0 nos terços
- `compute_all` retorna os 3 sub-blocos e `frontal_ok` é bool
- `severity_for` retorna chaves esperadas

## Critérios de aceite

- [ ] `make clean && make all` roda sem erro
- [ ] `pytest tests/ -q` 100% verde
- [ ] `relatorio.html` abre em `file://` mostrando todas as seções novas
- [ ] JSON contém `measurements.advanced`, `measurements.photo_quality`,
      `measurements.skin`
- [ ] Schema antigo (`*_pct_ipd`, `overall_asymmetry_score`, etc.) preservado
