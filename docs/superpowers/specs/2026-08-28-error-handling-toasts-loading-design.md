# Error handling, error tracking, toasts, loading & empty states

## Context

jobs.pac.africa has none of this today: no `error.tsx`, `global-error.tsx`,
`not-found.tsx`, or `loading.tsx` anywhere in `app/`; no error-tracking
service; toasts are a single hand-rolled success-only component
(`components/toast.tsx`) driven by a redirect search param; the sibling
`Flash` component (`components/dashboard-ui.tsx:98`) does the same job as an
inline banner instead of a toast. When something breaks — the recent
`MIDDLEWARE_INVOCATION_TIMEOUT` outage, a failed server action, a slow
Supabase query — the only visibility is Vercel's raw request log, and the
user sees either a blank Next.js crash overlay or a silently-broken page.
This spec adds real error tracking with alerting, proper error boundaries
with recoverable UI, a general-purpose toast system, skeleton loaders, and
empty states, so failures are visible to the team and recoverable for users.

Five pieces, built in this order because each later piece reports through
the earlier ones:

1. Sentry (error tracking + alerts)
2. Error boundaries & custom error pages
3. Toast system
4. Skeleton loaders
5. Empty / fallback states

## 1. Sentry (error tracking + alerts)

Installed via Vercel Marketplace (`vercel integration add sentry --yes`),
never `npm install @sentry/nextjs` by hand — the Marketplace install
provisions the Sentry project and injects `SENTRY_DSN` /
`NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_AUTH_TOKEN` as env vars automatically, and
wires source-map upload into the build. After install, run
`npx @sentry/wizard@latest -i nextjs` (Sentry's own Next.js SDK setup, which
is instrumentation, not a provider integration) to generate:

