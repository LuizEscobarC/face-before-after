/**
 * PR-30 — M3.1 Overlay Catalog types
 *
 * Mirrors Postgres ENUMs declared in migration
 * ``1746000160000-M3OverlayCatalog.ts`` so the TS layer has a single source
 * of truth for valid overlay categories and rendered asset types/formats.
 *
 * References
 * ----------
 *  - PLAN_M3_OVERLAYS.md §2 (overlay catalog scope)
 *  - PLAN_DDL_REVIEW.md §3 (overlay layer)
 */

export const OVERLAY_CATEGORIES = [
  'axis',
  'grid',
  'contour',
  'mask',
  'vector',
  'heatmap',
  'label',
] as const;
export type OverlayCategory = (typeof OVERLAY_CATEGORIES)[number];

export const RENDERED_ASSET_TYPES = [
  'single_annotated',
  'region_gallery_item',
  'before_ideal_composition',
  'heatmap_asymmetry',
  'heatmap_ideal_adherence',
  'report_pdf',
] as const;
export type RenderedAssetType = (typeof RENDERED_ASSET_TYPES)[number];

export const RENDERED_ASSET_FORMATS = ['png', 'jpg', 'svg', 'pdf'] as const;
export type RenderedAssetFormat = (typeof RENDERED_ASSET_FORMATS)[number];

/**
 * Shape of ``overlay_definition.rendering_hints`` JSONB column.
 * Frontend consumes this as SVG attribute hints; server raster renderer
 * also reads stroke / fill / dash hints. Free-form because future overlays
 * (heatmap colormap, vector arrowhead size) carry richer payloads.
 */
export type RenderingHints = Record<string, string | number | boolean | null>;
