# Dev Digest Visualizer — Implementation Plan

## Context

This project builds a **client-side historical data visualizer** for `claude-dev-digest` output. The report schema captures a developer's LLM agent sessions, GitHub PR activity, and Jira tickets over a configurable time window. The visualizer loads a `report.json` via file upload, persists it in localStorage, and renders 5 dashboard views. There is no backend, no auth, no live monitoring — it's a static analysis tool for already-generated report data.

The `report.schema.json` is the source of truth. The mockups in `plan-and-dev-assets/stitch_progress_report_dashboard/` provide the visual theme ("Synthetic Architect" dark design system) but contain fabricated data and monitoring language that must be stripped.

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Vue 3 SFC + Vite | Reactive data binding, SFC structure, fast HMR |
| CSS | Tailwind CSS v4 (via `@tailwindcss/vite`) | Matches mockup design tokens; v4 uses CSS-first `@theme` |
| Charts | Chart.js via `vue-chartjs` | Daily activity bar chart, authored/reviewed split |
| Markdown | `marked` | Conversation log rendering (~35KB, GFM support) |
| Icons | Material Symbols Outlined (Google Fonts) | Matches mockups |
| Fonts | Inter + JetBrains Mono (Google Fonts) | Matches mockups |
| Routing | `vue-router` with hash mode (`#/summary`, `#/sessions/:id`) | Browser back/forward, bookmarkable URLs for specific sessions/PRs |
| State | Plain `ref()`/`reactive()` store | Too simple for Pinia — one report object, one view string |

---

## Design System (extracted from mockups — KEEP the aesthetic, STRIP fake data)

**Colors:**
- Surface base: `#0b1326`, layers: `#060e20` → `#131b2e` → `#171f33` → `#222a3d` → `#2d3449`
- Primary: `#7bd0ff`, Secondary: `#4edea3`, Tertiary: `#ffb95f`, Error: `#ffb4ab`
- Text: `#dae2fd` (primary), `#c6c6cd` (secondary)
- Full 40+ token palette from mockup Tailwind configs → translated to Tailwind v4 `@theme` in CSS

**Rules:**
- No visible borders for section separation — use background color shifts
- Border radius: `0.125rem` default (tight), `0.25rem` lg, `0.5rem` xl
- Nav labels: `text-[0.6875rem] font-mono uppercase tracking-wider`
- Metric numbers: large `font-mono font-bold` with small unit labels
- Category icons: mapped to Material Symbols (implementation→`code`, debugging→`bug_report`, etc.)

**Stripped from mockups:**
- All monitoring language: "Active Nodes", "Sync Error Rate", "System Health", "Latency"
- User profiles: avatars, roles ("PRO_ACCESS", "Tier: Elite"), status indicators
- Live indicators: pulsing dots, "Incident Detected", status columns
- Fabricated metrics: "Global Impact Score", "Weekly Velocity", "Correlation Score 0.92"
- Non-existent fields: CPU Impact, Memory Delta, Token Depth, Agent Version, Model
- Interactive features: "Share Report", "Replay Stream", chat input
- Footer links: Docs, API, Support

---

## Data Flow

1. **Upload**: User drops/selects `report.json` → `FileReader.readAsText()` → parse → validate → store
2. **Validation**: Check 12 required top-level fields + `totals` subfields + array types. Return descriptive errors.
3. **localStorage**: Store raw JSON string on success. Auto-load on app mount. ~1.1MB fits in 5-10MB limit.
4. **Store exports**: `reportData` (ref), `isLoaded` (computed), `sidebarCollapsed` (ref). View state managed by `vue-router` (no `currentView` / `selectedSessionId` in store).

---

## Views

### 1. Upload View (shown when no data loaded)
- Centered layout: feature highlights on left, drop zone on right
- Drop zone: drag-drop + file picker button
- Validation errors shown inline (red text, list of issues)
- No bundled sample data — user must explicitly provide their own report.json
- No fake status bars, version numbers, or stream indicators

### 2. Summary Dashboard
**Header row** — Report window dates + 4 metric cards:
- Total Sessions (`totals.sessions`)
- Authored PRs (`totals.prs`)
- Reviewed PRs (`totals.reviewedPrs`)
- Total Hours (sum of `categoryMinutes` values, converted to hours, flag if any session > 8h)

**Grid `grid-cols-12 gap-6`:**

