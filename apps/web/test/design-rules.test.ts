// @vitest-environment node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fileKind, findViolations, scanDirectory, stripComments } from './design-rules';

const srcDir = fileURLToPath(new URL('../src', import.meta.url));

describe('design rules: the web app source', () => {
  it('src/ contains none of the banned patterns', () => {
    const report = scanDirectory(srcDir).map(
      (v) => `${path.relative(srcDir, v.file)}:${v.line} ${v.message}`,
    );
    expect(report).toEqual([]);
  });
});

describe('design rules: the checker', () => {
  const rulesHit = (kind: 'code' | 'css', text: string) =>
    findViolations(kind, text).map((v) => v.rule);

  it.each([
    ['em-dash', 'Ride locked \u2014 chat opens'],
    ['emoji', 'Ride booked \u{1F389}'],
    ['library', "import { Star } from 'lucide-react';"],
    ['library', "import { motion } from 'motion/react';"],
    ['gradient', '<div className="bg-linear-to-r from-accent to-ink" />'],
    ['shadow', '<div className="shadow-md" />'],
    ['shadow', '<div className="hover:shadow-lg" />'],
    ['glass', '<div className="backdrop-blur-md" />'],
    ['radius', '<div className="rounded-xl" />'],
    ['radius', '<div className="rounded-t-lg" />'],
    ['motion', '<a className="transition-colors duration-200" />'],
    ['motion', '<span className="animate-spin" />'],
    ['hover-transform', '<a className="hover:scale-105" />'],
    ['left-stripe', '<aside className="border-l-4 border-accent" />'],
    ['pure-white', "const style = { background: '#ffffff' };"],
    ['decorative-glyph', `<li>${String.fromCodePoint(0x2713)} Seat confirmed</li>`],
    ['decorative-glyph', `<h2>${String.fromCodePoint(0x2726)} New</h2>`],
    ['not-x-its-y', "<p>It's not a taxi app, it's a pooling platform.</p>"],
    ['not-x-its-y', "<p>This isn't just carpooling; it's community.</p>"],
    ['gradient', '<div className="bg-[radial-gradient(circle,#1d6b4f_1px,transparent_1px)]" />'],
    ['gradient', "const style = { backgroundImage: 'linear-gradient(red, blue)' };"],
    ['arbitrary-colour', '<p className="text-[#ff00ff]" />'],
    ['arbitrary-colour', '<div className="bg-[oklch(0.7_0.3_300)]" />'],
  ])('flags %s in code: %s', (rule, text) => {
    expect(rulesHit('code', text)).toContain(rule);
  });

  it.each([
    ['css-shadow', '.card { box-shadow: 0 1px 2px black; }'],
    ['css-gradient', '.hero { background: linear-gradient(red, blue); }'],
    ['css-glass', '.nav { backdrop-filter: blur(8px); }'],
    ['css-motion', 'a { transition: color 0.2s; }'],
    ['css-motion', '@keyframes spin { to { rotate: 1turn; } }'],
    ['pure-white', 'body { background: #fff; }'],
  ])('flags %s in CSS: %s', (rule, text) => {
    expect(rulesHit('css', text)).toContain(rule);
  });

  it.each([
    '<div className="rounded-sm border border-line-strong bg-paper text-ink" />',
    '<div className="animate-skeleton bg-line" />',
    '<a className="underline hover:text-accent" />',
    '<p>Pickup between 04:45\u201305:15</p>',
    'const root = element.shadowRoot;',
    '// Hover changes colour instantly; no transitions, no shadow.',
    '/* No gradients, blur or shadow here. */',
    "const docs = 'https://example.org/page';",
    "<p>It's not available yet.</p>",
    '<span className="text-ink-muted">Not available yet</span>',
    '<div className="w-[22rem] max-w-[90vw]" />',
  ])('allows %s', (text) => {
    expect(findViolations('code', text)).toEqual([]);
  });

  it('allows the theme resets and the skeleton keyframes in CSS', () => {
    const css = '--shadow-*: initial;\n--drop-shadow-*: initial;\n@keyframes skeleton-pulse {}';
    expect(findViolations('css', css)).toEqual([]);
  });

  it('reports the line of each violation', () => {
    expect(findViolations('code', 'ok\nok\n<div className="shadow-md" />')).toEqual([
      expect.objectContaining({ rule: 'shadow', line: 3 }),
    ]);
  });

  it('keeps line numbers when blanking comments', () => {
    const text = 'a /* one\ntwo */ b // three\nc';
    expect(stripComments(text, 'code').split('\n')).toHaveLength(3);
    expect(stripComments(text, 'code')).not.toMatch(/one|two|three/);
  });

  it('classifies files by extension', () => {
    expect(fileKind('page.tsx')).toBe('code');
    expect(fileKind('vitest.config.mts')).toBe('code');
    expect(fileKind('globals.css')).toBe('css');
    expect(fileKind('icon.svg')).toBe('other');
  });
});
