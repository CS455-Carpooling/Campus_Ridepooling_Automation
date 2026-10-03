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
  app/               routes; the root layout adds the header, main landmark and footer to every page
  app/(app)/         signed-in pages (each one checks the session itself)
  components/ui/     shared building blocks: Button, ButtonLink, Field, Skeleton, LoadingRegion
  components/shell/  header, navigation, footer and the product mark
  components/home/   the student and admin home screens
  components/landing/ the landing page's fare card and live fare calculator
  lib/               session, roles, route map, fares, formatting, page data and small helpers
test/                test setup, the design-rule checker and the contrast test
```

## Routes

Every route the app links to is defined once, in `src/lib/routes.ts`. A link to a page that does not
exist yet shows the 404 page until the page is built.

| Route | Page | Status |
| --- | --- | --- |
| `/` | Landing page (public) | Built (CS455-16) |
| `/home` | Home: one screen for students, another for admins | Built (CS455-15) |
| `/login` | Sign in with IITK email and password | Built (CS455-17, CS455-19) |
| `/register` | Registration, iitk.ac.in addresses only, verified by email | Built (CS455-18, CS455-19) |
| `/forgot-password`, `/reset-password` | Ask for a reset link; set a new password from it | Built (CS455-19) |
| `/api/auth/*` | Register, verify, log in, log out, forgot, reset | Built (CS455-19), see `setup.md` |
| `/terms` | Community guidelines | Placeholder |
| `/privacy` | Privacy policy | Placeholder |
| `/rides`, `/rides/new`, `/rides/[id]` | Find a ride, offer a ride, ride details | Not started |
| `/notifications` | Notifications | Not started |
| `/admin/incidents`, `/admin/complaints`, `/admin/recommendations` | Admin queues | Not started |
| `/admin/configuration/...` | Vehicle types, hubs and pickup points, fares | Not started |

## Signed-in pages and roles

- **Roles** (`src/lib/roles.ts`): `student` finds rides and offers rides with the same account, as in
  the D0 proposal; `admin` is for operations admins, whose accounts are given the role rather than
  registered.
- **Access:** every page under `src/app/(app)/` first calls `verifySession()` from
  `src/lib/session.ts`, which redirects to `/login` when nobody is signed in. The header only
  displays the session; the root layout does not protect pages, because layouts are not re-rendered
  on navigation.
- **Accounts (CS455-19):** `/api/auth/*` stores accounts in PostgreSQL (`db/schema.sql`,
  `npm run db:migrate`), and `getSession()` reads the session cookie that `/api/auth/login` sets.
  Every registered account is a student; admin accounts are not provisioned yet. `setup.md`
  explains the database and email setup.
- **Development sign-in:** to build pages without a database, copy `.env.example` to `.env.local`
  in this folder, set `DEV_SESSION_ROLE` to `student` or `admin`, optionally set
  `DEV_SESSION_EMAIL`, and restart `npm run dev`. It takes priority over real sign-in under
  `npm run dev`; production builds and tests ignore it. Keep passwords and personal addresses out
  of the repository.
- **Page data** comes from server-only modules in `src/lib`, such as `home-data.ts`. Until the APIs
  exist they return empty lists, or null counts that the page shows as "Not available yet".

## Conventions

- Server Components by default; add `'use client'` only for interaction or browser APIs.
- Tests sit next to the code they test, for example `Button.test.tsx` beside `Button.tsx`.
- A route that loads data has a `loading.tsx` made of `Skeleton` blocks in the shape of the final
  content, wrapped in a `LoadingRegion`.
- Use `next/link` for links inside the app and the `@/` alias for imports from `src/`.
- Every page gets exactly one `<main id="main">`, which the skip link targets, from the root layout.
  Pages render only their content and never add another `<main>`.

## Design rules

The site must look designed by people for IIT Kanpur students, not generated. The direction is a
forest-green palette with one coral accent, large tightly set headings, and real product components
(such as the live fare calculator on the landing page) in place of mock-ups.

### Tokens

Every colour is a token in `src/app/globals.css`. The dark values apply when the device is set to a
dark colour scheme; components need no `dark:` classes.

| Token            | Light     | Dark      | Use                                              |
| ---------------- | --------- | --------- | ------------------------------------------------ |
| `paper`          | `#F4F5EF` | `#0E1714` | Page background (never pure white)               |
| `surface`        | `#FAFBF7` | `#14201C` | Inputs, cards inside brand panels                |
| `panel`          | `#E8EBE2` | `#1B2A25` | Filled areas, hovered secondary buttons          |
| `ink`            | `#14231F` | `#E7EDE4` | Text                                             |
| `ink-muted`      | `#4E5B55` | `#A2B0A9` | Secondary text                                   |
| `line`           | `#D3D8CD` | `#2A3A34` | Dividers and skeleton blocks, never text         |
| `line-strong`    | `#78837C` | `#6C7D75` | Borders of inputs and buttons                    |
| `brand`          | `#143029` | `#1E463B` | Forest panels (fare card, closing call to action) |
| `on-brand`       | `#EDF1E8` | `#EDF1E8` | Text on brand panels                             |
| `on-brand-muted` | `#A7B8AF` | `#A9BBB1` | Secondary text on brand panels                   |
| `primary`        | `#143029` | `#E7EDE4` | Primary buttons                                  |
| `primary-strong` | `#0B1F1A` | `#F4F7F1` | Hovered primary buttons                          |
| `on-primary`     | `#F4F5EF` | `#0E1714` | Text on primary buttons                          |
| `accent`         | `#EE7A50` | `#EE7A50` | Coral fills and markers; large text on brand     |
| `accent-strong`  | `#F39270` | `#F39270` | Hovered accent buttons                           |
| `on-accent`      | `#14231F` | `#14231F` | Text on the accent colour                        |
| `accent-text`    | `#B8431F` | `#EF7A52` | Coral text on the page                           |
| `danger`         | `#B3261E` | `#F28B78` | Errors and destructive actions                   |
| `warning`        | `#7A5200` | `#E0B04A` | Warnings                                         |

Coral is the only accent. Type is Manrope (headings `font-extrabold tracking-tight`), with IBM Plex
Mono for times, fares and codes (`font-mono tabular-nums`); both include the rupee sign. Corners come
in two sizes: `rounded-control` (8px) for buttons, inputs and anything inside a panel, and
`rounded-panel` (16px) for panels. Depth comes from forest panels and 1px borders, never shadows.
Brand panels carry `data-surface="brand"` so that focus rings inside them switch to a light colour.

### Enforced by code

The Tailwind theme removes the default colour palette, shadows, blur, stock radii and stock
animations. `test/design-rules.ts` fails the test run if `src/` contains:

- an em dash or an emoji;
- a checkmark or sparkle character;
- the "It's not X, it's Y" phrasing;
- an import of an icon kit (Lucide, react-icons, Heroicons) or an animation library (Framer Motion);
- a gradient, including radial orbs and dot grids written as CSS gradients;
- an arbitrary colour such as `text-[#ff00ff]`, so only the tokens above can be used;
- a shadow, blur or glass effect;
- a corner radius other than `rounded-control`, `rounded-panel`, `rounded-none` or `rounded-full`;
- a transition or animation other than the skeleton pulse;
- a hover effect that moves or scales an element (pressing a button may nudge it down by 1px);
- a coloured left stripe;
- pure white.

`test/contrast.test.ts` checks every text, button and border pairing against WCAG 2.1 AA, in both
colour schemes (NFR-RD-15).

### Checked in review

Code cannot catch these, so the reviewer of every UI pull request checks them:

- No row of three feature cards, bento grid, terminal-window mock-up, pricing tiers or testimonials.
- No invented numbers: no user counts, ratings or savings the project cannot back up. Example data
  is labelled as an example.
- No checkmark bullets or sparkle icons drawn as SVG or CSS, and no copy that contrasts what the
  product is not with what it is (the code check only catches the plain characters and phrasing).
- At most one small uppercase label above a heading for every three sections of a page.
- Pastel, neon, purple or rainbow colours stay out; coral is the only accent.
- The site has a terms of service page and a privacy policy, linked from the footer.
- Loading states use skeletons in the shape of the content.
- The landing page shows real components of the product, not mock-ups.
- Pages are checked in both the light and the dark colour scheme.
