# Daily Activity Chart: Weekday Labels + Click-to-Filter Sessions

> Note: per CLAUDE.md convention, rename this file to `002-daily-activity-interactions.md` after approval.

## Context

The Summary page's Daily Activity bar chart ([src/components/DailyActivityChart.vue](src/components/DailyActivityChart.vue)) currently shows a passive view of minutes per UTC day with labels like "Mar 26". Two small usability gaps:

1. Users can't quickly see which weekday a bar represents — distinguishing a weekend spike from a Monday sprint requires mental math.
2. Bars are not interactive; users have to manually scroll and filter the Sessions page to see what they actually did on a given day.

This plan adds weekday labels to the chart and makes bars clickable to drill into that day's sessions via a new `date` filter on the Sessions page.

## Timezone correctness (important)

`totals.minutesByDay` is keyed by **UTC** date (`YYYY-MM-DD`, per [report.schema.json:188](report.schema.json#L188)), but the chart today uses `formatDateShort(key)` which does `new Date("2026-03-26").toLocaleDateString('en-US', {…})` — `new Date("YYYY-MM-DD")` parses as UTC midnight, then the format renders in **local** TZ. Verified in a Pacific-TZ Node run: the key `2026-03-26` renders as `"Mar 25"` / `"Wed"` instead of the true UTC `"Mar 26"` / `"Thu"`. So the existing chart is already subtly wrong for users west of UTC, and weekday labels would compound the error if added naively.

Fix: every formatter consuming a UTC day key must pass `timeZone: 'UTC'`, and every comparison between `session.createdAt` and a day key must go UTC→UTC via `toISOString().slice(0, 10)`.

## Scope

### 1. Weekday labels on Daily Activity chart

Chart.js accepts an **array** for each label and renders it as multi-line tick text. Use this to stack weekday on top of the date:

```
Thu         Fri
Mar 26     Mar 27
```

**Changes in [src/utils/format.js](src/utils/format.js):**
- Add `formatUtcDateShort(key)` → `new Date(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })`. Returns `"Mar 26"` for UTC day keys regardless of viewer TZ.
- Add `formatUtcWeekdayShort(key)` → same pattern with `{ weekday: 'short', timeZone: 'UTC' }`. Returns `"Thu"`.
- Leave existing `formatDateShort` alone — it's used elsewhere on full ISO timestamps (e.g. [src/utils/format.js:34](src/utils/format.js#L34)) where local TZ is probably desired.

**Changes in [src/components/DailyActivityChart.vue](src/components/DailyActivityChart.vue):**
- Import `formatUtcDateShort` and `formatUtcWeekdayShort` (replacing `formatDateShort`).
- In [line 27](src/components/DailyActivityChart.vue#L27), change `labels` to an array-per-label (Chart.js renders each array as multi-line tick text):
  ```js
  labels: entries.map(([date]) => [formatUtcWeekdayShort(date), formatUtcDateShort(date)]),
  ```
- This silently fixes the pre-existing mislabel bug in addition to adding weekday.
- No axis/option changes needed — the existing 10px mono font and `.h-48` container accommodate two stacked short strings.

### 2. Click-to-filter by day

**Chart side** ([src/components/DailyActivityChart.vue](src/components/DailyActivityChart.vue)):
- Declare `const emit = defineEmits(['day-click'])`.
- Add `onClick` to `chartOptions`:
  ```js
  onClick: (_evt, elements) => {
    if (!elements.length) return
    const idx = elements[0].index
    const dateKey = Object.keys(props.minutesByDay)[idx]
    emit('day-click', dateKey)
  },
  ```
- Add `onHover: (evt, elements) => { evt.native.target.style.cursor = elements.length ? 'pointer' : 'default' }` so the pointer cursor hints interactivity.

**Summary page** ([src/views/SummaryView.vue:110](src/views/SummaryView.vue#L110)):
- Import `useRouter`, wire `@day-click="(d) => router.push({ path: '/sessions', query: { date: d } })"`.

**Sessions page** ([src/views/SessionsView.vue](src/views/SessionsView.vue)):
- Add a derived `activeDate` computed from `route.query.date` (single string — unlike category/repo this is a single-value filter; clicking another bar replaces it).
- Extend `replaceFilterQuery()` (line 49) to preserve/update `date`:
  ```js
  const date = 'date' in updates ? updates.date : activeDate.value
  if (date) query.date = date
  ```
- Add a clear function `clearDateFilter() { replaceFilterQuery({ date: null }) }`.
- In `filteredSessions` (line 82), add after the category filter:
  ```js
  if (activeDate.value) {
    result = result.filter(s => utcDateKey(s.createdAt) === activeDate.value)
  }
  ```
  where `utcDateKey` is a new helper in [src/utils/format.js](src/utils/format.js): `return iso ? new Date(iso).toISOString().slice(0, 10) : ''`. This converts a full session ISO timestamp to a UTC day key, which is exactly how `minutesByDay` is bucketed (per [report.schema.json:188](report.schema.json#L188)). Critically, do **not** reuse `formatDateKey` ([src/utils/format.js:61](src/utils/format.js#L61)) — that one uses `d.getFullYear()` / `getMonth()` / `getDate()`, which are local-TZ, and would mis-bucket sessions near the UTC day boundary.
- Render a filter chip in the filter row (alongside the search/repo/sort row) only when `activeDate` is set, using the UTC-safe formatter so the chip matches the bar the user clicked:
  ```html
  <button v-if="activeDate" @click="clearDateFilter"
    class="flex items-center gap-2 text-xs font-mono px-3 py-2 rounded-lg bg-primary/20 text-primary">
    <span class="material-symbols-outlined text-base">event</span>
    {{ formatUtcWeekdayShort(activeDate) }} {{ formatUtcDateShort(activeDate) }}
    <span class="material-symbols-outlined text-sm">close</span>
  </button>
  ```

## Critical files

- [src/components/DailyActivityChart.vue](src/components/DailyActivityChart.vue) — add emit, onClick, onHover, multi-line labels
- [src/views/SummaryView.vue](src/views/SummaryView.vue#L110) — wire `@day-click` → router push
- [src/views/SessionsView.vue](src/views/SessionsView.vue) — `activeDate`, filter, chip, `replaceFilterQuery` update
- [src/utils/format.js](src/utils/format.js) — add `formatUtcDateShort`, `formatUtcWeekdayShort`, `utcDateKey`

## Reuse

- `replaceFilterQuery` pattern ([src/views/SessionsView.vue:49](src/views/SessionsView.vue#L49)) — extend rather than reinvent; keeps all filter state in URL
- `queryParamAsSet` approach ([src/views/SessionsView.vue:23](src/views/SessionsView.vue#L23)) — not reused; `date` is a single scalar, read directly as `route.query.date`
- `formatDateShort` / `formatDateKey` — intentionally **not** reused for day-key inputs because they render in local TZ; new UTC-specific variants are required (see "Timezone correctness" above).

## Verification

1. `npm run dev`, load a report, go to Summary.
2. Confirm each bar shows weekday above date (e.g. "Thu / Mar 26"). Cross-check at least one date against a real calendar (Mar 26 2026 = Thu).
3. **TZ check:** open DevTools, set the page TZ via `Sensors → Location` to Los Angeles (or run in a Pacific-TZ terminal); reload and confirm the same bar still reads "Thu / Mar 26", not "Wed / Mar 25". This confirms the UTC-forced formatters work and the pre-existing off-by-one is fixed.
4. Click a bar with sessions → routes to `/sessions?date=YYYY-MM-DD`, chip appears showing the same weekday+date as the bar, list filters to that UTC day. Sessions count footer matches `minutesByDay[date].sessions`.
5. **TZ boundary check:** find a session whose `createdAt` is close to UTC midnight (e.g. 23:30 UTC = 16:30 PT previous day). Confirm it's filtered into the UTC day of its `createdAt`, matching the chart's bar for that UTC day — not the viewer's local day.
6. Click chip's × → query param clears, chip disappears, full list returns.
7. Click a bar, then toggle a category — both filters stack; URL contains `date` and `category[]`.
8. Hover a bar → cursor is pointer; hover empty space → default.
9. Click an empty day (0h bar with no sessions) → nothing happens (no element hit).
