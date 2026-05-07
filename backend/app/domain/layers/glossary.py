"""Glossário de termos e métricas usadas no projeto.

Cada entrada: termo, unidade, descrição leiga, como medimos (técnico),
faixas típicas, problemas comuns e referências (públicas).
"""

from __future__ import annotations

from typing import Any, Dict


GLOSSARY: Dict[str, Dict[str, Any]] = {
    "ipd": {
        "termo":    "IPD — Distância Interpupilar",
        "unidade":  "px (na imagem) / mm (na vida real, ~63 mm em adultos)",
        "descricao": (
            "Distância entre os centros das pupilas. Usamos como referência de escala "
            "para que métricas em pixels possam ser comparadas entre fotos diferentes."
        ),
        "como_medido": (
            "Centro do olho esquerdo (média dos landmarks 36..41) e do direito (42..47); "
            "norma euclidiana entre os dois centros, em pixels."
        ),
        "faixas":   "Adulto típico: 54–74 mm. Em pixels depende da resolução.",
        "problemas_comuns": [
            "Foto não-frontal subestima IPD",
            "Lente curta (selfie) distorce IPD",
        ],
        "referencias": [
            {"titulo": "Wikipedia — Pupillary distance",
             "url": "https://en.wikipedia.org/wiki/Pupillary_distance"},
            {"titulo": "Dodgson 2004 — Variation and extrema of human IPD",
             "url": "https://www.cl.cam.ac.uk/~nad10/pubs/SPIE5291A-36.pdf"},
        ],
    },

    "fwhr": {
        "termo":    "fWHR — Facial Width-to-Height Ratio",
        "unidade":  "razão adimensional",
        "descricao": "Largura bizigomática dividida pela altura entre lábio superior e linha das sobrancelhas.",
        "como_medido": "‖p0 − p16‖ / (y(p51) − y(média(p19,p24))). Implementação em face_metrics.proportions.",
        "faixas":   "Masculino típico: 1.7–2.0. Ideal estético: ~1.85.",
        "problemas_comuns": [
            "Pose com pitch para cima/baixo distorce a altura",
            "Cabelo cobrindo testa pode falsear a sobrancelha detectada",
        ],
        "referencias": [
            {"titulo": "Lefevre 2012 — fWHR e dominância",
             "url": "https://doi.org/10.1098/rspb.2012.0884"},
            {"titulo": "Wikipedia — fWHR",
             "url": "https://en.wikipedia.org/wiki/Facial_width-to-height_ratio"},
        ],
    },

    "canthal_tilt": {
        "termo":    "Canthal Tilt",
        "unidade":  "graus (°)",
        "descricao": "Inclinação da linha que une o canto medial e o lateral do olho. Positivo = canto lateral mais alto.",
        "como_medido": "atan2(Δy, |Δx|) entre landmarks medial (39/42) e lateral (36/45) por olho.",
        "faixas":   "Atrativo masculino: +3° a +8°. Negativo dá ar cansado.",
        "problemas_comuns": [
            "Roll da cabeça aparenta tilt onde não há",
            "Edema palpebral muda o ponto detectado",
        ],
        "referencias": [
            {"titulo": "Rhee SC 2012",
             "url": "https://pubmed.ncbi.nlm.nih.gov/22743893/"},
            {"titulo": "Wikipedia — Canthus",
             "url": "https://en.wikipedia.org/wiki/Canthus"},
        ],
    },

    "gonial_angle": {
        "termo":    "Ângulo Gonial",
        "unidade":  "graus (°)",
        "descricao": "Ângulo formado no canto inferior da mandíbula (gônio).",
        "como_medido": "Ângulo entre vetores (gônio→têmpora) e (gônio→mento) usando landmarks 4/12, 0/16 e 8.",
        "faixas":   "Masculino típico: 110°–130°. Quanto menor, mais quadrada/definida.",
        "problemas_comuns": [
            "Pose 3/4 muda projeção do gônio",
            "Adiposidade submentoniana mascara o ponto real",
        ],
        "referencias": [
            {"titulo": "Naini — Facial Aesthetics (capítulo mandibular)",
             "url": "https://onlinelibrary.wiley.com/doi/10.1002/9781118786109"},
        ],
    },

    "marquardt": {
        "termo":    "Desvio bilateral global (Marquardt)",
        "unidade":  "% IPD",
        "descricao": "Quanto cada landmark do lado direito desvia da posição espelhada do equivalente do esquerdo.",
        "como_medido": "Reflete cada landmark direito sobre x_midline e calcula RMSE com o esquerdo correspondente; resultado dividido pela IPD.",
        "faixas":   "Excelente: <1%. Severo: >8%.",
        "problemas_comuns": [
            "Roll/yaw produz pseudo-assimetria",
            "Linha média mal estimada amplifica o erro",
        ],
        "referencias": [
            {"titulo": "Marquardt — Phi Mask",
             "url": "https://en.wikipedia.org/wiki/Marquardt_Beauty_Mask"},
        ],
    },

    "lab_delta_e": {
        "termo":    "ΔE Lab — Diferença perceptual de cor",
        "unidade":  "unidades CIE Lab (DE76)",
        "descricao": "Distância no espaço Lab. Aproxima o quanto duas regiões parecem diferentes a olho nu.",
        "como_medido": "Converte ROIs para Lab, calcula a diferença euclidiana média entre a cor das bochechas esquerda e direita.",
        "faixas":   "<2 = imperceptível; 2–10 = perceptível; >10 = muito visível.",
        "problemas_comuns": [
            "Iluminação lateral assimétrica fabrica ΔE alto sem haver lesão",
            "Reflexos de óculos ou cabelo sobre a face poluem a ROI",
        ],
        "referencias": [
            {"titulo": "Wikipedia — Color difference",
             "url": "https://en.wikipedia.org/wiki/Color_difference"},
            {"titulo": "OpenCV — cvtColor BGR2Lab",
             "url": "https://docs.opencv.org/4.x/de/d25/imgproc_color_conversions.html"},
        ],
    },

    "laplacian_sharpness": {
        "termo":    "Sharpness Laplaciana",
        "unidade":  "variância (adimensional)",
        "descricao": "Estimador de nitidez. Quanto maior a variância da Laplaciana, mais nítida a foto.",
        "como_medido": "cv2.Laplacian(grayscale, CV_64F).var() sobre a região da face.",
        "faixas":   "Tipicamente: <100 borrado, 100–500 ok, >500 nítido.",
        "problemas_comuns": [
            "Imagem comprimida em JPG agressivo gera valor falso baixo",
            "Textura (barba, sardas) eleva o valor mesmo em imagem desfocada",
        ],
        "referencias": [
            {"titulo": "Pech-Pacheco 2000 — Diatom autofocusing",
             "url": "https://ieeexplore.ieee.org/document/903548"},
            {"titulo": "OpenCV — Laplacian",
             "url": "https://docs.opencv.org/4.x/d4/d86/group__imgproc__filter.html"},
        ],
    },

    "solvepnp_pose": {
        "termo":    "Pose da cabeça (yaw/pitch/roll)",
        "unidade":  "graus (°)",
        "descricao": "Orientação 3D da cabeça em relação à câmera.",
        "como_medido": "cv2.solvePnP com 6 landmarks (nariz, queixo, cantos dos olhos e da boca) contra um modelo 3D genérico em mm; matriz de rotação decomposta via cv2.RQDecomp3x3.",
        "faixas":   "Frontal aceitável: |yaw|≤7° e |pitch|≤7°. Roll tolera ±5° (girando a foto resolve).",
        "problemas_comuns": [
            "Sem calibração de câmera, focal aproximada (=largura) introduz erro",
            "Smile + mouth corners deslocados afetam pose estimada",
        ],
        "referencias": [
            {"titulo": "Mallick — Head Pose Estimation tutorial",
             "url": "https://learnopencv.com/head-pose-estimation-using-opencv-and-dlib/"},
            {"titulo": "OpenCV — solvePnP",
             "url": "https://docs.opencv.org/4.x/d9/d0c/group__calib3d.html#ga549c2075fac14829ff4a58bc931c033d"},
        ],
    },

    "thirds_fifths": {
        "termo":    "Cânones neoclássicos (terços e quintos)",
        "unidade":  "razão adimensional",
        "descricao": "Regras estéticas históricas: face dividida em 3 alturas iguais e 5 larguras iguais.",
        "como_medido": "Razões entre alturas (trichion-glabella-nasion-mento) e larguras (faces e olhos).",
        "faixas":   "Desvio padrão das razões idealmente 0; aceitável <0.03.",
        "problemas_comuns": [
            "Trichion (linha do cabelo) é estimado por reflexão — calvície altera",
            "Sorriso e expressão alteram boca/olhos",
        ],
        "referencias": [
            {"titulo": "Wikipedia — Neoclassical canons",
             "url": "https://en.wikipedia.org/wiki/Neoclassical_canons_of_facial_proportions"},
        ],
    },

    "face_shape": {
        "termo":    "Forma facial",
        "unidade":  "rótulo (oval, oblongo, etc.)",
        "descricao": "Silhueta classificada por razões altura/largura e zigomática/bigonial.",
        "como_medido": "Regras heurísticas sobre as razões; ver face_metrics.face_shape().",
        "faixas":   "Não há ‘ideal’; cada formato pede grooming distinto.",
        "problemas_comuns": [
            "Cabelo/barba mudam silhueta percebida",
        ],
        "referencias": [
            {"titulo": "GQ — face shape guide",
             "url": "https://www.gq.com/story/grooming-tips-by-face-shape"},
        ],
    },

    "ear": {
        "termo":    "EAR — Eye Aspect Ratio",
        "unidade":  "razão adimensional",
        "descricao": "Razão entre alturas e largura do olho. Detecta abertura ocular (piscadas).",
        "como_medido": "(‖p1−p5‖ + ‖p2−p4‖) / (2·‖p0−p3‖) sobre os 6 pontos do olho.",
        "faixas":   "Aberto: 0.25–0.35. Fechado: <0.20.",
        "problemas_comuns": [
            "Foto com olhos parcialmente fechados rebaixa EAR",
        ],
        "referencias": [
            {"titulo": "Soukupová & Čech 2016 — Real-Time Eye Blink Detection",
             "url": "https://vision.fe.uni-lj.si/cvww2016/proceedings/papers/05.pdf"},
        ],
    },
}


__all__ = ["GLOSSARY"]