| Left (col-span-7) | Right (col-span-5) |
|---|---|
| **Category Distribution** — horizontal bars from `totals.categoryMinutes`, sorted desc, hours labels, color-cycled (primary/secondary/tertiary/outline) | **Daily Activity** (top) — Chart.js bar chart from `minutesByDay`, x=dates, y=hours |
| | **Repo Activity** (bottom) — horizontal bars from `minutesByRepo`, top 8 repos |

**Bottom (col-span-12):** Ticket overview table — ID, title (or "Not enriched"), status (or "N/A"), linked sessions count, linked PRs count. Paginated (20/page).

### 3. Sessions Explorer
**Header:** Total / Correlated / Uncorrelated counts
**Filters:** Search by repo, category toggle chips (multi-select), sort dropdown
**Table columns** (grid-based, not `<table>`):
- Session ID (truncated 8-char UUID)
- Repo (`repoShort` as chip)
- Category (icon + label)
- Branch
- Duration (`formatDuration` — flag outliers > 8h with tertiary warning)
- First Prompt (truncated ~60 chars)
- Correlation (count of `correlatedPRs` or "None")

Click row → Session Inspector. Paginated (25/page).

### 4. Session Inspector
**Header:** Back button, session ID, repo, branch, category badge, duration

**Layout `grid-cols-12 gap-8`:**

| Left (col-span-8) | Right (col-span-4, sticky) |
|---|---|
| **Conversation Log** — interleave `userMessages` + `assistantTexts` by `ts` timestamp. Full markdown rendering via `marked` (GFM, code blocks). User = left accent `border-l-2 border-primary/40`. Assistant = `bg-surface-container-high`. Show "X of Y messages" notice if arrays are partial. | **Metadata** — duration, msg counts, files touched, repo, branch, created/last activity timestamps |
| **Stats cards** (below conversation) — 3 cards: Duration, User Messages, Files Touched | **Tool Usage** — CSS horizontal bars from `toolCounts` (Bash: 7, Read: 4, etc.) |
| | **Correlated PRs** — PR key, "Score: N" (integer), reasons chips. Empty state with `link_off` icon |
| | **Jira IDs** — chips. Empty state: "No Jira tickets linked" |
| | **Files Touched** — first 5 from `filesTouchedRelative`, "and N more..." expand toggle |

### 5. PR Tracker
**Header metrics** (`grid-cols-12`):
- **Authored vs Reviewed split** (col-span-5): bar comparison chart, 21 vs 8
- **Code Volume** (col-span-4): total +additions (secondary) / -deletions (error)
- **Correlation Rate** (col-span-3): `(sessions - uncorrelatedSessions) / sessions * 100`%

**PR List:** Expandable cards combining `prs` + `reviewedPrs` (distinguished by `kind`):
- Header: #number, title, repoShort, +/-lines, merged date, Jira ID chips, kind badge
- Expand: correlated sessions with "Score: N" (integer, NOT percentage), reasons, clickable session IDs
- Filter: All / Authored / Reviewed toggle + search

**Corrections vs mockup:** No "In Review" status (all PRs are merged), no fake impact/velocity scores.

### 6. Jira Tickets
**Table:** ID, Title (or "Not enriched" italic), Status (or "N/A"), Linked Sessions count, Linked PRs count
**Expand row:** clickable session IDs and PR keys
**Notice:** "Ticket details can be enriched by running the report with Atlassian MCP integration"
**Search/sort:** by ID, session count, PR count

---

## Time Display Rules

| Range | Format | Example |
|-------|--------|---------|
| < 60m | `Xm` | `42m` |
| 1-24h | `Xh Ym` | `3h 22m` |
| > 24h | `Xd Yh` | `2d 16h` |
| Outlier (> 8h) | Normal format + tertiary warning icon | `64h 30m ⚠` tooltip: "May include idle time" |

---

## File Structure

