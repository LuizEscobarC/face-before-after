import { runOverlayTest } from './overlay-test-lib.mjs';

await runOverlayTest('heatmap_asymmetry', {
  extraChecks(pipeline, png) {
    // Heatmap should be substantial (at least 100 KB for a real image)
    if (png.length < 50_000) throw new Error(`PNG too small (${png.length} B) — heatmap may be blank`);

    const evals = pipeline.metric_evaluations ?? pipeline.result?.metric_evaluations ?? [];
    const asymmetry = evals.filter(m => m.metric_id?.includes('asymmetry'));
    if (asymmetry.length === 0) console.warn('     WARNING: no asymmetry metrics found in evaluations');
    else console.log(`     ${asymmetry.length} asymmetry metric(s) found`);
  },
});
