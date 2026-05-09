# Daily Activity Chart: Horizontal Scroll for Long Date Ranges

> Note: per CLAUDE.md convention, rename this file to `003-daily-activity-horizontal-scroll.md` after approval (next in sequence after `002-daily-activity-interactions.md`).

## Context

Reports can span arbitrary date ranges — the `claude-dev-digest` skill defaults to 7 days but users can (and do) generate 3+ week windows. At 3 weeks in the fixed `col-span-5` column (~450px available), Chart.js auto-shrinks bars to ~21px each, then drops every other tick label to avoid overlap (see screenshot: "Fri 27", "Sun 29", "Tue 31", etc. missing from the March/April range).

We considered widening the Summary grid (reduce `col-span-7` → `col-span-6` for CategoryBars), but that's zero-sum and only delays the problem — a 4-week report would re-trigger skipping. A horizontally scrollable chart container gives each bar a guaranteed minimum width and scales to any report length with no further layout changes.

Outcome: every day's bar is fully readable with its weekday + date label, regardless of window length; short reports (≤~9 days) still fit without a scrollbar.

## Scope

### Single file change: [src/components/DailyActivityChart.vue](src/components/DailyActivityChart.vue)

1. **Compute a per-entry pixel minimum.** Add a `minWidthPx` computed:
   ```js
   const minWidthPx = computed(() => {
     const n = Object.keys(props.minutesByDay || {}).length
     return n * 52  // ~52px per bar: enough for two-line "Thu / Mar 26" at 10px mono
   })
   ```
   52px is chosen to comfortably fit the widest two-line label (`Wed / Mar 30` ≈ 42px) plus gutter, keeping labels axis-parallel rather than the auto-rotated state seen at ≤30px per bar.

2. **Wrap the chart in a scroll container.** Replace:
   ```html
   <div class="h-48">
     <Bar :data="chartData" :options="chartOptions" />
   </div>
   ```
   with:
   ```html
   <div class="h-48 overflow-x-auto">
     <div class="h-full" :style="{ minWidth: minWidthPx + 'px' }">
       <Bar :data="chartData" :options="chartOptions" />
     </div>
   </div>
   ```
   - Outer `overflow-x-auto` enables scroll only when inner content exceeds column width (short reports render without scrollbar — verified: 7 days × 52 = 364px < ~450px column).
   - Inner `h-full` + inline `min-width` gives Chart.js a concrete element to size against; `responsive: true` + `maintainAspectRatio: false` are already set and the Chart.js 4.5 ResizeObserver tracks the inner element correctly (confirmed by exploration).

No other files change. The click-to-filter emit, onHover pointer cursor, tooltip config, and UTC-safe labels from plan 002 all continue to work unchanged inside the scroll container.

## Critical files

- [src/components/DailyActivityChart.vue](src/components/DailyActivityChart.vue) — add `minWidthPx` computed, wrap chart in scroll container

## Reuse

- Global webkit scrollbar styling at [src/assets/main.css:98-111](src/assets/main.css#L98-L111) already styles horizontal scrollbars (6px, `--color-outline-variant` thumb, themed hover) — no new CSS.
- `Object.keys(props.minutesByDay)` pattern already used in the existing `onClick` handler for index lookup — same prop, same keying.

## Verification

1. `npm run dev`, load a report covering ≥3 weeks (e.g. the one in the screenshot with Mar 26 → Apr 15).
2. Confirm every day has a visible bar with both weekday and date label — no skipped ticks.
3. Confirm a horizontal scrollbar appears under the chart and scrolls smoothly; scrollbar matches the theme (thin, muted outline-variant).
4. Load a 7-day report and confirm no scrollbar appears (inner content fits column).
5. Click a bar at the far-right of the scrolled view → still routes to `/sessions?date=YYYY-MM-DD` with the correct day (regression check for plan 002's onClick).
6. Hover a bar → pointer cursor; tooltip renders correctly and isn't clipped by the scroll container's bounds for bars near the middle of the range.
7. Resize the browser narrower — the outer container shrinks, scrollbar appears earlier; the inner chart's bar width stays at the 52px floor.
