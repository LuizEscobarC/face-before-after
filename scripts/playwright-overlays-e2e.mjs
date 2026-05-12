#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.PW_BASE_URL || "http://localhost:9016";
const IMAGE_PATH = process.env.PW_IMAGE || path.resolve(process.cwd(), "rosto_exemplo.jpg");
const OUT_DIR = process.env.PW_OUT_DIR || path.resolve(process.cwd(), "review", "playwright");
const HEADLESS = (process.env.PW_HEADLESS || "true").toLowerCase() !== "false";

function assertOrThrow(condition, message) {
  if (!condition) throw new Error(message);
}

function toNum(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function safeBox(locator) {
  try {
    return await locator.boundingBox();
  } catch {
    return null;
  }
}

async function clickView(page, viewRegex) {
  const button = page.getByRole("button", { name: viewRegex }).first();
  await button.click();
  await page.waitForTimeout(900);
}

async function checkSideBySide(page, sidebarSelector, label) {
  const stage = page.locator(".overlay-stage").first();
  const media = page.locator(".overlay-media").first();
  const sidebar = page.locator(sidebarSelector).first();

  assertOrThrow(await stage.count(), `${label}: .overlay-stage nao encontrado`);
  assertOrThrow(await media.count(), `${label}: .overlay-media nao encontrado`);
  assertOrThrow(await sidebar.count(), `${label}: sidebar nao encontrado (${sidebarSelector})`);

  const mediaBox = await safeBox(media);
  const sidebarBox = await safeBox(sidebar);

  assertOrThrow(!!mediaBox, `${label}: nao foi possivel ler bbox da imagem`);
  assertOrThrow(!!sidebarBox, `${label}: nao foi possivel ler bbox do sidebar`);

  const sideBySide = sidebarBox.x >= mediaBox.x + mediaBox.width - 2;
  const notBelow = sidebarBox.y <= mediaBox.y + 24;

  assertOrThrow(sideBySide, `${label}: sidebar nao esta ao lado da imagem`);
  assertOrThrow(notBelow, `${label}: sidebar esta deslocado para baixo`);

  return {
    media: {
      x: toNum(mediaBox.x),
      y: toNum(mediaBox.y),
      width: toNum(mediaBox.width),
      height: toNum(mediaBox.height),
    },
    sidebar: {
      x: toNum(sidebarBox.x),
      y: toNum(sidebarBox.y),
      width: toNum(sidebarBox.width),
      height: toNum(sidebarBox.height),
    },
  };
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  assertOrThrow(fs.existsSync(IMAGE_PATH), `Imagem nao encontrada: ${IMAGE_PATH}`);

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const report = {
    baseUrl: BASE_URL,
    imagePath: IMAGE_PATH,
    headless: HEADLESS,
    checks: {},
    screenshots: [],
  };

  try {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });

    await page.getByRole("button", { name: /Premium/i }).first().click();
    await page.locator('input[type="file"]').first().setInputFiles(IMAGE_PATH);

    await page.getByRole("button", { name: /Gerar resultado Premium/i }).first().click();
    await page.waitForURL(/\/resultado\/premium/, { timeout: 120000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});

    const shotHome = path.join(OUT_DIR, "01-premium-result-default.png");
    await page.screenshot({ path: shotHome, fullPage: false });
    report.screenshots.push(shotHome);

    // IDEAL PROPORTIONS VIEW
    await clickView(page, /Propor.*ideais/is);
    const idealGeometry = await checkSideBySide(page, ".overlay-sidebars-ideal", "ideal");
    const shotIdeal = path.join(OUT_DIR, "02-ideal-proportions.png");
    await page.screenshot({ path: shotIdeal, fullPage: false });
    report.screenshots.push(shotIdeal);
    report.checks.ideal = {
      status: "ok",
      ...idealGeometry,
    };

    // OVERLAYS VIEW
    await clickView(page, /Overlays/is);
    const overlaysGeometry = await checkSideBySide(page, ".overlay-sidebars", "overlays");

    const imgBoxBefore = await safeBox(page.locator(".overlay-media img").first());
    assertOrThrow(!!imgBoxBefore, "overlays: imagem base nao encontrada para check de heatmap");

    // Toggle heatmap to ensure no horizontal expansion / covering
    const heatmapButton = page.getByRole("button", { name: /Mapa de calor.*assimetria/i }).first();
    if (await heatmapButton.count()) {
      await heatmapButton.click();
      await page.waitForTimeout(700);
      const imgBoxAfter = await safeBox(page.locator(".overlay-media img").first());
      assertOrThrow(!!imgBoxAfter, "overlays: imagem base nao encontrada apos heatmap toggle");

      const widthDrift = Math.abs(imgBoxAfter.width - imgBoxBefore.width);
      const xDrift = Math.abs(imgBoxAfter.x - imgBoxBefore.x);

      assertOrThrow(widthDrift <= 2.5, `overlays: heatmap alterou largura da imagem (${toNum(widthDrift)}px)`);
      assertOrThrow(xDrift <= 2.5, `overlays: heatmap deslocou imagem no eixo X (${toNum(xDrift)}px)`);

      report.checks.heatmap = {
        status: "ok",
        widthDriftPx: toNum(widthDrift),
        xDriftPx: toNum(xDrift),
      };
    } else {
      report.checks.heatmap = {
        status: "skipped",
        reason: "botao de heatmap nao encontrado",
      };
    }

    const shotOverlays = path.join(OUT_DIR, "03-overlays.png");
    await page.screenshot({ path: shotOverlays, fullPage: false });
    report.screenshots.push(shotOverlays);
    report.checks.overlays = {
      status: "ok",
      ...overlaysGeometry,
    };

    // Compare view smoke
    await clickView(page, /Comparativo/is);
    const compareSlider = page.locator(".ba-slider").first();
    assertOrThrow(await compareSlider.count(), "compare: slider nao encontrado");
    report.checks.compare = { status: "ok" };

    const shotCompare = path.join(OUT_DIR, "04-compare.png");
    await page.screenshot({ path: shotCompare, fullPage: false });
    report.screenshots.push(shotCompare);

    // Landmarks view smoke
    await clickView(page, /Mapa de m.*tricas/is);
    const anyImage = page.locator("img").first();
    assertOrThrow(await anyImage.count(), "landmarks: imagem nao encontrada");
    report.checks.landmarks = { status: "ok" };

    const reportPath = path.join(OUT_DIR, "playwright-overlays-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");

    console.log("OK: fluxo Playwright concluido");
    console.log(`- Report: ${reportPath}`);
    console.log(`- Screenshots: ${OUT_DIR}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

run().catch((err) => {
  console.error("FALHA:", err.message || err);
  process.exit(1);
});
