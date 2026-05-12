import { runOverlayTest } from './overlay-test-lib.mjs';

await runOverlayTest('axis_vertical', {
  extraChecks(pipeline, png) {
    // Axis must be present: PNG > 50 KB (image is not blank)
    if (png.length < 50_000) throw new Error(`PNG too small (${png.length} B) — overlay may be blank`);
  },
});
