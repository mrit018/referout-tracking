# Brainstorm — ระบบทะเบียนติดตามการส่งต่อผู้ป่วย (Refer Out) จังหวัดกาญจนบุรี

**Slug:** referout-tracking
**Hospital:** 11278 — โรงพยาบาลไทรโยค
**Source files consulted:** `REQUIREMENTS.md`, `AGENT_RULES.md`, knowledge base `hosxp` (HOSxPReferPackage_FULL.md, HOSxPNCDRegistryPackage_FULL.md, HOSxPPCUAccount1Package_FULL.md), template page `src/pages/Overview.tsx`, service `src/services/bmsSession.ts`.

---

## 1. Knowledge-base findings (HOSxP schema confirmation)

### 1.1 Primary table: `referout` (HOSxP physical name)

The user-facing label `hosxp_referout` in REQUIREMENTS maps to the underlying physical HOSxP table `referout`. The HOSxP knowledge base for the Refer Package confirms 60+ columns. Key columns we will use:

| Column | Type | Meaning (TH) |
|--------|------|--------------|
| `referout_id` | int PK | รหัสภายใน |
| `vn` | varchar(12) | เลข Visit |
| `hn` | varchar(9) | เลข HN ผู้ป่วย |
| `refer_number` | varchar(10) | เลขที่ใบส่งตัว |
| `refer_date` | date | วันที่ส่งตัว |
| `refer_time` | time | เวลาที่ส่งตัว |
| `hospcode` | varchar(5) | รหัสสถานพยาบาลปลายทาง (FK → `hospcode`) |
| `refer_hospcode` | char(5) | สถานพยาบาลที่ส่งตัว (alternative) |
| `pre_diagnosis` | varchar(200) | การวินิจฉัยเบื้องต้น |
| `pdx` | varchar(7) | ICD-10 หลัก |
| `refer_type` | tinyint | ประเภทส่งต่อ (รหัสตัวเลข) |
| `refer_cause` | tinyint | สาเหตุการส่งตัว (รหัส 1..n) |
| `referout_status_id` | int | สถานะ (FK → `referout_status`) |
| `referout_type_id` | int | ประเภทผู้ป่วย (FK → `referout_type`) |
| `referout_emergency_type_id` | int | ระดับความเร่งด่วน (FK → `referout_emergency_type`) |
| `refer_in_province` | char(1) | อยู่ในจังหวัดเดียวกันหรือไม่ ('Y' / 'N' / NULL) |
| `refer_in_region` | char(1) | อยู่ในเขตเดียวกันหรือไม่ ('Y' / 'N' / NULL) |
| `with_nurse` | char(1) | มีพยาบาลร่วมไป |
| `with_ambulance` | char(1) | ใช้รถพยาบาล |
| `doctor` | varchar(7) | รหัสแพทย์ผู้สั่งส่งต่อ |
| `depcode` | char(3) | แผนกต้นทาง |
| `refer_response_type_id` | int | สถานะการตอบรับจากปลายทาง |

### 1.2 Lookup tables (confirmed via knowledge base)

* `hospcode (hospcode PK, name, hosptype, chwpart, amppart)` — 18 columns. Use `hospcode.name` and `hospcode.hosptype` for display, and `chwpart` to confirm province (กาญจนบุรี = `71`).
* `referout_type (referout_type_id PK, name)` — 3 fixed rows confirmed:
  | id | name (TH) | name (EN) |
  |----|-----------|-----------|
  | 1 | ผู้ป่วยทั่วไป | General |
  | 2 | ผู้ป่วยอุบัติเหตุ | Accident/Trauma |
  | 3 | ผู้ป่วยฉุกเฉิน(ยกเว้นอุบัติเหตุ) | Emergency (non-trauma) |
* `referout_emergency_type (referout_emergency_type_id PK, name)` — 5 fixed rows confirmed:
  | id | EN | TH |
  |----|----|----|
  | 1 | Life threatening | คุกคามชีวิต |
  | 2 | Emergency | ฉุกเฉิน |
  | 3 | Urgent | เร่งด่วน |
  | 4 | Acute | เฉียบพลัน |
  | 5 | Non acute | ไม่เฉียบพลัน |
* `referout_status (referout_status_id PK, name)` — workflow status table (e.g., รอดำเนินการ, ส่งตัวแล้ว, ตอบรับแล้ว, ยกเลิก). Exact rows are hospital-configurable; we will join LEFT and display `name` as-is.
* `refer_cause (refer_cause PK, name)` — reasons (e.g., ขีดความสามารถไม่เพียงพอ, ผู้ป่วยร้องขอ, ฯลฯ). 1-character/tinyint code mapped to a Thai label.

### 1.3 Secondary table: `referout_regist`

