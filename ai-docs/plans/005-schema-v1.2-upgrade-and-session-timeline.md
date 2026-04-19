# 005 — Schema v1.2.0 upgrade + session timeline

## Context

The `progress-report-skill` now emits schema v1.2.0 (see [plan-and-dev-assets/CHANGELOG.md](plan-and-dev-assets/CHANGELOG.md)). The change is purely additive at the field level, but it redefines the `activeDurationMin` formula (gap-aware, user-pause capped) and ships a set of new per-session fields that unlock a real activity-timeline view. It also absorbs v1.1.0's `needsReview`/`reviewReason` into the required set — those are currently not surfaced in the UI either.

We're taking a **hard cut**: the visualizer will require v1.2.0 and reject older reports with a clear "regenerate" error. Keeping dual-schema fallbacks adds branches everywhere and produces mixed numbers that can't be trusted against each other (`activeDurationMin` math changed).

The flagship new capability we're building on top is a **session timeline** in SessionDetailView that visualizes `segments[]` (activity bursts) and `gaps[]` (over-cap user pauses), plus a "needs active review" warning banner. The remaining new fields (idle breakdowns, daily idle stacking) are in scope for validation but deferred for UI work.

## What's changing in the schema

New required fields we must start validating:

- **Session:** `idleSec`, `userPauseCount`, `longestUserPauseSec`, `gaps[]`, `segments[]`, `needsActiveReview`, `activeReviewReason`, plus v1.1.0's `needsReview`, `reviewReason`
- **Totals:** `idleMinutesByRepo`, `idleCategoryMinutes` (and `activeMinutesByRepo`, `activeCategoryMinutes` from v1.0.0 which we were already permissive about)
- **DayBucket:** `idleMinutes`
- **New $defs:** `Gap { startedAt, endedAt, sec, kind, creditedSec }`, `Segment { startedAt, endedAt, sec, messageCount }`

Formula change: `activeDurationMin` is now `tool_runtime + inference always credited + user_pause capped at --user-pause-cap-min`. Old reports will have different numbers for the same sessions — another reason the hard cut is cleaner than mixing.

## Implementation

### Phase A — Replace schema + validator (hard cut)

1. **Replace** [report.schema.json](report.schema.json) with the contents of [plan-and-dev-assets/report.schema.json](plan-and-dev-assets/report.schema.json). (Docs file — not imported by runtime code.)
2. **Rewrite** [src/utils/validation.js](src/utils/validation.js):
   - Extend `REQUIRED_TOTALS` with `activeMinutesByRepo`, `activeCategoryMinutes`, `idleMinutesByRepo`, `idleCategoryMinutes`.
   - Add `REQUIRED_SESSION` covering every Session-level field from the v1.2 schema (explicitly including `idleSec`, `userPauseCount`, `longestUserPauseSec`, `gaps`, `segments`, `needsActiveReview`, `activeReviewReason`, `needsReview`, `reviewReason`).
   - Add `REQUIRED_DAYBUCKET = ['minutes', 'activeMinutes', 'idleMinutes', 'sessions', 'categories']` and walk `totals.minutesByDay` values.
   - Add `REQUIRED_GAP` / `REQUIRED_SEGMENT` for array-item validation on `session.gaps[]` / `session.segments[]`.
   - Iterate `data.sessions[]`, validate each against `REQUIRED_SESSION`, then each gap/segment. Collect errors with full path (`sessions[3].gaps[1].creditedSec`) for easy debugging.
   - **Old-schema rejection:** if the top level validates but `totals.activeMinutesByRepo` or `session.gaps`/`session.segments` is missing, short-circuit with a friendly message:
     > *"This report was generated with an older schema (pre-v1.2.0). Please regenerate it with the latest progress-report-skill — the active-duration math has changed and mixing old/new reports produces inconsistent numbers."*
   - Keep generic `Missing required field: "…"` messages for other violations.
