# jobs.pac.africa — Frontend and Dashboard Build Brief

**Repo:** `Gordian-Knotz/job-pac`
**Stack:** Next.js 15, Supabase, shadcn/ui, Vercel, Framer Motion
**Date:** 19 August 2026
**Owner:** Imran

Read the repo first. Understand the current routes, auth setup, and the two live entry points before writing a single line.

---

## 1. Design System

### Theme

Dark and premium. Clay morphism applied site-wide — not glass morphism. Clay morph on a dark background is intentional and differentiated. Most clay morph implementations use light surfaces. This one does not.

Full dark and light mode support, parity with ActivHR (activ-hr.vercel.app). Same component, two moods. Clay in light mode is warm white and creamy with soft depth. Clay in dark mode is deep charcoal with thick offset shadows and a matte surface.

### Colour Tokens

| Token | Dark mode | Light mode |
|---|---|---|
| Background | `#0A0A0A` (ink) | `#F5F5F0` (bone) |
| Surface (clay) | `#1A1A1A` | `#FFFFFF` |
| Surface raised | `#222222` | `#F0EDE8` |
| Brand accent | `#E8532E` | `#E8532E` |
| Text primary | `#F5F5F0` | `#0A0A0A` |
| Text secondary | `#8A8A8A` | `#666666` |
| Border subtle | `#2A2A2A` | `#E0E0DA` |

Orange `#E8532E` appears on interactive elements only: buttons, tags, active nav states, focus rings. It does not bleed into card surfaces.

### Typography

| Role | Family | Notes |
|---|---|---|
| Display / Headings | Source Serif 4 | Expressive weight for hero and section heads |
| Body | IBM Plex Sans | All prose, labels, nav |
| Mono / Data | IBM Plex Mono | Job codes, dates, status labels |

### Clay Morph Specification

Apply consistently across all elevated surfaces: cards, modals, drawers, nav bar, sidebar, form inputs, dropdowns.

```css
/* Dark mode clay surface */
background: #1A1A1A;
border-radius: 16px;
box-shadow:
  8px 8px 16px rgba(0, 0, 0, 0.6),
  -4px -4px 10px rgba(255, 255, 255, 0.03);
border: 1px solid rgba(255, 255, 255, 0.05);

/* Light mode clay surface */
background: #FFFFFF;
border-radius: 16px;
box-shadow:
  8px 8px 20px rgba(0, 0, 0, 0.12),
  -4px -4px 12px rgba(255, 255, 255, 0.9);
border: 1px solid rgba(0, 0, 0, 0.04);
```

### Ambient Motion

Background layer: noise grain texture at 4 percent opacity layered over a slow-moving gradient mesh that shifts between the ink background and a deeply muted version of the orange. The mesh completes one cycle every 12 seconds. Never distracting, always alive.

No floating particles. No bouncing elements.

Framer Motion handles all component animation:
- Scroll-driven section reveals: `fadeInUp` with `viewport={{ once: true }}`
- Card hover: subtle `y: -4` lift with shadow deepening
- Page transitions: `layoutId` shared element transitions where applicable
- Drawer and modal: spring-based enter and exit

Respect `prefers-reduced-motion`. All animation should be opt-out safe.

---

## 2. Public Navigation

### Problems with current nav

Too sparse, no visual weight, no premium feel, no hierarchy between the two actions.

### What it becomes

A clay-surfaced bar that sits slightly elevated from the background. Not floating, not flat — it has physical presence.

**Structure left to right:**

- PAC Africa logo with proper breathing room and a subtle vertical divider
- Browse Jobs — ghost style, no fill, just label
- Post a Job — solid clay pill with orange text, clear primary action
- Sign In — ghost, smaller weight than Post a Job
- Theme toggle (dark/light) — icon only, far right

**Scroll behaviour:**

On scroll past 60px the nav compresses slightly in height, the clay surface deepens, and a backdrop blur kicks in. Smooth transition, 300ms ease. Signals that the user has moved into the page.

**Mobile nav:**

Hamburger reveals a full-screen clay overlay. Links stack vertically with generous tap targets. Theme toggle at the bottom. Closes on route change.

### Dashboard nav (sidebar — replaces top nav inside auth)

Once signed in, the top nav gives way to a left sidebar. The sidebar is always visible on desktop. On mobile it becomes a bottom tab bar for the primary four sections and a hamburger for the rest.

Sidebar anatomy top to bottom:
1. PAC logo and product name "jobs.pac.africa"
2. User avatar, name, company name (employer) or "Job Seeker" label
3. Navigation items (see per-dashboard sections below)
4. Collapse toggle at the bottom
5. Theme toggle
6. Sign out

Collapsed state: icons only, tooltips on hover. Expands on hover or on toggle click. Smooth spring transition.

