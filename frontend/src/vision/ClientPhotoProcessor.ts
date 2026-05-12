import { wrap, type Remote } from 'comlink';
import type { LandmarkPayload, FeedbackResult } from './mediapipe.worker';

type WorkerApi = {
  initialize(modelUrl: string): Promise<void>;
  detectLandmarks(imageData: ImageData): Promise<LandmarkPayload | null>;
  analyzeVideoFrame(imageData: ImageData): Promise<FeedbackResult | null>;
};

export type { LandmarkPayload, FeedbackResult };

export class ClientPhotoProcessor {
  private constructor(
    private readonly worker: Worker,
    private readonly workerProxy: Remote<WorkerApi>,
  ) {}

  static async create(): Promise<ClientPhotoProcessor> {
    const worker = new Worker(
      new URL('./mediapipe.worker.ts', import.meta.url),
    );
    const workerProxy = wrap<WorkerApi>(worker);
    const modelUrl = `${window.location.origin}/models/face_landmarker.task`;
    await workerProxy.initialize(modelUrl);
    return new ClientPhotoProcessor(worker, workerProxy);
  }

  async runMediaPipe(imageData: ImageData): Promise<LandmarkPayload | null> {
    return this.workerProxy.detectLandmarks(imageData);
  }

  async validateRealtimeFeedback(imageData: ImageData): Promise<FeedbackResult | null> {
    return this.workerProxy.analyzeVideoFrame(imageData);
  }

  dispose(): void {
    this.worker.terminate();
  }
}
