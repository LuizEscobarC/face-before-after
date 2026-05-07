#!/usr/bin/env python3
"""
Facial Asymmetry Analysis Tool

A professional Python script for analyzing facial asymmetry from frontal face photos.
Uses dlib's 68 facial landmarks model with Frankfort Horizontal Plane correction.

Author: Face Analysis Tool
License: MIT
"""

import cv2
import numpy as np
import argparse
import json
import os
import sys
from typing import Tuple, Optional, Dict, List, Any

import app.domain.face_metrics as face_metrics
from app.domain.landmarks_mesh import (
    LM_INNER_MOUTH,
    LM_JAWLINE,
    LM_LEFT_BROW,
    LM_LEFT_EYE,
    LM_NOSE_BRIDGE,
    LM_NOSE_TIP,
    LM_OUTER_MOUTH,
    LM_RIGHT_BROW,
    LM_RIGHT_EYE,
    P_BROW_LEFT_INNER,
    P_BROW_RIGHT_INNER,
    P_LEFT_MOUTH,
    P_MENTON,
    P_NOSE_LEFT,
    P_NOSE_RIGHT,
    P_NOSE_TIP,
    P_RIGHT_MOUTH,
    P_UPPER_LIP,
)
from app.vision.services import face_detection
from app.vision.services.face_landmarker import FaceDetectionResult


# ============================================================================
# CONFIGURATION
# ============================================================================

# Region groups and anatomical points are sourced from landmarks_mesh.
LANDMARKS = {
    'left_eye': LM_LEFT_EYE,
    'right_eye': LM_RIGHT_EYE,
    'left_eyebrow': LM_LEFT_BROW,
    'right_eyebrow': LM_RIGHT_BROW,
    'nose_bridge': LM_NOSE_BRIDGE,
    'nose_tip': LM_NOSE_TIP,
    'outer_mouth': LM_OUTER_MOUTH,
    'inner_mouth': LM_INNER_MOUTH,
    'jawline': LM_JAWLINE,
}

ANATOMICAL_POINTS = {
    'pronasale': P_NOSE_TIP,           # Nose tip
    'labiale_superius': P_UPPER_LIP,   # Upper lip center
    'menton': P_MENTON,                # Chin bottom
    'left_mouth_corner': P_LEFT_MOUTH,
    'right_mouth_corner': P_RIGHT_MOUTH,
    'nose_left': P_NOSE_LEFT,
    'nose_right': P_NOSE_RIGHT,
}

# Visualization colors (BGR format)
COLORS = {
    'landmarks': (0, 255, 0),      # Green
    'midline': (255, 0, 0),        # Blue
    'horizontal': (0, 255, 255),   # Yellow
    'asymmetry': (0, 0, 255),      # Red
    'text': (255, 255, 255),       # White
    'text_bg': (0, 0, 0),          # Black
}


# ============================================================================
# FACE DETECTION AND LANDMARK EXTRACTION
# ============================================================================

