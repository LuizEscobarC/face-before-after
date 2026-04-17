import cv2
import dlib
import numpy as np
import os

# Carregamento do modelo
predictor_path = "shape_predictor_68_face_landmarks.dat"
detector = dlib.get_frontal_face_detector()
predictor = dlib.shape_predictor(predictor_path)

def normalize_illumination(img):
    """Iguala a iluminação das fotos usando CLAHE (melhora o contraste)"""
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
    cl = clahe.apply(l)
    limg = cv2.merge((cl,a,b))
    return cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)

def get_landmarks(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    rects = detector(gray, 1)
    if len(rects) == 0: return None
    shape = predictor(gray, rects[0])
    return np.array([[p.x, p.y] for p in shape.parts()])

def align_and_crop(img, landmarks, size=1024):
    """Alinhamento estável baseado nos centros dos olhos e nariz"""
    l_eye = landmarks[36:42].mean(axis=0)
    r_eye = landmarks[42:48].mean(axis=0)
    nose = landmarks[30] # Ponta do nariz como âncora central
    
    # Cálculos geométricos
    eye_center = (l_eye + r_eye) / 2
    dy = r_eye[1] - l_eye[1]
    dx = r_eye[0] - l_eye[0]
    angle = np.degrees(np.arctan2(dy, dx))
    
    dist = np.sqrt(dx**2 + dy**2)
    scale = (size * 0.35) / dist
    
    M = cv2.getRotationMatrix2D(tuple(eye_center), angle, scale)
    M[0, 2] += (size * 0.5) - eye_center[0]
    M[1, 2] += (size * 0.45) - eye_center[1]
    
    return cv2.warpAffine(img, M, (size, size), flags=cv2.INTER_LANCZOS4)

# 1. Carregar e Normalizar Luz
img1 = normalize_illumination(cv2.imread('antes.png'))
img2 = normalize_illumination(cv2.imread('depois.png'))

lm1, lm2 = get_landmarks(img1), get_landmarks(img2)
face1 = align_and_crop(img1, lm1)
face2 = align_and_crop(img2, lm2)

# 2. OVERLAY DE CONTORNO (O "Pulo do Gato")
# Em vez de transparência, desenhamos o contorno da barba/rosto do DEPOIS sobre o ANTES
edges2 = cv2.Canny(cv2.GaussianBlur(face2, (5,5), 0), 50, 150)
kernel = np.ones((3,3), np.uint8)
edges2 = cv2.dilate(edges2, kernel, iterations=1)

result_contour = face1.copy()
# Pinta onde o rosto 'Depois' termina (em Ciano para alto contraste)
result_contour[edges2 > 0] = [255, 255, 0] 

# 3. HEATMAP MELHORADO
diff = cv2.absdiff(cv2.cvtColor(face1, cv2.COLOR_BGR2GRAY), 
                   cv2.cvtColor(face2, cv2.COLOR_BGR2GRAY))
# Aplica um limiar para ignorar pequenas mudanças de luz e focar em mudanças de massa
_, diff_thresh = cv2.threshold(diff, 30, 255, cv2.THRESH_BINARY)
heatmap = cv2.applyColorMap(diff, cv2.COLORMAP_HOT)

# Salvar resultados
cv2.imwrite('COMP_ANTES_ALINHADO.png', face1)
cv2.imwrite('COMP_DEPOIS_ALINHADO.png', face2)
cv2.imwrite('COMP_CONTORNO_SOBREPOSTO.png', result_contour)
cv2.imwrite('COMP_HEATMAP_ESTRUTURAL.png', heatmap)

print("Processado com normalização de luz e contorno estrutural.")