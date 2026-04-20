# PR Tracker: Filters + Connection Flow

## Context

The PR tracker ([src/views/PrTrackerView.vue](../../src/views/PrTrackerView.vue)) currently exposes only a three-way tab (all/authored/reviewed) and a free-text search. Two friction points motivate this change:

1. **Weak filtering.** With dozens of PRs per week across multiple repos, the tab+search combo doesn't let the user narrow to "reviewed PRs from person X in repo Y" or "merged-but-closed PRs only."
2. **Noisy deep-links.** Ticket rows ([TicketsView.vue:142](../../src/views/TicketsView.vue#L142)) and session correlation badges ([CorrelationBadge.vue:23](../../src/components/CorrelationBadge.vue#L23)) both jump to `#/prs?search=<prKey>`. The `owner/repo#number` key doesn't match any of the fields searched by [PrTrackerView.vue:50-58](../../src/views/PrTrackerView.vue#L50-L58), so results are often empty or incorrect.

The Sessions Explorer ([src/views/SessionsView.vue](../../src/views/SessionsView.vue)) already solves the same UX problems with a sticky **right-hand** facet column (240px, achieved via `grid-template-columns: minmax(0, 1fr) 240px` + `order: 1` on the aside — see [SessionsView.vue:451-465](../../src/views/SessionsView.vue#L451-L465)), URL-synced filter state, and a dismissable "focus" chip pattern (`activeDate`). The fix is to port that pattern to the PR tracker and add a precise `key` deep-link param.

## Outcome

- PR tracker gets a facet column (repo, author, merge state, size, target branch, kind) mirroring the Sessions layout.
- All filter state is URL-encoded so combinations are shareable/bookmarkable.
- Ticket and session-detail PR links use a precise `key` filter instead of fuzzy `search`, surfacing exactly one PR card with a dismissable chip.

## Filters to ship

Based on user selection — must-haves first, then the two lower-priority picks.

| Facet | UI | Source | URL param |
|---|---|---|---|
| Kind | Segmented: All / Authored / Reviewed | `pr.kind` | `kind` (replaces `tab`) |
| Repo | Multi-select checkbox list with search + "+N more" overflow (copy from SessionsView pattern) | `pr.repoShort` | `repo` |
| Author | Multi-select checkbox list; **shown only when ≥2 distinct authors are visible** (so it disappears on kind=authored) | `pr.author` | `author` |
| Merge state | Segmented: Any / Merged / Closed / Open | derived: `merged = mergedAt != null`; `closed = closedAt != null && mergedAt == null`; `open = closedAt == null && mergedAt == null` | `state` |
| Size | Checkbox list: XS / S / M / L / XL | derived from `additions + deletions`: XS<10, S<100, M<500, L<1000, XL≥1000 | `size` |
| Target branch | Checkbox list (hidden if only one distinct `base`) | `pr.base` | `base` |

**Skipped** (per user): merge-date range, file-path prefix, has-jira/has-sessions booleans, correlation filter.

**Kept from today:** free-text search (title, repoShort, number, jiraIds).

## Connection flow: precise `key` deep-link

New exact-match URL param `?key=owner/repo%23N` on `#/prs`. When present:
- Filter reduces to the single PR whose `${pr.repo}#${pr.number}` equals the decoded key.
- A dismissable chip renders above the list (same treatment as `activeDate` in [SessionsView.vue:199-208](../../src/views/SessionsView.vue#L199-L208)): `× owner/repo#123`.
- Other facets still apply but are typically redundant when key is set.

Call-site updates — change query shape from `search` to `key`:
- [CorrelationBadge.vue:23](../../src/components/CorrelationBadge.vue#L23) — `query: { search: match.key }` → `query: { key: match.key }`
- [TicketsView.vue:142](../../src/views/TicketsView.vue#L142) — `query: { search: key }` → `query: { key }`

Rename `tab` → `kind` to match the Sessions namespace (`category`, `repo`, `date`):
- [SummaryView.vue:77](../../src/views/SummaryView.vue#L77), [SummaryView.vue:85](../../src/views/SummaryView.vue#L85) — `tab: 'authored'` / `tab: 'reviewed'` → `kind: …`

PR card → GitHub (external new-tab) stays exactly as-is: [PrCard.vue:24](../../src/components/PrCard.vue#L24), [PrCard.vue:34](../../src/components/PrCard.vue#L34). No in-app PR detail surface.

## Implementation

### New file: `src/stores/prFilters.js`

Parallel to [src/stores/sessionFilters.js](../../src/stores/sessionFilters.js). Exports `usePrFilters()` and `useUrlPrFacets(route)`. Reuse the same shape:

- `DEFAULTS = { search: '', sort: 'mergedAt' }` — non-URL state.
- `applyFilters(prs, { kind, repos, authors, state, sizes, bases, key })` — pure filter+sort pipeline.
- `useUrlPrFacets(route)` returns `{ activeKind, activeRepos, activeAuthors, activeState, activeSizes, activeBases, activeKey, filteredPrs }`.
- Reuse `queryParamAsSet` helper (copy; it's 4 lines, not worth extracting).
- Reset on `reportData` change (same `watch(reportData, resetAll)` pattern).

Size bucketing lives here as a small helper (`sizeBucket(pr)` returning `'XS'|'S'|'M'|'L'|'XL'`).

### Refactor: `PrTrackerView.vue`

Replace the current filter row with the aside+main grid from SessionsView:
- Copy the `.facet-layout`, `.facet-col`, `.facet-group`, `.facet-hdr`, `.facet-item`, `.facet-segmented`, `.chk`, `.facet-cnt` scoped styles verbatim from [SessionsView.vue:450-609](../../src/views/SessionsView.vue#L450-L609). Keep them scoped in the PR view for now — hoisting to `main.css` is a separate cleanup.
- Aside contents, top to bottom:
  1. "Filters · N" header + "Clear all" button (mirror SessionsView.vue:184-196).
  2. `key` chip group (visible only when `activeKey` is set) — same pattern as the `activeDate` block.
  3. Kind segmented (All / Authored / Reviewed).
  4. Merge state segmented (Any / Merged / Closed / Open).
  5. Size checkbox list with counts.
  6. Target branch checkbox list (hidden if single value).
  7. Author checkbox list (hidden if <2 distinct authors in current visible set).
  8. Repo checkbox list with search + "+N more" overflow — lift verbatim from [SessionsView.vue:262-295](../../src/views/SessionsView.vue#L262-L295).
- Main column keeps the three header-metric cards, then search + sort + `PrCard` list.
- Add a sort dropdown (`mergedAt` desc default, plus `createdAt` desc, `size` desc, `correlation` desc).

Reuse [PrCard.vue](../../src/components/PrCard.vue) and [EmptyState.vue](../../src/components/EmptyState.vue) unchanged.

### Query-param writer

Copy the `replaceFilterQuery(updates)` helper pattern from [SessionsView.vue:28-42](../../src/views/SessionsView.vue#L28-L42), extended to cover the new params. Segmented facets (`kind`, `state`) use `router.replace` on click; checkbox facets toggle via a `Set` round-trip. `key` is never written from inside the tracker — it's only consumed from incoming deep links and cleared via the chip's × button.

## Critical files

- [src/views/PrTrackerView.vue](../../src/views/PrTrackerView.vue) — rewrite (filter row → aside grid).
- [src/stores/prFilters.js](../../src/stores/prFilters.js) — new.
- [src/components/CorrelationBadge.vue](../../src/components/CorrelationBadge.vue) — one-line query shape change.
- [src/views/TicketsView.vue](../../src/views/TicketsView.vue) — one-line query shape change.
- [src/views/SummaryView.vue](../../src/views/SummaryView.vue) — two lines: `tab` → `kind`.

## Verification

1. `npm run dev`; upload a report with multiple repos, authors, and merge states (the local `plan-and-dev-assets/data/report.json` should do).
2. **Facet UX**: toggle each facet; observe the list narrows, URL updates, count chips under each facet reflect the pre-filter counts (mirror SessionsView's `categoryCounts`/`allRepos` behavior). Reload — filters restore from URL. "Clear all" wipes the query string.
3. **Author conditional**: set kind=Authored; Author facet should disappear. Switch to All or Reviewed with mixed-author reviewed PRs; it reappears.
4. **Target-branch conditional**: with a single-repo single-branch report, the Target branch facet is hidden; with `--branches master,develop`, it appears.
5. **Key deep-link**: from a ticket expansion, click a PR chip — URL becomes `#/prs?key=owner/repo%23N`, only that PR renders, and a dismissable chip shows above the list. Click × — chip clears, full list returns, other facets preserved.
6. **Correlation badge round-trip**: from a session-detail page, click a correlated PR badge — same single-PR view renders. The old noisy-search bug is gone.
7. **Summary cards**: click "Authored" / "Reviewed" metric cards on Summary — lands on `#/prs?kind=authored` / `…?kind=reviewed` with the segmented facet pre-selected.
8. **Shareability**: copy a URL with multiple filters set, open in a new tab — state matches exactly.
