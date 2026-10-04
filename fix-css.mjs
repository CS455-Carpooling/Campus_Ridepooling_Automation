import fs from 'node:fs';

const file = 'apps/web/src/index.css';
let css = fs.readFileSync(file, 'utf8');

// Input focus ring: swap the box-shadow for an outline so focus stays visible
css = css.replace(
  /(\.input-wrap:focus-within\s*\{[^}]*?)box-shadow\s*:[^;]*;/,
  '$1outline: 2px solid #829b29;',
);

// Remove all remaining shadows, transitions and blur
css = css.replace(/\s*(?<![\w-])(?:box-shadow|transition|backdrop-filter)\s*:[^;{}]*;/g, '');

// Pure white -> off-white
css = css.replace(/#(?:fff|ffffff)\b/gi, '#fdfdfb');

// Checkbox tick: draw it with borders instead of the check character
css = css.replace(
  /(input\[type=['"]checkbox['"]\]:checked::after\s*\{)[^}]*\}/,
  `$1
  content: '';
  width: 4px;
  height: 8px;
  border: solid var(--surface);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}`,
);

fs.writeFileSync(file, css);
console.log('index.css updated');
