export const VISION_CLIENT_CONFIG = Symbol('VISION_CLIENT_CONFIG');

export interface VisionClientConfig {
  baseUrl: string;
  timeoutMs: number;
}

export function loadVisionClientConfig(): VisionClientConfig {
  return {
    baseUrl: process.env.VISION_SERVICE_URL ?? 'http://vision-service:8000',
    timeoutMs: parseInt(process.env.VISION_SERVICE_TIMEOUT_MS ?? '30000', 10),
  };
}
