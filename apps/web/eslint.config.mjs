import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

// Icon kits and animation libraries are not used (see "Design rules" in README.md).
const designRuleMessage = 'Not allowed by the design rules in apps/web/README.md.';
const bannedPackages = [
  'lucide-react',
  'lucide',
  'react-icons',
  '@heroicons/react',
  'framer-motion',
  'motion',
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: bannedPackages.map((name) => ({ name, message: designRuleMessage })),
          patterns: [
            {
              group: bannedPackages.map((name) => `${name}/*`),
              message: designRuleMessage,
            },
          ],
        },
      ],
    },
  },
  // Turns off rules that conflict with Prettier; keep it last.
  prettier,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'coverage/**', 'next-env.d.ts']),
]);

export default eslintConfig;
