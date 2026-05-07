"""Plano de ação personalizado a partir das métricas DEPOIS.

Cada métrica vira um item com explicação leiga, técnica e ações práticas.
Sem evidência clínica forte? O texto deixa explícito e recomenda profissional.

Fontes consultadas:
- Lefevre et al. 2012 — fWHR e percepção de dominância
- Hammond et al. (Northwestern Med 2018) — facial exercise para definição
- Naini FB — "Facial Aesthetics: Concepts and Clinical Diagnosis" (Wiley)
- Farkas LG — antropometria facial clássica
- AAD (American Academy of Dermatology) — rotina de pele
- SBD (Sociedade Brasileira de Dermatologia)
- Stockholm Sleep 2010 — sono x face perception (Axelsson)
- AAFPRS / SBCP — opções não-cirúrgicas (preenchimentos, cantoplastia)
- ISSN — composição corporal e definição facial

Severidade vinda de face_metrics.severity_for() / adv_severity().
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import app.domain.face_metrics as fm


# ----------------------------------------------------------------------
# Catálogo de recomendações por chave de métrica
# Cada item: explicação + ações (apenas as relevantes para severidade > excelente)
# ----------------------------------------------------------------------

REC_CATALOG: Dict[str, Dict[str, Any]] = {
    "overall_asymmetry_score_pct_ipd": {
        "label": "Assimetria global",
        "ideal": "0% IPD",
        "what_is": (
            "Score consolidado que combina diferenças bilaterais de olhos, nariz, "
            "boca, queixo e mandíbula, normalizado pela distância interpupilar."
        ),
        "how_measured": (
            "Soma ponderada das distâncias absolutas entre cada landmark e seu par "
            "espelhado em torno da linha média facial, dividida pela IPD em pixels."
        ),
        "why_matters": (
            "A simetria bilateral é um marcador universal de saúde de desenvolvimento "
            "e tende a aumentar a percepção de atratividade (Rhodes 2006, Perrett 1999)."
        ),
        "actions_by_severity": {
            "leve": [
                {"tipo": "habito",  "titulo": "Mastigação bilateral consciente",
                 "descricao": "Alterne deliberadamente o lado da mastigação a cada refeição.",
                 "frequencia": "todas as refeições",
                 "fonte": {"titulo": "JADA — unilateral chewing and asymmetry",
                           "url": "https://jada.ada.org/"}},
                {"tipo": "postura", "titulo": "Postura neutra de cabeça",
                 "descricao": "Evite head-tilt habitual; alinhe orelha sobre ombro em frente ao espelho 2× ao dia.",
                 "frequencia": "diário",
                 "fonte": {"titulo": "APTA — posture",
                           "url": "https://www.apta.org/"}},
            ],
            "moderada": [
                {"tipo": "exercicio", "titulo": "Mio-funcional (terapia orofacial básica)",
                 "descricao": "Rotina diária de língua-no-palato + deglutição madura; Buteyko leve.",
                 "frequencia": "10 min/dia",
                 "fonte": {"titulo": "AOMT — Orofacial Myofunctional Therapy",
                           "url": "https://aomtinfo.org/"}},
                {"tipo": "profissional", "titulo": "Avaliação fisio orofacial",
                 "descricao": "Procurar fisioterapeuta especialista em DTM/orofacial para protocolo guiado.",
                 "frequencia": "1×",
                 "fonte": {"titulo": "ABFO — Associação Brasileira de Fisio Orofacial",
                           "url": "https://abfo.org.br/"}},
            ],
            "acentuada": [
                {"tipo": "profissional", "titulo": "Bucomaxilo + ortodontista",
                 "descricao": "Avaliação cefalométrica para descartar assimetria esquelética.",
                 "frequencia": "1×",
                 "fonte": {"titulo": "AAOMS",
                           "url": "https://www.aaoms.org/"}},
            ],
        },
        "references": [
            {"titulo": "Rhodes 2006 — Evolutionary Psychology of Facial Beauty",
             "url": "https://doi.org/10.1146/annurev.psych.57.102904.190208"},
            {"titulo": "Perrett 1999 — Symmetry and human facial attractiveness",
             "url": "https://doi.org/10.1016/S1090-5138(99)00014-8"},
        ],
        "actionability_tier": 0,
        "time_to_result": "semanas",
        "cost_level": 0,
        "mutable": True,
        "social_perception_weight": 0.90,
    },

    "fwhr": {
        "label": "fWHR (largura/altura sup.)",
        "ideal": "~1.85",
        "what_is": (
            "Razão entre a largura bizigomática e a altura entre lábio superior e linha "
            "superciliar. Marcador de dimorfismo sexual."
        ),
        "how_measured": (
            "Largura zigomática (landmarks 0↔16 ajustados) ÷ altura do ponto mais alto "
            "do lábio superior (51) à linha das sobrancelhas (média de 19/24)."
        ),
        "why_matters": (
            "fWHR alto correlaciona com percepção de dominância e força (Lefevre 2012); "
            "muito baixo passa percepção menos masculina."
        ),
        "actions_by_severity": {
            "leve": [
                {"tipo": "habito", "titulo": "Mastigar goma sem açúcar bilateralmente",
                 "descricao": "Hipertrofia leve do masseter aumenta percepção de largura.",
                 "frequencia": "15 min/dia",
                 "fonte": {"titulo": "Tsai et al. — masseter and chewing",
                           "url": "https://pubmed.ncbi.nlm.nih.gov/24495658/"}},
            ],
            "moderada": [
                {"tipo": "exercicio", "titulo": "Mewing (postura de língua no palato)",
                 "descricao": "Evidência fraca/anedótica em adultos. Pode auxiliar postura linguodental e percepção do terço médio.",
                 "frequencia": "manter ao longo do dia",
                 "fonte": {"titulo": "Mewing — revisão crítica (BJOO)",
                           "url": "https://www.bjoms.com/"}},
                {"tipo": "habito", "titulo": "Reduzir % de gordura corporal",
                 "descricao": "BF% baixo aumenta visibilidade de zigomático e mandíbula.",
                 "frequencia": "objetivo nutricional",
                 "fonte": {"titulo": "ISSN Position Stand — body comp",
                           "url": "https://jissn.biomedcentral.com/"}},
            ],
            "acentuada": [
                {"tipo": "profissional", "titulo": "Avaliação com cirurgião plástico/dermato",
                 "descricao": "Discutir preenchimento de zigomático ou bichectomia. Decisão individual.",
                 "frequencia": "1×",
                 "fonte": {"titulo": "SBCP",
                           "url": "https://www2.cirurgiaplastica.org.br/"}},
            ],
        },
        "references": [
            {"titulo": "Lefevre 2012 — Facial width-to-height ratio",
             "url": "https://doi.org/10.1098/rspb.2012.0884"},
            {"titulo": "Wikipedia — fWHR",
             "url": "https://en.wikipedia.org/wiki/Facial_width-to-height_ratio"},
        ],
        "actionability_tier": 1,
        "time_to_result": "meses",
        "cost_level": 1,
        "mutable": True,
        "social_perception_weight": 0.75,
    },

    "lower_third_ratio": {
        "label": "Razão do terço inferior",
        "ideal": "~0.56 (masculino)",
        "what_is": "Proporção do terço inferior em relação à altura facial total.",
        "how_measured": "Distância nasion→mento ÷ trichion→mento (trichion estimado por reflexão).",
        "why_matters": "Terço inferior maior está associado a percepção masculina (Naini 2011).",
        "actions_by_severity": {
            "leve": [
                {"tipo": "postura", "titulo": "Posição lingual alta",
                 "descricao": "Manter dorso da língua no palato pode reposicionar mandíbula em repouso.",
                 "frequencia": "ao longo do dia",
                 "fonte": {"titulo": "Mew JRC — Orthotropic Premise",
                           "url": "https://orthotropics-london.co.uk/"}},
            ],
            "moderada": [
                {"tipo": "profissional", "titulo": "Ortodontia/ortognática consultiva",
                 "descricao": "Se o terço inferior é estruturalmente curto/longo, somente intervenção esquelética altera.",
                 "frequencia": "1×",
                 "fonte": {"titulo": "AAO",
                           "url": "https://www.aaoinfo.org/"}},
            ],
        },
        "references": [
            {"titulo": "Naini — Facial Aesthetics (Wiley)",
             "url": "https://www.wiley.com/en-us/Facial+Aesthetics-p-9781405181921"},
        ],
        "actionability_tier": 1,
        "time_to_result": "meses",
        "cost_level": 0,
        "mutable": True,
        "social_perception_weight": 0.50,
    },

    "canthal_tilt_mean_deg": {
        "label": "Canthal tilt médio",
        "ideal": "~+5°",
        "what_is": "Inclinação do eixo medial→lateral do olho. Positivo = canto lateral mais alto.",
        "how_measured": "atan2(Δy, |Δx|) entre canto medial (39/42) e lateral (36/45) por olho, em graus.",
        "why_matters": "Tilt positivo é associado à percepção de juventude e atratividade (Rhee 2012).",
        "actions_by_severity": {
            "leve": [
                {"tipo": "habito", "titulo": "Sono adequado e hidratação",
                 "descricao": "Reduz edema periorbital que pode disfarçar tilt.",
                 "frequencia": "7–9 h/dia",
                 "fonte": {"titulo": "Axelsson 2010 — Stockholm Sleep",
                           "url": "https://www.bmj.com/content/341/bmj.c6614"}},
            ],
            "moderada": [
                {"tipo": "profissional", "titulo": "Consulta com oftalmoplástico",
                 "descricao": "Tilt é estrutural (osso orbital/ligamento cantal). Opções: cantopexia, preenchimento de têmpora.",
                 "frequencia": "1×",
                 "fonte": {"titulo": "ASOPRS",
                           "url": "https://www.asoprs.org/"}},
            ],
        },
        "references": [
            {"titulo": "Rhee SC 2012 — Lateral canthal tilt",
             "url": "https://pubmed.ncbi.nlm.nih.gov/22743893/"},
            {"titulo": "Wikipedia — Canthus",
             "url": "https://en.wikipedia.org/wiki/Canthus"},
        ],
        "actionability_tier": 1,
        "time_to_result": "semanas",
        "cost_level": 1,
        "mutable": True,
        "social_perception_weight": 0.85,
    },

    "intercanthal_to_eyewidth_ratio": {
        "label": "Intercanthal / largura do olho",
        "ideal": "~1.0",
        "what_is": "Distância entre cantos mediais ÷ largura média de um olho. Ideal ≈ 1 (terço central neoclássico).",
        "how_measured": "‖p39 − p42‖ ÷ média(‖p36−p39‖, ‖p45−p42‖).",
        "why_matters": "Razão muito alta = aparência mais larga do nasion; muito baixa = olhos próximos.",
        "actions_by_severity": {
            "leve": [
                {"tipo": "habito", "titulo": "Reposicionar foto",
                 "descricao": "Distorção focal aumenta nariz/intercanthal. Use lente ≥85 mm equivalente.",
                 "frequencia": "ao registrar",
                 "fonte": {"titulo": "B&H — focal length & faces",
                           "url": "https://www.bhphotovideo.com/explora/photography/tips-and-solutions/best-focal-lengths-portrait-photography"}},
            ],
            "moderada": [
                {"tipo": "profissional", "titulo": "Avaliação rinoplástica",
                 "descricao": "Largura do nasion é estrutural; rinoplastia pode reduzir percepção de intercanthal alto.",
                 "frequencia": "1×",
                 "fonte": {"titulo": "SBCP — rinoplastia",
                           "url": "https://www2.cirurgiaplastica.org.br/"}},
            ],
        },
        "references": [
            {"titulo": "Farkas — Anthropometry of the Head and Face",
             "url": "https://www.worldcat.org/title/26595060"},
        ],
        "actionability_tier": 0,
        "time_to_result": "imediato",
        "cost_level": 0,
        "mutable": False,
        "social_perception_weight": 0.60,
    },

    "nasal_to_mouth_width_ratio": {
        "label": "Nariz / boca (largura)",
        "ideal": "~0.70",
        "what_is": "Largura da base nasal ÷ largura da boca.",
        "how_measured": "‖p31−p35‖ ÷ ‖p48−p54‖.",
        "why_matters": "Razão neoclássica de Ricketts: nariz ≈ 70% da boca dá harmonia frontal.",
        "actions_by_severity": {
            "leve": [
                {"tipo": "habito", "titulo": "Sorriso natural ao fotografar",
                 "descricao": "Boca fechada subestima sua largura — capture sorriso fechado neutro.",
                 "frequencia": "ao registrar",
                 "fonte": {"titulo": "Naini — facial photography",
                           "url": "https://onlinelibrary.wiley.com/doi/10.1002/9781118786109"}},
            ],
            "moderada": [
                {"tipo": "profissional", "titulo": "Rinoplastia consultiva",
                 "descricao": "Alar muito largo pode ser corrigido com alarplastia (procedimento ambulatorial).",
                 "frequencia": "1×",
                 "fonte": {"titulo": "SBCP",
                           "url": "https://www2.cirurgiaplastica.org.br/"}},
            ],
        },
        "references": [
            {"titulo": "Ricketts RM 1982 — Divine proportion",
             "url": "https://pubmed.ncbi.nlm.nih.gov/7041859/"},
        ],
        "actionability_tier": 0,
        "time_to_result": "imediato",
        "cost_level": 0,
        "mutable": False,
        "social_perception_weight": 0.65,
    },

    "mouth_to_ipd_ratio": {
        "label": "Boca / IPD",
        "ideal": "~1.50",
        "what_is": "Largura da boca ÷ distância interpupilar.",
        "how_measured": "‖p48−p54‖ ÷ ‖centro_olho_E − centro_olho_D‖.",
        "why_matters": "Boca proporcional à IPD passa equilíbrio frontal (regra dos quintos).",
        "actions_by_severity": {
            "leve": [
                {"tipo": "habito", "titulo": "Hidratação labial e cuidado",
                 "descricao": "Lábios bem hidratados aparentam volume e largura natural maior.",
                 "frequencia": "diário",
                 "fonte": {"titulo": "AAD — lip care",
                           "url": "https://www.aad.org/public/everyday-care/skin-care-basics/dry/dry-lips"}},
            ],
        },
        "references": [
            {"titulo": "Wikipedia — Neoclassical canons",
             "url": "https://en.wikipedia.org/wiki/Neoclassical_canons_of_facial_proportions"},
        ],
        "actionability_tier": 0,
        "time_to_result": "imediato",
        "cost_level": 0,
        "mutable": True,
        "social_perception_weight": 0.45,
    },

    "thirds_std_dev": {
        "label": "Desvio dos 3 terços",
        "ideal": "0",
        "what_is": "Quanto os terços facial sup/médio/inf desviam de 1/3 cada.",
        "how_measured": "Desvio padrão das 3 razões de altura entre trichion, glabella, nasion e mento.",
        "why_matters": "Terços equilibrados = cânone neoclássico de harmonia.",
        "actions_by_severity": {
            "leve": [
                {"tipo": "postura", "titulo": "Postura cefálica neutra",
                 "descricao": "Inclinação anterior altera projeção do terço inferior na foto.",
                 "frequencia": "diário",
                 "fonte": {"titulo": "APTA",
                           "url": "https://www.apta.org/"}},
            ],
        },
        "references": [
            {"titulo": "Naini — Facial Aesthetics",
             "url": "https://www.wiley.com/en-us/Facial+Aesthetics-p-9781405181921"},
        ],
        "actionability_tier": 0,
        "time_to_result": "imediato",
        "cost_level": 0,
        "mutable": True,
        "social_perception_weight": 0.55,
    },

    "fifths_std_dev": {
        "label": "Desvio dos 5 quintos",
        "ideal": "0",
        "what_is": "Desvio dos 5 quintos horizontais (lateral, olho, nasion, olho, lateral).",
        "how_measured": "Desvio padrão das 5 larguras divididas pela largura facial total.",
        "why_matters": "Equilíbrio horizontal frontal — outro cânone neoclássico.",
        "actions_by_severity": {
            "leve": [
                {"tipo": "habito", "titulo": "Foto verdadeiramente frontal",
                 "descricao": "Pequena rotação da cabeça destrói a regra dos quintos.",
                 "frequencia": "ao registrar",
                 "fonte": {"titulo": "Naini — clinical photography",
                           "url": "https://onlinelibrary.wiley.com/doi/10.1002/9781118786109"}},
            ],
        },
        "references": [
            {"titulo": "Wikipedia — Neoclassical canons",
             "url": "https://en.wikipedia.org/wiki/Neoclassical_canons_of_facial_proportions"},
        ],
        "actionability_tier": 0,
        "time_to_result": "imediato",
        "cost_level": 0,
        "mutable": False,
        "social_perception_weight": 0.40,
    },

    "marquardt_deviation_pct_ipd": {
        "label": "Desvio bilateral global (Marquardt)",
        "ideal": "0% IPD",
        "what_is": "RMSE entre cada landmark e seu par espelhado pela linha média.",
        "how_measured": "Para cada par (li, ri): reflete ri sobre x_midline e calcula distância; RMSE final ÷ IPD.",
        "why_matters": "Métrica quantitativa de quão perto da máscara fi do Marquardt.",
        "actions_by_severity": {
            "leve":      [{"tipo": "habito", "titulo": "Mastigação bilateral",
                           "descricao": "Reduz hipertrofia assimétrica do masseter.",
                           "frequencia": "diário",
                           "fonte": {"titulo": "Tsai et al.",
                                     "url": "https://pubmed.ncbi.nlm.nih.gov/24495658/"}}],
            "moderada":  [{"tipo": "profissional", "titulo": "Fisioterapia orofacial",
                           "descricao": "Avaliação para padrões assimétricos de tônus muscular.",
                           "frequencia": "1×",
                           "fonte": {"titulo": "ABFO",
                                     "url": "https://abfo.org.br/"}}],
            "acentuada": [{"tipo": "profissional", "titulo": "Bucomaxilo",
                           "descricao": "Cefalometria para descartar assimetria esquelética.",
                           "frequencia": "1×",
                           "fonte": {"titulo": "AAOMS",
                                     "url": "https://www.aaoms.org/"}}],
        },
        "references": [
            {"titulo": "Marquardt — Phi mask",
             "url": "https://en.wikipedia.org/wiki/Marquardt_Beauty_Mask"},
        ],
        "actionability_tier": 0,
        "time_to_result": "semanas",
        "cost_level": 0,
        "mutable": True,
        "social_perception_weight": 0.70,
    },

    "jaw_width_pct_ipd": {
        "label": "Largura mandibular (% IPD)",
        "ideal": "~155%",
        "what_is": "Largura bigonial ÷ IPD.",
        "how_measured": "‖p4 − p12‖ ÷ IPD × 100.",
        "why_matters": "Largura mandibular alta passa percepção de dimorfismo masculino.",
        "actions_by_severity": {
            "leve": [
                {"tipo": "exercicio", "titulo": "Mastigação resistida (gum/jawliner)",
                 "descricao": "Hipertrofia leve do masseter pode aumentar largura percebida.",
                 "frequencia": "10–15 min/dia",
                 "fonte": {"titulo": "Tsai et al.",
                           "url": "https://pubmed.ncbi.nlm.nih.gov/24495658/"}},
            ],
            "moderada": [
                {"tipo": "profissional", "titulo": "Avaliação dermato/cirurgião",
                 "descricao": "Preenchimento de mandíbula é alternativa rápida; cirurgia para casos esqueléticos.",
                 "frequencia": "1×",
                 "fonte": {"titulo": "AAFPRS",
                           "url": "https://www.aafprs.org/"}},
            ],
        },
        "references": [
            {"titulo": "Hammond et al. 2018 — Facial exercise",
             "url": "https://jamanetwork.com/journals/jamadermatology/fullarticle/2666780"},
        ],
        "actionability_tier": 1,
        "time_to_result": "meses",
        "cost_level": 1,
        "mutable": True,
        "social_perception_weight": 0.65,
    },

    "jawline_definition_score": {
        "label": "Definição da linha mandibular",
        "ideal": "maior = melhor",
        "what_is": "Quão proeminente é a transição mandíbula-pescoço.",
        "how_measured": "Curvatura discreta dos pontos 4..12 da mandíbula normalizada pela largura facial.",
        "why_matters": "Linha definida está associada a baixa adiposidade submentoniana e bom tônus.",
        "actions_by_severity": {
            "leve": [
                {"tipo": "exercicio", "titulo": "Retração cervical guiada",
                 "descricao": "3×15 reps diário; redução de papada postural e definição do perfil.",
                 "frequencia": "diário",
                 "fonte": {"titulo": "Mayo Clinic — chin tucks",
                           "url": "https://www.mayoclinichealthsystem.org/hometown-health/speaking-of-health/exercises-to-prevent-or-fix-rounded-shoulders"}},
                {"tipo": "habito", "titulo": "Reduzir BF%",
                 "descricao": "Adiposidade submentoniana é o que mais ofusca a definição.",
                 "frequencia": "objetivo nutricional",
                 "fonte": {"titulo": "ISSN — body composition",
                           "url": "https://jissn.biomedcentral.com/"}},
            ],
            "moderada": [
                {"tipo": "exercicio", "titulo": "Hammond facial protocol",
                 "descricao": "Programa de 30 min/dia, 20 semanas, mostrou ganho de aparência mid/lower face.",
                 "frequencia": "30 min/dia",
                 "fonte": {"titulo": "JAMA Dermatology 2018",
                           "url": "https://jamanetwork.com/journals/jamadermatology/fullarticle/2666780"}},
                {"tipo": "profissional", "titulo": "Lipo de papada / Kybella",
                 "descricao": "Para gordura submentoniana resistente.",
                 "frequencia": "1×",
                 "fonte": {"titulo": "AAD — submental fat",
                           "url": "https://www.aad.org/"}},
            ],
        },
        "references": [
            {"titulo": "Hammond et al. 2018",
             "url": "https://jamanetwork.com/journals/jamadermatology/fullarticle/2666780"},
        ],
        "actionability_tier": 1,
        "time_to_result": "semanas",
        "cost_level": 1,
        "mutable": True,
        "social_perception_weight": 0.80,
    },

    "upper_lower_lip_ratio": {
        "label": "Razão lábio sup/inf",
        "ideal": "~0.62 (masculino)",
        "what_is": "Espessura do lábio superior ÷ inferior.",
        "how_measured": "Altura vertical entre vermelhão dos lábios (51↔62 e 66↔57).",
        "why_matters": "Lábio inferior ligeiramente mais cheio é o padrão neoclássico.",
        "actions_by_severity": {
            "leve": [
                {"tipo": "habito", "titulo": "Hidratação labial e fotoproteção",
                 "descricao": "Lábios desidratados parecem mais finos.",
                 "frequencia": "diário",
                 "fonte": {"titulo": "AAD — lip care",
                           "url": "https://www.aad.org/public/everyday-care/skin-care-basics/dry/dry-lips"}},
            ],
        },
        "references": [
            {"titulo": "Heidekrueger PI 2017 — lip ratio",
             "url": "https://pubmed.ncbi.nlm.nih.gov/27915313/"},
        ],
        "actionability_tier": 0,
        "time_to_result": "imediato",
        "cost_level": 0,
        "mutable": True,
        "social_perception_weight": 0.45,
    },

    "philtrum_length_pct_ipd": {
        "label": "Filtro nasolabial (% IPD)",
        "ideal": "~22%",
        "what_is": "Comprimento do filtro (sub-nariz → vermelhão do lábio sup).",
        "how_measured": "‖p33 − p51‖ ÷ IPD × 100.",
        "why_matters": "Filtro alongado tende à percepção de envelhecimento; curto, à juventude.",
        "actions_by_severity": {
            "leve": [
                {"tipo": "habito", "titulo": "Postura facial e tônus do orbicular da boca",
                 "descricao": "Sorrisos exagerados habituais alongam aparência do filtro em fotos.",
                 "frequencia": "diário",
                 "fonte": {"titulo": "Naini — facial photography",
                           "url": "https://onlinelibrary.wiley.com/doi/10.1002/9781118786109"}},
            ],
            "moderada": [
                {"tipo": "profissional", "titulo": "Bullhorn lip lift consultivo",
                 "descricao": "Cirurgia de encurtamento do filtro; decisão pessoal e irreversível.",
                 "frequencia": "1×",
                 "fonte": {"titulo": "AAFPRS — lip lift",
                           "url": "https://www.aafprs.org/"}},
            ],
        },
        "references": [
            {"titulo": "Naini — Facial Aesthetics",
             "url": "https://www.wiley.com/en-us/Facial+Aesthetics-p-9781405181921"},
        ],
        "actionability_tier": 0,
        "time_to_result": "imediato",
        "cost_level": 0,
        "mutable": True,
        "social_perception_weight": 0.40,
    },

    "face_shape_label": {
        "label": "Forma facial",
        "ideal": "—",
        "what_is": "Classificação descritiva da silhueta (oval, retangular, redondo, etc).",
        "how_measured": "Razão altura/largura + zigomático/bigonial mapeados por regras.",
        "why_matters": "Define a moldura — orienta corte de cabelo, barba e óculos.",
        "actions_by_severity": {},  # informativo
        "references": [
            {"titulo": "GQ — face shape guide",
             "url": "https://www.gq.com/story/grooming-tips-by-face-shape"},
        ],
        "actionability_tier": 0,
        "time_to_result": "imediato",
        "cost_level": 0,
        "mutable": False,
        "social_perception_weight": 0.30,
    },

    "skin_spf_protocol": {
        "label": "Protocolo SPF + hidratação",
        "ideal": "rotina diária",
        "what_is": (
            "Rotina básica de fotoproteção e hidratação diária como base para uniformidade de tom."
        ),
        "how_measured": "Ativado quando skin_uniformity_std_lab ou under_eye_darkness estão acima do limiar.",
        "why_matters": (
            "SPF diário é o hábito de maior retorno para uniformidade de tom a médio prazo — "
            "o investimento mais barato com impacto visual mais consistente."
        ),
        "actions_by_severity": {
            "leve": [
                {
                    "tipo": "habito",
                    "titulo": "SPF 30+ diariamente + hidratante noturno",
                    "descricao": "Aplicar SPF 30+ toda manhã antes de sair; hidratante noturno antes de dormir.",
                    "frequencia": "diário",
                    "fonte": {
                        "titulo": "AAD — skin care basics",
                        "url": "https://www.aad.org/public/everyday-care/skin-care-basics",
                    },
                },
            ],
            "moderada": [
                {
                    "tipo": "habito",
                    "titulo": "SPF 50+ + vitamina C tópica + hidratante noturno",
                    "descricao": (
                        "SPF 50+ diário, vitamina C sérica de manhã, "
                        "hidratante noturno com niacinamida ou retinol de entrada."
                    ),
                    "frequencia": "diário",
                    "fonte": {
                        "titulo": "AAD — skin care routine",
                        "url": "https://www.aad.org/public/everyday-care/skin-care-basics/routines",
                    },
                },
            ],
            "severa": [
                {
                    "tipo": "profissional",
                    "titulo": "Avaliação dermatológica + rotina completa",
                    "descricao": "Irregularidade de tom marcada pode ter causas tratáveis (melasma, rosácea) — avaliação recomendada.",
                    "frequencia": "1×",
                    "fonte": {
                        "titulo": "SBD — Sociedade Brasileira de Dermatologia",
                        "url": "https://www.sbd.org.br/",
                    },
                },
            ],
        },
        "references": [
            {
                "titulo": "AAD — sunscreen FAQs",
                "url": "https://www.aad.org/public/everyday-care/sun-protection/sunscreen-patients/sunscreen-faqs",
            }
        ],
        "actionability_tier": 0,
        "time_to_result": "semanas",
        "cost_level": 1,
        "mutable": True,
        "social_perception_weight": 0.70,
    },
}


# ----------------------------------------------------------------------
# Geração das recomendações
# ----------------------------------------------------------------------

# Severidades em ordem crescente para priorização
_SEV_RANK = {
    "excelente": 0, "leve": 1, "moderada": 2, "acentuada": 3, "severa": 4,
}


def _resolve_severity(key: str, value: Any, ideal_tuple) -> str:
    """Calcula severidade (excelente/leve/.../severa) para uma chave."""
    if not isinstance(value, (int, float)):
        return "excelente"
    # tenta usar ideais avançados de face_metrics, mas só se a chave existir lá
    if key in fm.ADVANCED_IDEALS:
        return fm.severity_for(key, float(value))
    if ideal_tuple is None:
        return "leve"
    ideal, tol = ideal_tuple
    if tol <= 0:
        return "leve"
    diff = abs(float(value) - ideal)
    if diff <= tol:     return "excelente"
    if diff <= tol * 2: return "leve"
    if diff <= tol * 3: return "moderada"
    if diff <= tol * 4: return "acentuada"
    return "severa"


def _flatten_advanced(measurements: Dict[str, Any]) -> Dict[str, Any]:
    """Junta o bloco 'advanced' com chaves _pct_ipd no nível raiz."""
    flat = {}
    adv = measurements.get("advanced") or {}
    flat.update(adv)
    # também inclui o score global
    if "overall_asymmetry_score_pct_ipd" in measurements:
        flat["overall_asymmetry_score_pct_ipd"] = measurements["overall_asymmetry_score_pct_ipd"]
    return flat


# Tuplas para resolver severidade quando face_metrics.severity_for não cobre
_FALLBACK_IDEALS: Dict[str, tuple] = {
    "fwhr": (1.85, 0.10),
    "lower_third_ratio": (0.56, 0.05),
    "canthal_tilt_mean_deg": (5.0, 3.0),
    "intercanthal_to_eyewidth_ratio": (1.0, 0.10),
    "nasal_to_mouth_width_ratio": (0.70, 0.10),
    "mouth_to_ipd_ratio": (1.50, 0.20),
    "thirds_std_dev": (0.0, 0.03),
    "fifths_std_dev": (0.0, 0.03),
    "marquardt_deviation_pct_ipd": (0.0, 3.0),
    "jaw_width_pct_ipd": (155.0, 20.0),
    "upper_lower_lip_ratio": (0.62, 0.15),
    "philtrum_length_pct_ipd": (22.0, 6.0),
    "overall_asymmetry_score_pct_ipd": (0.0, 1.0),
    # jawline_definition_score: maior é melhor; severidade fica "leve" se < 5
    "jawline_definition_score": None,
    "face_shape_label": None,
}


def recommend(measurements_after: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Gera plano de ação priorizado. Retorna lista ordenada por severidade desc."""
    flat = _flatten_advanced(measurements_after)
    out: List[Dict[str, Any]] = []

    for key, entry in REC_CATALOG.items():
        if key not in flat and key != "overall_asymmetry_score_pct_ipd":
            continue
        value = flat.get(key)

        # Severidade
        ideal_tuple = _FALLBACK_IDEALS.get(key)
        if key == "jawline_definition_score":
            # score "quanto maior melhor" — leve se < 5, excelente >= 7
            if isinstance(value, (int, float)):
                v = float(value)
                if   v >= 7: sev = "excelente"
                elif v >= 5: sev = "leve"
                elif v >= 3: sev = "moderada"
                else:        sev = "acentuada"
            else:
                sev = "excelente"
        elif key == "face_shape_label":
            sev = "excelente"  # informativo apenas
        else:
            sev = _resolve_severity(key, value, ideal_tuple)

        # Selecionar ações conforme severidade
        actions: List[Dict[str, Any]] = []
        actions_map = entry.get("actions_by_severity") or {}
        if sev == "excelente":
            actions = []  # apenas manter
        else:
            for tier in ("leve", "moderada", "acentuada"):
                actions.extend(actions_map.get(tier, []))
                if tier == sev:
                    break
            if sev == "severa":
                actions.extend(actions_map.get("acentuada", []))

        out.append({
            "metric_key":   key,
            "metric_label": entry["label"],
            "severity":     sev,
            "value":        value,
            "ideal":        entry["ideal"],
            "what_is":      entry["what_is"],
            "how_measured": entry["how_measured"],
            "why_matters":  entry["why_matters"],
            "actions":      actions,
            "references":   entry.get("references") or [],
        })

    # Ordenar: severidade desc, depois rótulo asc
    out.sort(key=lambda r: (-_SEV_RANK.get(r["severity"], 0), r["metric_label"]))
    return out


__all__ = ["recommend", "REC_CATALOG"]
