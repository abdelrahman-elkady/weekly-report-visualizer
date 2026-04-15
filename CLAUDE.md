# Weekly Report Visualizer

A client-side dashboard for visualizing weekly-activity-report data — historical session/PR/ticket analysis, not live monitoring. Data loaded via file upload, persisted in localStorage. Built with Vue 3 + Vite + Tailwind CSS v4 + Chart.js. The `report.schema.json` is the source of truth for all data contracts.

## Dev Commands

- `npm run dev` — start dev server
- `npm run build` — production build to `dist/`
- `npm run preview` — preview production build

## Structure

- `src/views/` — route-level pages (Upload, Summary, Sessions, SessionDetail, PrTracker, Tickets)
- `src/components/` — reusable UI components
- `src/stores/report.js` — reactive store (reportData, sidebarCollapsed, localStorage persistence)
- `src/utils/` — formatters, validation, category mappings
- `src/assets/main.css` — Tailwind v4 @theme design system (Synthetic Architect dark theme)
- `src/router.js` — hash-mode routing with auth guards

## Key Decisions

- Hash routing (`#/summary`, `#/sessions/:id`) for static deployment compatibility
- No backend, no auth — pure client-side static analysis tool
- Design tokens extracted from plan-and-dev-assets mockups, stripped of fabricated monitoring language
- `report.schema.json` defines the data contract; `utils/validation.js` enforces it on upload

## Plans

Implementation plans live in `ai-docs/plans/` and are prefixed with a 3-digit zero-padded sequential number, e.g. `001-schema-v1-update.md`, `002-foo.md`. Increment from the highest existing number when adding a new plan.
