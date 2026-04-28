# Engineering Rules (enforced by the platform)

This repository was generated from a pre-built React + TypeScript + Vite
template with shadcn/ui components, Tailwind CSS 4, and a ready-made
BMS session + HOSxP SQL service layer. You MUST follow these rules
through the entire 12-step speckit pipeline.

**Target file for the dashboard UI:** `src/pages/Overview.tsx`
The file currently holds a dummy hospital dashboard. Rewrite its
contents to implement the spec above. The route is already wired.

**Reuse rules (no new dependencies):**
1. Do NOT run `npm install <anything>`. The `package.json` is frozen.
2. Use existing UI primitives from `src/components/ui/`: Button, Card,
   Dialog, Input, Table, Tabs, Textarea, Badge, Skeleton. Import with
   `@/components/ui/...`.
3. Icons: `lucide-react`. Charts: `recharts`. Dates: `date-fns`. All
   already installed.
4. Tailwind CSS classes only — no new CSS files.

**Reuse existing services:**
- `useBmsSessionContext()` for session / auth state
- `executeSqlViaApi()` in `src/services/bmsSession.ts` for reading HOSxP
  data (read-only SELECT/WITH/SHOW/DESCRIBE/EXPLAIN only)
- `AppLayout` and `LoadingSpinner` already wrap the page

**Files you must NOT touch:**
- `src/App.tsx`, `src/main.tsx`
- `package.json`, `package-lock.json`, `vite.config.ts`, tsconfig files
- `Dockerfile`, `nginx.conf`, `docker-compose.yaml`
- `.specify/memory/constitution.md` (speckit writes its own constitution)

**Files you MAY add:**
- Helper files under `src/pages/`, `src/hooks/`, `src/utils/`,
  `src/components/` if the main page grows large

**READ-ONLY scope (hard constraint — defense in depth):**
The app MUST be a read-only dashboard. You MUST NOT:
- Generate code that POSTs/PUTs/DELETEs to any hospital API
- Call `executeSqlViaApi()` with INSERT/UPDATE/DELETE/CREATE/DROP
- Add forms that "save" data anywhere
- Add authentication — `BmsSessionContext` already handles the session

**Allowed interactions:** filters, sorts, search, date range pickers,
drill-downs, export-to-CSV, print views, visualizations.

**Build verification:** Before the final merge step, `npm run build`
MUST pass with zero errors. The rolling QC phase (speckit step 10) runs
builds and fixes errors per task — respect that loop.
