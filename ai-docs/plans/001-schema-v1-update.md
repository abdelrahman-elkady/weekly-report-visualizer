# Schema v1.0.0 Update: Active Duration + Discarded Category

## Context

The progress report schema has been updated to v1.0.0, adding active-duration fields (wall-clock minus idle gaps) alongside existing wall-clock fields, a new `discarded` session category, and description clarifications. The dashboard needs to surface active time as the primary metric everywhere, show discarded sessions with muted styling, and replace the blanket >8h outlier warning with smart idle-ratio detection.

## Design Decisions (confirmed with user)

1. **Active as default** — active time shown everywhere; wall-clock secondary in detail views only
2. **Discarded: show but muted** — included in all views with dimmed visual treatment
3. **Idle ratio warnings** — flag sessions where active/wall-clock <= 45% (replaces >8h check)

## Implementation Plan

### Step 1: `src/utils/categories.js` — add discarded category

Add between `ask` (line 12) and `other` (line 13):
```js
discarded:  { icon: 'delete_sweep', label: 'Discarded', color: 'on-surface-variant' },
```
This flows automatically to all category filters, badges, and charts via `getCategoryInfo()` / `getAllCategories()`.

### Step 2: `src/utils/format.js` — add idle-ratio helpers, remove outlier check

- Remove `OUTLIER_THRESHOLD_MINUTES` (line 14) and `isOutlierDuration` (lines 16-18)
- Add:
```js
const IDLE_RATIO_THRESHOLD = 0.4
const MIN_DURATION_FOR_IDLE_CHECK = 10

export function isHighIdleRatio(durationMin, activeDurationMin) {
  if (durationMin == null || activeDurationMin == null) return false
  if (durationMin <= MIN_DURATION_FOR_IDLE_CHECK) return false
  return (activeDurationMin / durationMin) < IDLE_RATIO_THRESHOLD
}

export function formatIdleRatio(durationMin, activeDurationMin) {
  if (!durationMin || durationMin === 0) return '0%'
  return Math.round((activeDurationMin / durationMin) * 100) + '%'
}
```

### Step 3: `src/components/DailyActivityChart.vue` — use activeMinutes

Line 29: `bucket.minutes` -> `bucket.activeMinutes ?? bucket.minutes`

### Step 4: `src/components/CategoryBars.vue` — muted discarded bars

- Row div (line 38): add `:class="{ 'opacity-50': item.category === 'discarded' }"`
- Bar fill div (lines 47-53): when discarded, override color to `var(--color-outline-variant)` and add dashed border

### Step 5: `src/views/SummaryView.vue` — switch to active data

- **Import** (line 5): replace `isOutlierDuration` with `isHighIdleRatio`
- **totalHours** (line 19): use `totals.activeCategoryMinutes ?? totals.categoryMinutes`
- **Warning text** (lines 86-89): "N sessions with high idle ratio (<45% active)" instead of "exceed 8h"
- **hasOutlier -> highIdleCount** (lines 25-27): count sessions with `isHighIdleRatio(s.durationMin, s.activeDurationMin)`
- **CategoryBars prop** (line 97): pass `totals.activeCategoryMinutes ?? totals.categoryMinutes`
- **RepoBreakdown prop** (line 103): pass `totals.activeMinutesByRepo ?? totals.minutesByRepo`

### Step 6: `src/views/SessionsView.vue` — active duration + muted discarded rows

- **Import** (line 5): replace `isOutlierDuration` with `isHighIdleRatio`
- **Sort** (line 106): sort by `activeDurationMin ?? durationMin`
- **Duration cell** (lines 274-279): display `activeDurationMin ?? durationMin`, use `isHighIdleRatio` for warning icon/color
- **Row div** (line 259): add `:class="{ 'opacity-50': session.category === 'discarded' }"` for muted discarded rows

### Step 7: `src/views/SessionDetailView.vue` — dual display + idle warning banner

- **Import** (line 5): replace `isOutlierDuration` with `isHighIdleRatio, formatIdleRatio`
- **Header duration** (lines 69-72): show `activeDurationMin ?? durationMin` with `isHighIdleRatio` check
- **After header** (after line 75): add idle ratio warning banner:
  ```
  "High idle ratio — only X% active (Xh Xm of Xh Xm)"
  ```
  Styled with `bg-tertiary-container/20 border border-tertiary/30`
- **Metadata sidebar** (lines 98-101): replace single "Duration" row with two rows:
  - "Active Time" — `activeDurationMin ?? durationMin` (primary color)
  - "Wall-clock" — `durationMin` (dimmed `text-on-surface-variant`)
- **Category badge** (lines 57-62): add `border border-dashed border-outline` when discarded

### Step 8: `report.schema.json` — replace with v1.0.0

Copy content from `ai-docs/report.schema.json` to root `report.schema.json`.

## Backward Compatibility

All new field access uses `??` fallback to wall-clock equivalents. `validation.js` `REQUIRED_TOTALS` stays unchanged — older reports still load and display wall-clock data seamlessly. `isHighIdleRatio` returns `false` when `activeDurationMin` is null.

| New Field | Fallback | Used In |
|---|---|---|
| `totals.activeCategoryMinutes` | `totals.categoryMinutes` | SummaryView, CategoryBars |
| `totals.activeMinutesByRepo` | `totals.minutesByRepo` | SummaryView, RepoBreakdown |
| `session.activeDurationMin` | `session.durationMin` | SessionsView, SessionDetailView |
| `bucket.activeMinutes` | `bucket.minutes` | DailyActivityChart |

## Files Modified (8 total)

1. `src/utils/categories.js` — add discarded entry
2. `src/utils/format.js` — add `isHighIdleRatio`, `formatIdleRatio`; remove `isOutlierDuration`
3. `src/components/DailyActivityChart.vue` — activeMinutes fallback
4. `src/components/CategoryBars.vue` — discarded muted styling
5. `src/views/SummaryView.vue` — active data sources + idle warning
6. `src/views/SessionsView.vue` — active duration display + discarded row muting
7. `src/views/SessionDetailView.vue` — dual duration, warning banner, badge styling
8. `report.schema.json` — replace with v1.0.0

## Verification

1. `npm run build` — no compilation errors
2. Load a v1.0.0 report: active time shown in all metrics/charts, discarded sessions muted, idle warnings on high-ratio sessions, detail view shows both active + wall-clock
3. Load a legacy report (no active fields): everything works with wall-clock fallback, no warnings, no console errors
4. Edge cases: 0-minute sessions, sessions shorter than 10min (no idle warning), discarded category in filters
