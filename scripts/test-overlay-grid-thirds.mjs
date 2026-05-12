import { runOverlayTest } from './overlay-test-lib.mjs';

await runOverlayTest('grid_thirds', {
  extraChecks(pipeline, png) {
    // Metric evaluations must include thirds
    const evals = pipeline.metric_evaluations ?? pipeline.result?.metric_evaluations ?? [];
    const hasUpperThird = evals.some(m => m.metric_id === 'upper_third_ratio');
    if (!hasUpperThird) throw new Error('upper_third_ratio missing from metric_evaluations');
    const upper = evals.find(m => m.metric_id === 'upper_third_ratio');
    if (typeof upper.value !== 'number' || upper.value <= 0 || upper.value >= 1) {
      throw new Error(`upper_third_ratio value out of range: ${upper.value}`);
    }
    console.log(`     upper_third_ratio=${(upper.value * 100).toFixed(1)}% severity=${upper.severity_5}`);
  },
});
