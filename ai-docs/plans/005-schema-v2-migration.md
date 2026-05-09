# Schema v2.0.0 migration + session timeline + idle-kind breakdown

> On approval, rename to `005-schema-v2-migration.md` per the numbered-plan convention in `CLAUDE.md`.

## Context

The claude-dev-digest skill shipped a v2.0.0 schema (see [plan-and-dev-assets/CHANGELOG.md](plan-and-dev-assets/CHANGELOG.md) and [plan-and-dev-assets/report.schema.json](plan-and-dev-assets/report.schema.json)). The visualizer currently consumes v1.x. The change is load-bearing:

- `activeDurationMin` is now capped per-gap-kind. `tool_runtime` and `inference` gaps (previously credited uncapped) are capped at 30 min each. On real data this drops active totals hard — in [plan-and-dev-assets/data/report.json](plan-and-dev-assets/data/report.json), total wall-clock is 39,185 min but active is **only 2,694 min (6.9%)**. One session (`43621413`) has 237 hours of wall-clock but 108 min active — 850k seconds stripped as `tool_runtime` idle. Those outliers were silently inflating v1.x dashboards.
- `idleSec` now sums stripped time across **all three capped kinds** (`user_pause`, `tool_runtime`, `inference`), not just user pauses. The new `idleBreakdownSec: {user_pause, tool_runtime, inference}` exposes the split.
- `gaps[]` now contains over-cap gaps of **any** kind (v1.x only emitted `user_pause`). `segments[]` now splits on over-cap gaps of any kind, not only user pauses.
- New required Session fields: `idleBreakdownSec`, `userPauseCount`, `longestUserPauseSec`, `gaps`, `segments`, `needsActiveReview`, `activeReviewReason`, `needsReview`, `reviewReason`, `idleSec`. New Totals fields: `idleMinutesByRepo`, `idleCategoryMinutes`. New DayBucket field: `idleMinutes`.
- Enum rename: `many_long_pauses` → `many_long_gaps`.

User has confirmed we can drop v1.x support entirely — no users remain on the old schema. The migration is therefore a clean cutover (remove fallbacks, tighten validator), plus two new UI features that make the richer data legible: a chronological session timeline and an idle-kind breakdown on the session detail page.

## Scope

1. **Schema migration** — replace the root `report.schema.json`, tighten the validator, remove all `?? wall-clock-fallback` conditionals.
2. **Relabel idle semantics** — "idle" now means all capped kinds. Tooltips/labels on existing views need updating.
3. **Session timeline** — horizontal proportional bar on [SessionDetailView.vue](src/views/SessionDetailView.vue) rendering segments + gaps color-coded by kind.
4. **Idle-kind breakdown** — per-session breakdown of where the idle came from, inline in the SessionDetailView metadata area.
5. **DailyActivityChart** — plot active hours, not wall-clock. User clarified: "plot the actual active time instead of the idle + active time."

Out of scope (can ship later): SessionsView filters/sort on new fields, Summary-level idle-kind rollups, needsActiveReview badges in the session list.

---

## Changes

### 1. Schema & validator — drop v1.x, require v2.0.0

**[report.schema.json](report.schema.json)** (repo root) — replace with the v2.0.0 contents from [plan-and-dev-assets/report.schema.json](plan-and-dev-assets/report.schema.json). This file is documentation-only at runtime (not imported), but is the declared source-of-truth per `CLAUDE.md`.

**[src/utils/validation.js](src/utils/validation.js)** — extend `REQUIRED_*` arrays:

- Session: add `idleSec`, `idleBreakdownSec`, `userPauseCount`, `longestUserPauseSec`, `gaps`, `segments`, `needsActiveReview`, `activeReviewReason`, `needsReview`, `reviewReason`.
- Totals: add `idleMinutesByRepo`, `idleCategoryMinutes`.
- DayBucket: add `idleMinutes`.
- Shallow-shape-check `idleBreakdownSec` for the three sub-keys (`user_pause`, `tool_runtime`, `inference`).
- Error messaging: mention "v2.0.0 schema" so users on old reports get an obvious signal (they need to re-run `generate.py`).

