#!/usr/bin/env python3
"""Diagnóstico BiSeNet: verifica se hairline está sendo detectado e usado corretamente."""

import json
import sys
from pathlib import Path

# Adicionar backend ao path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

import cv2
import numpy as np
from app.services.segmentation.bisenet_segmenter import get_segmenter
from app.services.landmarks.virtual_landmarks import extract_hairline_points
from app.domain.landmarks_mesh import P_LEFT_EYE_INNER, P_RIGHT_EYE_INNER, P_LEFT_EYE_OUTER, P_RIGHT_EYE_OUTER
from app.services.landmarks.fusion_layer import TRICHION_CONFIDENCE_THRESHOLD


def diagnose_image(image_path: str):
    """Analisa um arquivo de imagem e retorna diagnóstico de BiSeNet."""

    print(f"\n{'='*70}")
    print(f"DIAGNÓSTICO BiSeNet: {image_path}")
    print(f"{'='*70}\n")

    # 1. Carregar imagem
    img = cv2.imread(image_path)
    if img is None:
        print(f"❌ Erro: Não consegui carregar {image_path}")
        return

    h, w = img.shape[:2]
    print(f"✓ Imagem carregada: {w}×{h} pixels\n")

    # 2. Rodar BiSeNet
    print("Executando BiSeNet segmenter...")
    try:
        segmenter = get_segmenter()
        result = segmenter.segment(img)
        print(f"✓ BiSeNet executado em {result.get('elapsed_ms', 'N/A')}ms\n")
    except Exception as e:
        print(f"❌ Erro ao executar BiSeNet: {e}\n")
        return

    # 3. Extrair hair mask
    hair_mask = result.get("hair_mask")
    if hair_mask is None:
        print("❌ Hair mask vazia\n")
        return

    hair_pixels = np.sum(hair_mask)
    hair_pct = (hair_pixels / (h * w)) * 100
    print(f"Hair pixels detectados: {hair_pixels:,} ({hair_pct:.1f}% da imagem)\n")

    # 4. PROBLEMA: Não temos landmarks MediaPipe aqui direto
    # Vou simular alguns landmarks baseado em proporções padrão
    print("⚠️  Nota: Para diagnóstico completo, preciso de landmarks MediaPipe")
    print("   (Este script simula com proporções padrão)\n")

    # Landmarks simulados (proporções faciais típicas)
    icd_px = w * 0.25  # Intercanthal distance ≈ 25% da largura

    left_eye_outer_x = w * 0.25
    right_eye_outer_x = w * 0.75
    eye_y = h * 0.35

    fake_landmarks = np.zeros((478, 3), dtype=np.float32)
    fake_landmarks[P_LEFT_EYE_INNER] = [w * 0.40, eye_y, 1.0]
    fake_landmarks[P_RIGHT_EYE_INNER] = [w * 0.60, eye_y, 1.0]
    fake_landmarks[P_LEFT_EYE_OUTER] = [left_eye_outer_x, eye_y, 1.0]
    fake_landmarks[P_RIGHT_EYE_OUTER] = [right_eye_outer_x, eye_y, 1.0]
    fake_landmarks[10] = [w * 0.50, h * 0.15, 1.0]  # P_FOREHEAD_CROWN (proxy)
    fake_landmarks[152] = [w * 0.50, h * 0.95, 1.0]  # P_MENTON (proxy)

    print("Extraindo hairline points de hair_mask...\n")
    try:
        hairline_result = extract_hairline_points(hair_mask, fake_landmarks)

        if hairline_result:
            trichion = hairline_result.get("trichion")
            confidence = hairline_result.get("confidence", 0.0)
            column_y = hairline_result.get("column_y", [])

            print(f"Trichion detectado: {trichion}")
            print(f"Confidence BiSeNet: {confidence:.3f}")
            print(f"Threshold mínimo: {TRICHION_CONFIDENCE_THRESHOLD}")

            if confidence >= TRICHION_CONFIDENCE_THRESHOLD:
                print(f"✅ ACEITO: confidence {confidence:.3f} >= {TRICHION_CONFIDENCE_THRESHOLD}")
                print(f"   → trichion_source = 'bisenet'")
            else:
                print(f"❌ REJEITADO: confidence {confidence:.3f} < {TRICHION_CONFIDENCE_THRESHOLD}")
                print(f"   → fallback para lm[10] (P_FOREHEAD_CROWN)")
                print(f"\n🔧 SUGESTÃO: Threshold atual 0.5 pode ser muito alto para rostos com:")
                print(f"   - Cabelo curto / textura irregular")
                print(f"   - Cabelo levemente fora de foco")
                print(f"   - Cabelo muito claro/escuro")

            print(f"\nColuna Y samples (primeiras 10): {column_y[:10] if column_y else 'N/A'}")

    except Exception as e:
        print(f"❌ Erro ao extrair hairline: {e}\n")
        import traceback
        traceback.print_exc()

    # 5. Salvar visualização (opcional)
    print(f"\n{'='*70}")
    print("Salvando visualizações...")

    try:
        # Hair mask overlay
        hair_rgb = np.zeros_like(img)
        hair_rgb[hair_mask] = [0, 255, 0]  # Verde = cabelo detectado
        overlay = cv2.addWeighted(img, 0.7, hair_rgb, 0.3, 0)

        output_path = Path(image_path).parent / f"{Path(image_path).stem}_bisenet_overlay.jpg"
        cv2.imwrite(str(output_path), overlay)
        print(f"✓ Salvo: {output_path}\n")
    except Exception as e:
        print(f"⚠️  Não consegui salvar visualização: {e}\n")


if __name__ == "__main__":
    image_path = "rosto_exemplo.jpg"
    if len(sys.argv) > 1:
        image_path = sys.argv[1]

    if not Path(image_path).exists():
        print(f"❌ Arquivo não encontrado: {image_path}")
        sys.exit(1)

    diagnose_image(image_path)