3. **localStorage stale data:** [src/stores/report.js](src/stores/report.js) already runs `validateReport` on `loadFromStorage` (verify during implementation). If a previously-cached v1.0 report is present, the new validator will reject it and the store will clear to the upload prompt — no migration code needed.

### Phase B — Retire old-schema fallbacks

With v1.2 guaranteed, delete the `?? <wallclock>` fallbacks that were there to paper over older schemas. Each one is now unreachable.

- [src/views/SessionDetailView.vue:74](src/views/SessionDetailView.vue#L74) — `session.activeDurationMin ?? session.durationMin` → `session.activeDurationMin`
- [src/views/SessionDetailView.vue:115](src/views/SessionDetailView.vue#L115) — same
- [src/views/SummaryView.vue:19](src/views/SummaryView.vue#L19) — `totals.activeCategoryMinutes ?? totals.categoryMinutes` → `totals.activeCategoryMinutes`
- [src/views/SummaryView.vue:23](src/views/SummaryView.vue#L23) — `totals.activeMinutesByRepo ?? totals.minutesByRepo` → `totals.activeMinutesByRepo`
- [src/views/SessionsView.vue:120](src/views/SessionsView.vue#L120) — `(b.activeDurationMin ?? b.durationMin)` / `(a.activeDurationMin ?? a.durationMin)` in the sort comparator → use `activeDurationMin` directly
- [src/views/SessionsView.vue:301](src/views/SessionsView.vue#L301) — `session.activeDurationMin ?? session.durationMin` in the cell → `session.activeDurationMin`
- [src/components/DailyActivityChart.vue:56](src/components/DailyActivityChart.vue#L56) — `b.activeMinutes ?? b.minutes` → `b.activeMinutes`

All `?? durationMin` / `?? minutes` / `?? categoryMinutes` / `?? minutesByRepo` forms are accounted for above.

### Phase C — SessionTimeline component (flagship feature)

**New file:** `src/components/SessionTimeline.vue`

**Renderer choice:** raw SVG, not Chart.js or %-width divs. The data is piecewise (discrete segments + gaps with explicit start/end timestamps), not a continuous series. SVG gives exact time-scaling via `viewBox`, crisp `<rect>` hover targets at any width, and trivial tooltip positioning. Chart.js would require a stacked-horizontal-bar hack and lose tick precision. Divs work but get fuzzy at narrow widths.

**Props:** `session: Object` — reads `createdAt`, `lastActivityAt`, `segments`, `gaps`.

**Layout:**
- Horizontal strip, `viewBox="0 0 1000 40"`.
- Compute `T = (lastActivityAt - createdAt)` in seconds; for each item `x = (item.startedAt - createdAt) / T * 1000`, `width = item.sec / T * 1000`.
- Merge `segments[]` and `gaps[]` into one array sorted by `startedAt`, render in order.
- Colors (pull Tailwind design tokens from [src/assets/main.css](src/assets/main.css)):
  - Segments (activity): `fill-primary` alternating with `fill-primary-container` for rhythm across contiguous segments.
  - Gap `user_pause`: `fill-tertiary` (amber warning tone).
  - Gap `tool_runtime`: `fill-secondary/40`.
  - Gap `inference`: `fill-on-surface-variant/30`.
  - Gap `same_turn`: `fill-outline-variant` (rare / thin).
- 4–5 axis ticks along the bottom rendering HH:MM UTC labels from evenly-spaced offsets.

**Interaction:**
- `hovered` ref = `{ item, type: 'segment'|'gap', x, y }`.
- `@mouseenter` on `<rect>` sets `hovered`; `@mouseleave` clears.
- Floating tooltip (absolutely-positioned Tailwind `<div>`):
  - Segment: `start · duration · N messages`.
  - Gap: `start · duration · kind · credited Xs of Ys`.
- `@click` emits `timeline-click` carrying the item (leave unused for now; enables future drill-downs).

**Embedding:** render above `<ConversationLog>` in [src/views/SessionDetailView.vue:95](src/views/SessionDetailView.vue#L95):

```vue
<SessionTimeline :session="session" />
```

### Phase D — Schema-driven review flag + pause stats

The current codebase *derives* idle-badness from a ratio helper (`isHighIdleRatio(durationMin, activeDurationMin) < 0.4`). v1.2 replaces this with schema-authored flags — `session.needsActiveReview` (boolean) + `session.activeReviewReason` (enum tag). We swap every derived site to the schema flag and retire the helpers.

**In [src/utils/format.js](src/utils/format.js):**

1. Add `humanizeActiveReviewReason(reason)` mapping the three enum values:
   - `long_single_pause` → "Long single pause detected"
   - `high_idle_ratio` → "High idle ratio"
   - `many_long_pauses` → "Many long pauses"
   - other / null → empty string (defensive)
2. Add `formatSec(seconds)` for sub-minute values (gaps/segments are often single-digit seconds): `<60s → "42s"`, else delegate to `formatDuration(seconds / 60)`.
3. **Remove** `isHighIdleRatio` and `formatIdleRatio` along with `IDLE_RATIO_THRESHOLD` / `MIN_DURATION_FOR_IDLE_CHECK` constants — after Phase D they have no callers.

**In [src/views/SessionDetailView.vue](src/views/SessionDetailView.vue):**

1. Delete the `isHighIdle` computed (lines 21–23) and its import of `isHighIdleRatio, formatIdleRatio`.
2. Line 73 duration cell: replace the `isHighIdle` class-binding and warning-icon logic with `session.needsActiveReview`-driven styling (keep the `text-tertiary` tone + warning icon, but gated on the schema flag).
3. Lines 82–90 banner: rewrite to
   ```vue
   <div v-if="session.needsActiveReview" class="mb-6 flex items-center gap-3 px-4 py-3 rounded-lg bg-tertiary-container/20 border border-tertiary/30">
     <span class="material-symbols-outlined text-tertiary">schedule</span>
     <span class="text-sm text-on-surface">
       {{ humanizeActiveReviewReason(session.activeReviewReason) }}
       — {{ formatDuration(session.activeDurationMin) }} active of {{ formatDuration(session.durationMin) }} wall-clock
     </span>
   </div>
   ```
4. Extend the Session Metadata sidebar (after line 144) with:
   - `Idle` — `formatSec(session.idleSec)` (only when `idleSec > 0`)
   - `User Pauses` — `session.userPauseCount` (only when `> 0`)
   - `Longest Pause` — `formatSec(session.longestUserPauseSec)` (only when `userPauseCount > 0`)

**In [src/views/SessionsView.vue](src/views/SessionsView.vue):**

1. Drop `isHighIdleRatio` from the import list (line 5).
2. Lines 300–303: replace the two `isHighIdleRatio(...)` calls with `session.needsActiveReview`:
   ```vue
   <span class="text-xs font-mono" :class="session.needsActiveReview ? 'text-tertiary' : 'text-on-surface'">
     {{ formatDuration(session.activeDurationMin) }}
   </span>
   <span v-if="session.needsActiveReview" class="material-symbols-outlined text-xs text-tertiary ml-0.5" title="Needs active review">warning</span>
   ```

**In [src/views/SummaryView.vue](src/views/SummaryView.vue):**

1. Drop `isHighIdleRatio` from the import list (line 5).
2. Lines 33–35: rename `highIdleCount` → `needsReviewCount`, driven by `s.needsActiveReview`:
   ```js
   const needsReviewCount = computed(() =>
     reportData.value?.sessions?.filter(s => s.needsActiveReview).length || 0
   )
   ```
3. Lines 94–97: update the warning copy to reflect the schema semantics (drop the hardcoded "<45% active" which is no longer what the flag means):
   > `{{ needsReviewCount }} session{s} flagged for active-duration review`

### Phase E — Cleanup verification

- Grep for `isHighIdleRatio`, `formatIdleRatio`, `IDLE_RATIO_THRESHOLD` — expect zero results.
- Grep for `?? *durationMin`, `?? *minutes`, `?? *categoryMinutes`, `?? *minutesByRepo` — expect zero results.
- Grep for `activeDurationMin ??` — expect zero results.

## Critical files

- [report.schema.json](report.schema.json) — replace wholesale
- [src/utils/validation.js](src/utils/validation.js) — full rewrite (v1.2 required fields, gap/segment item checks, old-schema rejection)
- [src/utils/format.js](src/utils/format.js) — add `humanizeActiveReviewReason`, `formatSec`; **remove** `isHighIdleRatio`, `formatIdleRatio`, `IDLE_RATIO_THRESHOLD`, `MIN_DURATION_FOR_IDLE_CHECK`
- [src/views/SessionDetailView.vue](src/views/SessionDetailView.vue) — embed `<SessionTimeline>`, swap derived banner for `needsActiveReview`, add Idle / User Pauses / Longest Pause rows, drop fallbacks
- [src/views/SummaryView.vue](src/views/SummaryView.vue) — swap `highIdleCount` for `needsReviewCount`, drop fallbacks
- [src/views/SessionsView.vue](src/views/SessionsView.vue) — swap `isHighIdleRatio` calls for `session.needsActiveReview`, drop fallbacks
- [src/components/DailyActivityChart.vue](src/components/DailyActivityChart.vue) — drop one fallback
- [src/components/SessionTimeline.vue](src/components/SessionTimeline.vue) — **new** (raw SVG)
- [src/stores/report.js](src/stores/report.js) — **no edits** (already revalidates on both upload and storage-load paths; stale v1.0 reports get cleared automatically)

## Out of scope (explicit)

Deferred to a follow-up plan even though the data will validate:

- Stacked idle/active bars in DailyActivityChart using `minutesByDay[].idleMinutes`.
- Idle breakdowns by repo / category (`idleMinutesByRepo`, `idleCategoryMinutes`).
- Surfacing v1.1's `needsReview` / `reviewReason` (category-level review) — separate concern from `needsActiveReview`.
- Exposing raw `gaps[]` as a standalone QA table.

## Verification

1. `npm run dev`.
2. Upload [plan-and-dev-assets/data/report.json](plan-and-dev-assets/data/report.json) — confirm it validates and the app routes to Summary.
3. **Timeline** — navigate to a session with non-empty `segments[]`:
   - Timeline renders proportional segments + gaps across the full session span.
   - Hovering any `<rect>` shows the correct tooltip shape (start, duration, messageCount for segments; start, duration, kind, `creditedSec` for gaps).
   - Axis ticks show monotonically increasing UTC times.
4. **Review banner + cells** — find a session where `needsActiveReview === true`:
   - SessionDetail banner renders with `humanizeActiveReviewReason(activeReviewReason)`.
   - SessionDetail header duration shows the tertiary-tone warning icon.
   - SessionsView row shows the tertiary duration + warning icon.
   - SummaryView "Total Hours" card shows `{N} session(s) flagged for active-duration review`.
5. **Sidebar stats** — confirm Idle / User Pauses / Longest Pause rows appear with correct formatting and hide when their conditional gates fail (e.g. `userPauseCount === 0` hides Longest Pause).
6. **Old-schema rejection** — take the v1.2 report and remove `totals.activeMinutesByRepo` before upload → confirm the "older schema / regenerate" rejection surfaces with no partial render. Repeat the same manipulation on a Session (delete `gaps`) and confirm the friendly rejection still fires.
7. **Stale localStorage** — manually seed `localStorage[weekly-report-data]` with an old v1.0 JSON, reload → app clears the key and falls back to Upload with no error toast.
8. **Cleanup grep** — run the three greps from Phase E and expect zero hits.
9. **Smoke test navigation** — walk every view (Summary, Sessions, SessionDetail, PrTracker, Tickets) — confirm no console errors.