### 2. Drop v1.x fallbacks

Every `activeX ?? wallClockX` fallback assumes v1.x might omit the field. Under v2 they're always present. Remove:

- [src/components/DailyActivityChart.vue:56](src/components/DailyActivityChart.vue#L56) — `b.activeMinutes ?? b.minutes` → `b.activeMinutes`. Relabel the y-axis/tooltip to "Active hours" to match.
- [src/views/SummaryView.vue](src/views/SummaryView.vue) — any `activeCategoryMinutes ?? categoryMinutes`, `activeMinutesByRepo ?? minutesByRepo` → drop fallbacks.
- [src/utils/sessionFilters.js](src/utils/sessionFilters.js) — `session.activeDurationMin ?? session.durationMin` → drop fallback.
- Grep the codebase for other `?? ` on these fields and strip.

### 3. Relabel idle semantics

**[src/utils/format.js](src/utils/format.js)** — `isHighIdleRatio` and `formatIdleRatio` continue to work mechanically (same inputs), but the *meaning* of the idle gap is now "all capped kinds combined." Keep the 40% threshold — it still flags the right sessions. Add one helper:

```js
export function formatIdleKind(kind) {
  return { user_pause: 'User pause', tool_runtime: 'Tool runtime', inference: 'Inference' }[kind] ?? kind
}
```

Reuse `formatDuration` (already handles seconds→minutes cleanly) for gap/segment durations.

### 4. Session timeline — new component

**[src/components/SessionTimeline.vue](src/components/SessionTimeline.vue)** — new file.

**Props:** `createdAt: string`, `lastActivityAt: string`, `segments: Segment[]`, `gaps: Gap[]`.

**Rendering model:**

- Total wall-clock seconds = `(lastActivityAt - createdAt) / 1000`.
- Merge segments and gaps into a single chronological list keyed by `startedAt`. By schema construction `sum(segments.sec) + sum(gaps.sec) === wallClockSec` (under-cap + `same_turn` gaps are absorbed into segment `sec`; over-cap gaps split segments) — no gap coverage logic needed.
- Render as a horizontal flex row where each item's `width: (item.sec / totalSec) * 100%`.
- Enforce `min-width: 2px` on each span so sub-second items stay hoverable.
- Segments: solid fill with `var(--color-primary)`.
- Gaps: hatched/translucent fill, color-coded by `kind`:
  - `user_pause` → amber (reuse `--color-warning` if present; otherwise `#f59e0b`).
  - `tool_runtime` → violet (reuse `--color-tertiary` or `#8b5cf6`).
  - `inference` → cyan (`#06b6d4`).
  - CSS `background: repeating-linear-gradient(...)` for the hatch.
- Axis labels: `createdAt` on the far left, `lastActivityAt` on the far right, formatted as `HH:mm` for same-day sessions, `MM-DD HH:mm` for multi-day.
- Legend strip below the bar listing the three gap kinds + segment color.
- Hover tooltip (native `title=""` attribute is enough for v1):
  - Segment: `Segment · ${formatDuration(sec/60)} · ${messageCount} messages`.
  - Gap: `${formatIdleKind(kind)} · ${formatDuration(sec/60)} raw (${formatDuration(creditedSec/60)} credited)`.

**Insertion point:** [src/views/SessionDetailView.vue](src/views/SessionDetailView.vue), new card between the breadcrumb/header block and the metadata/conversation grid. Conditional render: show only if `segments.length > 1 || gaps.length > 0` — a one-segment, zero-gap session is a flat bar and adds no information.

### 5. Idle-kind breakdown on SessionDetailView

Extend the existing metadata card at [SessionDetailView.vue:188-195](src/views/SessionDetailView.vue#L188-L195) (currently two rows: "Active Time" / "Wall-clock").

Add, conditional on `idleSec > 0`:

- A stacked mini-bar (active / user_pause / tool_runtime / inference) inline in the card. Same color mapping as the timeline.
- Three rows under "Wall-clock": "User pause idle: Xm", "Tool runtime idle: Xm", "Inference idle: Xm" — each rendered only if its value > 0.
- Small meta chips under the bar: `userPauseCount` pauses, longest pause `formatDuration(longestUserPauseSec/60)`.

Upgrade the existing high-idle banner ([SessionDetailView.vue:157-165](src/views/SessionDetailView.vue#L157-L165)): when `needsActiveReview` is true, show the banner using `activeReviewReason` as the reason string (human-format it: `long_single_pause` → "Long single pause", `high_idle_ratio` → "High idle ratio", `many_long_gaps` → "Many long gaps"). This replaces the current ad-hoc `isHighIdleRatio` trigger — the skill's own judgment is more nuanced.

No new component needed; keep this inline in `SessionDetailView.vue` for cohesion with the existing metadata card.

---

## Files touched

Modify:
- [report.schema.json](report.schema.json) — replace with v2.0.0.
- [src/utils/validation.js](src/utils/validation.js) — extend required fields.
- [src/utils/format.js](src/utils/format.js) — add `formatIdleKind`.
- [src/components/DailyActivityChart.vue](src/components/DailyActivityChart.vue) — drop fallback, relabel.
- [src/views/SummaryView.vue](src/views/SummaryView.vue) — drop fallbacks.
- [src/views/SessionDetailView.vue](src/views/SessionDetailView.vue) — insert timeline, expand metadata card, upgrade banner.
- [src/utils/sessionFilters.js](src/utils/sessionFilters.js) — drop fallback.

Create:
- [src/components/SessionTimeline.vue](src/components/SessionTimeline.vue).

Notes:
- [src/views/SessionsView.vue](src/views/SessionsView.vue) currently reads `durationMin` / `activeDurationMin` and calls `isHighIdleRatio` — no code change needed (the labels are still correct under v2).
- [src/components/ConversationLog.vue](src/components/ConversationLog.vue), [src/components/MetricCard.vue](src/components/MetricCard.vue) — unchanged.

---

## Verification

Run `npm run dev` and load [plan-and-dev-assets/data/report.json](plan-and-dev-assets/data/report.json). Check:

1. **Upload validates.** The new required fields don't throw. A v1.x report (drop one into the upload box) fails validation with a clear v2.0.0 error message.
2. **Summary.** Totals render; DailyActivityChart shows **active** hours per day (not wall-clock). Given the sample data is 93% idle, the chart should look dramatically lower than a v1.x render of the same data — that's correct, not a regression.
3. **Session detail — session `575d3dd8`** (6 segments, 5 user_pause gaps, flagged `long_single_pause`): timeline shows 6 colored solid spans separated by amber hatched gaps; banner explains the reason; idle breakdown shows user_pause dominant.
4. **Session detail — session `43621413`** (237h wall, 108min active, 849k sec tool_runtime idle): timeline is overwhelmingly violet (tool_runtime); breakdown card clearly attributes the idle to `tool_runtime`; this was the v1.x inflation case and should now read as "this session mostly waited on tools," not "237 hours of work."
5. **Session detail — session `b0ecc658`** (59.5h single user pause): one giant amber hatched span dominates the timeline.
6. **Session detail — a trivial session** (single segment, zero gaps): timeline card is hidden (no info to show); metadata card shows only active + wall-clock rows.
7. **Hover a segment** → tooltip with duration and message count. **Hover a gap** → tooltip with kind, raw duration, credited duration.
8. **Console/network quiet.** No Vue warnings, no layout shift, no NaN widths on edge-case sessions (e.g. very short sessions with sub-second segments).
