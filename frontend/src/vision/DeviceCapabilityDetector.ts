export class DeviceCapabilityDetector {
  static supportsWASM(): boolean {
    return (
      typeof WebAssembly === 'object' &&
      typeof WebAssembly.instantiate === 'function'
    );
  }

  static async meetsPerformanceThreshold(): Promise<boolean> {
    const nav = navigator as Navigator & { deviceMemory?: number };
    if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 2) return false;
    if (navigator.hardwareConcurrency < 2) return false;
    return true;
  }

  static async shouldFallback(): Promise<boolean> {
    if (!DeviceCapabilityDetector.supportsWASM()) return true;
    return !(await DeviceCapabilityDetector.meetsPerformanceThreshold());
  }
}
