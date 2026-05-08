/**
 * ScoreBander — pure domain service (PR-12 / DEC-9).
 *
 * Maps a numeric score 0..100 to a UI-facing band:
 *   <50      → no_number (UI hides the digit, shows "explore harmonização")
 *   [50, 70) → refine    (UI shows number + "rosto com aspectos a refinar")
 *   [70, 85) → good      (UI shows number + "boa harmonia geral")
 *   [85, 100]→ high      (UI shows number + "alta harmonia")
 *
 * Null scores have no band (return null).
 */

import { Injectable } from '@nestjs/common';
import type { ScoreBand } from '../infrastructure/entities/global-score.entity.js';

@Injectable()
export class ScoreBander {
  band(score: number | null): ScoreBand | null {
    if (score === null) return null;
    if (Number.isNaN(score)) return null;
    if (score < 50) return 'no_number';
    if (score < 70) return 'refine';
    if (score < 85) return 'good';
    return 'high';
  }
}
