# Cross-Artifact Analysis Report — referout-tracking

**Date:** 2026-04-28
**Mode:** Non-destructive consistency check (per speckit.analyze contract)
**Scope:** `brainstorm.md`, `research.md`, `spec.md`, `plan.md`, `tasks.md`, `specs/constitution.md`

---

## 1. Artifact inventory

| Artifact | Path | Status | Lines |
|----------|------|--------|-------|
| Brainstorm | `specs/referout-tracking/brainstorm.md` | Present | ~190 |
| Research | `specs/referout-tracking/research.md` | Present | ~150 |
| Constitution | `specs/constitution.md` | Present | ~135 |
| Spec | `specs/referout-tracking/spec.md` | Present | ~205 |
| Plan | `specs/referout-tracking/plan.md` | Present | ~180 |
| Tasks | `specs/referout-tracking/tasks.md` | Present | ~215 |

All required artifacts exist and are non-empty.

---

## 2. Spec ↔ Plan ↔ Tasks traceability

### User stories → plan components → tasks

| Story | Spec FRs | Plan components | Tasks |
|-------|----------|----------------|-------|
| US1 — Executive Geography | FR-001, FR-002, FR-003, FR-004, FR-014, FR-015, FR-019 | `KpiCardsGrid`, `KpiDrillDownDialog`, hero band in `Overview.tsx` | T010–T013 |
| US2 — Detail Table | FR-005, FR-006, FR-007, FR-011, FR-012, FR-013, FR-019, FR-020 | `ReferoutTable`, `ReferoutDetailDialog`, `csvExport` util | T020–T024 |
| US3 — Deep Filters | FR-008, FR-016, FR-017 | `FiltersBar`, `useReferoutData`, `referoutSql` builders | T030–T033 |
| US4 — Cause & Categorization | FR-009, FR-010 | `EmergencyDonut`, `TypeAreaStackedBar`, `CauseTopBar`, `ChartDrillDownDialog` | T040–T045 |
| US5 — Trend | FR-009 (line), FR-010 | `TrendLine` | T050–T052 |
| US6 — Privacy & Print | FR-013 | `mask` util + table/dialog wiring + `print:` modifiers | T060–T063 |

**Result:** Every user story maps to plan components and at least one task. Every FR is exercised by at least one task. No orphan plan items.

### Edge cases → tasks

| Edge case (spec) | Tasks covering it |
|------------------|-------------------|
| Session expired | Reuses existing `notifyApiFailure` path; covered by T070 integration mock |
| Network timeout | Same — already in `executeSqlViaApi` |
| HTTP 429 | Same — service layer; T070 verifies UI surfaces toast |
| NULL geography | T011 (KPI grid handles unknown bucket) + T006 SQL builder |
| Missing lookup row | T006 builders use LEFT JOIN; T020/T022 component tests assert "ไม่ระบุ" fallback |
| DB flavor switch | T006 builders accept `dbType`; T002 confirms detection |
| Refer_date NULL | T031 filter excludes; T051 trend skips |
| Empty result | T008 EmptyState component; T013 wires it |
| 365-day guard | T033 |

**Result:** Each spec edge case has a corresponding task or relies on existing service plumbing.

---

## 3. Constitution compliance

| Principle | Spec/plan/tasks coverage |
|-----------|--------------------------|
| I. Code Quality | Plan §"Constitution Check" + tasks T073, T074, T075 |
| II. TDD | Every story phase has a "Tests" sub-section before "Implementation"; tasks T010, T020, T021, T030, T040, T050, T060 are test-first |
| III. UI/UX | Spec FR-014, FR-015, FR-013, FR-005 (badge color+label); plan reuses shadcn primitives |
| IV. Performance | Spec FR-007 (LIMIT 500), SC-001/SC-002; plan §SQL plan uses single round-trip aggregates |
| V. Version Control | Speckit step pattern (commit + push per phase) honored — 7 commits made so far on `main` with conventional prefixes |
| VI. Reuse | Plan §Source Code uses only `src/components/ui/`, `bmsSession.ts`, `lucide-react`, `recharts`, `date-fns` — no new deps |
| VII. Informative UX | Spec FR-014; tasks T008 (EmptyState), T011 (loading skeleton), T031 (warning dialog) |
| VIII. Observability | Plan delegates to existing `notify` service; covered by T070 integration |
| IX. Tools | Spec FR-017 (parameter binding), FR-018 (SELECT only); T006 builder enforces; T076 contract test snapshots |

**Result:** Full alignment.

---

## 4. AGENT_RULES.md compliance

| Rule | Status |
|------|--------|
| Target file `src/pages/Overview.tsx` | T072 rewrites it |
| No `npm install` | Plan + tasks add zero dependencies (only used: recharts, lucide, date-fns, shadcn — all installed) |
| Reuse `src/components/ui/` | All UI tasks reference existing primitives |
| Tailwind only | Plan §Project Structure does not list any `.css` file |
| Reuse `useBmsSessionContext` + `executeSqlViaApi` | T007 hook delegates exclusively to these |
| Forbidden files untouched | App.tsx / main.tsx / package.json / vite config / tsconfig / Dockerfile / nginx / docker-compose / .specify/memory/constitution.md → none in plan or tasks |
| Read-only scope | FR-018 + T006 builder + T076 contract test |
| `npm run build` zero errors | T075 gate |

**Result:** No violations identified.

---

## 5. Spec coverage of REQUIREMENTS.md

| REQUIREMENTS feature | Spec section |
|----------------------|--------------|
| Executive Summary cards split by area | US1 + FR-002, FR-003 |
| Detailed tracking table with refer_number/refer_date/hospcode/pre_diagnosis | US2 + FR-005 |
| Filters by date / refer_type / referout_status_id | US3 + FR-008 |
| Refer cause analysis | US4 + FR-009 (`CauseTopBar`) |
| referout_type_id classification | US4 + `TypeAreaStackedBar` |
| referout_emergency_type_id breakdown | US4 + `EmergencyDonut`, KPI card "คุกคามชีวิต" |
| Province scope = Kanchanaburi | Hero band in `Overview.tsx` (T013) + Assumption #18 |

**Result:** Every REQUIREMENT line in the consultant transcript is reflected.

---

## 6. Ambiguity resolution check

- `[NEEDS CLARIFICATION]` markers in `spec.md`: **0** (verified by grep).
- All ambiguities surfaced as documented defaults in spec `## Assumptions` (20 entries).
- Plan inherits assumptions; no new ambiguities introduced.

---

## 7. Risks and recommendations

| Risk | Mitigation in current plan |
|------|----------------------------|
| `referout_regist` schema unknown | T023 wraps timeline fetch in try/catch; degrades to "ไม่พบข้อมูลทะเบียน" |
| `refer_cause` codes hospital-specific | LEFT JOIN + raw-code fallback per spec |
| MySQL vs PostgreSQL date functions | T006 builders accept `dbType`; tested by contract snapshot T076 |
| Large bundle from recharts | Already in dependency tree; no new install; lazy-load not needed for single-page app |
| HN PDPA exposure | T061 mask util + T062 toggle |

---

## 8. Verdict

**PASS — artifacts are consistent, complete, and constitution-compliant.**

No blocking issues. The pipeline can proceed to implementation with the current artifact set.