class FaceAsymmetryAnalyzer:
    """Main class for facial asymmetry analysis."""
    
    def __init__(self, predictor_path: str | None = None):
        """Initialize the analyzer.

        ``predictor_path`` is kept for backwards-compat with the CLI and
        ignored — detection is now performed by MediaPipe Tasks Vision via
        :mod:`app.vision.services.face_detection`.
        """
        # Cache of last detection: maps id(image_bytes) → FaceDetectionResult.
        # Avoids running MediaPipe twice when caller invokes detect_face then
        # detect_landmarks with the same image.
        self._last_detection: dict[int, FaceDetectionResult] = {}
        self.landmarks = None
        self.original_image = None
        self.aligned_image = None
        self.annotated_image = None
        self.rotation_angle = 0.0
        self.midline = None
        self.asymmetry_data = {}

    def detect_face(self, image: np.ndarray) -> Optional[FaceDetectionResult]:
        """Detect the largest face in the image.

        Returns a :class:`FaceDetectionResult` with full Mesh-478 landmarks
        already populated (the actual landmark extraction is part of the
        MediaPipe single-shot inference). Returns ``None`` if no face found.
        """
        faces = face_detection.detect_faces(image)
        if not faces:
            return None
        if len(faces) > 1:
            print(f"Warning: {len(faces)} faces detected. Using the largest one.")
        result = faces[0]
        # Cache for follow-up detect_landmarks call on the same image.
        self._last_detection[id(image)] = result
        return result

    def detect_landmarks(self, image: np.ndarray, face_result: FaceDetectionResult) -> np.ndarray:
        """Return the (478, 2) landmarks for ``face_result``.

        For backwards compat with the previous (image, dlib_rect) signature,
        callers may pass any object whose ``.landmarks`` attribute holds an
        ndarray. If the cached detection covers the same image, we reuse it.
        """
        # Fast path: result carries its own landmarks.
        landmarks = getattr(face_result, "landmarks", None)
        if landmarks is not None:
            return np.asarray(landmarks)
        # Fallback: re-detect.
        cached = self._last_detection.get(id(image))
        if cached is not None and cached.landmarks is not None:
            return np.asarray(cached.landmarks)
        result = self.detect_face(image)
        if result is None or result.landmarks is None:
            raise ValueError("No face detected; cannot extract landmarks.")
        return np.asarray(result.landmarks)
    
    def compute_eye_centers(self, landmarks: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Compute the center points of left and right eyes.
        
        Args:
            landmarks: Array of facial landmarks.
            
        Returns:
            Tuple of (left_eye_center, right_eye_center) as numpy arrays.
        """
        left_eye = landmarks[LANDMARKS['left_eye']].mean(axis=0)
        right_eye = landmarks[LANDMARKS['right_eye']].mean(axis=0)
        return left_eye, right_eye
    
    def compute_glabella(self, landmarks: np.ndarray) -> np.ndarray:
        """
        Compute glabella point as midpoint between inner eyebrows.
        
        Args:
            landmarks: Array of facial landmarks.
            
        Returns:
            Glabella point coordinates.
        """
        # Inner eyebrow points (Mesh-478): 107 (left inner) and 336 (right inner).
        left_inner_brow = landmarks[P_BROW_LEFT_INNER]
        right_inner_brow = landmarks[P_BROW_RIGHT_INNER]
        glabella = (left_inner_brow + right_inner_brow) / 2
        return glabella
    
    def compute_frankfort_angle(self, landmarks: np.ndarray) -> float:
        """
        Estimate the Frankfort Horizontal Plane angle.
        
        Since ear landmarks are not available, we use the eye line as an approximation.
        The true Frankfort plane uses the lowest point of the orbital rim and 
        the upper ear region (porion), but eye centers provide a good approximation.
        
        Args:
            landmarks: Array of facial landmarks.
            
        Returns:
            Rotation angle in degrees to align the face horizontally.
        """
        left_eye, right_eye = self.compute_eye_centers(landmarks)
        
        # Compute angle of the line connecting eye centers
        dy = right_eye[1] - left_eye[1]
        dx = right_eye[0] - left_eye[0]
        angle = np.degrees(np.arctan2(dy, dx))
        
        return angle
    
    def align_face(self, image: np.ndarray, landmarks: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Rotate the image to correct head tilt using Frankfort Horizontal Plane estimation.
        
        Args:
            image: Input BGR image.
            landmarks: Array of facial landmarks.
            
        Returns:
            Tuple of (rotated_image, rotation_matrix).
        """
        self.rotation_angle = self.compute_frankfort_angle(landmarks)
        
        # Get image center for rotation
        h, w = image.shape[:2]
        center = (w // 2, h // 2)
        
        # Create rotation matrix
        M = cv2.getRotationMatrix2D(center, self.rotation_angle, 1.0)
        
        # Calculate new bounding dimensions to avoid cropping
        cos = np.abs(M[0, 0])
        sin = np.abs(M[0, 1])
        new_w = int((h * sin) + (w * cos))
        new_h = int((h * cos) + (w * sin))
        
        # Adjust rotation matrix for the new image size
        M[0, 2] += (new_w / 2) - center[0]
        M[1, 2] += (new_h / 2) - center[1]
        
        # Apply rotation
        rotated = cv2.warpAffine(image, M, (new_w, new_h), 
                                  flags=cv2.INTER_LANCZOS4,
                                  borderMode=cv2.BORDER_REPLICATE)
        
        return rotated, M
    
    def transform_landmarks(self, landmarks: np.ndarray, M: np.ndarray) -> np.ndarray:
        """
        Transform landmark coordinates using the rotation matrix.
        
        Args:
            landmarks: Original landmark coordinates.
            M: 2x3 rotation matrix.
            
        Returns:
            Transformed landmark coordinates.
        """
        ones = np.ones((landmarks.shape[0], 1))
        landmarks_homogeneous = np.hstack([landmarks, ones])
        transformed = landmarks_homogeneous @ M.T
        return transformed
    
    def compute_midline(self, landmarks: np.ndarray) -> Tuple[np.ndarray, float, float]:
        """
        Compute the facial midline as the perpendicular bisector of the eye line.

        Rationale: after Frankfort alignment the eye line is horizontal by
        construction, so the true sagittal midline is a *vertical* line
        passing through the midpoint between the eyes. Anchoring on the eye
        midpoint + glabella (both stable, bilateral references) avoids the
        bias that occurs when the midline is fitted through asymmetric
        points like the nose tip, lips or chin — which is exactly what we
        want to MEASURE the deviation of, not use as anchor.

        Args:
            landmarks: Array of facial landmarks (already aligned).

        Returns:
            Tuple of (midline_points, slope, x_intercept). The line is
            represented as ``x = slope * y + intercept``; here slope = 0
            (vertical line) and intercept = midline x-coordinate.
        """
        left_eye, right_eye = self.compute_eye_centers(landmarks)
        eye_midpoint = (left_eye + right_eye) / 2.0
        glabella = self.compute_glabella(landmarks)

        # Average eye-midpoint x with glabella x for added robustness.
        midline_x = float((eye_midpoint[0] + glabella[0]) / 2.0)

        midline_points = np.array([glabella, eye_midpoint])
        slope = 0.0
        intercept = midline_x

        self.midline = {
            'points': midline_points,
            'slope': slope,
            'intercept': intercept,
        }

        return midline_points, slope, intercept
    
    def get_midline_x_at_y(self, y: float) -> float:
        """
        Calculate the x-coordinate on the midline at a given y-coordinate.
        
        Args:
            y: Y-coordinate.
            
        Returns:
            X-coordinate on the midline.
        """
        if self.midline is None:
            raise ValueError("Midline has not been computed yet.")
        return self.midline['slope'] * y + self.midline['intercept']
    
    def compute_horizontal_distance_to_midline(self, point: np.ndarray) -> float:
        """
        Compute the horizontal distance from a point to the midline.
        
        Args:
            point: (x, y) coordinates of the point.
            
        Returns:
            Signed horizontal distance (negative = left of midline, positive = right).
        """
        midline_x = self.get_midline_x_at_y(point[1])
        return point[0] - midline_x
    
    def measure_asymmetry(self, landmarks: np.ndarray) -> Dict[str, Any]:
        """
        Measure facial asymmetry by comparing left and right feature distances.
        
        Args:
            landmarks: Array of facial landmarks.
            
        Returns:
            Dictionary containing asymmetry measurements.
        """
        asymmetry = {}
        
        # Eye level difference
        left_eye, right_eye = self.compute_eye_centers(landmarks)
        asymmetry['eye_level_difference_px'] = abs(left_eye[1] - right_eye[1])
        
        # Eye distance from midline asymmetry
        left_eye_dist = self.compute_horizontal_distance_to_midline(left_eye)
        right_eye_dist = self.compute_horizontal_distance_to_midline(right_eye)
        asymmetry['eye_horizontal_asymmetry_px'] = abs(abs(left_eye_dist) - abs(right_eye_dist))
        
        # Nose tip deviation from midline
        nose_tip = landmarks[ANATOMICAL_POINTS['pronasale']]
        asymmetry['nose_deviation_px'] = abs(self.compute_horizontal_distance_to_midline(nose_tip))
        
        # Nose wings asymmetry
        nose_left = landmarks[ANATOMICAL_POINTS['nose_left']]
        nose_right = landmarks[ANATOMICAL_POINTS['nose_right']]
        left_nose_dist = abs(self.compute_horizontal_distance_to_midline(nose_left))
        right_nose_dist = abs(self.compute_horizontal_distance_to_midline(nose_right))
        asymmetry['nose_wings_asymmetry_px'] = abs(left_nose_dist - right_nose_dist)
        
        # Chin deviation from midline
        menton = landmarks[ANATOMICAL_POINTS['menton']]
        asymmetry['chin_deviation_px'] = abs(self.compute_horizontal_distance_to_midline(menton))
        
        # Mouth center deviation
        upper_lip = landmarks[ANATOMICAL_POINTS['labiale_superius']]
        asymmetry['mouth_center_deviation_px'] = abs(self.compute_horizontal_distance_to_midline(upper_lip))
        
        # Mouth corners asymmetry
        left_mouth = landmarks[ANATOMICAL_POINTS['left_mouth_corner']]
        right_mouth = landmarks[ANATOMICAL_POINTS['right_mouth_corner']]
        left_mouth_dist = abs(self.compute_horizontal_distance_to_midline(left_mouth))
        right_mouth_dist = abs(self.compute_horizontal_distance_to_midline(right_mouth))
        asymmetry['mouth_corners_asymmetry_px'] = abs(left_mouth_dist - right_mouth_dist)
        
        # Jawline asymmetry (compare left and right jawline point distances)
        jawline = landmarks[LANDMARKS['jawline']]
        jaw_center_idx = len(jawline) // 2
        left_jaw = jawline[:jaw_center_idx]
        right_jaw = jawline[jaw_center_idx + 1:][::-1]  # Reverse for pairing
        
        jaw_asymmetries = []
        for l_point, r_point in zip(left_jaw, right_jaw):
            l_dist = abs(self.compute_horizontal_distance_to_midline(l_point))
            r_dist = abs(self.compute_horizontal_distance_to_midline(r_point))
            jaw_asymmetries.append(abs(l_dist - r_dist))
        
        asymmetry['jawline_mean_asymmetry_px'] = np.mean(jaw_asymmetries)
        asymmetry['jawline_max_asymmetry_px'] = np.max(jaw_asymmetries)
        
        # Overall asymmetry score (weighted average, in pixels)
        weights = {
            'nose_deviation_px': 2.0,
            'chin_deviation_px': 1.5,
            'mouth_center_deviation_px': 1.5,
            'eye_level_difference_px': 1.0,
            'eye_horizontal_asymmetry_px': 1.0,
            'mouth_corners_asymmetry_px': 1.0,
            'jawline_mean_asymmetry_px': 1.0,
        }

        weighted_sum = sum(asymmetry[k] * weights[k] for k in weights)
        total_weight = sum(weights.values())
        asymmetry['overall_asymmetry_score'] = weighted_sum / total_weight

        # ── Normalization by interpupillary distance (IPD) ──────────────────
        # Pixel measurements are not comparable across photos with different
        # face scales. We express every *_px metric as a percentage of the
        # interpupillary distance, which is a stable bilateral reference.
        ipd_px = float(np.linalg.norm(np.asarray(right_eye) - np.asarray(left_eye)))
        asymmetry['ipd_px'] = ipd_px

        if ipd_px > 1e-6:
            normalized = {}
            for key in list(asymmetry.keys()):
                if key.endswith('_px') and key not in ('ipd_px',):
                    norm_key = key[:-3] + '_pct_ipd'
                    normalized[norm_key] = (asymmetry[key] / ipd_px) * 100.0
            # Issue 2.5: só agrega métricas que efetivamente foram normalizadas;
            # se alguma estiver ausente (landmarks faltando), pula sem crashar.
            norm_weights = {
                k[:-3] + '_pct_ipd': weights[k]
                for k in weights
                if (k[:-3] + '_pct_ipd') in normalized
            }
            sum_norm_weights = sum(norm_weights.values())
            if sum_norm_weights > 0:
                norm_weighted_sum = sum(
                    normalized[k] * norm_weights[k] for k in norm_weights
                )
                normalized['overall_asymmetry_score_pct_ipd'] = (
                    norm_weighted_sum / sum_norm_weights
                )
            else:
                normalized['overall_asymmetry_score_pct_ipd'] = None
            asymmetry.update(normalized)
        else:
            asymmetry['overall_asymmetry_score_pct_ipd'] = None

        # Round all values for cleaner output (preserva None).
        for key in asymmetry:
            value = asymmetry[key]
            if value is None:
                continue
            decimals = 3 if key.endswith('_pct_ipd') else 2
            asymmetry[key] = round(value, decimals)
        
        self.asymmetry_data = asymmetry
        return asymmetry
    
    def draw_annotations(self, image: np.ndarray, landmarks: np.ndarray) -> np.ndarray:
        """
        Draw visual annotations on the image.
        
        Args:
            image: Input BGR image.
            landmarks: Array of facial landmarks.
            
        Returns:
            Annotated image.
        """
        annotated = image.copy()
        h, w = annotated.shape[:2]
        
        # 1. Draw all facial landmarks (green)
        for i, (x, y) in enumerate(landmarks):
            cv2.circle(annotated, (int(x), int(y)), 2, COLORS['landmarks'], -1)
        
        # 2. Draw Frankfort Horizontal line (yellow)
        left_eye, right_eye = self.compute_eye_centers(landmarks)
        eye_center = ((left_eye + right_eye) / 2).astype(int)
        
        # Draw horizontal line across the image at eye level
        cv2.line(annotated, (0, int(eye_center[1])), (w, int(eye_center[1])), 
                 COLORS['horizontal'], 2)
        
        # Draw eye center points
        cv2.circle(annotated, tuple(left_eye.astype(int)), 4, COLORS['horizontal'], -1)
        cv2.circle(annotated, tuple(right_eye.astype(int)), 4, COLORS['horizontal'], -1)
        
        # Add label for Frankfort horizontal
        self._put_text_with_background(annotated, "Frankfort Horizontal", 
                                       (10, int(eye_center[1]) - 10),
                                       color=COLORS['horizontal'])
        
        # 3. Draw facial midline (blue)
        if self.midline is not None:
            # Draw the midline from top to bottom of face
            y_top = int(self.midline['points'][:, 1].min() - 30)
            y_bottom = int(self.midline['points'][:, 1].max() + 30)
            
            x_top = int(self.get_midline_x_at_y(y_top))
            x_bottom = int(self.get_midline_x_at_y(y_bottom))
            
            cv2.line(annotated, (x_top, y_top), (x_bottom, y_bottom), 
                     COLORS['midline'], 2)
            
            # Draw midline anchor points
            for point in self.midline['points']:
                cv2.circle(annotated, tuple(point.astype(int)), 4, COLORS['midline'], -1)
            
            # Label the midline
            self._put_text_with_background(annotated, "Facial Midline", 
                                          (x_top + 5, y_top + 15),
                                          color=COLORS['midline'])
        
        # 4. Draw asymmetry deviation lines (red)
        key_points = {
            'Nose tip': landmarks[ANATOMICAL_POINTS['pronasale']],
            'Chin': landmarks[ANATOMICAL_POINTS['menton']],
            'Upper lip': landmarks[ANATOMICAL_POINTS['labiale_superius']],
            'L mouth': landmarks[ANATOMICAL_POINTS['left_mouth_corner']],
            'R mouth': landmarks[ANATOMICAL_POINTS['right_mouth_corner']],
        }
        
        for name, point in key_points.items():
            midline_x = self.get_midline_x_at_y(point[1])
            deviation = abs(point[0] - midline_x)
            
            # Draw line from point to midline
            cv2.line(annotated, 
                     tuple(point.astype(int)), 
                     (int(midline_x), int(point[1])),
                     COLORS['asymmetry'], 2)
            
            # Draw the point
            cv2.circle(annotated, tuple(point.astype(int)), 5, COLORS['asymmetry'], -1)
            
            # Add measurement text
            text_x = int(min(point[0], midline_x)) - 5
            text_y = int(point[1]) - 5
            self._put_text_with_background(annotated, f"{name}: {deviation:.1f}px",
                                          (text_x, text_y),
                                          font_scale=0.4,
                                          color=COLORS['asymmetry'])
        
        # 5. Draw eye asymmetry lines
        for eye_name, eye_center in [('L eye', left_eye), ('R eye', right_eye)]:
            midline_x = self.get_midline_x_at_y(eye_center[1])
            cv2.line(annotated, 
                     tuple(eye_center.astype(int)), 
                     (int(midline_x), int(eye_center[1])),
                     COLORS['asymmetry'], 1)
        
        # 6. Add asymmetry score summary
        if self.asymmetry_data:
            y_start = 30
            self._put_text_with_background(annotated, "Asymmetry Analysis", 
                                          (10, y_start), font_scale=0.6)
            y_start += 25
            self._put_text_with_background(annotated, 
                f"Overall Score: {self.asymmetry_data.get('overall_asymmetry_score', 0):.2f}",
                (10, y_start), font_scale=0.5)
            y_start += 20
            self._put_text_with_background(annotated,
                f"Rotation correction: {self.rotation_angle:.2f} deg",
                (10, y_start), font_scale=0.4)
        
        return annotated
    
    def _put_text_with_background(self, image: np.ndarray, text: str, 
                                   position: Tuple[int, int],
                                   font_scale: float = 0.5,
                                   color: Tuple[int, int, int] = COLORS['text'],
                                   thickness: int = 1):
        """
        Draw text with a background rectangle for better visibility.
        
        Args:
            image: Image to draw on.
            text: Text string to draw.
            position: (x, y) position for the text.
            font_scale: Font scale factor.
            color: Text color in BGR.
            thickness: Line thickness.
        """
        font = cv2.FONT_HERSHEY_SIMPLEX
        (text_width, text_height), baseline = cv2.getTextSize(text, font, font_scale, thickness)
        
        x, y = position
        padding = 3
        
        # Draw background rectangle
        cv2.rectangle(image, 
                      (x - padding, y - text_height - padding),
                      (x + text_width + padding, y + baseline + padding),
                      COLORS['text_bg'], -1)
        
        # Draw text
        cv2.putText(image, text, (x, y), font, font_scale, color, thickness, cv2.LINE_AA)
    
    def generate_asymmetry_heatmap(self, image: np.ndarray, landmarks: np.ndarray) -> np.ndarray:
        """
        Generate a heatmap visualization showing asymmetry intensity across the face.
        
        Uses Gaussian smoothing to create a gradient showing asymmetry strength.
        
        Args:
            image: Input BGR image.
            landmarks: Array of facial landmarks.
            
        Returns:
            Heatmap overlay image.
        """
        h, w = image.shape[:2]
        heatmap = np.zeros((h, w), dtype=np.float32)
        
        # Create asymmetry map for each landmark pair
        # Left landmarks: 0-16 (left half of jaw), 17-21 (left brow), 36-41 (left eye)
        # Right landmarks mirror these
        
        # Mirror pairs in Mesh-478 indices (built from region lists).
        pairs: list[tuple[int, int]] = []
        pairs += list(zip(LM_JAWLINE[:8], list(reversed(LM_JAWLINE[9:]))))
        pairs += list(zip(LM_LEFT_EYE, LM_RIGHT_EYE))
        pairs += list(zip(LM_LEFT_BROW, list(reversed(LM_RIGHT_BROW))))
        pairs += [(P_NOSE_LEFT, P_NOSE_RIGHT)]
        om = LM_OUTER_MOUTH
        pairs += [(om[0], om[6]), (om[1], om[5]), (om[2], om[4]),
                  (om[11], om[7]), (om[10], om[8])]
        
        for left_idx, right_idx in pairs:
            left_point = landmarks[left_idx]
            right_point = landmarks[right_idx]
            
            # Calculate vertical asymmetry
            y_diff = abs(left_point[1] - right_point[1])
            
            # Calculate horizontal asymmetry relative to midline
            left_dist = abs(self.compute_horizontal_distance_to_midline(left_point))
            right_dist = abs(self.compute_horizontal_distance_to_midline(right_point))
            x_diff = abs(left_dist - right_dist)
            
            # Combined asymmetry score
            asymmetry_score = np.sqrt(x_diff**2 + y_diff**2)
            
            # Draw Gaussian blobs at asymmetric points
            for point in [left_point, right_point]:
                cv2.circle(heatmap, tuple(point.astype(int)), 
                          int(20 + asymmetry_score), asymmetry_score, -1)
        
        # Apply Gaussian blur for smoothing
        heatmap = cv2.GaussianBlur(heatmap, (51, 51), 0)
        
        # Normalize to 0-255 range
        if heatmap.max() > 0:
            heatmap = (heatmap / heatmap.max() * 255).astype(np.uint8)
        else:
            heatmap = heatmap.astype(np.uint8)
        
        # Apply colormap
        heatmap_colored = cv2.applyColorMap(heatmap, cv2.COLORMAP_JET)
        
        # Blend with original image
        alpha = 0.5
        blended = cv2.addWeighted(image, 1 - alpha, heatmap_colored, alpha, 0)
        
        return blended
    
    def analyze(self, image_path: str) -> Dict[str, Any]:
        """
        Perform complete facial asymmetry analysis on an image.
        
        Args:
            image_path: Path to the input image.
            
        Returns:
            Dictionary containing analysis results.
        """
        # Load image
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image not found: {image_path}")
        
        self.original_image = cv2.imread(image_path)
        if self.original_image is None:
            raise ValueError(f"Failed to load image: {image_path}")
        
        print(f"Loaded image: {image_path} ({self.original_image.shape[1]}x{self.original_image.shape[0]})")
        
        # Detect face
        face_rect = self.detect_face(self.original_image)
        if face_rect is None:
            raise ValueError("No face detected in the image. Please use a clear frontal face photo.")
        
        print(f"Face detected: ({face_rect.left()}, {face_rect.top()}) - ({face_rect.right()}, {face_rect.bottom()})")
        
        # Detect landmarks on original image
        original_landmarks = self.detect_landmarks(self.original_image, face_rect)
        print(f"Detected {len(original_landmarks)} facial landmarks")
        
        # Align face using Frankfort Horizontal Plane
        self.aligned_image, rotation_matrix = self.align_face(self.original_image, original_landmarks)
        print(f"Applied rotation correction: {self.rotation_angle:.2f} degrees")
        
        # Transform landmarks to aligned image coordinates
        aligned_landmarks = self.transform_landmarks(original_landmarks, rotation_matrix)
        
        # Detect new face region in aligned image (for accuracy)
        aligned_face_rect = self.detect_face(self.aligned_image)
        if aligned_face_rect is not None:
            # Re-detect landmarks for better accuracy
            aligned_landmarks = self.detect_landmarks(self.aligned_image, aligned_face_rect)
        
        self.landmarks = aligned_landmarks
        
        # Compute facial midline
        self.compute_midline(aligned_landmarks)
        print("Computed facial midline using glabella, pronasale, and menton")
        
        # Measure asymmetry
        asymmetry = self.measure_asymmetry(aligned_landmarks)
        print("\nAsymmetry Measurements:")
        for key, value in asymmetry.items():
            print(f"  {key}: {value}")
        
        # Generate annotated image
        self.annotated_image = self.draw_annotations(self.aligned_image, aligned_landmarks)
        
        # Generate heatmap
        self.heatmap_image = self.generate_asymmetry_heatmap(self.aligned_image, aligned_landmarks)

        # Advanced metrics + photo quality + skin (noão quebra o schema antigo:
        # apenas adiciona blocos novos em measurements).
        try:
            face_w = (aligned_face_rect.width() if aligned_face_rect is not None
                      else face_rect.width())
            extra = face_metrics.compute_all(self.aligned_image, aligned_landmarks, face_w)
            self.asymmetry_data['advanced']      = extra['advanced']
            self.asymmetry_data['photo_quality'] = extra['photo_quality']
            self.asymmetry_data['skin']          = extra['skin']
            print("\nAdvanced metrics computed.")
            warns = extra['photo_quality'].get('warnings') or []
            for w in warns:
                print(f"  [warn] {w}")
        except Exception as exc:  # nunca deve quebrar o pipeline antigo
            print(f"  [warn] Falha ao calcular métricas avançadas: {exc}")
        
        return {
            'success': True,
            'asymmetry': asymmetry,
            'rotation_angle': round(self.rotation_angle, 2),
            'face_rect': {
                'left': face_rect.left(),
                'top': face_rect.top(),
                'right': face_rect.right(),
                'bottom': face_rect.bottom()
            }
        }
    
    def save_outputs(self, output_dir: str, base_name: str = None,
                     save_heatmap: bool = True) -> Dict[str, str]:
        """
        Save the analysis outputs in organized subfolders.
        
        Args:
            output_dir: Base output directory for all results.
            base_name: Base name for output files (without extension).
            save_heatmap: Whether to save the heatmap visualization.
            
        Returns:
            Dictionary of saved file paths.
        """
        saved_files = {}
        
        # Create main output directory and subfolders
        subfolders = {
            'annotated': os.path.join(output_dir, '01_annotated'),
            'aligned': os.path.join(output_dir, '02_aligned'),
            'heatmap': os.path.join(output_dir, '03_heatmap'),
            'landmarks': os.path.join(output_dir, '04_landmarks'),
            'reports': os.path.join(output_dir, '05_reports'),
            'original': os.path.join(output_dir, '00_original'),
        }
        
        for folder in subfolders.values():
            os.makedirs(folder, exist_ok=True)
        
        if base_name is None:
            base_name = 'face_analysis'
        
        # Save original image
        if self.original_image is not None:
            original_path = os.path.join(subfolders['original'], f'{base_name}_original.jpg')
            cv2.imwrite(original_path, self.original_image)
            saved_files['original_image'] = original_path
            print(f"Saved original: {original_path}")
        
        # Save annotated image
        if self.annotated_image is not None:
            annotated_path = os.path.join(subfolders['annotated'], f'{base_name}_annotated.jpg')
            cv2.imwrite(annotated_path, self.annotated_image)
            saved_files['annotated_image'] = annotated_path
            print(f"Saved annotated: {annotated_path}")
        
        # Save aligned image (without annotations)
        if self.aligned_image is not None:
            aligned_path = os.path.join(subfolders['aligned'], f'{base_name}_aligned.jpg')
            cv2.imwrite(aligned_path, self.aligned_image)
            saved_files['aligned_image'] = aligned_path
            print(f"Saved aligned: {aligned_path}")
        
        # Save heatmap
        if save_heatmap and self.heatmap_image is not None:
            heatmap_path = os.path.join(subfolders['heatmap'], f'{base_name}_heatmap.jpg')
            cv2.imwrite(heatmap_path, self.heatmap_image)
            saved_files['heatmap'] = heatmap_path
            print(f"Saved heatmap: {heatmap_path}")
        
        # Save landmarks-only image
        if self.aligned_image is not None and self.landmarks is not None:
            landmarks_img = self.aligned_image.copy()
            for i, (x, y) in enumerate(self.landmarks):
                cv2.circle(landmarks_img, (int(x), int(y)), 3, COLORS['landmarks'], -1)
                cv2.putText(landmarks_img, str(i), (int(x)+3, int(y)-3), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.25, (255, 255, 255), 1)
            landmarks_path = os.path.join(subfolders['landmarks'], f'{base_name}_landmarks.jpg')
            cv2.imwrite(landmarks_path, landmarks_img)
            saved_files['landmarks_image'] = landmarks_path
            print(f"Saved landmarks: {landmarks_path}")
        
        # Save JSON report
        report = {
            'analysis_type': 'facial_asymmetry',
            'input_file': base_name,
            'rotation_correction_degrees': round(self.rotation_angle, 2),
            'measurements': self.asymmetry_data,
            'output_files': saved_files
        }
        
        json_path = os.path.join(subfolders['reports'], f'{base_name}_report.json')
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        saved_files['json_report'] = json_path
        print(f"Saved report: {json_path}")
        
        # Save text summary report
        txt_path = os.path.join(subfolders['reports'], f'{base_name}_summary.txt')
        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write("=" * 50 + "\n")
            f.write("FACIAL ASYMMETRY ANALYSIS REPORT\n")
            f.write("=" * 50 + "\n\n")
            f.write(f"Input: {base_name}\n")
            f.write(f"Rotation correction: {self.rotation_angle:.2f} degrees\n\n")
            f.write("MEASUREMENTS (in pixels):\n")
            f.write("-" * 30 + "\n")
            for key, value in self.asymmetry_data.items():
                readable_key = key.replace('_', ' ').replace(' px', '').title()
                f.write(f"{readable_key}: {value}\n")
            f.write("\n" + "=" * 50 + "\n")
        saved_files['txt_report'] = txt_path
        print(f"Saved summary: {txt_path}")
        
        return saved_files


# ============================================================================
# CLI INTERFACE
# ============================================================================

def main():
    """Main entry point for CLI usage."""
    parser = argparse.ArgumentParser(
        description='Facial Asymmetry Analysis Tool',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python face_asymmetry.py --image face.jpg --output ./results
  python face_asymmetry.py -i photo.png -o ./analysis --no-heatmap
  python face_asymmetry.py -i portrait.jpg -o ./output --predictor custom_model.dat

Output structure:
  <output_dir>/
    ├── 00_original/       # Original input image
    ├── 01_annotated/      # Annotated image with measurements
    ├── 02_aligned/        # Face-aligned image
    ├── 03_heatmap/        # Asymmetry heatmap visualization
    ├── 04_landmarks/      # Landmarks-only visualization
    └── 05_reports/        # JSON and text reports
        """
    )
    
    parser.add_argument('-i', '--image', required=True,
                        help='Path to input face image')
    parser.add_argument('-o', '--output', required=True,
                        help='Path for output directory')
    parser.add_argument('--predictor', default=PREDICTOR_PATH,
                        help=f'Path to dlib shape predictor model (default: {PREDICTOR_PATH})')
    parser.add_argument('--no-heatmap', action='store_true',
                        help='Do not generate heatmap visualization')
    
    args = parser.parse_args()
    
    try:
        # Initialize analyzer
        print("=" * 60)
        print("Facial Asymmetry Analysis Tool")
        print("=" * 60)
        
        analyzer = FaceAsymmetryAnalyzer(predictor_path=args.predictor)
        
        # Run analysis
        print(f"\nAnalyzing: {args.image}")
        print("-" * 40)
        
        results = analyzer.analyze(args.image)
        
        # Get base name from input image
        base_name = os.path.splitext(os.path.basename(args.image))[0]
        
        # Save outputs
        print("-" * 40)
        saved = analyzer.save_outputs(
            output_dir=args.output,
            base_name=base_name,
            save_heatmap=not args.no_heatmap
        )
        
        print("=" * 60)
        print("Analysis complete!")
        print(f"Overall asymmetry score: {results['asymmetry']['overall_asymmetry_score']:.2f} pixels")
        print(f"Results saved to: {args.output}")
        print("=" * 60)
        
        return 0
        
    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 2
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 3


if __name__ == '__main__':
    sys.exit(main())