Per knowledge base under `cloud_refer` collection, there is a corresponding `hosxp_referout_regist` (cloud sync version of the registration table). The on-prem physical name is `referout_regist`. This table holds **regist event** logs for each referral (timestamped status transitions). It is not strictly needed for the MVP dashboard, but the spec lists it as a data source — we will use it to enrich the **timeline / drill-down** of a single referral when the user clicks a row (latest registration event = most recent status update). Schema treated as: `referout_regist_id PK, referout_id FK, regist_datetime, referout_status_id, staff, note`. If the column names differ, the drill-down query degrades gracefully.

---

## 2. Design alternatives explored

### 2.1 Layout — picked: **single scrollable page with sticky filter bar**

Alternatives considered:
* (A) Tabs (Summary / Table / Analytics) — rejected: hides context, executives want everything visible.
* (B) Multi-page route — rejected: AGENT_RULES says route is wired to `Overview.tsx` only.
* (C) **Single page sectioned** — chosen. Sections: Filters → KPI cards → Analytics charts → Detailed table.

### 2.2 Filters — picked: **date range + refer_type + status + emergency level + province bucket**

* `refer_date` range (default = current month). Quick presets: `วันนี้`, `7 วันล่าสุด`, `30 วันล่าสุด`, `เดือนนี้`, `ปีงบฯ ปัจจุบัน`, `กำหนดเอง`.
* `referout_type_id` multi-select (ทั่วไป / อุบัติเหตุ / ฉุกเฉิน).
* `referout_status_id` multi-select.
* `referout_emergency_type_id` multi-select (5 levels, color-coded).
* Province bucket toggle: `ทั้งหมด / ในจังหวัด / นอกจังหวัด / นอกเขต`.
* Free-text search over `refer_number`, `hn`, destination hospital name, `pre_diagnosis`.

### 2.3 KPI cards — picked: 4 + 3 = **7 cards in 2 rows**

Row 1 — Geography (per REQUIREMENTS):
1. **ทั้งหมด** — total referrals in selected range.
2. **ในจังหวัด** — `refer_in_province = 'Y'`.
3. **นอกจังหวัด** — `refer_in_province = 'N'` AND `refer_in_region = 'Y'`.
4. **นอกเขต** — `refer_in_region = 'N'`.

Row 2 — Operational (executive value-add the consultant proposed and user accepted with "จัดมาให้ละเอียดที่สุด"):
5. **คุกคามชีวิต / Life-threatening** — count where `referout_emergency_type_id = 1`.
6. **ใช้รถพยาบาล** — count where `with_ambulance = 'Y'`.
7. **มีพยาบาลร่วมส่ง** — count where `with_nurse = 'Y'`.

Each card: large number, Thai label, small caption with % of total + delta vs previous period (same length window immediately before current range). Click → modal showing breakdown by status and 12-month trend (read-only chart, no save).

### 2.4 Charts — picked: **4 visualizations**

* **Pie / Donut** — สัดส่วนระดับความเร่งด่วน (`referout_emergency_type`). Colors: red→orange→amber→sky→slate.
* **Stacked bar** — ประเภทการส่งต่อ (`referout_type`) × พื้นที่ (ในจังหวัด/นอกจังหวัด/นอกเขต).
* **Horizontal bar** — Top 10 สาเหตุการส่งต่อ (`refer_cause`).
* **Line / area** — แนวโน้มจำนวนการส่งต่อรายวัน/รายเดือน (auto-bucket by range length: ≤31 days → daily, >31 days → monthly).

Library: `recharts` (already installed).

### 2.5 Detailed table — picked: **paginated TanStack-style table** (or built with shadcn `<Table>` since TanStack v8 is not in package.json — we will use simple `<Table>` + `useMemo` sort/filter)

Columns:
1. `refer_number`
2. `refer_date` + `refer_time` (Thai พ.ศ.)
3. HN + ชื่อผู้ป่วย (LEFT JOIN `patient` for name; gracefully empty if join fails)
4. `pre_diagnosis` + `pdx`
5. โรงพยาบาลปลายทาง (`hospcode.name`)
6. ประเภทพื้นที่ badge (ในจังหวัด/นอกจังหวัด/นอกเขต)
7. ประเภท (`referout_type.name`)
8. ระดับเร่งด่วน (color-coded badge)
9. สถานะ (`referout_status.name`)

Row click → side `Dialog` showing full details + clinical narrative (`hpi`, `pmh`, `pre_diagnosis`, `lab_text`, `treatment_text`) + timeline from `referout_regist`.

Header click → sort. CSV export button (client-side, generates BOM-prefixed UTF-8). Print view (window.print + print CSS via Tailwind `print:` modifiers).

### 2.6 Edge cases identified

