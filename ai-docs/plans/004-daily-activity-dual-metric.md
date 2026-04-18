# Daily Activity — Dual-Metric Chart (Sessions + Hours)

> On approval, rename to `004-daily-activity-dual-metric.md` per the numbered-plan convention in `CLAUDE.md`.

## Context

The `DailyActivityChart` on the Summary view currently renders one metric per day: active minutes (falling back to wall-clock minutes), converted to hours. The user wants to also see **session count per day** alongside it. The interesting signal is the *relationship* between the two — e.g. many sessions + few hours = fragmented day; few sessions + many hours = deep-focus day. That relationship is only visible when both are on screen at once.

The data is already in the report: each `totals.minutesByDay[YYYY-MM-DD]` bucket has both `sessions` (integer) and `activeMinutes`/`minutes` fields (see `report.schema.json` `$defs/DayBucket`, lines 201–223). No schema, store, or upload changes are needed.

## Recommended approach

Render a **mixed bar+line chart with two Y-axes**:

- **Bars (left Y-axis):** session count per day — primary visual emphasis using `--color-primary`.
- **Line (right Y-axis):** hours per day — secondary overlay using a contrasting accent (e.g. `--color-tertiary`), with point markers so individual values are readable.

The Chart.js legend is enabled and lets the user click either dataset to hide it. **Both the hidden dataset *and* its Y-axis must disappear so the remaining metric rescales to fill the chart** — Chart.js doesn't do the axis-hide automatically when two axes are present, so we wire a custom `plugins.legend.onClick` that toggles the dataset visibility *and* the corresponding axis's `display` flag, then calls `chart.update()`.

Alternative considered: a single-metric segmented toggle (Time | Sessions). Rejected because it forces the user to flip back and forth to spot the bars-vs-hours relationship — exactly the insight the dual chart makes obvious at a glance.

## Changes

### [src/components/DailyActivityChart.vue](src/components/DailyActivityChart.vue) — the only file that changes

1. **Register additional Chart.js components** (currently line 13, only `BarElement`, `CategoryScale`, `LinearScale`, `Tooltip`):
   - Add `LineController`, `LineElement`, `PointElement`, `Legend`.
2. **Switch the rendered component**: the existing `<Bar>` from `vue-chartjs` (line 102) only registers as a bar controller. For a mixed chart, use `<Chart type="bar" ...>` from `vue-chartjs` and let the line dataset specify `type: 'line'` per-dataset. (`<Bar>` with a typed line dataset works in many setups but the explicit `<Chart>` is clearer.)
3. **`chartData`** (currently line 30) — emit two datasets:
   ```js
   datasets: [
     { type: 'bar',  label: 'Sessions', yAxisID: 'ySessions',
       data: entries.map(([, b]) => b.sessions),
       backgroundColor: getCssVar('--color-primary'),
       borderRadius: 3, barPercentage: 0.7, order: 2 },
     { type: 'line', label: 'Hours',    yAxisID: 'yHours',
       data: entries.map(([, b]) => minutesToHours(b.activeMinutes ?? b.minutes)),
       borderColor: getCssVar('--color-tertiary'),
       backgroundColor: getCssVar('--color-tertiary'),
       pointRadius: 3, tension: 0.3, order: 1 },
   ]
   ```
   `order` keeps the line drawn above the bars.
4. **`chartOptions`** (currently line 44) — replace the single `y` scale with two:
   - `ySessions`: left, `position: 'left'`, integer ticks (`precision: 0`, `stepSize: 1`), grid retained for the active axis only.
   - `yHours`: right, `position: 'right'`, tick callback `${v}h`, `grid.drawOnChartArea: false` to avoid double gridlines.
   - Tooltip `label` callback formats per dataset: `${v} session(s)` or `${v}h`.
   - `plugins.legend = { display: true, position: 'top', align: 'end', labels: { boxWidth: 10, font: { size: 11, family: fontMono } } }`.
5. **Custom legend onClick** — replace Chart.js's default with one that also hides the matching axis so the visible metric rescales:
   ```js
   plugins.legend.onClick = (_e, item, legend) => {
     const chart = legend.chart
     const ds = chart.data.datasets[item.datasetIndex]
     const visible = chart.isDatasetVisible(item.datasetIndex)
     chart.setDatasetVisibility(item.datasetIndex, !visible)
     chart.options.scales[ds.yAxisID].display = !visible ? true : false
     chart.update()
   }
   ```
   This guarantees the remaining axis takes the full vertical space when one dataset is hidden.
6. **Preserve** `onClick` / `onHover` / `emit('day-click', dateKey)` (currently lines 50–58). The bar's `index` still maps to a date, and bars are the click target users already expect.
7. **Preserve** horizontal scroll behavior (`minWidthPx`, `overflow-x-auto` wrapper at line 100) — unchanged.
8. **Header label** stays "Daily Activity" — no toggle UI needed; the legend itself is the control.

No new utilities required; `minutesToHours` stays in use for the line dataset, and session count is a raw integer.

## Verification

1. `npm run dev`, open the Summary view with a loaded report (use [plan-and-dev-assets/data/report.json](plan-and-dev-assets/data/report.json) for a multi-week sample).
2. Default view shows **bars (sessions, left axis) + line (hours, right axis)** with a legend at the top-right.
3. Hover any bar → tooltip shows both `N sessions` and `Xh` for that date.
4. Click **Hours** in the legend → line and right Y-axis disappear; bars + left axis re-scale to fill the chart vertically.
5. Click **Hours** again → line + right axis return.
6. Click **Sessions** → bars and left Y-axis disappear; line + right axis fill the chart.
7. Click any bar (when sessions are visible) → still navigates to `/sessions?date=YYYY-MM-DD` (filters SessionsView).
8. Long windows → horizontal scroll still works; both datasets scroll together.
9. Cross-check session counts against the SessionsView day filter and `totals.sessions`; cross-check hours against `totals.activeMinutesByRepo` summed.
