# Implementation Plan: referout-tracking

**Branch**: `main` (single-page rewrite of `src/pages/Overview.tsx`)
**Date**: 2026-04-28
**Spec**: `specs/referout-tracking/spec.md`
**Brainstorm**: `specs/referout-tracking/brainstorm.md`
**Research**: `specs/referout-tracking/research.md`
**Constitution**: `specs/constitution.md`

## Summary

Rewrite `src/pages/Overview.tsx` so it implements the "ระบบทะเบียนติดตามการส่งต่อผู้ป่วย (Refer Out) จังหวัดกาญจนบุรี" dashboard for Thaiyok Hospital (11278). The page renders a sticky filter bar, 7 KPI cards (4 geography + 3 operational), 4 visualizations (donut emergency / stacked bar type×area / horizontal bar refer_cause top-10 / line trend), and a paginated detail table with row-level drill-down. Data is read-only via `executeSqlViaApi()`; all SQL uses parameter binding. UI is built from existing shadcn primitives, lucide-react icons, recharts charts, and date-fns Thai locale (Buddhist Era display). No new dependencies.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: React 19, Vite 6, recharts 3.x, shadcn/ui (Card/Dialog/Button/Input/Table/Tabs/Textarea/Badge/Skeleton), Tailwind CSS v4, lucide-react, date-fns (with Thai locale)
**Storage**: BMS Session API → HOSxP MySQL/PostgreSQL (read-only via `/api/sql`)
**Testing**: Vitest + React Testing Library (unit/component/integration); SQL builder contract tests
**Target Platform**: Modern browsers (Chrome/Edge/Firefox/Safari ≥ 2 years old) on Windows hospital workstations
**Project Type**: Single-page web app (template already wired)
**Performance Goals**: First interactive < 2 s on hospital LAN; KPI + charts render < 3 s after data; supports 5,000 rows / range
**Constraints**: Frozen `package.json` (no `npm install`), single target file `src/pages/Overview.tsx` (with helper modules allowed), Tailwind only, read-only SQL, no auth code
**Scale/Scope**: 1 page, ~6 helper modules, 7 KPI cards, 4 charts, 1 detail table with drill-downs, ~50–100 tests

## Constitution Check

| Principle | Compliance |
|-----------|-----------|
| I. Code Quality | TypeScript strict; ESLint clean; `npx tsc -b` and `npm run build` gates enforced before merge |
| II. TDD (NON-NEGOTIABLE) | Each phase task pairs a failing test with the implementation |
| III. UI/UX | All four states (loading/empty/error/success); Thai labels; พ.ศ. dates; severity color + label; HN masking toggle |
| IV. Performance | Aggregate SQL in single round-trip per KPI block; LIMIT 500 on detail; useMemo/useCallback; debounced search |
| V. Version Control | Atomic commits per task with conventional prefixes; push after every commit |
| VI. Reuse | All UI from `src/components/ui/`; service via `src/services/bmsSession.ts`; new helpers under `src/utils`/`src/hooks` |
| VII. Informative UX | Skeleton + Thai error + empty state + retry; loading caption tells the user what's loading |
| VIII. Observability | Errors via existing `notify` service; dev-only console traces gated by `import.meta.env.DEV` |
| IX. Tools / Domain | HOSxP knowledge base used; SQL parameter binding only |

**Gate**: PASS — no violations to justify in Complexity Tracking.

## Project Structure

### Documentation

```text
specs/referout-tracking/
├── brainstorm.md           # Phase 0 brainstorm (already created)
├── research.md             # Phase 0 research (already created)
├── spec.md                 # Phase 1 spec (already created)
├── plan.md                 # This file
├── tasks.md                # Phase 2 (created by speckit.tasks step)
└── analyze.md              # Phase 2 cross-artifact report (step 8)
specs/constitution.md       # Project constitution
```

### Source Code (repository root)

```text
src/
├── pages/
│   └── Overview.tsx                          # rewritten — main dashboard page
├── components/
│   └── referout/
│       ├── FiltersBar.tsx                    # sticky filter bar (date range + selects + search)
│       ├── KpiCardsGrid.tsx                  # 7 KPI cards (geography + operational rows)
│       ├── EmergencyDonut.tsx                # donut chart
│       ├── TypeAreaStackedBar.tsx            # stacked bar chart
│       ├── CauseTopBar.tsx                   # horizontal bar chart
│       ├── TrendLine.tsx                     # line chart
│       ├── ReferoutTable.tsx                 # detailed table
│       ├── ReferoutDetailDialog.tsx          # row-click side dialog (incl. timeline)
│       ├── KpiDrillDownDialog.tsx            # KPI-card drill-down modal
│       ├── ChartDrillDownDialog.tsx          # chart-slice drill-down modal
│       └── EmptyState.tsx                    # empty-state card
├── hooks/
│   └── useReferoutData.ts                    # orchestrates filters → SQL → state
├── utils/
│   ├── thaiDate.ts                           # formatThaiDate helper (date-fns + พ.ศ. shift)
│   ├── csvExport.ts                          # CSV with UTF-8 BOM
│   ├── numberFormat.ts                       # toThaiNumber / formatPercentDelta
│   └── referoutSql.ts                        # SQL builders + lookups (parameterized)
└── services/                                  # (no changes — reuse bmsSession.ts)

tests/
├── unit/
│   ├── thaiDate.test.ts
│   ├── csvExport.test.ts
│   ├── numberFormat.test.ts
│   └── referoutSql.test.ts
├── component/
│   ├── KpiCardsGrid.test.tsx
│   ├── FiltersBar.test.tsx
│   ├── ReferoutTable.test.tsx
│   ├── ReferoutDetailDialog.test.tsx
│   └── EmergencyDonut.test.tsx
├── integration/
│   └── referoutFlow.test.tsx                 # filter → fetch → render → drill-down
└── api/
    └── referoutSql.contract.test.ts          # SQL string contract test
```

