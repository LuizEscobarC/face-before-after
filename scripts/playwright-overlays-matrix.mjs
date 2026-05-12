#!/usr/bin/env node

import path from "node:path";
import { spawnSync } from "node:child_process";

const BASE_URL = process.env.PW_BASE_URL || "http://localhost:9016";
const OUT_ROOT = process.env.PW_OUT_ROOT || path.resolve(process.cwd(), "review", "playwright-matrix");

const cliImages = process.argv.slice(2);
const images = cliImages.length > 0
  ? cliImages
  : ["rosto_exemplo.jpg", "bradpitt-reference.jpg"].filter(Boolean);

if (!images.length) {
  console.error("Nenhuma imagem informada.");
  process.exit(1);
}

let failures = 0;

for (const img of images) {
  const safe = path.basename(img).replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
  const outDir = path.join(OUT_ROOT, safe);

  console.log(`\n=== Playwright E2E: ${img} ===`);

  const result = spawnSync(
    process.execPath,
    [path.resolve(process.cwd(), "scripts", "playwright-overlays-e2e.mjs")],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        PW_BASE_URL: BASE_URL,
        PW_IMAGE: path.resolve(process.cwd(), img),
        PW_OUT_DIR: outDir,
      },
    },
  );

  if (result.status !== 0) {
    failures += 1;
    console.error(`FALHA: ${img}`);
  } else {
    console.log(`OK: ${img}`);
  }
}

if (failures > 0) {
  console.error(`\nResumo: ${failures} imagem(ns) com falha.`);
  process.exit(1);
}

console.log("\nResumo: todas as imagens passaram.");
