// @vitest-environment node
/**
 * WCAG 2.1 AA contrast of the Timetable colour tokens (NFR-RD-15).
 * Reads the hex values straight from globals.css, so a token change that
 * breaks contrast fails here.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(fileURLToPath(new URL('../src/app/globals.css', import.meta.url)), 'utf8');
const tokens: Record<string, string> = Object.fromEntries(
  [...css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [
    m[1],
    m[2].toLowerCase(),
  ]),
);

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const TEXT = 4.5; // WCAG 1.4.3, normal-size text
const NON_TEXT = 3; // WCAG 1.4.11, borders of controls

describe('colour contrast (WCAG 2.1 AA, NFR-RD-15)', () => {
  it('matches known reference ratios', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  it('defines every token the checks use', () => {
    for (const name of [
      'paper',
      'panel',
      'ink',
      'ink-muted',
      'line-strong',
      'accent',
      'accent-strong',
      'on-accent',
      'danger',
      'warning',
    ]) {
      expect(tokens[name], name).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it.each(['ink', 'ink-muted', 'accent', 'accent-strong', 'danger', 'warning'])(
    '%s text on paper is at least 4.5:1',
    (name) => {
      expect(contrast(tokens[name], tokens.paper)).toBeGreaterThanOrEqual(TEXT);
    },
  );

  it.each(['ink', 'ink-muted', 'danger'])('%s text on panel is at least 4.5:1', (name) => {
    expect(contrast(tokens[name], tokens.panel)).toBeGreaterThanOrEqual(TEXT);
  });

  it.each(['accent', 'accent-strong'])('on-accent text on %s is at least 4.5:1', (name) => {
    expect(contrast(tokens['on-accent'], tokens[name])).toBeGreaterThanOrEqual(TEXT);
  });

  it('input and button borders are at least 3:1 against paper and panel', () => {
    expect(contrast(tokens['line-strong'], tokens.paper)).toBeGreaterThanOrEqual(NON_TEXT);
    expect(contrast(tokens['line-strong'], tokens.panel)).toBeGreaterThanOrEqual(NON_TEXT);
  });

  it('the page background is not pure white', () => {
    expect(tokens.paper).not.toBe('#ffffff');
  });
});
