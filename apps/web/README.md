# Web app (`@ridepool/web`)

The browser client of the Campus Ride-Pooling and Split-Fare System: one Next.js app with separate
areas for riders, ride owners and operations admins. It talks to the API server over HTTPS and
Socket.IO. Every check that protects data is also made on the server.

Stack: Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4, Vitest with React
Testing Library.

## Commands

Run these from the repository root (they cover every workspace) or from `apps/web`:

| Command             | What it does                                                          |
| ------------------- | --------------------------------------------------------------------- |
| `npm run dev`       | Development server at http://localhost:3000                           |
| `npm run lint`      | ESLint                                                                |
| `npm run typecheck` | Generates the route types, then runs `tsc --noEmit`                   |
| `npm run test`      | Unit, design-rule and contrast tests with coverage; fails below 80 %  |
| `npm run build`     | Production build                                                      |

Inside `apps/web`, `npm run test:watch` reruns the tests on every change. Formatting is run from
the root: `npm run format`.

## Layout

```
src/
  app/               routes: layout, pages, loading, error and not-found files
  components/ui/     shared building blocks: Button, Field, Skeleton, LoadingRegion
  components/icons/  hand-written inline SVG icons, only where text will not do (none yet)
  lib/               small helpers
test/                test setup, the design-rule checker and the contrast test
```

## Planned routes

| Route       | Page                                      | Jira          |
| ----------- | ----------------------------------------- | ------------- |
| `/`         | Landing page (public)                     | CS455-16      |
| `/home`     | Homepage for the signed-in user's role    | CS455-15      |
| `/login`    | Sign in with a code sent by email         | CS455-17      |
| `/register` | Registration, iitk.ac.in addresses only   | CS455-18      |
| `/terms`    | Terms of service                          | to be created |
| `/privacy`  | Privacy policy                            | to be created |

## Conventions

- Server Components by default; add `'use client'` only for interaction or browser APIs.
- Tests sit next to the code they test, for example `Button.test.tsx` beside `Button.tsx`.
- A route that loads data has a `loading.tsx` made of `Skeleton` blocks in the shape of the final
  content, wrapped in a `LoadingRegion`.
- Use `next/link` for links inside the app and the `@/` alias for imports from `src/`.

## Design rules

The site must not look machine-generated. The visual direction is "Timetable": dense and factual,
like a railway timetable or a ticket.

### Tokens

| Token           | Value     | Use                                      |
| --------------- | --------- | ---------------------------------------- |
| `paper`         | `#F5F3EE` | Page background (never pure white)       |
| `panel`         | `#EDEAE3` | Filled areas, hovered secondary buttons  |
| `ink`           | `#1B1F24` | Text                                     |
| `ink-muted`     | `#5C5850` | Secondary text                           |
| `line`          | `#CFCAC0` | Dividers and skeleton blocks, never text |
| `line-strong`   | `#77736A` | Borders of inputs and buttons            |
| `accent`        | `#1D6B4F` | Actions only                             |
| `accent-strong` | `#155540` | Hovered and pressed actions              |
| `on-accent`     | `#F5F3EE` | Text on the accent colour                |
| `danger`        | `#A3341F` | Errors and destructive actions           |
| `warning`       | `#7A5200` | Warnings                                 |

Type is IBM Plex Sans, with IBM Plex Mono for times, fares and codes (`font-mono tabular-nums`).
Corners are `rounded-sm` (2px). Surfaces are separated by 1px borders, not shadows.

### Enforced by code

The Tailwind theme removes the default colour palette, shadows, blur, large radii and stock
animations. `test/design-rules.ts` fails the test run if `src/` contains:

- an em dash or an emoji;
- an import of an icon kit (Lucide, react-icons, Heroicons) or an animation library (Framer Motion);
- a gradient, shadow, blur or glass effect;
- a corner radius above 2px;
- a transition or animation other than the skeleton pulse;
- a hover effect that moves or scales an element;
- a coloured left stripe;
- pure white.

`test/contrast.test.ts` checks that every text colour meets WCAG 2.1 AA (NFR-RD-15).

### Checked in review

Code cannot catch these, so the reviewer of every UI pull request checks them:

- No row of three feature cards, bento grid, terminal-window mock-up, pricing tiers or testimonials.
- No checkmark bullets, sparkle icons or animated arrows, and no "It's not X, it's Y" copy.
- No neon, pastel, rainbow or purple-and-black colouring: only the tokens above.
- The site has a terms of service page and a privacy policy.
- Loading states use skeletons.
- The landing page shows real screens of the product, not mock-ups.