```
src/
  main.js                          # Mount + localStorage auto-load + router init
  App.vue                          # Root: sidebar + <router-view>
  router.js                        # vue-router hash mode routes
  assets/
    main.css                       # Tailwind v4 @theme (40+ color tokens) + base styles + markdown CSS
  stores/
    report.js                      # Reactive store (reportData, sidebarCollapsed)
  utils/
    format.js                      # Duration, date, number formatters
    validation.js                  # Schema structural validation
    categories.js                  # Category → icon name + color mapping
  views/
    UploadView.vue                 # route: /
    SummaryView.vue                # route: /summary
    SessionsView.vue               # route: /sessions
    SessionDetailView.vue          # route: /sessions/:id
    PrTrackerView.vue              # route: /prs
    TicketsView.vue                # route: /tickets
  components/
    AppSidebar.vue                 # Collapsible 256px ↔ 64px, uses <router-link>
    CategoryBars.vue               # Horizontal bars (CSS, not Chart.js)
    DailyActivityChart.vue         # Chart.js bar chart via vue-chartjs
    RepoBreakdown.vue              # Horizontal bars (CSS)
    SessionTable.vue               # Grid-based session list
    PrCard.vue                     # Expandable PR card
    ConversationLog.vue            # Message interleaving + marked rendering
    ToolUsageChart.vue             # CSS horizontal bars for tool counts
    CorrelationBadge.vue           # Score + reasons (reused in sessions + PRs)
    MetricCard.vue                 # Reusable: icon + label + large number
    EmptyState.vue                 # Reusable: icon + message for empty data
```

23 files total.

**Routes** (hash mode — e.g. `http://localhost:5173/#/sessions/7ee1dec1`):
- `/ ` → UploadView (redirect to `/summary` if data loaded)
- `/summary` → SummaryView
- `/sessions` → SessionsView
- `/sessions/:id` → SessionDetailView
- `/prs` → PrTrackerView
- `/tickets` → TicketsView
- Navigation guard: redirect to `/` if no data loaded and trying to access any view

---

## Implementation Phases

| # | Phase | Key files | Depends on |
|---|-------|-----------|------------|
| 1 | **Scaffold** — `npm create vite@latest`, install deps (vue-router, vue-chartjs, chart.js, marked, tailwindcss, @tailwindcss/vite) | `package.json`, `vite.config.js`, `index.html` | — |
| 2 | **Design system** — Tailwind v4 `@theme` with all color/font/radius tokens, base styles, markdown CSS | `src/assets/main.css` | Phase 1 |
| 3 | **Data layer** — store, validation, formatters, localStorage | `stores/report.js`, `utils/*` | Phase 1 |
| 4 | **Shell** — App.vue layout, router setup, AppSidebar (collapsible), `<router-view>` | `App.vue`, `router.js`, `AppSidebar.vue` | Phase 2-3 |
| 5 | **Upload View** — drag-drop, validation | `UploadView.vue` | Phase 3-4 |
| 6 | **Summary Dashboard** — header metrics, CategoryBars, DailyActivityChart, RepoBreakdown, ticket table | `SummaryView.vue`, `CategoryBars.vue`, `DailyActivityChart.vue`, `RepoBreakdown.vue`, `MetricCard.vue` | Phase 4 |
| 7 | **Sessions Explorer** — filters, table, pagination | `SessionsView.vue`, `SessionTable.vue` | Phase 4 |
| 8 | **Session Inspector** — conversation log, metadata sidebar, tool usage, correlations | `SessionDetailView.vue`, `ConversationLog.vue`, `ToolUsageChart.vue`, `CorrelationBadge.vue` | Phase 4 |
| 9 | **PR Tracker** — header metrics, PR cards, correlation details | `PrTrackerView.vue`, `PrCard.vue` | Phase 4 |
| 10 | **Tickets View** — table, empty states, expand detail | `TicketsView.vue`, `EmptyState.vue` | Phase 4 |
| 11 | **Polish** — empty states across all views, loading feedback, responsive tweaks | All | Phase 5-10 |

---

## Verification

1. `npm run dev` — app starts, shows Upload view
2. Drop `plan-and-dev-assets/data/report.json` — validates, navigates to Summary
3. Refresh browser — report auto-loads from localStorage
4. Navigate all 5 views via sidebar
5. Collapse/expand sidebar toggle
6. Click session row → Session Inspector with conversation log
7. Click PR → expands with correlated sessions
8. Verify: no fabricated labels, all data matches schema fields
9. `npm run build` — production build succeeds

---

## Also: Update CLAUDE.md

Add project description to CLAUDE.md:
> A client-side dashboard for visualizing claude-dev-digest report data — historical session/PR/ticket analysis, not live monitoring. Data loaded via file upload, persisted in localStorage. Built with Vue 3 + Vite + Tailwind CSS v4 + Chart.js. The `report.schema.json` is the source of truth for all data contracts.