**Structure Decision**: Use the existing single-project layout. The dashboard lives in `src/pages/Overview.tsx`, but UI is decomposed into `src/components/referout/` and logic into `src/hooks/` + `src/utils/`. Tests mirror the source tree under `tests/`. No new dependencies are added.

## Phase 0 — Outputs (already produced)

- `brainstorm.md`: design alternatives, edge cases, drill-down ideas, palette decisions.
- `research.md`: external best-practice references + sources.

## Phase 1 — Design Decisions

### Data flow

1. `Overview.tsx` mounts `<BmsSessionProvider>`-aware (already wrapped at app level).
2. `useReferoutData(filters)` returns `{ kpis, byEmergency, byTypeArea, byCause, trend, rows, loading, error, reload, loadMore }`.
3. `useReferoutData` builds 6 SQL strings (parameterized) and dispatches them via `Promise.all` through `executeSqlViaApiQueued`. The queue dedupes identical concurrent requests.
4. Filters are stored in component state (no URL persistence — keeps the page simple and aligns with the consultant transcript). Changing a filter triggers a refetch.

### SQL plan (parameterized; `:start_date`, `:end_date`, `:status_ids`, `:type_ids`, `:emer_ids`, `:area_filter`, `:search_text`, `:hospital_chwpart='71'`)

- **KPI counts** — single SELECT with conditional aggregates:
  ```sql
  SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN refer_in_province='Y' THEN 1 ELSE 0 END) AS in_province,
    SUM(CASE WHEN refer_in_province='N' AND refer_in_region='Y' THEN 1 ELSE 0 END) AS out_province,
    SUM(CASE WHEN refer_in_region='N' THEN 1 ELSE 0 END) AS out_region,
    SUM(CASE WHEN refer_in_province IS NULL AND refer_in_region IS NULL THEN 1 ELSE 0 END) AS unknown_area,
    SUM(CASE WHEN referout_emergency_type_id=1 THEN 1 ELSE 0 END) AS life_threat,
    SUM(CASE WHEN with_ambulance='Y' THEN 1 ELSE 0 END) AS with_ambulance,
    SUM(CASE WHEN with_nurse='Y' THEN 1 ELSE 0 END) AS with_nurse
  FROM referout
  WHERE refer_date BETWEEN :start_date AND :end_date
    AND (… type/status/emergency/area/search filters …);
  ```
- **Comparison KPI** — same SELECT for the previous-period range.
- **Emergency distribution** — `SELECT referout_emergency_type_id, COUNT(*) FROM referout WHERE … GROUP BY 1`.
- **Type × Area pivot** — GROUP BY referout_type_id and a CASE-derived area bucket.
- **Top-10 cause** — `SELECT refer_cause, COUNT(*) FROM referout WHERE … GROUP BY 1 ORDER BY 2 DESC LIMIT 10`.
- **Trend** — auto-bucketed (`DATE_FORMAT(refer_date,'%Y-%m-%d')` for ≤31d; `DATE_FORMAT(refer_date,'%Y-%m')` else); for PostgreSQL use `to_char(refer_date,'YYYY-MM-DD')`/`'YYYY-MM'`. Detect via `getDatabaseType()` which is already on the session config.
- **Detail rows** — full LEFT JOIN with hospcode, referout_type, referout_emergency_type, referout_status, refer_cause, patient. ORDER BY refer_date DESC, refer_time DESC. LIMIT 500 OFFSET :offset.
- **Detail by id** — single LEFT JOIN by `referout_id` for the row drill-down.
- **Timeline** — `SELECT * FROM referout_regist WHERE referout_id = :id ORDER BY regist_datetime DESC` with try/catch.

### State machine

```
idle → loading → success | error
                     ↓
                 (filter change → loading)
                 (load more → loadingMore → success)
```

### Component responsibility split

- **Pure presentation** components receive props only — easy to test.
- **`Overview.tsx`** owns filter state and the `useReferoutData` hook; passes data down.
- **`useReferoutData`** is the only place that imports `executeSqlViaApiQueued`.

### Test plan

- **Unit**: pure functions (`thaiDate`, `csvExport`, `numberFormat`, `referoutSql`).
- **Component**: each of the 5–7 components with props matrix (loading/empty/error/data states).
- **Integration**: the full flow with a mocked `executeSqlViaApiQueued`.
- **Contract**: snapshot of the SQL strings for fixed filter inputs; ensures we don't accidentally inject user input or remove LIMIT.

## Phase 2 — Tasks (delegated to `speckit.tasks` in step 7)

The next phase will produce `tasks.md` with atomic, dependency-ordered tasks per user story.

## Complexity Tracking

No deviations from the constitution. No additional dependencies. No new project boundaries. The plan is intentionally constrained to a single page + helpers under existing folders.
