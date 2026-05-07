import { expose } from 'comlink';
import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from '@mediapipe/tasks-vision';

export type LandmarkPayload = {
  landmarks: number[][];
  pose: { yaw: number; pitch: number; roll: number };
  processing_mode: 'CLIENT_SIDE';
};

export type FeedbackResult = {
  face_detected: boolean;
  pose_ok: boolean;
  light_ok: boolean;
};

let imageLandmarker: FaceLandmarker | null = null;
let videoLandmarker: FaceLandmarker | null = null;

async function initialize(modelUrl: string): Promise<void> {
  const filesetResolver = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm',
  );

  imageLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: { modelAssetPath: modelUrl, delegate: 'GPU' },
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
    runningMode: 'IMAGE',
    numFaces: 1,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  videoLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: { modelAssetPath: modelUrl, delegate: 'GPU' },
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
    runningMode: 'VIDEO',
    numFaces: 1,
    minFaceDetectionConfidence: 0.4,
    minFacePresenceConfidence: 0.4,
    minTrackingConfidence: 0.4,
  });
}

function extractPixelLandmarks(
  result: FaceLandmarkerResult,
  width: number,
  height: number,
): number[][] {
  if (!result.faceLandmarks || result.faceLandmarks.length === 0) return [];
  return result.faceLandmarks[0].map((pt) => [pt.x * width, pt.y * height]);
}

// Simplified pose estimation using 6 PnP anchor landmarks.
// Indices: 1=nose tip, 152=chin, 33=left eye outer, 263=right eye outer,
// 61=left mouth, 291=right mouth — same anchors used server-side.
function estimatePose(landmarks: number[][]): { yaw: number; pitch: number; roll: number } {
  if (landmarks.length < 292) return { yaw: 0, pitch: 0, roll: 0 };

  const noseTip = landmarks[1];
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const menton = landmarks[152];

  const eyeWidth = rightEye[0] - leftEye[0];
  const eyeMidX = (leftEye[0] + rightEye[0]) / 2;
  const eyeMidY = (leftEye[1] + rightEye[1]) / 2;

  const yaw = eyeWidth > 0 ? ((noseTip[0] - eyeMidX) / eyeWidth) * 45 : 0;
  const pitch =
    menton[1] - eyeMidY > 0
      ? ((noseTip[1] - eyeMidY) / (menton[1] - eyeMidY) - 0.5) * 30
      : 0;
  const roll = (Math.atan2(rightEye[1] - leftEye[1], rightEye[0] - leftEye[0]) * 180) / Math.PI;

  return { yaw, pitch, roll };
}

async function detectLandmarks(imageData: ImageData): Promise<LandmarkPayload | null> {
  if (!imageLandmarker) throw new Error('Landmarker not initialized. Call initialize() first.');
  // @mediapipe/tasks-vision accepts ImageData in non-DOM (Worker) contexts
  const result = imageLandmarker.detect(imageData as unknown as Parameters<FaceLandmarker['detect']>[0]);
  const landmarks = extractPixelLandmarks(result, imageData.width, imageData.height);
  if (landmarks.length === 0) return null;
  const pose = estimatePose(landmarks);
  return { landmarks, pose, processing_mode: 'CLIENT_SIDE' };
}

let lastVideoTimestamp = -1;

async function analyzeVideoFrame(imageData: ImageData): Promise<FeedbackResult | null> {
  if (!videoLandmarker) throw new Error('Video landmarker not initialized. Call initialize() first.');
  const timestamp = Date.now();
  if (timestamp <= lastVideoTimestamp) return null;
  lastVideoTimestamp = timestamp;

  const result = videoLandmarker.detectForVideo(
    imageData as unknown as Parameters<FaceLandmarker['detectForVideo']>[0],
    timestamp,
  );

  const faceDetected = (result.faceLandmarks?.length ?? 0) > 0;
  if (!faceDetected) return { face_detected: false, pose_ok: false, light_ok: false };

  const landmarks = extractPixelLandmarks(result, imageData.width, imageData.height);
  const pose = estimatePose(landmarks);
  const poseOk =
    Math.abs(pose.yaw) < 15 &&
    Math.abs(pose.pitch) < 15 &&
    Math.abs(pose.roll) < 10;

  // TODO: compute actual brightness from ImageData pixel values around nose region
  const lightOk = true;

  return { face_detected: true, pose_ok: poseOk, light_ok: lightOk };
}

expose({ initialize, detectLandmarks, analyzeVideoFrame });
