/**
 * Automated part of the design rules in apps/web/README.md. Each rule is a
 * pattern that must not appear in the web app's source. Rules about Tailwind
 * classes and CSS ignore comments, so a comment may mention a banned pattern.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export type FileKind = 'code' | 'css' | 'other';

type Rule = {
  id: string;
  message: string;
  kinds: FileKind[];
  pattern: RegExp;
  /** Copy rules also apply inside comments; style rules do not. */
  includeComments?: boolean;
};

export type Violation = { rule: string; message: string; line: number };

// A Tailwind utility starts after whitespace, a quote, a backtick or a variant colon.
const START = String.raw`(?<![\w-])`;
const END = String.raw`(?![\w-])`;
const REST = String.raw`[^\s'"\x60]`;

const ALL: FileKind[] = ['code', 'css', 'other'];

// Checkmarks and sparkles (used as bullets and decoration), from their code points.
const DECORATIVE_GLYPHS = String.fromCodePoint(
  0x2713, // check mark
  0x2714, // heavy check mark
  0x2705, // white heavy check mark
  0x2611, // ballot box with check
  0x2726, // black four-pointed star
  0x2727, // white four-pointed star
  0x2728, // sparkles
  0x2734, // eight-pointed black star
  0x2747, // sparkle
);

export const rules: Rule[] = [
  {
    id: 'em-dash',
    message: 'Em dash: use a comma, a colon or a full stop instead.',
    kinds: ALL,
    pattern: /\u2014/,
    includeComments: true,
  },
  {
    id: 'emoji',
    message: 'Emoji are not used.',
    kinds: ALL,
    pattern: /\p{Extended_Pictographic}/u,
    includeComments: true,
  },
  {
    id: 'library',
    message: 'Icon kits and animation libraries are not used.',
    kinds: ['code'],
    pattern:
      /from\s+['"](?:lucide(?:-react)?|react-icons|@heroicons\/react|framer-motion|motion)(?:\/[^'"]*)?['"]/,
  },
  {
    id: 'decorative-glyph',
    message: 'Checkmark and sparkle characters are not used as bullets or decoration.',
    kinds: ALL,
    pattern: new RegExp(`[${DECORATIVE_GLYPHS}]`, 'u'),
    includeComments: true,
  },
  {
    id: 'not-x-its-y',
    message: 'Avoid the "It\'s not X, it\'s Y" phrasing; say what it is.',
    kinds: ['code'],
    pattern:
      /\b(?:it|this|that)(?:'s| is)(?: not|n't)\b[^.!?\n]{0,80}?[,;:]\s*(?:it|this|that)(?:'s| is)\b/i,
  },
  {
    id: 'gradient',
    message: 'Gradients (including radial orbs and dot grids) are not used.',
    kinds: ['code'],
    pattern: new RegExp(
      `${START}bg-(?:linear|radial|conic|gradient)-|(?:linear|radial|conic)-gradient[(]`,
    ),
  },
  {
    id: 'arbitrary-colour',
    message: 'Use the colour tokens; arbitrary colours (neon, pastel, purple) are not used.',
    kinds: ['code'],
    pattern: /-[[](?:#|rgba?[(]|hsla?[(]|ok(?:lch|lab)[(]|l(?:ab|ch)[(]|hwb[(]|color[(])/,
  },
  {
    id: 'shadow',
    message: 'Shadows are not used; separate surfaces with a 1px border.',
    kinds: ['code'],
    pattern: new RegExp(`${START}(?:drop-|inset-|text-)?shadow(?:-${REST}+)?${END}`),
  },
  {
    id: 'glass',
    message: 'Blur and glass effects are not used.',
    kinds: ['code'],
    pattern: new RegExp(`${START}(?:backdrop-${REST}+|blur(?:-${REST}+)?)${END}`),
  },
  {
    id: 'radius',
    message:
      'Corners are rounded-control (8px) or rounded-panel (16px); rounded-none and rounded-full are also allowed.',
    kinds: ['code'],
    // Any rounded-* utility except the allowed sizes, with or without a side (rounded-t-panel).
    pattern: new RegExp(
      `${START}(?!rounded(?:-(?:[setrbl]|ss|se|es|ee|tl|tr|br|bl))?-(?:none|full|control|panel)${END})rounded-${REST}+${END}`,
    ),
  },
  {
    id: 'motion',
    message: 'Transitions and animations are not used, except animate-skeleton.',
    kinds: ['code'],
    pattern: new RegExp(
      `${START}(?:transition(?:-[a-z]+)?|duration-\\d+|delay-\\d+|ease-(?:in|out|in-out|linear)|animate-(?!skeleton${END})[a-z-]+)${END}`,
    ),
  },
  {
    id: 'hover-transform',
    message: 'Hover states change colour only; they do not move or scale.',
    kinds: ['code'],
    pattern: new RegExp(`${START}(?:group-)?(?:hover|focus):-?(?:scale|translate|rotate|skew)`),
  },
  {
    id: 'left-stripe',
    message: 'Coloured left stripes are not used.',
    kinds: ['code'],
    pattern: new RegExp(`${START}border-l-(?:[2-8]|\\[)`),
  },
  {
    id: 'pure-white',
    message: 'Pure white is not used; the page background is the paper token.',
    kinds: ['code', 'css'],
    pattern: /#fff(?:fff)?(?![\w-])/i,
  },
  {
    id: 'css-shadow',
    message: 'Shadows are not used.',
    kinds: ['css'],
    pattern: /\b(?:box|text)-shadow\s*:|drop-shadow\(/,
  },
  {
    id: 'css-gradient',
    message: 'Gradients are not used.',
    kinds: ['css'],
    pattern: /(?:linear|radial|conic)-gradient\(/,
  },
  {
    id: 'css-glass',
    message: 'Blur and glass effects are not used.',
    kinds: ['css'],
    pattern: /backdrop-filter\s*:|filter\s*:\s*blur\(/,
  },
  {
    id: 'css-motion',
    message: 'Transitions and animations are not used, except the skeleton pulse.',
    kinds: ['css'],
    pattern: /\btransition(?:-[a-z-]+)?\s*:|@keyframes\s+(?!skeleton-pulse\b)/,
  },
];

export function fileKind(fileName: string): FileKind {
  if (/\.(?:[cm]?[jt]sx?)$/.test(fileName)) return 'code';
  if (fileName.endsWith('.css')) return 'css';
  return 'other';
}

/** Blanks out comments while keeping line numbers. */
export function stripComments(text: string, kind: FileKind): string {
  const blank = (comment: string) => comment.replace(/[^\n]/g, ' ');
  let stripped = text.replace(/\/\*[\s\S]*?\*\//g, blank);
  if (kind === 'code') {
    // Line comments; the [^:] guard keeps URLs such as https://example.org.
    stripped = stripped.replace(
      /(^|[^:\\])(\/\/[^\n]*)/g,
      (_match, before: string, comment: string) => before + blank(comment),
    );
  }
  return stripped;
}

export function findViolations(kind: FileKind, text: string): Violation[] {
  const withoutComments = stripComments(text, kind);
  const violations: Violation[] = [];
  for (const rule of rules) {
    if (!rule.kinds.includes(kind)) continue;
    const lines = (rule.includeComments ? text : withoutComments).split('\n');
    lines.forEach((lineText, index) => {
      if (rule.pattern.test(lineText)) {
        violations.push({ rule: rule.id, message: rule.message, line: index + 1 });
      }
    });
  }
  return violations;
}

/** Checks every source file under a directory, skipping tests. */
export function scanDirectory(dir: string): Array<Violation & { file: string }> {
  const results: Array<Violation & { file: string }> = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      results.push(...scanDirectory(fullPath));
      continue;
    }
    if (/\.test\.[jt]sx?$/.test(entry)) continue;
    const text = readFileSync(fullPath, 'utf8');
    for (const violation of findViolations(fileKind(entry), text)) {
      results.push({ ...violation, file: fullPath });
    }
  }
  return results;
}
