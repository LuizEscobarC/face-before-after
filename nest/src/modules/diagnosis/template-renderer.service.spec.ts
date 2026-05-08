/**
 * Unit tests for TemplateRendererService (PR-51 / M4.1).
 */
import { describe, it, expect } from 'vitest';
import {
  TemplateRendererService,
  TemplateRenderError,
  ALLOWED_PLACEHOLDERS,
} from './template-renderer.service.js';

const r = new TemplateRendererService();

describe('TemplateRendererService.render — allowlist sanity', () => {
  it('exposes the v1 allowlist exactly', () => {
    expect([...ALLOWED_PLACEHOLDERS]).toEqual([
      'value',
      'ideal',
      'deviation_pct',
      'direction_label',
      'region_pt',
    ]);
  });
});

describe('TemplateRendererService.render — happy paths', () => {
  it('substitutes a single token', () => {
    const out = r.render({
      template: 'desvio {deviation_pct}%',
      placeholdersUsed: ['deviation_pct'],
      context: { deviation_pct: '7.3' },
    });
    expect(out).toBe('desvio 7.3%');
  });

  it('substitutes multiple distinct tokens', () => {
    const out = r.render({
      template: 'mede {value}, ref {ideal} ({deviation_pct}%)',
      placeholdersUsed: ['value', 'ideal', 'deviation_pct'],
      context: { value: '0.32', ideal: '0.30', deviation_pct: '6.7' },
    });
    expect(out).toBe('mede 0.32, ref 0.30 (6.7%)');
  });

  it('substitutes a token used multiple times', () => {
    const out = r.render({
      template: '{value} comparado a {value}',
      placeholdersUsed: ['value'],
      context: { value: 'X' },
    });
    expect(out).toBe('X comparado a X');
  });

  it('coerces numbers to strings', () => {
    const out = r.render({
      template: 'n={value}',
      placeholdersUsed: ['value'],
      context: { value: 42 },
    });
    expect(out).toBe('n=42');
  });

  it('handles a template with zero tokens', () => {
    const out = r.render({
      template: 'texto sem placeholders',
      placeholdersUsed: [],
      context: {},
    });
    expect(out).toBe('texto sem placeholders');
  });
});

describe('TemplateRendererService.render — failure modes', () => {
  it('throws placeholder_not_allowed on disallowed declared placeholder', () => {
    expect(() =>
      r.render({
        template: 'foo {evil}',
        placeholdersUsed: ['evil'],
        context: { evil: 'bar' },
      }),
    ).toThrowError(TemplateRenderError);
    try {
      r.render({
        template: 'foo {evil}',
        placeholdersUsed: ['evil'],
        context: { evil: 'bar' },
      });
    } catch (e) {
      expect((e as TemplateRenderError).code).toBe('placeholder_not_allowed');
    }
  });

  it('throws undeclared_placeholder when template uses an unlisted token', () => {
    try {
      r.render({
        template: 'usa {value} e {ideal}',
        placeholdersUsed: ['value'],
        context: { value: 'X' },
      });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(TemplateRenderError);
      expect((e as TemplateRenderError).code).toBe('undeclared_placeholder');
    }
  });

  it('throws missing_context_value when declared placeholder lacks runtime value', () => {
    try {
      r.render({
        template: '{value}',
        placeholdersUsed: ['value'],
        context: {},
      });
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as TemplateRenderError).code).toBe('missing_context_value');
    }
  });

  it('throws extraneous_context_key when context has an undeclared key', () => {
    try {
      r.render({
        template: '{value}',
        placeholdersUsed: ['value'],
        context: { value: 'X', sneaky: 'Y' },
      });
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as TemplateRenderError).code).toBe('extraneous_context_key');
    }
  });
});

describe('TemplateRendererService.render — regex safety', () => {
  it('does not match {Uppercase} or {with-dash}', () => {
    // These should NOT be treated as tokens (regex restricts to [a-z_][a-z0-9_]*).
    const out = r.render({
      template: '{Value} {with-dash} {value}',
      placeholdersUsed: ['value'],
      context: { value: 'OK' },
    });
    expect(out).toBe('{Value} {with-dash} OK');
  });
});