---

## 3. Homepage

### Layout

Hero is minimal: big Source Serif 4 headline, a single supporting line in IBM Plex Sans, and two clay pill buttons ("Browse Jobs" and "Post a Job"). Headline is the only thing doing the talking. No stat bar. No numbers. Confidence through restraint.

Ambient background is doing the heavy lifting visually.

Below the hero: job feed begins immediately. No interstitial sections. No "how it works." The jobs are the proof.

### Job Feed on Homepage

Show the most recent postings in a two-column grid on desktop, single column on mobile. Same cards used on the Browse Jobs page. No infinite scroll here — show 8 to 12 and link to Browse Jobs for the rest.

---

## 4. Job Cards

Clay morph surface. Matte, tactile, premium.

**Card face shows:**
- Job title (Source Serif 4, medium weight)
- Company name
- Location (county, city)
- Employment type tag (Full Time / Part Time / Contract / Remote) — small clay pill
- Posted date in IBM Plex Mono
- Save button (bookmark icon, top right corner of card)

**Hover state:**
- Card lifts `y: -4` with deepened shadow
- A thin orange left border fades in
- Save button becomes visible if hidden

**Click:**
- Goes to the job detail page. Not a drawer. The card itself is the entry point.

---

## 5. Browse Jobs Page

### Filters

Left sidebar (desktop) or a slide-down panel triggered by a filter button (mobile).

Filter options:
- Keyword search (title and description)
- Location (Kenyan counties, multi-select, Nairobi checked by default)
- Category (Tech, Finance, NGO, Healthcare, Sales, Admin, Engineering, Creative, Other)
- Employment type (Full Time, Part Time, Contract, Internship, Remote)
- Experience level (Entry, Mid, Senior, Director)
- Posted within (Today, Last 3 days, Last 7 days, Last 30 days)
- Salary range (slider, optional, only shows if employer set it)

Active filters appear as dismissible clay tags below the search bar. A "Clear all" action appears when any filter is active.

### Results

Same clay cards as homepage. Sort by: Most Recent (default), Most Relevant, Salary High to Low.

Pagination at the bottom. Not infinite scroll.

Empty state when filters return nothing: short message, "Clear filters" button, and a link to post a job aimed at employers who might have found the empty state.

---

## 6. Job Detail Page

Full-width layout with a sticky right panel on desktop (apply action + company info). Single column on mobile.

Left column:
- Job title, company, location, employment type tag, posted date
- Full job description with proper typography — headings, lists, paragraphs all styled. Not a raw HTML dump.
- Requirements section
- About the company section

Right panel (sticky):
- Salary range if provided
- Apply button — respects auth state (see section 8)
- Share button with copy-link fallback
- Report listing link

Below the main content: Related jobs strip (3 cards, same category or location).

---

## 7. Auth Gate — Post a Job and Apply

This applies to both the "Post a Job" nav button and the "Apply" button on job detail pages.

**If signed out:**
Redirect to `/auth/signup?next=[current-path]`. After auth, they land back where they started. Server-side redirect, no client flash.

**If signed in as employer or admin:**
"Post a Job" goes directly to the post form. "Apply" shows a message that employers cannot apply — link to browse as seeker.

**If signed in as seeker:**
"Post a Job" shows a clay interstitial modal explaining employer accounts. Two actions: "Learn about employer accounts" and "Dismiss." No silent rejection. "Apply" proceeds to the application flow.

All redirect and role logic is resolved server-side on first paint.

---

## 8. Seeker Dashboard

Sidebar sections:
- Overview
- Browse Jobs (links to public browse page)
- My Applications
- Saved Jobs
- My Profile
- Settings

### Overview

Quick stats in clay cards: applications submitted, applications shortlisted, saved jobs count. No chart needed at this stage.

Recent activity feed below: last 5 application status changes with timestamp.

### My Applications

Table view with columns: Job Title, Company, Applied Date, Status.

Status tags: Applied, Under Review, Shortlisted, Rejected, Hired. Each status has a distinct colour within the brand palette.

Click any row to open the slide-out drawer (see section 10).

### Saved Jobs

Same clay cards as the public browse page. Unsave action on the card. Click goes to job detail.

### My Profile

- Avatar upload
- Full name, headline, location (Kenyan county)
- CV upload to R2 (single file, PDF only, max 5MB)
- Skills (freeform tags)
- LinkedIn URL (optional)

Show current CV filename and upload date. Replace button to swap it out.

---

## 9. Employer Dashboard

Sidebar sections:
- Overview
- My Jobs
- Applications (unified inbox)
- Messages
- Company Profile
- Settings

### Overview

Clay stat cards: active postings, total applications this month, shortlisted candidates, positions filled. No chart at this stage.

