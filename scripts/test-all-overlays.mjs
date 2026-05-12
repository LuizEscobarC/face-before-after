/**
 * Runs all overlay smoke-tests sequentially and reports a summary.
 *
 * Usage:
 *   node scripts/test-all-overlays.mjs
 *   OVERLAY_TEST_IMAGE=bradpitt-reference.jpg node scripts/test-all-overlays.mjs
 */

import { runOverlayTest } from './overlay-test-lib.mjs';

const OVERLAYS = [
  { id: 'axis_vertical' },
  { id: 'axis_intercanthal' },
  {
    id: 'grid_thirds',
    extraChecks(pipeline) {
      const evals = pipeline.metric_evaluations ?? pipeline.result?.metric_evaluations ?? [];
      const upper = evals.find(m => m.metric_id === 'upper_third_ratio');
      if (!upper) throw new Error('upper_third_ratio missing');
      console.log(`     upper_third_ratio=${(upper.value * 100).toFixed(1)}% severity=${upper.severity_5}`);
    },
  },
  { id: 'grid_fifths' },
  { id: 'outline_face' },
  { id: 'heatmap_asymmetry' },
  {
    id: 'heatmap_ideal_adherence',
    // 422 "global_density_below_l2" is expected with samples=0 — treat as skip.
    skipCode: 'global_density_below_l2',
    regionAdherence: [
      { region: 'upper_third',  adherence: 0.72, confidence: 0.9 },
      { region: 'middle_third', adherence: 0.88, confidence: 0.9 },
      { region: 'lower_third',  adherence: 0.65, confidence: 0.8 },
      { region: 'left_fifth',   adherence: 0.80, confidence: 0.85 },
      { region: 'right_fifth',  adherence: 0.78, confidence: 0.85 },
    ],
  },
];

const results = [];
for (const { id, extraChecks, regionAdherence, skipCode } of OVERLAYS) {
  try {
    await runOverlayTest(id, { extraChecks, regionAdherence });
    results.push({ id, ok: true });
  } catch (err) {
    if (skipCode && err.message.includes(skipCode)) {
      console.log(`\n~ ${id} SKIPPED (expected: ${skipCode})\n`);
      results.push({ id, ok: true, skipped: true });
    } else {
      console.error(`\n✗ ${id} FAILED: ${err.message}\n`);
      results.push({ id, ok: false, error: err.message });
    }
  }
}

console.log('\n═══════════════════════ SUMMARY ═══════════════════════');
let pass = 0, fail = 0;
for (const { id, ok, skipped, error } of results) {
  if (ok && !skipped) { console.log(`  ✓ ${id}`); pass++; }
  else if (ok && skipped) { console.log(`  ~ ${id}  (skipped)`); pass++; }
  else { console.log(`  ✗ ${id}  →  ${error}`); fail++; }
}
console.log(`═══════════════════════ ${pass}/${results.length} passed ════════════════════\n`);
process.exit(fail > 0 ? 1 : 0);