* **Empty result set** — show empty-state card with guidance ("ไม่พบข้อมูลในช่วงที่เลือก ลองขยายช่วงวันที่หรือลบตัวกรอง").
* **Loading** — Skeleton cards / table rows.
* **Error** — error card with error message + retry button.
* **Null geography** — referrals with both `refer_in_province` and `refer_in_region` NULL → bucket as "ไม่ระบุพื้นที่"; count separately so totals reconcile.
* **Date overflow** — block ranges > 365 days with friendly warning.
* **Missing lookup row** — if `referout_status.name` is NULL, show "ไม่ระบุ".
* **Large pages** — server-side hard `LIMIT 500` on detail query (per constitution perf rule); offer "โหลดเพิ่ม" if exactly 500 hit.
* **Database flavor** — switch quoting via the existing `queryBuilder` helper (handles MySQL vs PostgreSQL).
* **Session expiry** — handled by existing service; just re-throw and let global error path render.
* **Large refer_cause set** — show top 10 + "อื่นๆ".
* **Time zone** — DB dates are TIS-620 local; treat as `Asia/Bangkok`. Use `date-fns/locale/th` and `+543` for พ.ศ. display.

### 2.7 Accessibility

* All charts get an accessible table fallback inside the drill-down modal.
* Color is never the only signal — every emergency level also shows its Thai label.
* Buttons have visible focus rings (Tailwind `focus-visible:ring`).
* Min contrast WCAG AA on text-on-color badges (use white text on saturated background, dark text on pastel).
* Keyboard support: filter chips toggle on Enter/Space; table rows are real `<button>` for Enter/Space activation.

### 2.8 Performance

* Single round-trip for KPI counters via one `WITH`/sub-select aggregating in SQL (read-only allowed).
* Separate aggregated queries for charts (status distribution, type x area pivot, cause top-N, time series).
* Detailed list is paginated: default page size 50, hard cap 500 rows / query, additional pages via OFFSET.
* `useMemo` and `useCallback` on derived data; `react`'s built-in suspense pattern not needed — use plain `useEffect` + abort on filter change.
* No new deps.

### 2.9 Security / read-only defense in depth

* All SQL goes through `executeSqlViaApi` (SELECT only).
* No POST / PUT / DELETE anywhere.
* Patient-identifiable data (HN, ชื่อ-นามสกุล) shown only in the detail table and detail modal — masking toggle available ("ซ่อน HN") for screen-shared executive briefings.

---

## 3. Drill-down ideas

| Surface | On click | Shows |
|---------|----------|-------|
| KPI card | Modal | Definition (SQL formula in plain Thai), 12-month trend, breakdown by status, raw count list |
| Pie slice (emergency level) | Modal | Filtered list of referrals at that level |
| Stacked bar segment | Modal | Filtered list for that type × area combo |
| Top-cause bar | Modal | Patient list with that `refer_cause` |
| Time-series point | Modal | Day/month detail + count per emergency level |
| Table row | Side Dialog | Full referral detail + timeline (regist events) + clinical notes |
| Hospital code in row | Tooltip | Hospital name + type + province |
| Legend chip | Toggle | Hide/show series in chart |

---

## 4. Refer-cause + emergency analytics visualization choices

**Refer cause** — horizontal bar (Top 10) + "อื่นๆ" residual. Sort descending. Use a single brand color so categories don't compete. Tooltip shows count + % of total + 30-day trend mini-sparkline (deferred — no recharts brushing in MVP if it adds compile errors).

**Emergency level** — donut with severity-coded palette:
* 1 Life-threat: `#dc2626` (red-600)
* 2 Emergency: `#ea580c` (orange-600)
* 3 Urgent: `#d97706` (amber-600)
* 4 Acute: `#0284c7` (sky-600)
* 5 Non-acute: `#475569` (slate-600)

Show legend with both color and Thai label. Center label = "ทั้งหมด N ราย".

**Type × Area** — stacked bar with three stacks per `referout_type`:
* ในจังหวัด — `#16a34a` (green-600)
* นอกจังหวัด — `#2563eb` (blue-600)
* นอกเขต — `#9333ea` (purple-600)

---

## 5. Other notable consultant-proposed features the user accepted

The transcript shows the user said "เอาตามนี้" (= take everything) and later "จัดมาให้ละเอียดที่สุด" (= give me the most detailed version). So we include all five blocks the consultant proposed in the final transcript:
1. Executive Summary cards split by area.
2. Detailed tracking table with `refer_number`, `refer_date`, `hospcode`, `pre_diagnosis`.
3. Deep filters (date range + status + type + emergency level).
4. Categorization analysis (`referout_type_id` + `referout_emergency_type_id`).
5. Cause analysis (`refer_cause`).

Plus the geography toggle and the refer_in_province / refer_in_region split that REQUIREMENTS.md highlights explicitly.

Header replaces "Template App" → **"Refer Out กาญจนบุรี"** (per AGENT_RULES we cannot edit App.tsx, but the page itself owns its hero band — we set the in-page hero title).

---

## 6. Constraints enforced in this design

* No new dependencies (uses recharts, lucide-react, date-fns, shadcn primitives only).
* Single-file mainline (`src/pages/Overview.tsx`) but allowed helper modules under `src/pages/`, `src/hooks/`, `src/utils/`, `src/components/`.
* Read-only — all SQL is `SELECT … FROM referout LEFT JOIN …`.
* Tailwind-only styling.
* `npx tsc -b` and `npm run build` must succeed before final merge.
