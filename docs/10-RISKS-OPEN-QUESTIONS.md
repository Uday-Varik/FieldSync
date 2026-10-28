# FieldSync — Risks, Tradeoffs & Open Questions

## 1. Risks and mitigations

| Risk | Impact if ignored | Mitigation in this plan |
|------|-------------------|-------------------------|
| Sync complexity blows up the timeline | Project stalls in Phase 4, nothing shippable | Sync is a separate phase with its own DoD and 7 must-pass tests; cut map/Yjs before cutting sync tests; timebox Yjs integration |
| Yjs + Socket.io integration is fiddly | Notes feature eats days | Yjs is scoped to ONE field (notes). Plain-text notes ship in Phase 2, Yjs is an upgrade in Phase 3, not a blocker for jobs/sync |
| Offline photo storage fills the phone | Technician can't capture proof on a long day | IndexedDB photo cap + warnings (see sync spec); thumbnails only for other jobs; compression on capture |
| Location privacy backlash / misuse | Real product would be untrustworthy | Privacy rule in PRD: location only on active jobs, no history in MVP, clearly documented |
| Clerk lock-in / cost | Demo cost or migration pain later | Our DB is the authorisation source of truth; Clerk is only identity/session. Migration = replace session verification, not rewrite authorisation |
| Single-instance realtime doesn't scale | Socket rooms break on multi-instance deploy | Named tradeoff in architecture doc; Redis adapter is the documented next step, not a surprise |
| Scope creep (payments, chat, AI, customer portal) | MVP never finishes | Non-goals list in PRD is explicit; P2 backlog requires its own mini-PRD; cut list in implementation plan is ordered |
| Demo looks fake (empty data, no real flow) | Recruiters don't believe it | Seeded demo company, real-device offline demo, 2-min video, README with real tradeoffs — all in Phase 5 DoD |

## 2. Decisions decided 2026-10-27 (no longer open)

1. **PDF engine:** pdf-lib — lighter, manual layout, no Chromium in Docker.
2. **Signature upload payload:** Signed-URL flow like photos.
3. **Technician visibility of unassigned jobs:** NO — technicians see only their assigned jobs. Claiming unassigned jobs would be a new story + authorisation change.
4. **Completed job reopen:** YES — Admin-only reopen, with a required reason logged in the audit trail. Reopen returns the job to IN_PROGRESS, clears `completedAt`, and retains photos/signature.
5. **Auth:** Clerk, NOT Auth.js.

## 2b. Decisions decided 2026-10-27, by best-for-MVP choice

1. **Geocoding provider:** Mapbox. Why it's best here: one provider for map + geocoding + autocomplete, so pins and search results agree; demo-scale usage fits a free tier; a free OSM/Nominatim alternative would add a second provider, stricter usage limits, and weaker autocomplete for no MVP benefit.
2. **Sync batch transactionality:** Per-mutation transactions, applied sequentially. Why it's best here: it matches the API's per-mutation results, one bad offline mutation (e.g. completing a job that was cancelled) must not wipe earlier good work in the same session, and the client can retry only failed items. Tradeoff accepted: a batch can partially succeed, so partial success must be shown in sync UX.

No technical decisions now block Phase 0. What blocks a fully running Phase 0 is external setup, not decisions: Clerk keys, a Mapbox token (needed from Phase 1/3, not Phase 0 scaffold), and a local Postgres/Redis — Docker is not available in this workspace, so Phase 0 is scaffolded here and must be run where Docker is installed.

## 3. Decisions already made (recorded so they aren't re-litigated)

- PWA, not native apps, in MVP.
- No payments, invoicing, customer portal, recurring jobs, route optimisation, inventory, chat/SMS, or AI in MVP.
- One company timezone in MVP.
- Server authoritative, field-level conflicts, Yjs only for notes.
- Photos private, signed URLs, short-lived.
- Single NestJS instance in MVP, with Redis adapter as the documented scale path.
- PDF via pdf-lib; Admin-only reopen with logged reason; technicians see assigned jobs only; Clerk (not Auth.js) — all decided 2026-10-27.

## 4. "What would I do next?" (for README + interviews)

If asked in an interview, the honest next steps after MVP are:
1. Multi-instance realtime via Redis adapter + Socket.io sticky sessions.
2. Route optimisation (simple nearest-neighbour first, then a real solver) — with a clear explanation of why it was NOT in MVP.
3. Customer share link for job sheets (signed, expiring, read-only) + SMS notifications via a provider.
4. Recurring jobs + quote/estimate flow, each with its own PRD.
5. Proper Yjs history server (instead of snapshot persistence) if collaborative editing expands beyond notes.

Do not claim any of these are built until they are.
