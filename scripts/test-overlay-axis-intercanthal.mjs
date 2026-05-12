import { runOverlayTest } from './overlay-test-lib.mjs';

await runOverlayTest('axis_intercanthal', {
  extraChecks(pipeline, png) {
    if (png.length < 50_000) throw new Error(`PNG too small (${png.length} B) — overlay may be blank`);
  },
});