- `sentry.client.config.ts` / `sentry.server.config.ts` / `sentry.edge.config.ts`
- `instrumentation.ts` hook (Next 15's official server instrumentation entry)
- `next.config.ts` wrapped in `withSentryConfig`

Config:
- Environment tagged from `VERCEL_ENV` (`production` / `preview` / `development`)
  so preview-deploy noise doesn't page anyone.
- `tracesSampleRate` low (0.1) in production — this is an error tracker, not
  full APM, keep it inside the free tier.
- Alerts: one Sentry alert rule — new issue in `production` environment →
  email the team. Configured in the Sentry dashboard (Marketplace install
  gives dashboard access), not in code.

This is the foundation the other pieces report to: error boundaries call
`Sentry.captureException`, server actions do too, and `middleware.ts`'s
existing `catch` blocks (`middleware.ts:172-175`) gain a
`Sentry.captureException(error)` line each.

## 2. Error boundaries & custom error pages

Next.js App Router error boundaries, one per route group so an error in
`/admin` doesn't take out `/dashboard`:

- `app/global-error.tsx` — root fallback, catches errors `app/layout.tsx`
  itself throws. Must render its own `<html>`/`<body>` (Next requirement) and
  cannot use the site's normal layout/CSS, so keep it inline-styled and
  minimal.
- `app/error.tsx` — public site (jobs list, job detail, marketing pages).
- `app/dashboard/error.tsx` — seeker/employer dashboards.
- `app/admin/error.tsx` — admin console.
- `app/not-found.tsx` — 404s, replacing Next's default.

Each `error.tsx` is a client component (Next requirement) that:
1. Calls `Sentry.captureException(error)` in a `useEffect` on mount.
2. Renders using the same `PageHead`/`clay` visual language as the rest of
   the section (dashboard error page looks like a dashboard page, not a
   generic crash screen).
3. Offers a "Try again" button (`reset()`, the function Next passes in) and
   a "Contact support" link/mailto using the existing WhatsApp/support
   contact pattern already centralized in `lib/brand.ts`
   (`SUPPORT_WHATSAPP_NUMBER`) — reuse it, don't hardcode a new number.
4. In development, additionally shows `error.message` / `error.digest` for
   debugging; suppressed in production (don't leak internals to users).

`not-found.tsx` needs no Sentry reporting (404s aren't application errors)
— just the same visual language, a "Back to jobs" / "Back to dashboard"
link depending on where the user is likely coming from is out of scope for
v1: a single site-wide 404 pointing at `/` and `/jobs` is enough.

## 3. Toast system

Adopt **sonner** (`npm install sonner`) as the single toast primitive,
replacing `components/toast.tsx`'s bespoke implementation. Reasons: it has
an imperative API (`toast.success()` / `toast.error()` / `toast.promise()`)
that works from client components, server-action error handling, and
`error.tsx` boundaries alike — the current component only works by reading a
URL search param a redirect set, which means client-side failures (a failed
`fetch`, a thrown error in an event handler) have no way to show one today.

- `<Toaster />` mounted once in `app/layout.tsx`, themed via its
  `toastOptions.className`/`style` props to match the existing `clay` card
  look (same border-radius, shadow, and color tokens already in
  `app/globals.css`) rather than sonner's default styling.
- Success/info toasts: `role="status"`, matches current `Toast` behavior.
- Error toasts: `role="alert"`, red/destructive styling matching `Flash`'s
  existing error palette (`components/dashboard-ui.tsx:114`).
- **Redirect-driven flow (existing pattern)**: `app/dashboard/*/page.tsx`
  reading `?error=`/`?claimed=` continues to work, but instead of rendering
  the inline `<Flash>` banner it fires the equivalent `toast.success()` /
  `toast.error()` client-side (a small `<ToastFromSearchParams>` client
  component reads the params once on mount and calls sonner, then the URL
  param is not otherwise consumed for rendering). `Flash` is deleted once
  every call site is migrated — no two competing "here's what just
  happened" mechanisms.
- **New imperative flow**: any client-side error (failed fetch in a client
  component, thrown error caught before it reaches an error boundary) calls
  `toast.error(authErrorMessage(err.message))` or similar directly — reusing
  `lib/auth-errors.ts`'s existing message-mapping pattern, extended with a
  couple of generic non-auth cases if needed, rather than a second message
  table.
- Server actions that currently `redirect(...&error=...)` keep doing so
  (it's the correct pattern for a POST/redirect/GET-driven mutation); this
  spec doesn't rearchitect that, only how the resulting message renders.

## 4. Skeleton loaders

Next.js `loading.tsx` per data-heavy route, backed by a small shared
`components/skeleton.tsx` primitive (`<Skeleton className="..." />`, a
`div` with a pulsing `bg-*` animation via Tailwind, sized per use with
`className`) rather than one bespoke skeleton component per page:

- `app/jobs/loading.tsx` — job list skeleton (card grid matching the real
  job card layout).
- `app/jobs/[slug]/loading.tsx` — job detail skeleton.
- `app/dashboard/seeker/loading.tsx`, `app/dashboard/employer/loading.tsx` —
  dashboard overview skeleton (stat tiles + table rows).
- `app/admin/**/loading.tsx` — admin table skeletons, one per top-level
  admin section (`jobs`, `applications`, `candidates`, `employers`,
  `moderation`, `seekers`), reusing `TableFrame`'s existing markup
  (`components/dashboard-ui.tsx:128`) with skeleton rows instead of real
  `<tr>`s so the loading state doesn't jump/reflow when data arrives.

Skeletons use `useReducedMotion`-aware pulsing (same pattern already used in
`components/toast.tsx:25`) — no animation if the visitor has reduced motion
set.

## 5. Empty / fallback states

One reusable `<EmptyState icon={...} title="..." description="..."
action={...} />` component (`components/empty-state.tsx`), styled with the
existing `clay` card language, used wherever a list can legitimately be
empty:

- `/jobs` with no results matching filters → "No roles match your filters"
  + a "Clear filters" action.
- Seeker "My applications" / "Saved jobs" / "Alerts" with zero rows →
  respective empty copy + a relevant CTA (e.g. "Browse jobs").
- Employer "Applications" / "Jobs" with zero rows → "Post your first job" /
  "No applications yet".
- Admin tables with zero rows for the current filter → generic "No results"
  variant.

This is presentational only — no new data-fetching logic, each page already
knows its row count from the query it runs.

## Testing / verification

- `error.tsx`: temporarily throw in a page/server component per route group,
  confirm the right themed error page renders and the error appears in
  Sentry's issue stream within the environment tag it should (`development`
  locally, `preview`/`production` on deploy).
- `global-error.tsx`: temporarily throw inside `app/layout.tsx`, confirm the
  root fallback renders (won't have normal nav/CSS — verify it's still
  legible).
- `not-found.tsx`: visit a nonexistent route, confirm custom 404 renders.
- Sentry alert: trigger a real captured exception in `production` after
  deploy, confirm the email alert fires.
- Toasts: exercise one redirect-driven success (existing `claimApplications`
  flow), one redirect-driven error, and one new imperative client-side error
  toast; confirm `role="status"` vs `role="alert"` and visual styling match
  `clay`.
- Skeletons: throttle network (Chrome DevTools) on `/jobs`, a dashboard
  page, and an admin table, confirm skeleton renders before real content
  with no layout shift on swap.
- Empty states: filter `/jobs` to zero results, view a fresh seeker/employer
  account's empty lists, confirm each empty state's copy and action.
- `npm run lint` and `npm run build` clean after all changes.
