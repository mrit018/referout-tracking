---
description: "Task list for referout-tracking dashboard"
---

# Tasks: referout-tracking — ระบบทะเบียนติดตามการส่งต่อผู้ป่วย (Refer Out) จังหวัดกาญจนบุรี

**Input**: `specs/referout-tracking/{spec.md, plan.md, research.md, brainstorm.md}` + `specs/constitution.md`
**Tests**: REQUIRED — TDD is non-negotiable per the constitution.
**Organization**: by user story (US1–US6) for independent delivery.

Format: `[ID] [P?] [Story] Description`
- **[P]**: parallelizable (different files, no dependencies on a sibling task in the same phase)
- **[Story]**: user story tag (US1–US6) or `INF` for foundational

## Path Conventions
Single project (template): `src/`, `tests/` at repo root. Helper modules under `src/components/referout/`, `src/hooks/`, `src/utils/`. Tests mirror source under `tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 [INF] Create directory `src/components/referout/` and `tests/{unit,component,integration,api}/` if missing. Acceptance: directories exist, `git status` shows them tracked via the first new file commit.
- [ ] T002 [INF][P] Confirm `tsconfig.app.json` paths include `@/*` alias for `src/*` (already configured per template) — no changes; just document in plan. Acceptance: `import { Card } from '@/components/ui/card'` resolves.

## Phase 2: Foundational (Blocking Prerequisites)

**CRITICAL**: complete before any user-story phase.

- [ ] T003 [INF] Add `src/utils/thaiDate.ts` with `formatThaiDate(date, fmt?)`, `formatThaiDateTime(date)`, `parseDateInput(string)`, `getDefaultDateRange()` (current month). Test first.
  - Test: `tests/unit/thaiDate.test.ts` — exact strings for known dates (e.g. `2026-04-28` → `28 เม.ย. 2569`).
- [ ] T004 [INF][P] Add `src/utils/numberFormat.ts` with `toThaiNumber(n)` (comma separator, no Thai digits — keep Arabic), `formatPercentDelta(curr, prev)` (returns `{label: '+20%', color: 'text-emerald-600'|'text-rose-600'|'text-slate-500'}`). Test first.
  - Test: `tests/unit/numberFormat.test.ts`.
- [ ] T005 [INF][P] Add `src/utils/csvExport.ts` with `downloadCsv(filename, headers, rows)` that prefixes `﻿` and quotes risky cells. Test first.
  - Test: `tests/unit/csvExport.test.ts` — assert BOM, escape, formula-injection guard.
- [ ] T006 [INF] Add `src/utils/referoutSql.ts` with builders: `buildKpiSql`, `buildGeographyDistSql` (3-bucket: ในจังหวัด/ในเขต/นอกเขต using `hospcode.chwpart`+`region_id`), `buildEmergencyDistSql`, `buildTypeAreaSql`, `buildSpTypeSql` (SERVICE PLAN breakdown), `buildIcdTopSql` (ICD 10 top-10), `buildCauseTopSql` (5 referral causes), `buildTrendSql`, `buildDetailSql`, `buildDetailByIdSql`, `buildTimelineSql`, `buildSqlParams(filters, dbType)`. Each returns `{sql, params}` and **must** start with SELECT or WITH. Test first.
  - Test: `tests/unit/referoutSql.test.ts` + `tests/api/referoutSql.contract.test.ts` snapshot.
- [ ] T007 [INF] Add `src/hooks/useReferoutData.ts` that takes a `Filters` object and exposes `{kpis, kpisPrev, byEmergency, byTypeArea, byCause, trend, rows, totalRows, loading, error, reload, loadMore}`. Internally uses `executeSqlViaApiQueued` from `src/services/bmsSession.ts` and the `useBmsSessionContext()` config. Test with mocked service.
  - Test: `tests/unit/useReferoutData.test.ts` (mocked).
- [ ] T008 [INF] Add `src/components/referout/EmptyState.tsx` (shared) — Thai messaging + slot for action button. Test props.
  - Test: `tests/component/EmptyState.test.tsx`.

**Checkpoint**: Foundation complete. Story phases can begin in parallel.

---

## Phase 3: User Story 1 — Executive Geography Snapshot (P1)  MVP

**Goal**: 4 geography KPI cards with previous-period comparison.

**Independent Test**: open page with default range; sum of in/out-province + out-region + unknown-area equals total.

### Tests
- [ ] T010 [P][US1] Component test: `tests/component/KpiCardsGrid.test.tsx` — given fixed kpis prop, renders 7 cards (3 geography: ในจังหวัด/ในเขต/นอกเขต + 4 operational) with correct numbers, deltas, colors.

### Implementation
- [ ] T011 [US1] Add `src/components/referout/KpiCardsGrid.tsx` with 7 cards (3 geography: ในจังหวัด/ในเขต/นอกเขต + 4 operational: ทั้งหมด, คุกคามชีวิต, ใช้รถพยาบาล, มีพยาบาลร่วม). Uses shadcn `<Card>`, lucide icons, and `formatPercentDelta`. Click handler prop forwards to KPI drill-down dialog.
- [ ] T012 [US1] Add `src/components/referout/KpiDrillDownDialog.tsx` (uses `<Dialog>`) showing the SQL formula in plain Thai + 12-month sparkline (recharts) + raw count list (LIMIT 100).
- [ ] T013 [US1] Wire into `Overview.tsx` page skeleton: hero band ("ระบบทะเบียนติดตามการส่งต่อผู้ป่วย (Refer Out) จังหวัดกาญจนบุรี · โรงพยาบาลไทรโยค (11278)"), default filters (current month), KPI grid, loading/error/empty branches.

**Checkpoint**: US1 alone delivers an executive overview MVP.

---

## Phase 4: User Story 2 — Detailed Tracking Table (P1)

**Goal**: paginated detail table with sort + CSV export + row drill-down.

### Tests
- [ ] T020 [P][US2] Component test: `tests/component/ReferoutTable.test.tsx` — sort cycle (asc → desc → none), HN masking toggle, empty state, click row fires callback.
- [ ] T021 [P][US2] Component test: `tests/component/ReferoutDetailDialog.test.tsx` — renders all clinical fields; gracefully handles missing timeline.

### Implementation
- [ ] T022 [US2] Add `src/components/referout/ReferoutTable.tsx` using shadcn `<Table>`. Columns per FR-005. Header click → sort. Includes "ส่งออก CSV", "พิมพ์", "ซ่อน HN" toolbar.
- [ ] T023 [US2] Add `src/components/referout/ReferoutDetailDialog.tsx` (right-side `<Dialog>`). Loads detail-by-id + timeline on open. Try/catch around timeline.
- [ ] T024 [US2] Wire into `Overview.tsx`: place table below charts; integrate row click → detail dialog; integrate CSV export and print buttons.

**Checkpoint**: Operations team can search and review individual referrals end-to-end.

---

## Phase 5: User Story 3 — Deep Filters (P1)

**Goal**: full filter bar driving all sections.

### Tests
- [ ] T030 [P][US3] Component test: `tests/component/FiltersBar.test.tsx` — preset switching, multi-select toggling, debounced search, range > 365d warning, clear button.

### Implementation
- [ ] T031 [US3] Add `src/components/referout/FiltersBar.tsx` (sticky top with `sticky top-0 z-10 bg-background/95 backdrop-blur`). Date presets, two `<Input type="date">` for custom range, multi-select chips for type/status/emergency (using shadcn `<Badge>` as toggleable chips), area bucket toggle group, search `<Input>` with debounce.
- [ ] T032 [US3] Wire FiltersBar into `Overview.tsx` and route filter state through `useReferoutData`. Remove default-only behavior; ensure all 6 SQL queries refetch on filter change.
- [ ] T033 [US3] Add 365-day guard with confirm dialog before refetch.

**Checkpoint**: All three P1 stories functional together.

---

## Phase 6: User Story 4 — Cause & Categorization Analytics (P2)

**Goal**: 3 visual analytics + slice drill-downs.

### Tests
- [ ] T040 [P][US4] Component test: `tests/component/EmergencyDonut.test.tsx` — 5 slices in correct color order; center label = total; legend toggle hides/shows.

### Implementation
- [ ] T041 [P][US4] Add `src/components/referout/EmergencyDonut.tsx` (recharts `<PieChart>` with `innerRadius={'60%'}`). Click slice → emit slice id.
- [ ] T042 [P][US4] Add `src/components/referout/TypeAreaStackedBar.tsx` (recharts `<BarChart>` stacked, 3 series colors per palette).
- [ ] T043 [P][US4] Add `src/components/referout/CauseTopBar.tsx` (recharts `<BarChart layout="vertical">`, top 10 + "อื่นๆ").
- [ ] T044 [US4] Add `src/components/referout/ChartDrillDownDialog.tsx` — receives `{kind, value}` and lazily fetches the matching list via `useReferoutData.fetchSubset(filterOverride)`.
- [ ] T045 [US4] Wire all three charts into `Overview.tsx` between KPI grid and table; route slice clicks to ChartDrillDownDialog.

**Checkpoint**: Executives can analyze categories and drill in.

---

## Phase 7: User Story 5 — Trend Visualization (P2)

**Goal**: line chart with auto-bucketed time axis.

### Tests
- [ ] T050 [P][US5] Component test: `tests/component/TrendLine.test.tsx` — bucketing decision (≤31d daily / >31d monthly); click point fires callback.

### Implementation
- [ ] T051 [US5] Add `src/components/referout/TrendLine.tsx` (recharts `<LineChart>` with Thai-formatted x-axis labels using `thaiDate` util).
- [ ] T052 [US5] Wire trend chart into `Overview.tsx` near top of analytics section; clicks open ChartDrillDownDialog with `kind: 'date-bucket'`.

**Checkpoint**: All P1 + P2 stories deliver an analytics-rich dashboard.

---

## Phase 8: User Story 6 — Privacy & Print (P3)

**Goal**: HN masking + clean print view.

### Tests
- [ ] T060 [P][US6] Unit test: `tests/unit/maskHn.test.ts` — `maskHn('000054321')` → `'XXXXX4321'`; name pattern handled.

### Implementation
- [ ] T061 [P][US6] Add `src/utils/mask.ts` with `maskHn(hn)` and `maskPatientName({pname,fname,lname})`.
- [ ] T062 [US6] Wire toggle into `ReferoutTable` toolbar and `ReferoutDetailDialog`. Persist preference in `useState` (no storage — resets per session, intentional for safety).
- [ ] T063 [US6] Add `print:hidden` and `print:block` Tailwind classes to controls/dialogs; verify via Playwright print emulation in integration test (T070 below).

**Checkpoint**: Privacy and presentation use cases satisfied.

---

## Phase 8.5: User Story 7 — Refer Back Tracking (P2)

**Goal**: Separate Refer Back section using `referin` table with SERVICE PLAN, ICD 10, hospitals, causes.

### Tests
- [ ] T080 [P][US7] Component test: `tests/component/ReferBackTable.test.tsx` — renders referin rows, sort, click callback, empty state.
- [ ] T081 [P][US7] Unit test: `tests/unit/referinSql.test.ts` — SQL builders for referin queries, parameter binding, SELECT-only.

### Implementation
- [ ] T082 [US7] Add `src/utils/referinSql.ts` with builders: `buildReferinKpiSql`, `buildReferinDetailSql`, `buildReferinBySpTypeSql`, `buildReferinByIcdSql`, `buildReferinByCauseSql`, `buildReferinTrendSql`. Each returns `{sql, params}` and starts with SELECT or WITH.
- [ ] T083 [US7] Add `src/hooks/useReferinData.ts` — similar to `useReferoutData.ts` but queries `referin` table with `spclty` for SERVICE PLAN mapping, `icd10` for diagnosis, `hospcode`/`refer_hospcode` for hospitals.
- [ ] T084 [US7] Add `src/components/referout/ReferBackSection.tsx` — tab/section showing: summary KPI (total refer-back), SERVICE PLAN breakdown table, ICD 10 top-10, hospital source/destination, cause breakdown (5 causes), detail table with CSV export.
- [ ] T085 [US7] Add `src/components/referout/ReferBackDetailDialog.tsx` — detail dialog for referin rows.
- [ ] T086 [US7] Wire ReferBackSection into `Overview.tsx` as 4th main section after the 3 Refer Out sections.

**Checkpoint**: Refer Back data visible and drillable.

---

## Phase 8.6: User Story 8 — SERVICE PLAN Analytics (P2)

**Goal**: SERVICE PLAN as primary analytics dimension across all sections.

### Tests
- [ ] T090 [P][US8] Component test: `tests/component/ServicePlanBreakdown.test.tsx` — 8 branches render correctly, click fires callback.

### Implementation
- [ ] T091 [US8] Add `src/components/referout/ServicePlanBreakdown.tsx` — horizontal bar showing 8 SERVICE PLAN branches (STEMI, Stroke, Trauma, Cancer, Sepsis, Pregnancy, New born, อื่นๆ) with counts and %.
- [ ] T092 [US8] Add SERVICE PLAN filter to `FiltersBar.tsx` — multi-select chips for 8 branches using `referout_sp_type_id`.
- [ ] T093 [US8] Wire SERVICE PLAN breakdown into each geography section (ในจังหวัด, ในเขต, นอกเขต) showing per-area SERVICE PLAN distribution.
- [ ] T094 [US8] Add `buildSpTypeSql` to `referoutSql.ts` — query for SERVICE PLAN breakdown by geography area.

**Checkpoint**: SERVICE PLAN dimension visible across all dashboard sections.

---

## Phase 8.7: User Story 9 — ICD-10 Diagnosis Analytics (P2)

**Goal**: ICD 10 (pdx) as analytics dimension with top-10, filter, drill-down.

### Tests
- [ ] T100 [P][US9] Component test: `tests/component/Icd10TopBar.test.tsx` — 10 bars + "อื่นๆ", click fires callback.

### Implementation
- [ ] T101 [US9] Add `src/components/referout/Icd10TopBar.tsx` — horizontal bar chart showing top-10 ICD 10 codes with count and description.
- [ ] T102 [US9] Add `buildIcdTopSql` to `referoutSql.ts` — query for top-10 pdx with LEFT JOIN to ICD description lookup if available.
- [ ] T103 [US9] Wire ICD 10 chart into each geography section and as standalone analytics panel.
- [ ] T104 [US9] Add ICD 10 filter to `FiltersBar.tsx` — text input for ICD code prefix filter (e.g. "I21" → all STEMI codes).

**Checkpoint**: ICD 10 analytics visible and filterable.

---

## Phase 9: Integration & Polish

- [ ] T070 [INF] Integration test `tests/integration/referoutFlow.test.tsx` — mock `executeSqlViaApiQueued` with deterministic data; verify filter → KPI → chart → table → drill-down flow with HN masking.
- [ ] T071 [INF][P] Add `src/components/referout/index.ts` barrel for tidy imports.
- [ ] T072 [INF] Replace existing `src/pages/Overview.tsx` with the new dashboard; ensure no leftover references to deleted exports.
- [ ] T073 [INF] Run `npx tsc -b` — fix all errors. Acceptance: zero errors.
- [ ] T074 [INF] Run ESLint — fix all errors. Acceptance: zero errors.
- [ ] T075 [INF] Run `npm run build` — must succeed with zero errors.
- [ ] T076 [INF] Run unit + component + integration tests — all green.
- [ ] T077 [INF] Manual verification checklist (in `tests/manual-checklist.md`):
  - [ ] Default range loads in <3s
  - [ ] All 7 KPI cards render with deltas (3 geography: ในจังหวัด/ในเขต/นอกเขต + 4 operational)
  - [ ] All 5 charts render (emergency donut, type×area, cause top-10, SERVICE PLAN breakdown, trend)
  - [ ] SERVICE PLAN breakdown shows 8 branches per geography area
  - [ ] ICD 10 top-10 chart renders with code + description
  - [ ] Refer Back section shows referin data with all dimensions
  - [ ] Sort + CSV + print + HN masking work
  - [ ] Drill-down dialogs open/close cleanly
  - [ ] Empty state on a future-date filter
  - [ ] Error state recoverable via "ลองใหม่"

---

## Dependencies & Execution Order

### Phase Dependencies
1. Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3+ (user stories) in parallel
2. Phase 9 (Integration) requires all user-story phases complete

### Within Each User Story
- Tests first → implementation → integration into `Overview.tsx`
- Models/utils → components → page wiring

### Parallel Opportunities
- T010, T020, T021, T030, T040, T050, T060, T080, T081, T090, T100 can run in parallel (different files)
- T041, T042, T043 (three different chart components) parallelizable
- T091, T092 (SERVICE PLAN) parallelizable with T101, T102 (ICD 10)
- Within Phase 2 the [P]-marked utils (T004, T005) can run alongside T003

---

## Implementation Strategy

### MVP First
1. Phase 1 + 2 (Setup + Foundational)
2. Phase 3 (US1 — Geography KPI) → STOP, validate
3. Phase 4 (US2 — Detail table) → STOP, validate
4. Phase 5 (US3 — Filters)
5. Demo MVP

### Incremental Delivery
- Add US4 → US5 → US6 in subsequent commits
- Each commit independently verifiable

### Verification Gates
- After every task: tests green, `npx tsc -b` green
- Before merge: `npm run build` green, ESLint green, all integration tests green

---

## Notes

- All file paths are absolute relative to repo root
- Reuse, never duplicate
- Read-only SQL only (constitution Principle IX)
- No new npm dependencies (AGENT_RULES + Constitution)
- Commit after every task with conventional prefix
