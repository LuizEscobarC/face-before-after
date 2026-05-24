---
tenant_id: "face-before-after"
project: "face-before-after"
module: "plans/STATUS_LEDGER"
file_path: ".claude/local/plans/STATUS_LEDGER_2026-05-24.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Canonical truth-table for every per-PR plan under .claude/local/plans/.
  Verified against backend/app/, nest/src/, frontend/src/ on 2026-05-24.
  Use this to resolve any contradiction between an individual plan file and the code.
tags: ["planning", "status", "ledger"]
rag_keywords: ["status", "ledger", "PR", "plans"]
related_modules: []
depends_on: []
used_by: []
---

# Status Ledger — 2026-05-24

> Verified canonical state. Each plan file in `.claude/local/plans/` carries a
> banner pointing here. If a plan body contradicts this ledger, **the ledger wins**.

## Verified deliverables

| Plan file | PR | Status | Evidence in code |
|---|---|---|---|
| `bisenet-hairline-integration-2026-05-12.md` | BiSeNet | ✅ DONE | `backend/app/services/segmentation/bisenet_segmenter.py`, `services/landmarks/fusion_layer.py`, `metrics/thirds.py` lines 73-158, `domain/pipeline.py` 1222/1274/1414/1437 |
| `bisenet-ideal-proportions-zones-fix-2026-05-12.md` | BiSeNet fix | ✅ DONE | `trichion_source` propagation lands in pipeline; ideal zones consume fused trichion |
| `landmark-driven-face-rig-2026-05-11.md` | PR-64 | ✅ DONE | `LandmarkRig.tsx`, `normalizeLandmarks.ts`, `oneEuroFilter.ts` (frontmatter already says DONE) |
| `landmark-toggle-bar-refactor-2026-05-12.md` | PR-66 | ✅ DONE | commit `4cc9512` "toggle bar refact" |
| `implementation-summary-pr66.md` | PR-66 | ✅ DONE | self-attests; backend glossary + paginated findings shipped |
| `ideal-proportions-anatomical-2026-05-12.md` | M3.x | ✅ DONE | landmark-driven ideal zones live in `IdealProportionsLayer` |
| `pr57-recommendation-engine-ladder-2026-05-24.md` | PR-57 | ✅ DONE | `nest/src/modules/diagnosis/recommendation-engine.service.ts` lines 199, 270, 318, 347 — ladder rule + invasiveness gate implemented |
| `pr53b-pr54-30-metrics-2026-05-11.md` | PR-53b + PR-54 | 🟡 PARTIAL | Phases A+B (336 templates + tone review) ✅ done. **Phase C (30 new metrics) NOT done** — `backend/app/services/metrics/*.py` count = 19, not 49. |
| `overlays-tasks-3-4-5-2026-05-12.md` | M3 tasks 3-4-5 | ✅ DONE | M3.1-M3.4 overlays + heatmaps + before/ideal all live (see commits `2140a7e`, `d95e218`, `d861a4e`, `8d5e4e2`) |
| `refactor-overlays-central-backend-2026-05-12.md` | Overlays Padrão 3 | ✅ DONE (PLAN_A + PLAN_B) | A.2 verified at `IdealProportionsLayer.tsx:140-156`; B.1 at `annotations.py:325`; B.2/B.3 at `AsymmetryAnalysisLayer.tsx` + `PremiumResultPage.tsx:935-940`. Residual cleanup only: `*_mvp_annotated.jpg` background still served. PLAN_D (dropdown) deferred. |
| `o-pdf-ainda-n-o-lovely-salamander.md` | PDF persistence fix | ✅ DONE | PDF builder (`backend/app/vision/services/pdf_builder.py`) shipped in PR-67/68/69 |
| `crystalline-growing-sundae.md` | Doc/RAG plan | 🟡 IN PROGRESS | Documentation pipeline for `.claude/local/context/` — active work as of this date |

## Known sujeira (do NOT plan against these)

1. **`backend/app/services/scoring/` does not exist.** Any plan step referencing this path is stale — scoring lives inline in `nest/src/modules/diagnosis/` and in metric calculators under `backend/app/services/metrics/`.
2. **`*_mvp_annotated.jpg` legacy endpoint** still served (`vision/routers/results.py:61,72`) and used as background image in `FreeResultPage.tsx:72` and `PremiumResultPage.tsx:641`. The SVG overlay layer renders correctly on top; this is a cleanup task (remove burned-in OpenCV annotations from the JPG and switch background to canonical), not a plan-scope item.
3. **Phase C of PR-53b/PR-54** (30 new metrics) was never executed. Metric file count is 19 (`backend/app/services/metrics/`). If a future plan re-opens Phase C, it must list exactly which 30 metrics and where they slot.
4. **PR-21 v1.5 remains provisional** (`is_active=FALSE`, `is_provisional=TRUE`). Promotion to v2.0 is gated on **PR-22** (real-photo calibration — human task, see `marcos/M2_PR22_real_photos.md`).
5. **`aesthetic_procedure` recommendations** never fully populated. PR-56 phases 1-3 (427 recos) ✅; "PR-56b" for botox/fillers/PDO was never opened.

## How to use this ledger

- **Before quoting a plan as authoritative:** check this ledger.
- **Before reopening a plan as a task:** check this ledger — it may already be ✅.
- **When updating after a new PR lands:** add a row here and bump the banner in the affected plan.

## Subdirs (not re-audited; trust frontmatter)

- `marcos/` — M2_BACKLOG, M2_PR21, M2_PR22, M3_OVERLAYS. Authoritative for their marco.
- `archive/` — superseded / sessions / brainstorms. Do not read for current state.
- `13-05-2025/` and `overlays/` — older sub-plans, status inherited from their PR row above.
