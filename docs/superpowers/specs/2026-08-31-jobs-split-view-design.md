# /jobs browse page — Indeed-inspired split view

## Context

The `/jobs` browse page today is a single-column card grid with a left
sidebar (`FilterPanel`) and a numbered card grid — clicking a job navigates
to `/jobs/[slug]`, a full page load away from the list. The user wants it to
take visual/interaction inspiration from Indeed's job search UI instead: a
two-pane split view (scrollable job list on the left, a sticky detail panel
on the right that swaps instantly on click, no page navigation), a
filter-pills row in place of the sidebar, benefit-tag pills on cards, and an
instant top action bar ("Apply now" + save + match%) in the detail panel.
This is inspiration, not a literal clone.

Hard constraint: **no backend changes**. No new DB columns, migrations, or
RPCs. Everything in this design is derived from data `app/jobs/page.tsx`
already fetches today (`job_type`, `is_remote`, `required_skills`, joined
`category`/`location` names, `saved_jobs`, and the existing
`matchPercent()` util).

This followed the `superpowers:brainstorming` skill's architectural path.
The design below was refined over several rounds of clarifying questions and
confirmed by the user ("Yes, matches").

Separately, the user flagged the admin/applications filter page as feeling
cluttered and wanting a sleeker look. That is explicitly deferred to **after**
this redesign ships, as its own separate brainstorming task. Not part of
this spec.

## Routing

`/jobs/[slug]` (and its `loading.tsx`) stay exactly as they are today, now
serving two roles instead of one: a direct-link/SEO fallback (shared URLs,
search engine indexing, anything that lands on a job without going through
the browse page) and the mobile full-screen detail target (see Mobile,
below). The primary desktop browsing path becomes the split view on `/jobs`
itself — clicking a card there never navigates.

## Selection and data flow

`app/jobs/page.tsx` keeps every piece of server-side logic it has today
unchanged: filter/sort param parsing, the Supabase query (including joins),
pagination (`page` / `PER_PAGE`), the saved-job id lookup, and
`matchPercent()` computation per job. The only change is what it does with
the result: instead of rendering a card grid directly, it hands the fetched
`jobs` array (each already carrying its `category`/`location`/`matchPercent`
/saved-state) to a new client component that owns the two-pane body.

Selection is `useState` in that client component — the id of the currently
selected job, defaulting to the first job in the list on mount. Clicking a
list card updates that state; the detail pane re-renders from data already
in memory. No new network request, no route change. Pagination remains
numbered pages via the existing URL param, which naturally resets selection
to the new page's first job.

## List cards

Existing `components/job-card.tsx` is reused but denser, with benefit-tag
pills added — all derived from data already on the job object:

- Employment type (`job_type`) and a Remote badge (`is_remote`) as pills
- Top 2-3 entries from `required_skills` as pills
- Category and location names (already joined) as pills instead of plain text

The existing save/bookmark icon and match% badge stay on the card, restyled
to fit the denser layout. Because `JobCard` is also used elsewhere (e.g. the
seeker dashboard's saved-jobs list), the dense/pill variant is added as a new
prop (e.g. `variant="compact"` or similar) rather than changing the
component's default shape — other call sites keep rendering exactly as they
do today. Before implementation, every existing call site of `JobCard` is
checked so none regress.

## Detail panel

Sticky right-hand pane, populated from the selected job's already-fetched
data. Top action bar, visible without scrolling:

- Primary "Apply" button (existing apply flow, just relocated/made primary)
- Save/bookmark icon (existing `saved_jobs` toggle, relocated)
- Match% badge (existing `matchPercent()` value, relocated and made prominent)

Below the action bar: the job's title, meta (category, location, employment
type, remote badge), and full description — the same content
`/jobs/[slug]` renders today, reused rather than duplicated where
practical.

## Filters (replaces the sidebar)

Top of the page, in order:

1. Full-width search bar (unchanged from today)
2. A filter-pill row: Employment Type and Remote as always-visible pill
   groups, plus a "More filters" button that opens an anchored dropdown
   panel (not a full-screen drawer) containing Category (select), Location
   (select), Experience Level (pills), and Posted Within (pills) — the same
   filter set `FilterPanel` exposes today, just relocated
3. The active-filter chips row and the sort + result-count line, placed
   above the list column only (not merged into the filter-pill row, so it
   doesn't compete with the detail pane for width)

Every filter continues to work exactly as it does today: it's a URL param
change that re-runs the same server-side query in `app/jobs/page.tsx`.
Nothing about how filtering works changes, only where the controls live.

## Sort options

Drop "Highest Pay" from `sortOptions` in `lib/content.ts` — salary is rarely
published on these listings, making the option mostly dead weight — leaving
Most Recent / Oldest First. `app/jobs/page.tsx`'s `params.sort === "salary"`
branch is removed along with it. Low-risk, contained change.

## Mobile (below the two-pane breakpoint)

Single column, list only — no split view, no sidebar. Tapping a card
navigates to the full-screen detail view, reusing the existing
`/jobs/[slug]` route and markup, with a back button/link returning to the
list (preserving filter/sort/page state via the URL, same as today). This is
not an overlay drawer; it's the same page navigation the whole site already
uses at `/jobs/[slug]`, just now mobile-only instead of the universal path.

The breakpoint switch is CSS-based (e.g. `hidden lg:block` / `lg:hidden`
pairs), consistent with the existing pattern already used for the mobile
`<details>` filter panel vs. the desktop sidebar.

## Key files

- `app/jobs/page.tsx` — server component; query/filter/sort/pagination logic
  unchanged; JSX restructured (search row, filter-pill row + "More filters"
  popover, then hands `jobs`/`savedIds`/seeker context to the new client
  component instead of rendering the grid directly)
- `components/job-card.tsx` — add a compact/pill variant, reused as-is at
  existing call sites
- `lib/match.ts` — `matchPercent()` reused unchanged, called from both card
  and detail panel
- New `components/jobs-split-view.tsx` (client) — owns selection state,
  renders list pane + detail pane, handles the mobile/desktop CSS switch
- `app/jobs/[slug]/page.tsx`, `app/jobs/[slug]/loading.tsx` — unchanged,
  now the SEO-fallback + mobile-detail target
- `lib/content.ts` — `sortOptions` trimmed; `browse.*` copy extended for new
  UI text (e.g. "More filters" label)

## Error handling

No new failure modes are introduced — the query, filters, and mutations
(save/apply) are all existing code paths that already have error handling
(toasts via `ToastFromSearchParams`, Sentry capture in error boundaries). The
one new client-side state (selected job id) has no failure mode: it always
defaults to the first job in a non-empty list, and the zero-results case
already short-circuits to the existing `EmptyState` before the split view
would render.

## Testing / verification

- `npx tsc --noEmit` and `npm run build` clean
- Manual smoke test on the dev server: desktop split view (card selection
  swaps the detail pane instantly, Apply/Save/Match% all work from the
  action bar), mobile breakpoint (list-only, tap-through to full-screen
  detail, back navigation preserves filters), filter-pill row + "More
  filters" popover (each filter still updates the URL and results
  correctly), sort options (Most Recent / Oldest First only, no salary
  option), pagination (numbered pages still work and reset selection),
  saved-job toggle and match% parity with the pre-redesign page for a
  logged-in seeker account
- Confirm no regression at other `JobCard` call sites (e.g. the seeker
  dashboard's saved-jobs list)

## Out of scope

- Any backend/DB change (explicit hard constraint)
- Admin/applications filter page decluttering (deferred, separate task)
- Infinite scroll (pagination stays numbered pages)