Recent applications feed: last 5 across all postings with applicant name, job title, and time.

### My Jobs

Table or card grid (user can toggle). Columns/fields: Job Title, Status (Draft, Active, Paused, Closed), Applications count, Views count, Posted date, Actions (Edit, Pause, Close).

New posting button: prominent, top right, orange.

Post a Job form fields:
- Job title
- Category
- Location (county and city)
- Employment type
- Experience level
- Salary range (optional, min and max, or "Competitive")
- Job description (rich text editor — keep it simple, no kitchen sink)
- Requirements
- Application deadline (optional)
- Draft save at any point

New postings go into a Pending Moderation state. They are not public until an admin approves them. Show this clearly in the posting status.

### Applications — Unified Inbox

The core of the employer dashboard.

**List view (left panel or full width):**

Each row shows: applicant name and avatar, job title they applied for, application date, current status tag, and a quick action to change status.

**Filters above the list:**
- Search by applicant name
- Filter by job posting (dropdown of their active jobs)
- Filter by status (All, New, Under Review, Shortlisted, Rejected, Hired)
- Sort by: Newest, Oldest, Name A to Z

**Slide-out drawer (right panel):**

Opens when clicking any application row. The list stays visible and scrollable.

Drawer contents:
- Applicant name, avatar, headline
- Applied to: job title with a link to the posting
- Application date and time
- Status selector (dropdown) — changing it updates inline with a toast confirmation
- CV download button (pulls from R2, signed URL, expires in 60 seconds)
- Cover letter if provided
- Notes field — internal employer notes, not visible to applicant
- Activity log: timestamped history of every status change on this application

Drawer opens with a Framer Motion spring slide from the right. Closes on Escape or clicking outside.

### Messages

Placeholder for now. Show a "Coming soon" clay card. Do not build the messaging feature in this iteration.

### Company Profile

- Company name and logo upload
- Industry, company size, website URL
- About us (short text, 300 char limit)
- This becomes the "About the company" section on all their job postings.

---

## 10. Admin Dashboard

Sidebar sections:
- Overview
- Moderation Queue
- All Jobs
- All Applications
- Employers
- Seekers
- Settings

### Overview

Platform-wide clay stat cards: total active postings, postings pending moderation, total registered seekers, total registered employers, applications submitted this month.

### Moderation Queue

The most important admin feature post-hack. Every new employer posting lands here before going live.

List of pending postings with: job title, employer name, submitted time, and two actions — Approve (sends it live) and Reject (with a required reason field sent back to the employer).

Approve and Reject trigger a confirmation modal before executing. No accidental publishes.

### All Jobs

Full platform job listing with the same filters as Browse Jobs plus an admin-only status filter (Pending, Active, Paused, Closed, Rejected). Admin can force-close or force-hide any posting.

### All Applications

Same unified inbox as the employer dashboard but across all employers. Additional filter: Filter by employer. Admin cannot move application statuses — that stays with the employer. Admin can view only.

### Employers

List of all employer accounts: company name, date joined, active postings count, total applications received, account status (Active, Suspended).

Click any employer to open a detail drawer: their profile, their postings, and a Suspend or Reactivate action.

### Seekers

List of all seeker accounts: name, date joined, applications submitted, profile completion percentage, account status.

Click to open detail drawer. Admin can suspend accounts.

---

## 11. Working Order

Do not batch. Each item is its own PR against `main`.

1. Finish R2 migration and report results (see R2 brief)
2. Bump Next.js to 15.6.0 if still on 15.0.0
3. Design system: clay morph tokens, dark and light mode, font setup, ambient background component
4. Public nav rebuild
5. Homepage rebuild
6. Browse Jobs page with filters
7. Job detail page
8. Auth gate logic (server-side, all entry points)
9. Seeker dashboard
10. Employer dashboard — My Jobs and post form
11. Employer dashboard — unified Applications inbox with slide-out drawer
12. Admin dashboard — moderation queue first, then the rest
13. Dashboard sidebar nav with collapse and mobile bottom tab bar

---

## 12. Constraints

- Server components by default. Client components only where interaction demands it.
- No hardcoded copy. Route all UI strings through a `content` module.
- Every page: working empty state, loading state, and error state. No blank screens on any path.
- No new frameworks or UI libraries beyond what is already in the stack.
- Payments are out of scope for this iteration.
- `prefers-reduced-motion` respected on all animation.
- WCAG AA contrast minimum on all text, both dark and light mode.

---

## 13. What to Report Back

- Confirmation that R2 migration ran cleanly and the 178 unrecoverable rows as CSV.
- A note per section as it ships: deployed URL and anything to click through.
- Any product decision made that the owner would want to know about. Do not hide those in the diff.
