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
  app/               routes: layouts, pages, loading, error and not-found files
  app/(app)/         signed-in pages; its layout adds the header, main landmark and footer
  components/ui/     shared building blocks: Button, ButtonLink, Field, Skeleton, LoadingRegion
  components/shell/  header, main navigation and footer of the signed-in app
  components/home/   the student and admin home screens
  components/icons/  hand-written inline SVG icons, only where text will not do (none yet)
  lib/               session, roles, route map, page data and small helpers
test/                test setup, the design-rule checker and the contrast test
```

## Routes

Every route the app links to is defined once, in `src/lib/routes.ts`. A link to a page that does not
exist yet shows the 404 page until the page is built.

| Route | Page | Status |
| --- | --- | --- |
| `/` | Landing page (public) | CS455-16 |
| `/home` | Home: one screen for students, another for admins | Built (CS455-15) |
| `/login` | Sign in with a code sent by email | CS455-17 |
| `/register` | Registration, iitk.ac.in addresses only | CS455-18 |
| `/terms` | Terms of service | To be created |
| `/privacy` | Privacy policy | To be created |
| `/rides`, `/rides/new`, `/rides/[id]` | Find a ride, offer a ride, ride details | Not started |
| `/notifications` | Notifications | Not started |
| `/admin/incidents`, `/admin/complaints`, `/admin/recommendations` | Admin queues | Not started |
| `/admin/configuration/...` | Vehicle types, hubs and pickup points, fares | Not started |

## Signed-in pages and roles

- **Roles** (`src/lib/roles.ts`): `student` finds rides and offers rides with the same account, as in
  the D0 proposal; `admin` is for operations admins, whose accounts are given the role rather than
  registered.
- **Access:** every page under `src/app/(app)/` first calls `verifySession()` from
  `src/lib/session.ts`, which redirects to `/login` when nobody is signed in. The layout only displays
  the session; it does not protect pages, because layouts are not re-rendered on navigation.
- **Development sign-in:** until sign-in exists (CS455-17), `getSession()` returns a development
  user. Copy `.env.example` to `.env.local` in this folder, set `DEV_SESSION_ROLE` to `student` or
  `admin`, and restart `npm run dev`. Production builds and tests ignore it.
- **Page data** comes from server-only modules in `src/lib`, such as `home-data.ts`. Until the APIs
  exist they return empty lists, or null counts that the page shows as "Not available yet".

## Conventions

- Server Components by default; add `'use client'` only for interaction or browser APIs.
- Tests sit next to the code they test, for example `Button.test.tsx` beside `Button.tsx`.
- A route that loads data has a `loading.tsx` made of `Skeleton` blocks in the shape of the final
  content, wrapped in a `LoadingRegion`.
- Use `next/link` for links inside the app and the `@/` alias for imports from `src/`.
- Every page has exactly one `<main id="main">`, which the skip link targets. Signed-in pages get it
  from the `(app)` layout.

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
- a checkmark or sparkle character;
- the "It's not X, it's Y" phrasing;
- an import of an icon kit (Lucide, react-icons, Heroicons) or an animation library (Framer Motion);
- a gradient, including radial orbs and dot grids written as CSS gradients;
- an arbitrary colour such as `text-[#ff00ff]`, so only the tokens above can be used;
- a shadow, blur or glass effect;
- a corner radius above 2px;
- a transition or animation other than the skeleton pulse;
- a hover effect that moves or scales an element;
- a coloured left stripe;
- pure white.

`test/contrast.test.ts` checks that every text colour meets WCAG 2.1 AA (NFR-RD-15).

### Checked in review

Code cannot catch these, so the reviewer of every UI pull request checks them:

- No row of three feature cards, bento grid, terminal-window mock-up, pricing tiers or testimonials.
- No checkmark bullets or sparkle icons drawn as SVG or CSS, and no copy that contrasts what the
  product is not with what it is (the code check only catches the plain characters and phrasing).
- The site has a terms of service page and a privacy policy, linked from the footer.
- Loading states use skeletons in the shape of the content.
- The landing page shows real screens of the product, not mock-ups.
