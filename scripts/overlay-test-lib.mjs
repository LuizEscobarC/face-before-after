/**
 * Shared helpers for overlay smoke-tests.
 *
 * Each overlay test script calls runOverlayTest(overlayId, checks?) which:
 *   1. Uploads a reference image to POST /vision/full-pipeline/upload
 *   2. Posts the returned landmarks + image to POST /vision/render
 *   3. Asserts the response is a PNG of the expected size
 *   4. Runs optional pixel-level checks supplied by the caller
 *   5. Saves the PNG to review/<stem>/<stem>_<overlayId>.mjs.png
 *
 * Usage (in each test script):
 *   import { runOverlayTest } from './overlay-test-lib.mjs';
 *   await runOverlayTest('axis_vertical');
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const API_BASE = process.env.VISION_API ?? 'http://localhost:9015';

// Reference image used by all overlay tests.
// Override via env: OVERLAY_TEST_IMAGE=path/to/photo.jpg node test-xxx.mjs
const DEFAULT_IMAGE = resolve(
  fileURLToPath(import.meta.url),
  '../../rosto_exemplo.jpg',
);
const TEST_IMAGE = process.env.OVERLAY_TEST_IMAGE ?? DEFAULT_IMAGE;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fetch with a hard timeout (ms). */
async function fetchWithTimeout(url, options = {}, timeoutMs = 30_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Assert a condition; throw with message on failure. */
function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

/** Read the first 8 bytes of a Buffer and verify PNG magic bytes. */
function isPngBuffer(buf) {
  const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return PNG_SIG.every((b, i) => buf[i] === b);
}

// ---------------------------------------------------------------------------
// Step 1 — full pipeline (get landmarks + metric_evaluations + trichion)
// ---------------------------------------------------------------------------
async function runFullPipeline(imagePath) {
  const imageBytes = readFileSync(imagePath);
  const ext = extname(imagePath).replace('.', '') || 'jpeg';
  const form = new FormData();
  form.append('photo', new Blob([imageBytes], { type: `image/${ext}` }), basename(imagePath));
  form.append('mode', 'premium');

  const res = await fetchWithTimeout(`${API_BASE}/vision/full-pipeline/upload`, {
    method: 'POST',
    body: form,
  }, 60_000);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`full-pipeline/upload returned ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Step 2 — render overlay
// ---------------------------------------------------------------------------
async function renderOverlay(imagePath, landmarks, overlayId, regionAdherence = null) {
  const imageBytes = readFileSync(imagePath);
  const ext = extname(imagePath).replace('.', '') || 'jpeg';
  const form = new FormData();
  form.append('image', new Blob([imageBytes], { type: `image/${ext}` }), basename(imagePath));
  form.append('landmarks_json', JSON.stringify(landmarks));
  form.append('overlay_ids_json', JSON.stringify([overlayId]));
  if (regionAdherence !== null) {
    form.append('region_adherence_json', JSON.stringify(regionAdherence));
  }

  const res = await fetchWithTimeout(`${API_BASE}/vision/render`, {
    method: 'POST',
    body: form,
  }, 30_000);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`/vision/render returned ${res.status}: ${text.slice(0, 300)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * @param {string} overlayId - one of the supported overlay IDs
 * @param {object} [opts]
 * @param {Function} [opts.extraChecks] - (pipelineResult, pngBuf) => void; throw to fail
 * @param {Array}    [opts.regionAdherence] - required for heatmap_ideal_adherence
 */
export async function runOverlayTest(overlayId, opts = {}) {
  const { extraChecks, regionAdherence = null } = opts;
  const imagePath = TEST_IMAGE;
  const stem = basename(imagePath, extname(imagePath));

  console.log(`\n[${overlayId}] image: ${basename(imagePath)}`);

  // Step 1: pipeline
  process.stdout.write('  1/3 full-pipeline/upload ... ');
  const pipeline = await runFullPipeline(imagePath);
  const lm = pipeline.landmarks ?? pipeline.result?.landmarks;
  assert(Array.isArray(lm) && lm.length === 478, `Expected 478 landmarks, got ${lm?.length}`);
  console.log(`OK (${lm.length} lm, source=${pipeline.trichion_source ?? pipeline.result?.trichion_source})`);

  // Step 2: render
  process.stdout.write(`  2/3 /vision/render [${overlayId}] ... `);
  const pngBuf = await renderOverlay(imagePath, lm, overlayId, regionAdherence);
  assert(isPngBuffer(pngBuf), 'Response is not a valid PNG');
  assert(pngBuf.length > 1024, `PNG suspiciously small: ${pngBuf.length} bytes`);
  console.log(`OK (${(pngBuf.length / 1024).toFixed(0)} KB)`);

  // Step 3: save
  const outDir = resolve(fileURLToPath(import.meta.url), `../../review/${stem}`);
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `${stem}_${overlayId}_mjs.png`);
  writeFileSync(outPath, pngBuf);
  process.stdout.write(`  3/3 saved → ${outPath.replace(process.cwd() + '/', '')} ... `);

  // Optional pixel-level checks
  if (extraChecks) extraChecks(pipeline, pngBuf);
  console.log('OK');

  console.log(`\n✓ ${overlayId} PASSED\n`);
  return { pipeline, pngBuf, outPath };
}

export { API_BASE, TEST_IMAGE };
