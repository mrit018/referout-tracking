# referout-tracking — Project Constitution

**Project:** ระบบทะเบียนติดตามการส่งต่อผู้ป่วย (Refer Out) จังหวัดกาญจนบุรี
**Owner:** bms-11278-3700xxxxx3129 (ทวี ทรัพย์คลัง)
**Hospital:** 11278 — โรงพยาบาลไทรโยค

This constitution governs the speckit pipeline for the `referout-tracking` feature. It is the single normative reference for engineering quality, testing, UX, performance, version control, reuse, observability, and tool usage. All artifacts (`spec.md`, `plan.md`, `tasks.md`) must comply.

---

## Core Principles

### I. Code Quality (NON-NEGOTIABLE)

- TypeScript strict mode is mandatory. No `any` without a justifying comment.
- ESLint must pass with zero errors before any commit that touches `src/`.
- `npx tsc -b` must pass before every commit and `npm run build` must pass before merge to `main`.
- No dead code, commented-out blocks, or TODO markers shipped to `main`. Remove or convert into a tracked task.
- Functions should do one thing; max ~50 lines as a soft limit. Extract helpers when exceeded.

### II. Test-Driven Development (NON-NEGOTIABLE)

- Red-Green-Refactor: write the failing test first, confirm it fails, then implement, then confirm it passes.
- The four mandated test layers (already required by the platform CLAUDE.md) apply in priority order:
  1. **Unit** (≥80% coverage on services/utils added or modified)
  2. **Component** (React Testing Library for any new component or interaction)
  3. **Integration** (cross-module flows, e.g., filter → fetch → render)
  4. **API contract** (BMS Session API request/response shape)
- For this feature the read-only nature lets us deprioritize end-to-end DB tests; we still require contract tests of the SQL builder helpers we add.
- A task is "done" only when its tests pass on a clean clone.

### III. UI / UX Discipline

- Every screen state must be deliberate: **loading**, **empty**, **error**, **success**. No raw spinner-only fallbacks.
- All user-visible text in Thai. Date display in Buddhist Era (พ.ศ.). Numbers thousand-separated.
- Color is never the sole channel for meaning. Severity badges always pair color + Thai label.
- Keyboard-accessible: tabbable controls, visible focus rings, Enter/Space activation on row buttons.
- Min contrast WCAG AA on text-on-color badges.
- Patient-identifiable data (HN, ชื่อ-นามสกุล) hidden behind a toggle for executive presentations.

### IV. Performance

- API timeouts: session retrieval 30 s, query 60 s (already configured in `bmsSession.ts`). Do not raise.
- Detail SQL queries must include `LIMIT 500`. Aggregates may omit LIMIT (single-row by definition).
- Page first interactive in under 2 s on a typical hospital LAN (initial query latency aside).
- Use `useMemo` / `useCallback` for derived data; debounce search-text inputs (300 ms).
- Lazy-load nothing — the page is a single route already wired; importing recharts up-front is acceptable (already in bundle).

### V. Version Control

- Commit after every meaningful step (brainstorm / research / spec / plan / tasks / each implementation task / verification). Commits are atomic and self-descriptive.
- Conventional prefixes: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`, `style`, `perf`. The speckit phase uses `feat(speckit): …`.
- Push after each commit (the orchestrator requires it). Never `--force` push to `main`.
- Do not commit the artifacts ignored by `.gitignore` (`node_modules`, `dist`).

### VI. Reuse Over Duplication

- Reuse the existing UI primitives in `src/components/ui/` (Button, Card, Dialog, Input, Table, Tabs, Textarea, Badge, Skeleton).
- Reuse `useBmsSessionContext()` and `executeSqlViaApi()` / `executeSqlViaApiQueued()` from `src/services/bmsSession.ts`. Do not duplicate session/auth logic.
- Extract shared logic into `src/hooks/`, `src/utils/`, or `src/components/` — never inline a third copy.
- No new npm dependencies (`package.json` is frozen).

### VII. Informative UX & Progress Feedback

- Long-running fetches show a Skeleton or progress affordance.
- Multi-step operations communicate progress (e.g., "กำลังโหลดข้อมูลส่งต่อ…", "กำลังคำนวณสรุป…").
- Errors carry actionable Thai messages and a "ลองใหม่" button.
- Empty states explain why ("ไม่พบข้อมูลในช่วงที่เลือก") and offer next-step guidance.

### VIII. Observability

- Errors that escape the React tree must be caught by an error boundary (or equivalent) and surfaced via the existing `notify` service.
- Console-only logging is acceptable for development tracing but must be `console.info` / `console.warn` (not `console.log`) and gated behind `import.meta.env.DEV` if noisy.

### IX. Tools and Domain Expertise

- Lookups for HOSxP schema use the `mcp__bms-knowledge-mcp__search_knowledge` tool (collection `hosxp`).
- External docs use Context7 (`mcp__plugin_context7_context7__*`) or WebSearch with a "Sources" footer.
- For SQL we use parameter binding (`:name` placeholders) — never string concatenation of user input.
- We respect the BMS Session contract: read-only `/api/sql` (SELECT, WITH, SHOW, DESCRIBE, EXPLAIN); blacklist `opduser`, `opdconfig`, `sys_var`, `user_var`, `user_jwt`; max 20 tables per query.

---

## Read-only Scope (defense in depth)

- **No** code path may issue POST/PUT/DELETE to any hospital endpoint.
- **No** SQL containing INSERT, UPDATE, DELETE, CREATE, DROP, TRUNCATE, ALTER.
- **No** "save" forms; the dashboard is observation-only.
- **No** new authentication code — `BmsSessionContext` already handles it.
- A pre-commit (or in-CI) grep can verify the SQL strings match `^\s*(SELECT|WITH|SHOW|DESCRIBE|EXPLAIN)\b` (case-insensitive).

---

## Engineering Constraints (echo of AGENT_RULES.md)

- **Target file:** `src/pages/Overview.tsx` (rewrite contents — route is wired).
- **Allowed new files:** under `src/pages/`, `src/hooks/`, `src/utils/`, `src/components/` only.
- **Forbidden to touch:** `src/App.tsx`, `src/main.tsx`, `package.json`, `package-lock.json`, `vite.config.ts`, all tsconfig files, `Dockerfile`, `nginx.conf`, `docker-compose.yaml`, `.specify/memory/constitution.md`.
- **Tailwind only** for styling; no new `.css`/`.scss` files.
- Icons: `lucide-react`. Charts: `recharts`. Dates: `date-fns`. All already installed.

---

## Quality Gates

A speckit phase advances only if:

1. The artifact for the previous phase exists and is non-empty.
2. The previous artifact has zero `[NEEDS CLARIFICATION]` markers (any ambiguity is captured under `## Assumptions`).
3. The current commit is pushed to `origin/main` before the next phase begins.
4. For implementation tasks: tests exist, were red-then-green, and `npx tsc -b` passes.

A merge to `main` from any feature branch additionally requires:

1. `npm run build` exits with code 0.
2. ESLint passes (zero errors).
3. The full speckit artifact set is present in `specs/referout-tracking/` (spec, plan, tasks, research, brainstorm) and a constitution exists at `specs/constitution.md`.

---

## Governance

- This constitution supersedes all default agent behavior for the `referout-tracking` feature.
- Amendments require a new commit that updates this file plus a one-line note in the relevant artifact's `## Assumptions` section.
- Compliance is verified by the speckit `analyze` skill in step 8.

**Version:** 1.0.0 | **Ratified:** 2026-04-28 | **Last Amended:** 2026-04-28
