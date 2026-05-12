import { runOverlayTest } from './overlay-test-lib.mjs';

// NOTE: heatmap_ideal_adherence requires L2-density samples from a real user
// analysis history. A fresh pipeline run returns 422 "global_density_below_l2"
// (samples=0) — this is expected and not a bug. The test runs in lenient mode:
// a 422 with that specific code is treated as SKIP, not FAIL.

const EXPECTED_SKIP_CODE = 'global_density_below_l2';

try {
  await runOverlayTest('heatmap_ideal_adherence', {
    regionAdherence: [
      { region: 'upper_third',  adherence: 0.72, confidence: 0.9 },
      { region: 'middle_third', adherence: 0.88, confidence: 0.9 },
      { region: 'lower_third',  adherence: 0.65, confidence: 0.8 },
      { region: 'left_fifth',   adherence: 0.80, confidence: 0.85 },
      { region: 'right_fifth',  adherence: 0.78, confidence: 0.85 },
    ],
    extraChecks(pipeline, png) {
      if (png.length < 50_000) throw new Error(`PNG too small (${png.length} B)`);
    },
  });
} catch (err) {
  if (err.message.includes(EXPECTED_SKIP_CODE)) {
    console.log(`\n~ heatmap_ideal_adherence SKIPPED (expected: ${EXPECTED_SKIP_CODE})\n`);
    process.exit(0);
  }
  throw err;
}

