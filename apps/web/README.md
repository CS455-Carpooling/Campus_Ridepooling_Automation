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
  app/               routes; the root layout only loads the site styles (src/index.css)
  app/(app)/         signed-in pages (each one checks the session itself)
  components/ui/     shared building blocks: Button, ButtonLink, Field, Skeleton, LoadingRegion
  components/shell/  header, navigation, footer and the product mark
  components/home/   the student and admin home screens
  components/landing/ the landing page's fare card and live fare calculator
  components/rides/  create-ride inputs (route, vehicle, departure window, fare) and the ride details
  lib/               session, roles, route map, fares, formatting, page data and small helpers
test/                test setup, the design-rule checker and the contrast test
```

## Routes

Every route the app links to is defined once, in `src/lib/routes.ts`. A link to a page that does not
exist yet shows the 404 page until the page is built.

| Route | Page | Status |
| --- | --- | --- |
| `/` | Landing page (public); signed-in users get a link to their rides | Built |
| `/home` | Home: one screen for students, another for admins | Built (CS455-15) |
| `/login` | Sign in with an iitk.ac.in email and password | Built (CS455-19) |
| `/register` | Registration with email verification, iitk.ac.in addresses only | Built (CS455-19) |
| `/forgot-password`, `/reset-password` | Password reset by email | Built (CS455-19) |
| `/dashboard` | Where sign-in lands: links to offering a ride and to the home page | Built (CS455-19, 26) |
| `/terms` | Terms of service (community guidelines) | Built |
| `/privacy` | Privacy policy | Built |
| `/rides/new` | Offer a ride: route, vehicle, departure window, fare | Built (CS455-22 to 25) |
| `/rides/[id]` | Ride details: route, departure window, state and lock time, seats, fare split, people | Built (CS455-28, 29) |
| `/rides/[id]/review` | Rate the people on a completed ride, for 72 hours after it is completed | In progress (CS455-39) |
| `/rides` | Find a ride | Not started |
| `/notifications` | Notifications | Not started |
| `/admin/incidents`, `/admin/complaints`, `/admin/recommendations` | Admin queues | Not started |
| `/admin/configuration/...` | Vehicle types, hubs and pickup points, fares | Not started |

## Signed-in pages and roles

- **Roles** (`src/lib/roles.ts`): `student` finds rides and offers rides with the same account, as in
  the D0 proposal; `admin` is for operations admins, whose accounts are given the role rather than
  registered.
- **Access:** every signed-in page checks the sign-in itself and redirects to `/login` when nobody
  is signed in. `getCurrentUser()` in `src/lib/auth.ts` reads the session cookie that `/login`
  sets; `getSession()` and `verifySession()` in `src/lib/session.ts` build on it for pages that
  need a role, such as `/home`. The root layout does not protect pages, because layouts are not
  re-rendered on navigation.
- **Sign-in:** `getSession()` returns the account signed in through `/login`. Accounts have no
  roles yet, so every account is a student. Under `npm run dev` only, when nobody is signed in,
  `DEV_SESSION_ROLE` (`student` or `admin`) in `apps/web/.env.local` still gives a test user, and
  the optional `DEV_SESSION_EMAIL` sets its address; until admin accounts exist, it is the only way
  to see the admin home. Production builds and tests ignore both. Keep passwords and personal
  addresses out of the repository.
- **Ride rules** (`src/lib/ride-rules.ts`) hold the create-ride validation shared by the form and
  `POST /api/rides`; `src/lib/ride-options.ts` loads active places and vehicle types from PostgreSQL.
- **Who may see a ride** (`canViewRide` in `src/lib/ride-status.ts`, NFR-RD-09): its owner and
  riders always; any other signed-in student only while it is scheduled and before its lock time,
  an hour before departure. `getRideView()` in `src/lib/ride-view.ts` applies it on the server and
  answers "Ride not found" for every other case, so a link never reveals whether a ride exists.
- **Completing and rating a ride** (`src/lib/rating-rules.ts`, CS455-39): only the owner marks a
  ride completed, from the start of its departure window, never a cancelled ride and never twice.
  Everyone with a seat on a completed ride may then rate each other person on it from 1 to 5, once,
  with an optional comment of up to 500 characters, for 72 hours (P-16). The `ride_ratings` table
  enforces in PostgreSQL that both people had a seat on that ride, that nobody rates themselves and
  that each person rates each other person once. A rating counts only after its ride's 72 hours are
  over; others see an average only from 3 ratings up, comments go only to the person rated, and
  nobody is ever shown who gave a rating (P-24).
- **Page data** comes from server-only modules in `src/lib`. `ride-view.ts` reads rides from
  PostgreSQL for the ride page and for the Upcoming list on `/home` (rides you offered or joined,
  through `home-data.ts`). Join requests do not exist yet, so nothing is listed as waiting, and the
  admin counts are null, which the page shows as "Not available yet".

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

Every colour is a token in `src/app/globals.css`. The tokens are defined on the `.ds` class, so they
work only inside `<DesignSystem>` (`src/components/ui/DesignSystem.tsx`), which also loads the two
fonts: wrap the outermost element of a page in it. Pages outside it keep the site styles of
`src/index.css`. The dark values apply when the theme toggle switches the site to dark (the `.dark`
class on `<html>`), and `<DesignSystem>` applies the saved choice on pages without a toggle;
components need no `dark:` classes.

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

Inside `<DesignSystem>`, use only the tokens above: no Tailwind default colours, shadows, blur, stock
radii or stock animations (they still exist for the pages styled by `src/index.css`).
`test/design-rules.ts` fails the test run if `src/` contains:

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
