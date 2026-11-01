# FieldSync — UI Redesign: Audit + Design-System Decisions

Status: **complete** — the audit below was implemented in
slices (a)–(e), merged as PRs #49–#53 (2026-11-01). No code
in §1–§4 has been rewritten to match the finished state: §1
is the original audit evidence, §§2–3 are the decisions the
slices followed, §4 is the work order as planned, and §5
records what was verified vs what remains pending. The
implementation slices in §4 are all done; the remaining
verification (visual browser pass, signed-in flows, DB-backed
checks) is recorded in §5 and in `docs/16-PROJECT-TRACKING.md`.

Base: main `68694f5a88e1437e7137a0f327ee56b6f271ae79`
("Show sign-up/invite rules on unlinked accounts instead of API
unavailable (#47)", 2026-11-01). Audit by reading every web page and
component at that commit (see §1 file references). No browser or visual
check was done in this slice — see §5. Nothing in this document
changes the API, the data model, sync semantics, offline outbox rules,
conflict rules, auth, or any user-facing behaviour except presentation
and the stale-copy fixes named in §1. No new feature, role, screen, or
copy is invented here: every screen referenced already exists, and
every behaviour described already exists in code or in the planning
pack (`docs/05`, `docs/06`, `docs/11`).

How to read this document: §1 is the evidence (what is wrong, where,
with file references). §2–§3 are the decisions later slices must
follow — a worker that disagrees with a decision must log the
deviation in `docs/15-DECISIONS.md` and get it batched through the
manager role before implementing something different. §4 is the work
order. §5 is the quality gate every slice must pass.

## 1. Audit

### 1.0 Baseline: what the web app actually is today

The web app is Next.js 14 (app router), Clerk auth, Mapbox, Socket.io,
Yjs, and Dexie offline — with **no styling system at all**:

- There is no `globals.css`, no CSS file anywhere under `apps/web/`,
  no CSS framework, no PostCSS/Tailwind config, and **zero**
  `className` attributes in any page or component. All styling is
  inline `style` props (about 90 of them) plus browser defaults.
- The only shared visual constants are `STATUS_STYLES` /
  `PRIORITY_STYLES` in `packages/shared/src/index.ts` — and they are
  dead code in the web app: their values are Tailwind class strings
  (`bg-slate-200 text-slate-800`, …), no Tailwind is installed, and
  no web file imports them. The rule in `docs/06` ("define a single
  `STATUS_STYLES` constant … do not hardcode colours per screen") is
  therefore satisfied on paper and violated in practice: colours that
  do exist are hardcoded per component (see §1.7, §1.9), and statuses
  are mostly shown as raw codes with no colour at all.
- `apps/web/package.json` has no styling dependency. The existing
  brand colours live only in `apps/web/app/layout.tsx`
  (`themeColor: '#0f5132'`), `apps/web/public/manifest.json`
  (`theme_color: '#0f5132'`, white background), and scattered inline
  hex values (`#fff3cd`, `#f8d7da`, `#b45309`, `#0f5132`, `#842029`).
- Pages are server components that fetch with `fetchMe` / `fetchJobs`
  / `fetchJob` (`apps/web/lib/api.ts`); interactive work lives in
  client components under `apps/web/components/`. That split is
  sound and must be preserved — the redesign restyles it, it does
  not restructure data flow.

Consequence of the baseline: every page looks like unstyled browser
defaults (default serif, default blue/purple links, default grey
buttons and inputs), spacing and typography differ page to page, and
there is no way to tell at a glance what state a job is in, what is
pending sync, or what the primary action on a screen is. The audit
below is specific because the problems are specific — most are
one-line facts about named files, not matters of taste.

### 1.1 App shell — `apps/web/app/layout.tsx`

- **No visual identity.** The header is a bare flex row:
  `FieldSync` in `<strong>`, plain text links, no company name (the
  signed-in user's company is known — `page.tsx` already renders it —
  but the shell never shows it), no role indicator, no sync status in
  the shell. `docs/06` S03 requires a top bar with company name, sync
  status, and user menu, navigated by role. Today sync status appears
  only when something is wrong (`OfflineBanner`, and only for
  signed-in users) and live status only on the board (`LiveBoard`).
- **Navigation has no active state, no hierarchy, and small targets.**
  Header links have no padding/min-height (the 44px rule from
  `docs/06` principle 1 and PR #33 is met in most components but not
  here), no indication of the current page, and no responsive
  behaviour: on a narrow phone the four signed-in links
  (Board / My Day / Map / New job) plus the user button wrap or crowd
  with no defined layout. "New job" is shown to every signed-in role
  in the shell even though technicians are refused on the page itself
  (`apps/web/app/jobs/new/page.tsx`); role-based navigation (S03) is
  not implemented in the shell.
- **No skip link, no footer, no page container.** Every page repeats
  its own `padding: '2rem'` (detail and map use `1rem`; detail alone
  sets `maxWidth: '720px'`). There is no shared content width, so
  line length and alignment drift between pages.
- **No font, no reset, no focus styling.** No `globals.css` means no
  font stack (browser default serif on some platforms), no
  `box-sizing` / margin reset, and focus indication is whatever the
  browser supplies. No file suppresses outlines (good — PR #33), but
  nothing defines a visible, consistent focus ring either (see §1.11).
- **Clerk chrome is unstyled.** `UserButton` / `SignInButton` render
  with Clerk defaults against an otherwise unstyled page; the
  sign-in/up pages (§1.8) get no branding at all.
- **PWA install control is invisible by design, with no fallback.**
  `PwaRegister` renders nothing until `beforeinstallprompt` fires,
  so on browsers without that event there is no install affordance or
  explanation anywhere (US-X3). That behaviour is correct to keep —
  no dead button — but the redesign must decide where install
  guidance lives (slice (d); no new behaviour, presentation only).

### 1.2 Homepage — `apps/web/app/page.tsx`

- **Stale copy presented as current product.** The signed-in view
  ends with "The dispatcher board and technician My Day screens are
  the next Phase 1 slices." Both screens have existed since PR #10.
  The signed-out view is a bare heading + two links with no
  explanation of what FieldSync does beyond one sentence, no
  sign-up/invite rule, and no link to the board/My Day for a user who
  is signed in but lands here (the header provides those links, but
  the page itself does not guide the user onward).
- **Raw data shown as UI.** Role renders as the raw code
  (`ADMIN` / `DISPATCHER` / `TECHNICIAN`) and the welcome line shows
  name and email in one undifferentiated paragraph. No card, no
  hierarchy, no next step.
- **Developer-facing error text.** The API-down branch says "Start
  the API on :3001 and refresh." That is a local-dev instruction
  shown to end users. The same wording appears on the board and
  My Day (§1.3–§1.4). The `USER_NOT_LINKED` branch (PR #47) is the
  model to follow: it explains the sign-up/invite rules in plain
  language. Later slices must give the API-down state equivalent
  plain-language copy plus a retry action, without changing the
  underlying error handling in `lib/api.ts` (the `errorCode`
  preservation from PR #47 must be kept).

### 1.3 Dispatcher board — `apps/web/app/board/page.tsx`, `components/LiveBoard.tsx`

- **Not a board.** Despite the name and `docs/06` S11 / `docs/11`
  S11 (Kanban columns, cards, counts, drag-to-change), the page is a
  vertical list of seven status sections, each a heading plus a plain
  `<ul>` of text lines. All seven sections render even when empty
  (seven headings, seven empty lists on an empty day). Cards do not
  exist: no customer/address/time/technician/priority/photo-count
  card, no status colour, no overdue or unassigned grouping.
- **Status and priority are illegible.** Status headings and the
  per-job line show raw codes (`SCHEDULED`, `EN_ROUTE`, `ON_HOLD`,
  `URGENT`). No badge, no human label ("En route"), no colour, no
  icon. `STATUS_STYLES` labels exist in the shared package and are
  unused here. Priority is trailing text after the time window,
  visually equal to everything else — URGENT does not stand out, and
  jobs are not ordered with urgent first within a section.
- **Required dispatcher signals are missing.** US-D4 requires
  persistent "Overdue" and "Unassigned" filters/counts; neither
  exists. The count line reads `{total} job(s) found.` — with no
  space in the rendered "18job(s) found." form — and there is no
  breakdown (today / unassigned / overdue / completed today) as
  specified in `docs/11` S11. There is no date control: the board
  always shows the `limit=100` list with no date filter, so "today"
  cannot be isolated from the board itself.
- **Search/filter UX is a full reload with lossy refresh.** The
  form is a GET form (full page navigation on every search). The
  "Refresh" link is `<Link href="/board">`, which drops the active
  search/status filters. The search input and select have
  `aria-label`s (good) but no visible labels, and the select options
  are raw codes. There is no "clear filters" control and no
  empty-results state: a search with no matches renders seven empty
  sections and the count line, with no statement of what was searched
  or what to change (`docs/06` empty-states rule).
- **No loading state.** The page is a server component with no
  `loading.tsx`, no Suspense boundary, and no skeleton: navigation
  shows the previous page until the new one arrives, then the whole
  list appears. The same is true of every server page (§1.10).
- **Live status is small, text-only, and easy to miss.**
  `LiveBoard` renders one 0.9rem paragraph ("● Live" /
  "○ Live unavailable (manual refresh still works)") above the
  search form, with presence names appended in the same line. The
  dot + words combination is good (not colour alone), but its size,
  position, and lack of a stable shell slot mean a dispatcher can
  miss that the board is stale. Presence has no avatar/initial and
  no "viewing" context.
- **Heading lies by role.** The `<h1>` is always "Dispatcher
  board", even for a technician, who sees only their own jobs
  (server-side scoping, correctly preserved). The page title must
  reflect what the viewer actually sees without changing scoping.
- **What works here and must be preserved:** search + status filter
  via URL query (shareable, back-button-safe — keep the GET form
  mechanics, restyle it); server-side role scoping with no client
  role filtering; the `USER_NOT_LINKED` explainer; `LiveBoard`'s
  graceful degradation (manual refresh still works when the socket
  is down).

### 1.4 My Day — `apps/web/app/my-day/page.tsx`, `components/CacheJobs.tsx`

- **No grouping, no ordering signal.** `docs/06` S20 / `docs/11`
  S20 require Overdue first, then Today in window order, with a
  status pill and pending-sync dot per row. The page renders one
  flat `<ul>` in API order, with raw status/priority codes inline.
  Overdue jobs are not identified at all (no overdue computation is
  shown; a past-date SCHEDULED job looks identical to a future one).
  US-T1 (today's + overdue first, window, priority, address, status)
  is only partly met: address is not shown on the row at all.
- **Stale copy, again user-facing.** "Read-only in Phase 1. Status
  changes, checklist toggles, photos, and signature come in Phase 2."
  None of that is true any more: job detail has had all four since
  PRs #12–#13/#16. A technician reading this is told the app cannot
  do what it can do.
- **No sync visibility on the page itself.** US-T5 requires a
  "Pending sync (n)" badge on My Day. The only pending indicator is
  the global `OfflineBanner` (visible only when offline or when
  items are pending — correct) plus per-job queued messages on the
  detail page. My Day has no per-row pending dot, no pending count
  in its header, and no "last synced" line (the wireframe's
  `[Sync: Online | Last synced 09:12]` header does not exist
  anywhere in the app; do not invent a last-synced timestamp — the
  sync worker has no such value to show, so slice (b) must show only
  the pending count the app already knows via `getPendingCount`).
- **Empty state is a bare sentence.** "No jobs scheduled for today."
  No tomorrow link, no "you're clear" guidance, no dispatcher
  affordance. The `docs/06` rule (role-appropriate empty copy) is
  not met.
- **Date handling is invisible.** The heading shows the
  America/Chicago date string, but there is no explanation that the
  day is the company day, and no way to view another day. Keep the
  existing date logic; presentation only.
- **What works:** `CacheJobs` auto-caching is invisible and correct;
  the signed-out / unlinked / API-down branches match the board's
  (same copy fixes apply).

### 1.5 Job detail — `apps/web/app/jobs/[id]/page.tsx` and its components

This is the most-used screen (technician in the field, dispatcher
checking a job) and the least structured: one long single column in
which at least ten sections compete with no visual hierarchy.

- **No header, no status legibility.** The title is the `<h1>`;
  status/priority/version render as one undifferentiated paragraph:
  "Status: SCHEDULED · Priority: HIGH · Version: 3". Raw codes, no
  badge, and an internal optimistic-concurrency `version` exposed to
  the user for no user purpose. Customer, address, and window are
  three more equal-weight paragraphs. There is no sticky summary: on
  a long page the technician must scroll back to the top to re-read
  the address or window.
- **Primary actions are not primary, and not sticky.** The
  technician's status bar (`TechnicianStatusBar`) sits mid-page
  under Call/Navigate, inside a bordered box identical to every
  other section box. `docs/06` S21 requires a sticky bottom action
  bar at thumb reach with valid next statuses only; today the bar is
  neither sticky nor at the bottom, and on a phone it scrolls away.
  Conversely, dispatcher actions (`JobActions`) sit near the bottom,
  after photos, with the same visual weight as everything else.
  `TechnicianStatusBar` renders `null` for COMPLETED/CANCELLED jobs
  with no "completed/cancelled" state shown in its place — the
  section simply vanishes.
- **Two notes editors, no explanation.** Both `JobNotesForm`
  ("Notes (plain text)") and `YjsNotes` ("Collaborative notes
  (Yjs)") render on the same page for every user who `canToggle`,
  one after the other, with no guidance on which to use, how they
  relate, or which one the dispatcher sees. The Yjs panel leaks
  configuration state into user copy ("set
  NEXT_PUBLIC_YJS_WS_URL for live multi-user sync"). Both editors
  must be kept (different persistence: PATCH `internalNotes` vs Yjs
  snapshot — see `docs/07` / Phase 3 notes), but the redesign must
  make their relationship unmistakable or the page will keep
  confusing every user. Do not merge them into one editor: that
  would change sync semantics.
- **Destructive actions have no confirmation.** `docs/06`
  principle 4 requires explicit confirmation for cancel, delete
  photo, and complete-with-override. `JobActions` Cancel posts
  immediately on click (reason field is present but optional in the
  UI — the API requires a reason for cancel; an empty reason posts
  and fails server-side with a bare message). `PhotoSection`
  Delete posts immediately with no confirmation. No component in
  the app uses any confirm pattern today. Later slices must add
  confirmation without changing endpoints or payloads.
- **No busy/disabled states on dispatcher actions.** `JobActions`
  `run()` has no in-flight state: double-clicking a status button
  fires twice, with no spinner or disable. `JobSheetDownload` has
  no busy state and its error `<p>` has no `aria-live`. Other
  components do disable while busy (`ChecklistToggles`,
  `SignaturePad` save) — the inconsistency is the problem.
- **Audit timeline exposes internals.** The timeline renders raw
  action codes, raw JSON (`JSON.stringify` of `fromValue` /
  `toValue` / `conflictDetails`), and the literal rule text from
  `SyncNotices` ("(Rule: CONFLICT_RESOLVED)"). US-X1 requires actor,
  action, from → to, and timestamp in readable form. The data is
  all present; only presentation is missing. The timeline also
  keeps both `CHECKLIST_CHECKED` and `CHECKLIST_UNCHECKED` events
  (append-only audit, by design — preserve that, present it
  readably).
- **Stale footer copy.** The page ends with "Photos, signature, and
  PDF job sheet are the next Phase 2 slices — not in this one."
  All three are on the page above it. Remove in slice (c).
- **Photos section is a bare file input.** `PhotoSection` renders an
  unstyled `<input type="file">` with no button, no label, no
  caption field (S22 requires a caption field — the API stores
  `caption` and the grid renders `photo.caption`, but the upload
  flow never asks for one), no preview before upload, no progress
  beyond the text "Uploading…", and a 200px grid with no tap-to-full
  view. Pending (queued offline) photos and synced photos use the
  same figure layout with only caption text distinguishing them.
  The "Preview unavailable (storage not configured)" fallback is
  correct and must be kept.
- **Signature canvas sizing is fragile.** `SignaturePad` uses a
  fixed 320×160 canvas stretched with `width: 100%; maxWidth:
  320px`; on a wider container the drawing coordinates scale with
  the element, and the canvas background is hardcoded white (relevant
  to the dark-mode decision in §3.4). The keyboard limitation is
  honestly labelled (PR #33) and the dispatcher/admin override path
  is the documented alternative — both must be preserved, not
  "fixed" by inventing keyboard drawing.
- **Back navigation is minimal.** "← Board · My Day" text links at
  the top, small and unstyled, with no indication of where the user
  came from. On a phone these are easy to miss after scrolling.
- **What works here and must be preserved:** Call (`tel:`) and
  Navigate (Google Maps) actions with 44px targets; checklist
  toggles with 24px checkboxes, optimistic update, offline queueing,
  and revert-on-server-error; conflict banner and failed-notices
  as persistent (not toast) UI with Discard-only for rejections;
  signature-required gating messaging in `TechnicianStatusBar`;
  photo offline queueing with the 200 MB warning copy; Yjs presence
  line ("Editing now: …").

### 1.6 Create job — `apps/web/app/jobs/new/page.tsx`, `components/CreateJobForm.tsx`

- **Placeholder-as-label throughout.** All six text fields render
  with `aria-label` set to the raw field name (`title`,
  `customerName`, `addressLine1`, …) and the field name as
  placeholder, with no visible `<label>`. A sighted user sees only
  grey placeholder text that vanishes on typing; there is no way to
  tell a filled field's meaning without clearing it. US-D1 requires
  field-level validation errors; today the only error surface is one
  `aria-live` paragraph with the raw API error string, and no
  per-field error, no inline hint, and no success state (success
  navigates away, which is fine — keep it).
- **Time windows are free text.** Window start/end are plain text
  inputs with placeholder hints ("09:00"); nothing constrains format
  client-side, so a typo is discovered only via the API error. The
  date input is a native date picker (fine — keep native inputs).
- **Technician assignment is a pasted id.** The form asks for an
  "Assigned technician user id" as free text because no users-list
  endpoint exists (documented in `15-DECISIONS.md`, Phase 1 scope).
  The redesign must not invent a picker backed by an endpoint that
  does not exist; it must present the existing field honestly
  (visible label, helper text explaining where the id comes from)
  until a users-list slice exists. Same constraint as the notes
  editors: present the limitation clearly, do not fake the feature.
- **No section structure.** One 480px column, 0.5rem gaps, no
  grouping (customer / address / schedule / assignment), no
  required-field marking beyond native `required`, no summary of
  what happens after creation (job appears on the board + the
  technician's My Day — F1). The technician-refusal branch is a
  bare sentence; it should guide the technician to My Day with the
  same visual treatment as other empty states.

### 1.7 Map — `apps/web/app/map/page.tsx`, `components/MapView.tsx`

- **Only two pin colours for seven statuses.** Markers are green
  (`#0f5132`) for COMPLETED and amber (`#b45309`) for everything
  else. A dispatcher cannot tell EN_ROUTE from ON_HOLD from
  CANCELLED on the map, contradicting `docs/06` ("status colours
  must be consistent everywhere") and S12 (pins coloured by status).
  There is no legend. The selected-job panel below the map shows
  raw status/priority codes.
- **Fixed 500px map height, no responsive rule.** The map is
  `height: '500px'` at every viewport width, with a 1rem page pad.
  On a phone that is most of the screen with the job list/panel
  below the fold; on a wide desktop it is a narrow strip. No
  full-height or split-view rule exists.
- **Markers are not keyboard-accessible as job controls.** Markers
  get a click listener on the marker element with no keyboard
  equivalent; the only keyboard path to a job is the
  "Jobs without a map location" list or the no-token list. The
  unplotted-jobs section is good (jobs are never silently dropped)
  and must be kept, with the same card treatment as the selected
  panel in slice (d).
- **No loading state.** While jobs load/geocode, the page shows an
  empty map frame and heading with no loading indication; geocoding
  is sequential per job, so the wait is visible. The no-token
  fallback (list instead of a broken map) is correct and must be
  kept.
- **Map style is fixed light streets.** `mapbox://styles/mapbox/streets-v12`
  is hardcoded. Any future dark mode would need a separate map
  style — one more reason for the §3.4 decision.

### 1.8 Auth pages — `apps/web/app/sign-in/[[...sign-in]]/page.tsx`, `sign-up/[[...sign-up]]/page.tsx`

- **Bare Clerk defaults, no FieldSync context.** Each page is a
  centred `<SignIn />` / `<SignUp />` with no heading, no product
  explanation, no sign-up/invite rule, and no link between the two
  beyond Clerk's own footer. A new user who lands on sign-in with no
  invite has no way to learn — on this page — that signing in alone
  does not grant access (the PR #47 explainer exists only on
  post-sign-in pages). Later slices may add surrounding copy and
  Clerk `appearance` variables tied to §2 tokens only; they must not
  change auth behaviour, routes, or the Clerk components' internal
  flow. Note Clerk's own card has its own styling that will never
  fully match the app shell — the goal is coherence (same tokens
  where Clerk allows them), not pixel identity.

### 1.9 Offline, sync, and PWA surfaces — `components/OfflineBanner.tsx`, `components/SyncNotices.tsx`, `components/PwaRegister.tsx`, `app/offline/page.tsx`

- **Offline banner is text-only with unexamined colours.**
  `#fff3cd` (syncing) / `#f8d7da` (offline) backgrounds with default
  body text, no icon, no role/status semantics beyond the text
  itself (the text is clear — keep the wording), full-width with no
  max-width alignment to page content. Its persistence is correct
  (`docs/06` principle 3: sync state always visible, never a toast)
  and must be preserved, including the honest caveat "Jobs you have
  not opened while online are not guaranteed offline."
- **Conflict/rejection copy exposes rule codes.** `SyncNotices`
  appends "(Rule: …)" and `FailedNotices` names the raw mutation
  type ("Your change (UPDATE_STATUS)…"). The underlying behaviour —
  generated-from-`conflictDetails` text, Discard-only for server
  rejections, no Retry for rejections — is specified in `docs/07`
  §5 and `15-DECISIONS.md` and must not change; only the
  presentation (plain-language description, rule code removed from
  user view) is a redesign task.
- **Offline fallback page is stale.** `app/offline/page.tsx` says
  "FieldSync needs a connection to load jobs in Phase 2 (offline
  sync comes in Phase 4)." Phase 4 shipped. The page is served by
  the service worker when navigation fails offline, so its copy is
  what a technician actually reads with no signal. It must describe
  the real offline position (open jobs already cached; banner +
  pending counts when back in the app) without inventing new offline
  capabilities.
- **No sync-status screen.** `docs/06` S24 specifies a sync-status
  list (pending/failed outbox items, retry, last synced). It does
  not exist as a screen; pending/failed state is distributed across
  the banner, per-component messages, and `SyncNotices`. This audit
  does not invent S24 as a new screen for the redesign: slices must
  make the existing distributed state legible and consistent, and
  any dedicated sync screen is a separate product decision, not a
  styling slice.

### 1.10 Cross-cutting: forms, states, consistency

- **Forms have no shared pattern.** Visible labels exist nowhere in
  the app (every control relies on `aria-label` + placeholder or on
  surrounding text). Input/select/textarea/button styling is browser
  default everywhere except the few components that set padding or
  min-height inline. Error presentation is one `aria-live` paragraph
  per form with the raw error string; there are no field-level
  errors, no error summary, and no `aria-describedby` wiring.
  Success messages ("Saved.", "Notes saved.", "Photo saved.") are
  plain paragraphs in varying positions.
- **Buttons are inconsistent.** At least four ad-hoc variants of
  "44px + padding" recur (`0.75rem 1rem` in most places,
  `0.5rem 1rem` in `PwaRegister`/`SyncNotices`, border-only link-like
  buttons for Call/Navigate). There is no primary/secondary/
  destructive distinction: "Cancel" (destructive), "Move to …"
  (primary workflow), "Dismiss" (neutral), and "Delete" (destructive)
  all look identical. Disabled styling is browser default; busy
  states exist in some components and not others (§1.5).
- **Loading states do not exist.** No `loading.tsx`, no Suspense,
  no skeleton, no spinner anywhere. Server pages swap wholesale;
  client lists (`MapView`, `PhotoSection`) render empty until data
  arrives. The redesign must add skeletons for the board, My Day,
  job detail, and map list (§3.3) without changing fetch behaviour.
- **Empty states are inconsistent.** Good: My Day ("No jobs
  scheduled for today."), photos, checklist, signature, audit.
  Missing or misleading: board search with no results (§1.3),
  unplotted map jobs heading with no count context, homepage
  signed-out state (§1.2). Empty status sections on the board
  render as empty lists instead of empty states.
- **Error states mix user copy and developer copy.** "API
  unavailable right now. Start the API on :3001 and refresh."
  (board, My Day, homepage), "Job not found, or the API is
  unavailable." (detail — two different causes collapsed into one
  sentence), raw API error strings in forms. Retry is offered
  nowhere as a button; the user must manually refresh or re-click.
- **Typography and spacing have no scale.** Headings rely on
  browser default sizes; body text is default size except scattered
  `0.9rem` small print (live status, Yjs panel, TechnicianStatusBar
  note, detail footer). Padding is `2rem` / `1rem` per page with no
  shared container. Links are default blue/purple underlines with
  no hover/focus treatment defined anywhere.
- **No reduced-motion, no print, no responsive rules beyond the
  detail `maxWidth`.** Nothing in the app animates today, so there
  is nothing to break — but the redesign must not introduce motion
  that violates `prefers-reduced-motion`, and the job-sheet PDF
  flow needs no print stylesheet (PDF is generated server-side).

### 1.11 Accessibility — what PR #33 achieved, and what remains

PR #33 (2026-10-31, `15-DECISIONS.md`) is real and must not be
regressed. Verified in code at the base commit:

- **Labels on every form control.** Every input/select/textarea in
  `CreateJobForm`, `JobActions`, board search, checklist, notes,
  signature, and Yjs editor carries an `aria-label`. Later slices
  must convert these to visible `<label>` elements (keeping the
  accessible name identical or clearer) — never drop a label in
  the restyle.
- **Screen-reader labels on status buttons.** `JobActions` and
  `TechnicianStatusBar` use `aria-label="Move job to …"`. Keep.
- **44px tap targets.** `minHeight: '44px'` (with 24px checkboxes)
  in `ChecklistToggles`, `JobActions`, `TechnicianStatusBar`,
  `PhotoSection` delete, `SignaturePad`, `SyncNotices`, board
  Search, Call/Navigate, and `PwaRegister`. Keep everywhere; extend
  to header navigation and map controls (§1.1, §1.7).
- **Announced result messages.** `aria-live="polite"` on result
  paragraphs in `ChecklistToggles`, `JobActions`,
  `TechnicianStatusBar`, `JobNotesForm`, `SignaturePad`, `YjsNotes`,
  and `CreateJobForm`. Keep. Exceptions to fix: `JobSheetDownload`
  error paragraph has no `aria-live`; `PhotoSection` status
  paragraph has none either.
- **Focus rings intact.** No `outline: none` / outline suppression
  exists anywhere in the app. The redesign must define a visible
  focus style (§2) and must never suppress outlines without a
  replacement that meets the same visibility bar.
- **Honest limitation, preserved.** The signature canvas is
  pointer/touch only and says so in its `aria-label`; keyboard
  users complete via dispatcher/admin override. Do not claim
  otherwise.

Remaining accessibility gaps for the redesign (all presentation,
none requiring API change):

1. Colour is the only signal in two places: map pins (§1.7) and the
   offline banner background (§1.9). Status/priority everywhere
   else is text-only today (good for non-colour legibility, bad for
   scanning) — the §2 system pairs colour with a label + icon so
   neither signal stands alone.
2. Raw codes (`SCHEDULED`, `UPDATE_STATUS`, rule names) are read
   aloud by screen readers as written; human labels (§2.3) fix this
   as a side effect of the visual fix.
3. No skip link, no landmarks beyond `<main>`/`<section>`, no
   `aria-current` on navigation, no heading-order check beyond the
   existing h1/h2 structure (which is broadly sound — keep it).
4. Contrast of the banner colours and of any new token pair must be
   checked in slice (a) before use (§5) — no contrast ratio is
   claimed as verified in this document.
5. Touch targets on links (header nav, board job links, "Refresh",
   back links) are text-height today; §3 extends the 44px rule to
   every interactive element, links included, on touch layouts.
6. The map, signature canvas, and photo grid have no keyboard
   alternative beyond the fallbacks noted in §1.5/§1.7; slices must
   preserve those fallbacks and not remove the list-based path to
   any job.

### 1.12 What already works — preserve all of it

- Clerk auth chain, role guarding, and company scoping (server-side;
  the UI never filters by role — keep it that way).
- `USER_NOT_LINKED` handling and explainer copy (PR #47).
- Offline-first behaviour: Dexie outbox, sync worker triggers,
  optimistic UI with revert on server error, queued-offline
  messaging copy, conflict banner + failed-notice semantics
  (persistent, Discard-only for rejections), photo offline queueing
  with storage warnings.
- Live updates: Socket.io `job:updated` refresh, presence, graceful
  degradation when live is unavailable; Yjs local fallback + snapshot
  save/load when no websocket URL is set.
- Graceful fallbacks: map list when no Mapbox token, jobs without a
  location listed instead of dropped, photo "Preview unavailable"
  state, signature-required gating message.
- PWA shell: manifest, service worker registration, install prompt
  only when the browser offers it, static offline page (copy fix
  only, §1.9).
- Semantic structure where it exists: `lang="en"`, `<main>`,
  section headings, list markup for jobs/checklist/activity.
- No invented-data risk today: the UI shows only what the API
  returns, and empty states say so. The redesign must keep that
  property — no placeholder jobs, users, or counts.

## 2. Design tokens

One token set, defined once, used everywhere. Tokens live as CSS
custom properties in `apps/web/app/globals.css` (slice (a)). No token
may be redefined per page or per component; component styles reference
tokens only. Token *values* below are the decision: slice (a)
implements exactly these values, then runs the §5 contrast check and
adjusts values (not structure) if any pair fails its target. If a
value changes in slice (a), the change is recorded in that slice's PR
description and this document is updated in the same PR.

### 2.1 Colour

Brand anchor: the existing `#0f5132` (manifest `theme_color`,
layout `themeColor`). All other colours are chosen to work with it
on white, in bright field conditions (see §3.5), at WCAG AA.

| Token | Value | Use |
|---|---|---|
| `--color-surface` | `#ffffff` | Page and card background |
| `--color-surface-muted` | `#f2f4f3` | Subtle fills: empty states, secondary panels, skeleton base |
| `--color-ink` | `#1c2420` | Primary text, headings |
| `--color-text-muted` | `#55625b` | Secondary text, metadata, timestamps. Target ≥ 4.5:1 on white — verify in slice (a). |
| `--color-border` | `#d3d8d4` | Card/section/input borders (replaces scattered `#ccc`) |
| `--color-border-strong` | `#767f79` | Input borders at rest where `#ccc` is too faint; focus state uses `--color-focus` |
| `--color-brand` | `#0f5132` | Primary buttons, active nav, links on emphasis, header wordmark |
| `--color-brand-hover` | `#0b3d26` | Primary button hover/active |
| `--color-on-brand` | `#ffffff` | Text/icons on brand fill |
| `--color-focus` | `#005fcc` | Focus ring on all interactive elements (3px outline, 2px offset) |
| `--color-danger` | `#b3261e` | Destructive buttons/text, overdue, errors |
| `--color-danger-bg` | `#f8d7da` | Error banner background (existing value, kept) |
| `--color-danger-border` | `#842029` | Error banner border (existing value, kept) |
| `--color-warning-bg` | `#fff3cd` | Warning/pending banner background (existing value, kept) |
| `--color-warning-border` | `#b45309` | Warning banner border (existing value, kept) |
| `--color-info-bg` | `#e8f0fe` | Informational banner background (new, for live/sync notes) |
| `--color-success` | `#0f5132` | Success text/icons (same as brand; never colour alone — always with text/icon) |

Rules:

- Text on a coloured fill uses the paired token only (e.g. status
  pills use §2.3 pairs, never ad-hoc hex). No new hex values may be
  introduced in component styles; if a component needs a colour,
  the token is added to `globals.css` in the same slice, with its
  contrast target stated in the PR.
- The hardcoded `#fff` signature-canvas background in
  `SignaturePad` stays white in all themes (it is a drawing surface
  whose saved image is a white-background PNG). See §3.4.
- Mapbox basemap stays `streets-v12`; marker colours come from
  §2.3 tokens, not from the two hardcoded values in `MapView`
  today.

Slice (a) adjustment (2026-11-01): `--color-border-strong`
shipped as `#767f79`, not the `#9aa39d` in the table as first
drafted, because `#9aa39d` measured 2.59:1 against white, below
the 3:1 non-text target for input boundaries; `#767f79` measures
4.13:1. All other §2.1/§2.3 text pairs measured ≥ 4.5:1 in
slice (a) (see its PR description for the full ratio list).

### 2.2 Type, spacing, radius, shadow, motion

- **Font stack (system only, no webfont dependency):**
  `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue",
  Arial, sans-serif`. Rationale: no external fetch (offline/PWA),
  no new dependency, native rendering on the technician's phone and
  the dispatcher's desktop. Monospace (timestamps, ids in the audit
  timeline if shown) uses `ui-monospace, SFMono-Regular, Menlo,
  Consolas, monospace`.
- **Type scale** (base 16px; line-height 1.5 body, 1.25 headings;
  weights 400 / 600 / 700 only):
  `--text-xs: 12px` (metadata only, never for primary content),
  `--text-sm: 14px` (secondary, captions, banner text),
  `--text-base: 16px` (body, inputs, buttons),
  `--text-lg: 18px` (card titles, section lead-ins),
  `--text-xl: 20px` (page sub-headings),
  `--text-2xl: 24px` (h1 on detail/map pages),
  `--text-3xl: 32px` (h1 on homepage/board only). Minimum legible
  size in the field is 14px for anything a technician must read at
  arm's length; 12px is reserved for timestamps and footnotes.
- **Spacing** (4px base): `--space-1: 4px`, `--space-2: 8px`,
  `--space-3: 12px`, `--space-4: 16px`, `--space-6: 24px`,
  `--space-8: 32px`, `--space-12: 48px`. Page padding, card
  padding, section gaps, and form gaps use these steps only.
- **Radius:** `--radius-control: 6px` (buttons, inputs, pills),
  `--radius-card: 8px` (cards, panels), `--radius-sheet: 12px`
  (sticky action bar, dialogs). No pill-shaped (fully rounded)
  controls: status pills use `6px` so they read as labels, not
  buttons.
- **Shadow (two levels only):** `--shadow-card: 0 1px 2px
  rgba(28,36,32,.08)`; `--shadow-raised: 0 4px 16px
  rgba(28,36,32,.14)` (sticky bar, dialogs, map selected-panel).
  No shadow on buttons or inputs (border + fill carry state).
- **Motion:** none by default. The only permitted transitions are
  `opacity` / `transform` ≤ 150ms for the sticky bar and dialogs,
  and all motion is disabled under
  `@media (prefers-reduced-motion: reduce)`. Live refresh
  (`router.refresh()`) must never move focus or scroll position;
  slices must verify that behaviour is unchanged, not add scroll
  restoration code.

### 2.3 Status and priority colour system (with non-colour signals)

Single source of truth, two layers (as `docs/06` requires, repaired):

1. `packages/shared/src/index.ts` keeps the status/priority keys and
   human labels, but its style values change: the Tailwind class
   strings are replaced (slice (a), code change, no API change —
   the shared package exports types/constants only) with token
   references the web app can actually consume (data-attribute
   values / CSS variable names — exact shape decided in slice (a),
   documented in that PR). No web file may hardcode a status colour
   after slice (a).
2. `globals.css` defines the visual pairs. Every status is
   identified by **three** signals together: background/border/text
   colour, a text label (never the raw code), and a glyph. Colour
   is never the only signal.

| Status | Label | Glyph | Background | Text | Border |
|---|---|---|---|---|---|
| `SCHEDULED` | Scheduled | ○ | `#e8eae9` | `#37413b` | `#c9cfcb` |
| `EN_ROUTE` | En route | → | `#dbeafe` | `#1e3a5f` | `#93b4d8` |
| `ON_SITE` | On site | ◎ | `#ede9fe` | `#3d2a6e` | `#c4b5fd` |
| `IN_PROGRESS` | In progress | ◐ | `#fef3c7` | `#5c3d05` | `#e5c15c` |
| `ON_HOLD` | On hold | ❚❚ | `#e5e5e5` | `#3f3f46` | `#a1a1aa` |
| `COMPLETED` | Completed | ✓ | `#dcfce7` | `#14532d` | `#86c9a0` |
| `CANCELLED` | Cancelled | ✕ | `#fee2e2` | `#7f1d1d` | `#e5a3a3` |

Priority:

| Priority | Presentation |
|---|---|
| `URGENT` | Danger pair (`#fee2e2` / `#7f1d1d`), glyph ▲, text "URGENT", sorted first within any list. |
| `HIGH` | Warning pair (`#fef3c7` / `#5c3d05`), text "HIGH". |
| `NORMAL` / `LOW` | Neutral pair (`#e8eae9` / `#37413b`), text "Normal" / "Low". LOW and NORMAL share a pair deliberately — neither needs to demand attention. |

Additional states (same three-signal rule):

- **Overdue:** danger left-bar (4px) + "Overdue" text + clock glyph
  on the card/row, in addition to the status pill. Overdue is
  computed and displayed exactly as the API/seed define it (a job
  past its window end without completion); slices display the
  existing data, they do not invent a new overdue definition.
- **Pending sync:** warning dot + text "Pending sync (n)" with the
  count from the existing pending-count source; never a bare dot.
- **Live:** "● Live" / "○ Live unavailable" wording is kept
  (dot + words), restyled to token type scale and given a stable
  shell/board slot.
- **Sync conflict / rejected:** warning/error banner pairs from
  §2.1, icon + plain-language text, rule codes removed from user
  view (§1.9). The `conflictDetails`-generated wording stays;
  only the "(Rule: …)" suffix and raw mutation-type names go.

Map pins use the same status pairs: pin fill = status background
with a contrasting border/text-equivalent (pin colour + the
selected-panel label + legend). The two-colour rule in `MapView`
today is replaced, not extended. A legend (status glyph + label)
is part of the map slice, not an optional extra.

Human labels are the shared-package `label` values (Scheduled, En
route, On site, In progress, On hold, Completed, Cancelled) — the
same strings everywhere: board, My Day, job header, map panel,
timeline. Raw codes must not appear in user-visible UI after the
redesign, except where an API error string is quoted verbatim in an
error message (and then only as the error detail, not as the
heading).

### 2.4 Responsive breakpoints

Mobile-first: the base stylesheet is the phone layout; wider layouts
are progressive enhancement via `min-width` queries only.

| Breakpoint | Width | Layout rule |
|---|---|---|
| Base (phone) | < 720px | Single column; full-width cards; sticky bottom action bar on job detail; header nav as a compact row with 44px targets (exact pattern decided in slice (a) — no hamburger menu is mandated; a wrapping labelled nav is acceptable if targets and active state hold). |
| `--bp-tablet` | 720px | Job detail content max-width 720px centred (existing value, kept); forms max-width 480–560px; two-column photo grid. |
| `--bp-desktop` | 1024px | Board becomes grouped columns (one column per status, horizontally scrollable if needed — no drag-to-reorder in this redesign; status changes stay button-driven as today); map gets a side panel layout; shell shows full nav + company name. |
| `--bp-wide` | 1280px | Board content max-width 1280px centred; no wider stretching. |

The board's desktop column layout is the only layout that changes
structurally with width; everything else is the same components at
different widths. Dispatcher density (board) and technician
legibility (My Day / detail) are both served by the same tokens:
density comes from column layout and compact card spacing on
desktop, never from shrinking type below 14px or targets below
44px.

## 3. System decisions

### 3.1 Hand-rolled CSS, zero new dependencies (decision)

**Decision: no CSS framework, no component library, no icon
library, no webfonts.** Implementation is one `globals.css`
(tokens, reset, base type, utilities shared by all pages) plus CSS
Modules (`.module.css`, colocated) for component/route-scoped
styles, using Next.js 14's built-in CSS Modules support.

Justification:

- The app has zero styling infrastructure today; adding Tailwind
  (or any framework) would add a dependency, PostCSS config, content
  scanning, and a build step to solve a problem — consistent tokens
  and a dozen components — that plain CSS + CSS Modules already
  solve with no new moving parts. The `STATUS_STYLES` Tailwind
  strings are evidence of the failure mode: framework-specific
  values that nothing consumes.
- This supersedes the visual note in `docs/06` ("Tailwind + a small
  set of shared components is enough"). The shared-components half
  of that note stands (§3.2); the Tailwind half does not, for the
  reason above. Slice (a) must log this as a deviation in
  `docs/15-DECISIONS.md` (date + reason, per that file's rule) so
  the change from the planning pack is traceable.
- Offline/PWA: no runtime CSS-in-JS (no hydration cost, no
  client-side style generation on a technician's phone), no
  external font/icon fetch that fails offline. Styles ship as
  static CSS with the existing Next.js build.
- Icons: text glyphs from §2.3 plus inline SVG only where a glyph
  cannot carry the meaning (e.g. navigation/call). No icon package.
- Clerk and Mapbox keep their own stylesheets; only Clerk
  `appearance` variables (§3.3, slice (d)) and Mapbox marker
  colours are token-aligned. Neither library is restyled by
  overriding its internals.

Constraint for all slices: `package.json` (web or root) must not
gain a dependency for styling. If a later slice believes it needs
one, that is a new decision for the manager role, not a silent
addition.

### 3.2 Components (shared, built once, reused everywhere)

Slice (a) creates these in `apps/web/components/ui/` (new directory;
name fixed here so slices (b)–(e) have a stable import path).
Each component keeps its existing behaviour contract and adds only
presentation + the accessibility wiring named in §1.11. No
component may fetch data or call the API itself unless it already
does so today.

| Component | Contract |
|---|---|
| `Button` | Variants: `primary` (brand fill), `secondary` (bordered), `destructive` (danger), `ghost` (text-only, for Dismiss/back). Sizes: default 44px min-height; `large` 52px for the technician sticky bar. States: `disabled`, `busy` (disabled + "…" label suffix pattern already used in messages, e.g. "Uploading…", plus `aria-busy`); focus ring per §2.1. |
| `Field` (label + control + hint + error) | Visible `<label>` always; hint text; error text with `aria-describedby` + `aria-invalid`. Wraps native `input`/`select`/`textarea` — no custom controls. Converts every `aria-label`-only control (§1.10) to this pattern. |
| `Card` / `JobCard` | Card shell (surface, border, radius, shadow-card). `JobCard` adds: title link, customer, address short, window, `StatusPill`, `PriorityBadge`, pending-sync dot + text, overdue flag, photo count (data already on the job object where present; show only when the API returns it — never invent a count). |
| `StatusPill` / `PriorityBadge` | §2.3 pairs + glyph + human label. Props take status/priority keys, never colours. |
| `SyncBadge` | Pending count + "Pending sync (n)" / offline text; warning pair; used in shell-adjacent slot, My Day header, and job detail header (same component, three placements). |
| `Banner` | Variants `info` / `warning` / `error`. Icon + heading + body + optional action (Retry/Dismiss). Replaces ad-hoc banner `<div>`s in `OfflineBanner` and `SyncNotices` (behaviour and copy preserved except rule-code removal, §1.9). Always persistent, never auto-dismissing. |
| `EmptyState` | Heading + body + optional action. Used for: no jobs today (role-appropriate copy), no search results (what was searched + Clear filters), empty status sections (board: section shows count 0 and no list, not an empty `<ul>`), no photos/checklist (existing copy, restyled). |
| `Skeleton` | Skeleton rows/cards for board, My Day, job detail, map list, used behind Suspense/`loading.tsx` (§3.3). Shimmer animation only if it respects `prefers-reduced-motion` (static blocks otherwise); no skeleton may imply content that will not load. |
| `PageHeader` | H1 + supporting line + optional actions slot. One per page; replaces per-page heading + paragraph drift. |
| `AppShell` pieces | Header (wordmark, role-aware nav, company name, user menu, install control slot), offline-banner slot, content container. Built in slice (a) from the existing `layout.tsx` structure — same links, same Clerk components, same `OfflineBanner` placement. |

No other shared components may be introduced without a note in the
slice PR explaining why an existing one does not fit. One-off
`style` props for layout tweaks are banned after slice (a): if a
value recurs twice, it becomes a token or a component prop.

### 3.3 Page patterns (apply in slices (b)–(d))

- **Shell:** header + banner slot + centred content container
  (max-width per §2.4) on every page, including auth and offline
  pages. Signed-out users see the same shell minus role nav.
- **Loading:** add `loading.tsx` (or Suspense boundaries where a
  page composes server + client parts) for board, My Day, job
  detail, and map, rendering `Skeleton` in the page's own layout.
  No route may show a blank page while its server fetch runs.
- **Errors:** every server-page error branch gets the same shape —
  `PageHeader` + plain-language explanation + Retry action
  (re-request, e.g. a link to the same URL / `router.refresh()`
  equivalent for server pages) — and developer text ("Start the
  API on :3001") is removed from user view everywhere. The
  `USER_NOT_LINKED` explainer copy stays verbatim. Client-form
  errors keep the `aria-live` paragraph pattern and gain
  field-level errors only where the API returns field-identified
  errors today; raw error strings are never reformatted into new
  claims about what went wrong.
- **Confirmations:** Cancel (job), Delete (photo), and Reopen
  (admin) get an explicit confirmation step reusing the existing
  reason input (cancel/reopen) — no new fields, no new endpoints.
  The confirmation is a native `<dialog>` or an inline confirm
  block (slice's choice, documented in its PR); it must be
  keyboard-operable, focus-trapped or focus-returning, and
  cancellable with Escape. "Delete" on a photo confirms the
  filename being deleted.
- **Busy states:** every mutation button gets `disabled` +
  `busy` while its request/queue operation runs (matching the
  components that already do this). Double-submit must be
  impossible by disabling, not by debouncing.
- **Stale copy removal:** the three stale strings in §1.2/§1.4/§1.5
  and the offline page's Phase 2/Phase 4 string (§1.9) are removed
  or corrected in the slice that owns each page. No other copy is
  rewritten: message strings ("Queued offline — will sync when you
  reconnect.", "Notes saved.", etc.) stay verbatim unless a slice
  PR justifies a change.
- **Clerk appearance (slice (d) only):** pass Clerk `appearance`
  variables for brand colour, font family, and border radius from
  §2 tokens on the sign-in/up pages and the shell `UserButton`
  where the Clerk API allows it. No change to auth flow, routes,
  or redirect behaviour. If a Clerk surface cannot take a token,
  it stays default — document it, do not fight the library.

### 3.4 Dark mode: not added (decision, with the every-page rule stated)

**Decision: no dark mode in this redesign. The app ships one light
theme only.**

Justification: technicians work outdoors in bright sunlight, where a
high-contrast light UI is the legible choice and dark surfaces wash
out; dispatchers work on desktop in offices with the same light UI.
No user story, acceptance criterion, or planning-pack section asks
for dark mode. Adding it would double the verification surface —
every token pair re-checked for contrast, the Mapbox basemap style
swapped, Clerk's card rethemed, the signature canvas (white
background, saved PNG) and photo previews handled — for a preference
feature with no stated user need, in a redesign whose purpose is to
fix legibility and consistency.

**The every-page rule, stated explicitly:** if dark mode is ever
added in future, it must work on *every* page — shell, homepage,
board, My Day, job detail (including signature canvas and photo
grid), create-job, map (including basemap style and markers),
sign-in, sign-up, offline page, and every banner/notice state —
with contrast re-verified on each, and with the Clerk and Mapbox
surfaces themed or explicitly documented as exceptions. A partial
dark mode (some pages dark, others light; or dark shell with light
Clerk cards and a light map) is not acceptable and must not be
shipped. Until that future slice exists, no `prefers-color-scheme`
handling, no theme toggle, and no dark token set may be introduced.

### 3.5 Mobile-first rationale

The technician is the primary user of the hardest screens: one
hand, gloves, sunlight, low signal, standing at a customer's door.
That is why the base layout is the phone layout (§2.4), targets are
≥ 44px everywhere (§1.11), the primary status action is a sticky
bottom bar at thumb reach (§1.5, slice (c)), type never drops below
14px for task-critical text (§2.2), and sync state is persistent
text, not a toast (§1.9). The dispatcher board is the one
desktop-dense surface: density is achieved with the ≥ 1024px column
layout and compact card spacing, never by shrinking type or
targets. Nothing in the redesign may make a phone flow harder to
serve a desktop layout, and nothing may make the board harder to
scan to serve a phone layout — the breakpoint split in §2.4 is how
both hold.

## 4. Slice plan (for later workers)

One branch, one PR, merge, remote readback — per the
branch-per-feature rule (`~/workspace/custom-skills/branch_feature_delivery/SKILL.md`
in the working notes; repo rule: main is branch-protected, PR
required). Slices run in order because each builds on the last
(shell/tokens first; shared components before the pages that use
them). A slice must not start on a stale base: rebase/branch from
current main, and if another slice merged first, re-read the shared
files it touched before editing. No slice changes `apps/api/`,
`packages/shared` beyond the §2.3 style-value migration in slice
(a), the data model, sync/offline code (`lib/sync-worker.ts`,
`lib/offline-db.ts`, `lib/sync-reconcile.ts`), auth, or any API
contract. Every slice must independently typecheck and build
(`npm run typecheck` in `apps/web`, then `next build`) — see §5.

### Slice (a) — Tokens + app shell

- **Scope:** `apps/web/app/globals.css` (new: tokens, reset, base
  type, focus, banner/skeleton base styles), `apps/web/app/layout.tsx`
  (import globals, shell structure, nav with active state +
  role-aware links, company name slot, 44px nav targets, skip link),
  `apps/web/components/ui/*` (§3.2 components),
  `packages/shared/src/index.ts` (§2.3 style-value migration only),
  `docs/15-DECISIONS.md` (log the Tailwind supersession, §3.1).
- **Must not touch:** any page's data fetching, any component's
  behaviour, Clerk configuration. Pages will look partly tokenised
  (shell + base type only) until slices (b)–(d) adopt the
  components — that intermediate state is expected; do not
  half-adopt components on pages outside this slice's scope.
- **Done when:** tokens render on every page via the shell, nav
  shows active state and company/role context, skip link works by
  keyboard, contrast check (§5) passes for all §2.1/§2.3 pairs,
  typecheck + build pass.

### Slice (b) — Board + My Day

- **Scope:** `apps/web/app/board/page.tsx`,
  `apps/web/app/my-day/page.tsx`, `apps/web/components/LiveBoard.tsx`,
  `apps/web/app/board/loading.tsx` + `apps/web/app/my-day/loading.tsx`
  (new), `JobCard` adoption, board column layout ≥ 1024px,
  Overdue/Unassigned signals (§1.3 — display of existing data only;
  overdue computation uses the same window-end rule the seed/API
  already embody, surfaced from job fields already returned),
  search/filter restyle (GET mechanics kept, filters preserved on
  refresh, Clear filters, empty-results state), stale-copy fixes
  for both pages, My Day grouping (Overdue / Today in window order,
  using the order the API returns plus the overdue flag — no new
  sort contract invented; if API order is not window order, say so
  in the PR and do not silently re-sort), `SyncBadge` placement,
  role-accurate headings.
- **Must not touch:** job detail, map, auth, sync code. Board
  status changes stay button-driven on the detail page; no drag
  and drop, no board-inline status change (not in the current
  behaviour, not invented here).
- **Done when:** §1.3/§1.4 findings are closed or explicitly
  deferred with a reason in the PR, typecheck + build pass, board
  and My Day exercised per §5.

### Slice (c) — Job detail + creation

- **Scope:** `apps/web/app/jobs/[id]/page.tsx`,
  `apps/web/app/jobs/new/page.tsx`,
  `apps/web/components/JobActions.tsx`,
  `TechnicianStatusBar.tsx`, `ChecklistToggles.tsx`,
  `JobNotesForm.tsx`, `YjsNotes.tsx`, `SignaturePad.tsx`,
  `PhotoSection.tsx`, `JobSheetDownload.tsx`,
  `SyncNotices.tsx`, `CreateJobForm.tsx`,
  `apps/web/app/jobs/[id]/loading.tsx` (new). Sticky bottom status
  bar for technicians; header summary (status pill, priority,
  customer, window) with the internal `version` removed from user
  view; notes-editor relationship made explicit in headings/helper
  text (both editors kept); confirmations for Cancel/Delete/Reopen;
  busy states everywhere; audit timeline in readable form (actor,
  action, from → to, timestamp; rule codes removed from user view;
  append-only events preserved); photo section restyle (labelled
  upload control, caption field only if the existing confirm
  endpoint already accepts it — check the API spec first; if it
  does not, the caption gap is recorded as a follow-up, not faked);
  create-job form rebuilt on `Field` with visible labels, grouped
  sections, and honest technician-id helper text; stale footer
  copy removed.
- **Must not touch:** API endpoints, mutation payloads, sync
  queueing, Yjs document handling, signature storage format.
- **Done when:** §1.5/§1.6 findings are closed or deferred with a
  reason, the detail page is usable one-handed on a phone width
  (sticky bar, 44px targets, no horizontal scroll), typecheck +
  build pass.

### Slice (d) — Map + offline + auth pages

- **Scope:** `apps/web/app/map/page.tsx`,
  `apps/web/components/MapView.tsx` (marker colours from §2.3,
  legend, selected-panel restyle, unplotted list as cards,
  responsive map height rule, loading state),
  `apps/web/app/offline/page.tsx` (copy correction, shell
  treatment), `apps/web/components/OfflineBanner.tsx` (Banner
  adoption, wording kept), `PwaRegister` placement/styling,
  `apps/web/app/sign-in/[[...sign-in]]/page.tsx`,
  `apps/web/app/sign-up/[[...sign-up]]/page.tsx` (surrounding copy
  + Clerk `appearance` tokens, §3.3), `apps/web/app/page.tsx`
  (homepage restyle + stale-copy fix + signed-in next steps).
- **Must not touch:** Mapbox configuration, geocoding logic,
  service worker, manifest, auth flow.
- **Done when:** §1.2/§1.7/§1.8/§1.9 findings are closed or
  deferred with a reason, map is legible by status with a legend,
  offline page states the real offline position, typecheck + build
  pass.

### Slice (e) — Polish / accessibility pass + tracking

- **Scope:** whole web app. Keyboard-only walkthrough of every
  page (Tab order, focus visibility, skip link, dialogs, map list
  path, signature fallback path); contrast re-check after all
  slices; `aria-live` audit (close the `JobSheetDownload` /
  `PhotoSection` gaps); heading-order and landmark check; removal
  of any remaining inline `style` props that duplicate tokens;
  removal of any remaining raw status/priority codes in user view;
  dead-code check (no unused Tailwind strings, no unused tokens);
  final copy sweep for stale phase references anywhere in
  user-visible UI; update `docs/16-PROJECT-TRACKING.md` (mark
  slices done with PR links) and `docs/15-DECISIONS.md` (any
  deviations taken along the way).
- **Must not touch:** behaviour. This slice is presentation and
  accessibility only; any behaviour change found necessary here
  goes back to the owning slice as a follow-up, not into the
  polish PR.
- **Done when:** §5 checklist passes end to end, typecheck + build
  pass, tracking doc reflects reality.

Sequencing note: slices (b), (c), and (d) all touch
`components/ui/*` only by *using* it (slice (a) owns it). If a
later slice needs a new shared component or a token change, it
adds it in its own PR with the §5 checks, and says so in the PR
description — shared-file changes are never smuggled into a page
slice without mention.

## 5. Verification rules

Every implementation slice must pass all of these before its PR is
merged. "Verified" means evidence in the PR description, not
assertion.

1. **Typecheck + build, independently.** `npm run typecheck` in
   `apps/web` and `next build` for the web app pass on the slice
   branch alone (no reliance on another unmerged slice). API tests
   are unaffected (no API changes); if a slice touches
   `packages/shared`, the API typecheck must pass too.
2. **Local boot + flow exercise.** Boot the web app locally (with
   the API running or with the honest API-down state, stated in the
   PR) and exercise every flow the slice touched: board search /
   filter / refresh-with-filters, My Day list, job detail status
   move + checklist + notes + photo + signature + PDF download
   (slice (c)), create-job submit + validation error (slice (c)),
   map load + pin select + unplotted list (slice (d)), sign-in/up
   page render (slice (d)), offline banner + pending count (slice
   (d)). State what was exercised and what could not be (missing
   keys, no running API, etc.) — unexercised flows are pending,
   not passed.
3. **Accessibility checks (no regression from PR #33, gaps in
   §1.11 closed or deferred with a reason).** Keyboard-only pass
   over touched pages; visible focus on every interactive element;
   labels on every control (visible labels after slice (a));
   `aria-live` messages still announced; 44px targets on every
   interactive element including links; contrast pairs meet
   4.5:1 (text) / 3:1 (non-text UI) targets — checked with a
   contrast tool in slice (a) and re-checked in slice (e), with
   the tool/results noted in the PR. No outline suppression
   anywhere.
4. **No behaviour change.** Same endpoints, same payloads, same
   sync/offline/conflict semantics, same role scoping, same Clerk
   flow. The PR description states this explicitly. Any deviation
   is a `docs/15-DECISIONS.md` entry, not a silent change.
5. **Visual browser pass: PENDING for the main agent / user.**
   No worker may claim visual verification. Workers verify by
   code readback, typecheck, build, and local boot/flow exercise
   only. After all slices merge, the main agent or user runs a
   visual pass (desktop + phone width, board / My Day / job
   detail / map / auth) on the deployed app and records the
   result in the tracking doc. Until then, every slice's visual
   quality is unverified, and PRs must say so.
6. **Remote readback.** After merge, the merge commit is confirmed
   by remote readback (`list_commits` on main + `get_file_contents`
   for changed files) before the slice is reported done — per the
   branch-per-feature rule. A timed-out approval card is undecided:
   wait, never treat it as approval.

### Verification status after slices (a)–(e)

Slices (a)–(e) are merged (PRs #49–#53). Each slice's PR
records its own evidence: web + API typecheck, `next build`
for the web app, and a local boot exercising the routes it
touched (200 + shell presence + no server errors, with the
honest API-down state where no API was running). Slice (e)
additionally verified by code inspection across all routes:
one `#main-content` skip-link target wrapping one `<main>`
per page, no nested landmarks, visible focus (no outline
suppression), visible labels / `aria-describedby` /
`aria-invalid` on every form, `aria-live` result messages,
ConfirmBlock focus management with focus return, status
shown as label + glyph + colour everywhere, static skeletons
with no animation, and no remaining inline `style` props or
raw status codes in user-visible UI.

Still pending, honestly: the visual browser pass (desktop +
phone width, board / My Day / job detail / map / auth) by the
main agent or user; signed-in flows (a real Clerk browser
sign-in, which no worker can do); and DB-backed verification
of flows that need a running API + database (status moves,
checklist, notes, photos, signature, PDF download, offline
sync). Until those run, the redesign is verified by
code readback, typecheck, build, and local boot only — not
visually, not signed-in, and not against a live database.
Deferred follow-ups from the slices (photo caption field,
past-date overdue jobs on My Day, a dedicated sync-status
screen) are recorded in `docs/15-DECISIONS.md`.

## Appendix — files read for this audit

Pages: `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`,
`apps/web/app/board/page.tsx`, `apps/web/app/my-day/page.tsx`,
`apps/web/app/map/page.tsx`, `apps/web/app/offline/page.tsx`,
`apps/web/app/jobs/[id]/page.tsx`, `apps/web/app/jobs/new/page.tsx`,
`apps/web/app/sign-in/[[...sign-in]]/page.tsx`,
`apps/web/app/sign-up/[[...sign-up]]/page.tsx`.
Components: `LiveBoard`, `JobActions`, `ChecklistToggles`,
`PhotoSection`, `SignaturePad`, `YjsNotes`, `JobNotesForm`,
`MapView`, `OfflineBanner`, `SyncNotices`, `TechnicianStatusBar`,
`CacheJobs`, `CreateJobForm`, `JobSheetDownload`, `PwaRegister`.
Supporting: `apps/web/lib/api.ts`, `apps/web/package.json`,
`apps/web/next.config.mjs`, `apps/web/middleware.ts`,
`apps/web/public/manifest.json`, `packages/shared/src/index.ts`.
Docs: `docs/05-USER-STORIES.md`, `docs/06-UX-FLOWS.md`,
`docs/11-WIREFRAMES-PHASE0.md`, `docs/15-DECISIONS.md` (including
the PR #33 accessibility entry), `docs/16-PROJECT-TRACKING.md`.
