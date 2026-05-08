/**
 * PR-51 — TemplateRendererService (M4.1)
 *
 * Renders a diagnostic template string by substituting `{placeholder}` tokens
 * with values from a context object. Strict — fails fast on:
 *
 *   1. Any `{x}` token in the template that is NOT declared in
 *      `placeholders_used` (the template's own contract from migration
 *      `1746000180000-M41DiagnosticTemplates.ts`).
 *   2. Any declared placeholder that is NOT in the global allowlist
 *      (`ALLOWED_PLACEHOLDERS`).
 *   3. Any declared placeholder that is missing from the runtime `context`
 *      (so we never silently render `{value}` literally).
 *   4. Any `context` key that is not in `placeholders_used` (defensive: blocks
 *      accidental injection of arbitrary fields into a future template version).
 *
 * Rationale (PLAN_M4_NARRATIVE §1.1, §2 M4.1 backlog, DEC-30..DEC-34, DEC-40)
 * --------------------------------------------------------------------------
 * Templates power the user-facing narrative. A silent placeholder leak (e.g.
 * leaving `{value}` literal in production) would damage trust. A renderer that
 * accepts arbitrary placeholders would let a future bad template (or a bad CMS
 * import) introduce unsanitised text. Therefore the renderer's allowlist is
 * the second barrier (DDL CHECK on `placeholders_used` would be the first
 * if/when we tighten v0.2).
 *
 * Allowlist (v1)
 * --------------
 *   - `value`            — formatted metric value (string, already localised)
 *   - `ideal`            — formatted ideal value (string)
 *   - `deviation_pct`    — formatted % deviation from ideal (string, no `%` suffix)
 *   - `direction_label`  — pt-BR direction label (e.g. "para a direita")
 *   - `region_pt`        — pt-BR region label (e.g. "região dos olhos")
 *
 * Future placeholders go through a code review + a new ALLOWED_PLACEHOLDERS entry.
 *
 * References
 * ----------
 *   - PLAN_M4_NARRATIVE.md §1.1 (linha vermelha), §2 (PR-51 row), §3 (DEC-40)
 *   - Migration 1746000180000-M41DiagnosticTemplates.ts (placeholders_used contract)
 *   - PLAN_METRICS.md §0 (PR-51 row, M4.1 sub-marco)
 */
import { Injectable } from '@nestjs/common';

/** Allowlist of placeholder names accepted by the renderer (v1). */
export const ALLOWED_PLACEHOLDERS: readonly string[] = Object.freeze([
  'value',
  'ideal',
  'deviation_pct',
  'direction_label',
  'region_pt',
]);

/** Matches `{placeholder_name}` tokens in template strings. */
const PLACEHOLDER_TOKEN_REGEX = /\{([a-z_][a-z0-9_]*)\}/g;

/** Thrown when a template or context violates the renderer contract. */
export class TemplateRenderError extends Error {
  constructor(
    public readonly code:
      | 'undeclared_placeholder'
      | 'placeholder_not_allowed'
      | 'missing_context_value'
      | 'extraneous_context_key',
    message: string,
  ) {
    super(message);
    this.name = 'TemplateRenderError';
  }
}

export interface RenderInput {
  /** The raw template string from `diagnostic_template.template_pt`. */
  template: string;
  /** The `placeholders_used` JSONB array from the same row. */
  placeholdersUsed: readonly string[];
  /** Runtime values, one per declared placeholder. */
  context: Readonly<Record<string, string | number>>;
}

@Injectable()
export class TemplateRendererService {
  /**
   * Render a template. See class header for failure modes.
   * Returns the substituted string. Never throws on render itself — only on
   * contract violations (caller bug or bad data).
   */
  public render(input: RenderInput): string {
    const { template, placeholdersUsed, context } = input;

    // Gate 1: every declared placeholder must be in the global allowlist.
    for (const declared of placeholdersUsed) {
      if (!ALLOWED_PLACEHOLDERS.includes(declared)) {
        throw new TemplateRenderError(
          'placeholder_not_allowed',
          `Placeholder "${declared}" is not in ALLOWED_PLACEHOLDERS. Allowed: ${ALLOWED_PLACEHOLDERS.join(', ')}.`,
        );
      }
    }

    // Gate 2: every {x} token in the template must be declared.
    const tokensInTemplate = new Set<string>();
    for (const match of template.matchAll(PLACEHOLDER_TOKEN_REGEX)) {
      tokensInTemplate.add(match[1]);
    }
    for (const token of tokensInTemplate) {
      if (!placeholdersUsed.includes(token)) {
        throw new TemplateRenderError(
          'undeclared_placeholder',
          `Template references "{${token}}" but it is not in placeholders_used (${JSON.stringify(placeholdersUsed)}).`,
        );
      }
    }

    // Gate 3: every declared placeholder must have a runtime value.
    for (const declared of placeholdersUsed) {
      if (!Object.prototype.hasOwnProperty.call(context, declared)) {
        throw new TemplateRenderError(
          'missing_context_value',
          `Context is missing value for declared placeholder "${declared}".`,
        );
      }
    }

    // Gate 4: context must not carry extraneous keys (defensive).
    for (const key of Object.keys(context)) {
      if (!placeholdersUsed.includes(key)) {
        throw new TemplateRenderError(
          'extraneous_context_key',
          `Context has key "${key}" not declared in placeholders_used.`,
        );
      }
    }

    // Substitute. Safe: regex only matches `{snake_case}`, replacement is a
    // string coercion of an already-validated context value. No HTML/SQL
    // interpolation concerns at this layer (rendered text goes through the
    // frontend's React JSX which auto-escapes).
    return template.replace(PLACEHOLDER_TOKEN_REGEX, (_match, name: string) => {
      return String(context[name]);
    });
  }
}
