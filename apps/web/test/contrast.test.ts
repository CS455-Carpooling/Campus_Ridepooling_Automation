// @vitest-environment node
/**
 * WCAG 2.1 AA contrast of the colour tokens, in the light and the dark colour
 * scheme (NFR-RD-15). Reads the hex values straight from globals.css, so a
 * token change that breaks contrast fails here.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(fileURLToPath(new URL('../src/app/globals.css', import.meta.url)), 'utf8');
const DARK_SCHEME = '@media (prefers-color-scheme: dark)';
const [lightCss, darkCss = ''] = css.split(DARK_SCHEME);

function readTokens(text: string): Record<string, string> {
  return Object.fromEntries(
    [...text.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [
      m[1],
      m[2].toLowerCase(),
    ]),
  );
}

const lightTokens = readTokens(lightCss);
const darkOverrides = readTokens(darkCss);
const schemes: Record<string, Record<string, string>> = {
  light: lightTokens,
  dark: { ...lightTokens, ...darkOverrides },
};

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
const LARGE = 3; // WCAG 1.4.3 large text, and 1.4.11 borders and markers

const TOKENS = [
  'paper',
  'surface',
  'panel',
  'ink',
  'ink-muted',
  'line',
  'line-strong',
  'brand',
  'on-brand',
  'on-brand-muted',
  'primary',
  'primary-strong',
  'on-primary',
  'accent',
  'accent-strong',
  'on-accent',
  'accent-text',
  'danger',
  'warning',
];

describe('contrast helper', () => {
  it('matches known reference ratios', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
});

describe('the dark colour scheme', () => {
  it('overrides every colour token, so no light value leaks into it', () => {
    expect(Object.keys(darkOverrides).sort()).toEqual(Object.keys(lightTokens).sort());
  });

  it('really is darker', () => {
    expect(luminance(schemes.dark.paper)).toBeLessThan(luminance(schemes.light.paper));
  });
});

describe.each(Object.entries(schemes))('colour contrast, %s scheme (NFR-RD-15)', (_, t) => {
  it('defines every token the checks use', () => {
    for (const name of TOKENS) expect(t[name], name).toMatch(/^#[0-9a-f]{6}$/);
  });

  it.each(['ink', 'ink-muted', 'accent-text', 'danger', 'warning'])(
    '%s text is at least 4.5:1 on paper, surface and panel',
    (name) => {
      for (const background of ['paper', 'surface', 'panel']) {
        expect(contrast(t[name], t[background]), background).toBeGreaterThanOrEqual(TEXT);
      }
    },
  );

  it('button text is at least 4.5:1, at rest and on hover', () => {
    for (const fill of ['primary', 'primary-strong']) {
      expect(contrast(t['on-primary'], t[fill]), fill).toBeGreaterThanOrEqual(TEXT);
    }
    for (const fill of ['accent', 'accent-strong']) {
      expect(contrast(t['on-accent'], t[fill]), fill).toBeGreaterThanOrEqual(TEXT);
    }
  });

  it('text on brand panels is at least 4.5:1, and the accent at least 3:1', () => {
    expect(contrast(t['on-brand'], t.brand)).toBeGreaterThanOrEqual(TEXT);
    expect(contrast(t['on-brand-muted'], t.brand)).toBeGreaterThanOrEqual(TEXT);
    expect(contrast(t.accent, t.brand)).toBeGreaterThanOrEqual(LARGE);
  });

  it('input and button borders are at least 3:1 against paper, surface and panel', () => {
    for (const background of ['paper', 'surface', 'panel']) {
      expect(contrast(t['line-strong'], t[background]), background).toBeGreaterThanOrEqual(LARGE);
    }
  });

  it('focus rings are at least 3:1 where they are drawn', () => {
    expect(contrast(t.ink, t.paper)).toBeGreaterThanOrEqual(LARGE);
    expect(contrast(t.ink, t.surface)).toBeGreaterThanOrEqual(LARGE);
    expect(contrast(t['on-brand'], t.brand)).toBeGreaterThanOrEqual(LARGE);
  });

  it('never uses pure white for the page or for surfaces', () => {
    expect(t.paper).not.toBe('#ffffff');
    expect(t.surface).not.toBe('#ffffff');
  });
});
