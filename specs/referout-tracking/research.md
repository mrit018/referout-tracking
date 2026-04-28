# Research — referout-tracking

**Feature:** ระบบทะเบียนติดตามการส่งต่อผู้ป่วย (Refer Out) จังหวัดกาญจนบุรี
**Date:** 2026-04-28
**Method:** WebSearch + HOSxP knowledge base (`mcp__bms-knowledge-mcp__search_knowledge`, collection `hosxp`).

This document captures the design decisions backed by external research that we will pass into the spec and plan.

---

## 1. Hospital refer-out dashboard best practices (2026)

Searched: "hospital refer-out dashboard KPI design best practices healthcare 2026".

Synthesis of insightsoftware, databox, thoughtspot, knowi, IntuitionLabs, Infosys white paper:

* **Each dashboard should align to a specific operational decision.** For us: "ผู้ป่วยที่เราส่งต่อออกไปไหน เร่งด่วนระดับใด สาเหตุอะไร และยังค้างที่สถานะใด".
* **Define KPI ownership** — we list the SQL formula in plain Thai inside the drill-down modal so executives can verify the calculation.
* **Group KPIs by category** — geography (4 cards) and operational (3 cards). Mirrors the consultant transcript.
* **Real-time monitoring** — display "ข้อมูลล่าสุด" timestamp = last refer_date in the result + page render time.
* **HIPAA-style discipline (Thai PDPA equivalent)** — provide a "ซ่อน HN" toggle so an executive briefing on a projector doesn't expose patient identity.
* **Drill-down everywhere** — every KPI/chart/row reveals the underlying records. Aligns with the consultant's "Detailed Tracking Table" requirement.

Sources:
- [Top 26 Healthcare KPIs & Quality Metric Examples for 2026 — insightsoftware](https://insightsoftware.com/blog/25-best-healthcare-kpis-and-metric-examples/)
- [Track These 18 Essential Healthcare KPIs — Databox](https://databox.com/healthcare-kpi-dashboard)
- [15 Healthcare KPIs & Metrics — ThoughtSpot](https://www.thoughtspot.com/data-trends/dashboard/healthcare-kpis-and-metrics-dashboard-examples)
- [Healthcare Analytics Dashboard Examples — Knowi](https://www.knowi.com/blog/best-healthcare-analytics-dashboard-examples/)
- [Creating an Internal Hospital Performance Dashboard — IntuitionLabs](https://intuitionlabs.ai/articles/creating-an-internal-hospital-performance-dashboard)
- [KPIs for Effective, Real-Time Dashboards in Hospitals — Infosys](https://www.infosys.com/industries/healthcare/white-papers/documents/hospital-performance-bi.pdf)

---

## 2. Recharts visual patterns — pie/donut, stacked bar, accessible severity palette

Searched: "recharts pie donut bar chart React TypeScript accessible color palette medical severity".

Decisions:

* **Donut over Pie** for emergency level — `innerRadius` 60% leaves space for a center label that shows the total. Confirmed by Recharts examples.
* **Color palette** — follow medical severity convention (red→amber→sky), not Recharts default rainbow:
  * 1 Life-threatening: `#dc2626`
  * 2 Emergency: `#ea580c`
  * 3 Urgent: `#d97706`
  * 4 Acute: `#0284c7`
  * 5 Non-acute: `#475569`
* **Accessible labels** — every slice/bar has a tooltip that prints the Thai label, count, and percentage. We do NOT rely on color alone (WCAG 1.4.1).
* **Bar over Pie when categories > 6** — for `refer_cause` we use horizontal bar (top 10 + อื่นๆ).
* **Stacked bar** for `referout_type` × area split — uses three colors for the three area buckets (in-province green, out-of-province blue, out-of-region purple).
* **Line vs area for trend** — use line for clean comparison; if sparse, fall back to bar by date bucket.

Sources:
- [shadcn/ui Charts](https://ui.shadcn.com/charts/area)
- [Recharts donut chart guide — GeeksforGeeks](https://www.geeksforgeeks.org/reactjs/create-a-donut-chart-using-recharts-in-reactjs/)
- [Recharts pie chart colors — issue #470](https://github.com/recharts/recharts/issues/470)
- [React Pie chart accessibility — MUI X](https://mui.com/x/react-charts/pie/)

---

## 3. Thai locale + Buddhist calendar with date-fns

Searched: "Thai locale date-fns Buddhist calendar formatting React".

Decisions:

* `date-fns` already includes a Thai locale (`date-fns/locale/th`) — use it for month/day labels.
* For พ.ศ. (Buddhist Era) we add 543 to the year **only at format time**. Helper:
  ```ts
  import { format } from 'date-fns';
  import { th } from 'date-fns/locale';
  export function formatThaiDate(d: Date, fmt = 'd MMM yyyy') {
    const buddhistYear = d.getFullYear() + 543;
    return format(d, fmt, { locale: th }).replace(String(d.getFullYear()), String(buddhistYear));
  }
  ```
* No new dependency required — we deliberately do **not** install thaidatepicker-react or date-fns-be. AGENT_RULES forbids new packages.
* For the date range picker UI we use plain `<Input type="date">` (shadcn `<Input>` already wraps it) with quick-preset buttons; pickers stay Gregorian (matches HOSxP's underlying storage of `date` columns) and we render **display-only** as พ.ศ. throughout the page.

Sources:
- [Thai Date picker — ipiranhaa.github.io](https://ipiranhaa.github.io/blog/thai-date-picker/)
- [React DayPicker localization](https://daypicker.dev/docs/localization)
- [date-fns-be adapter — tarzui](https://github.com/tarzui/date-fns-be)
- [thaidatepicker-react](https://github.com/buildingwatsize/thaidatepicker-react) (reference only, not installed)

---

## 4. CSV export from React tables with Thai characters

Searched: "CSV export client-side React TypeScript UTF-8 BOM Thai characters Excel".

Decisions:

* Generate the CSV on the client with a `Blob` that prepends `﻿` (UTF-8 BOM). This makes Microsoft Excel auto-detect UTF-8 and render Thai correctly.
* Quote every cell that contains `,`, `"`, `\n`, or starts with `=`, `+`, `-`, `@` (formula injection prevention).
* File name: `referout-yyyy-MM-dd_HH-mm.csv` (Gregorian, machine-friendly).
* No new dependency — straightforward `Blob` + `URL.createObjectURL` + `<a download>` click.
* Pattern:
  ```ts
  const BOM = '﻿';
  const blob = new Blob([BOM + csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  ```

Sources:
- [Save CSV file in UTF-8 with BOM — Hyunbin / Medium](https://hyunbinseo.medium.com/save-csv-file-in-utf-8-with-bom-29abf608e86e)
- [JavaScript CSV Export Encoding Issues — copyprogramming](https://copyprogramming.com/howto/javascript-to-csv-export-encoding-issue)
- [How to export tables to CSV in React — CoreUI](https://coreui.io/answers/how-to-export-tables-to-csv-in-react/)

---

## 5. HOSxP-side schema confirmation (knowledge base)

Confirmed via `mcp__bms-knowledge-mcp__search_knowledge` (collection `hosxp`):

* `referout` table — full DDL captured (60+ columns). `refer_date`, `refer_number`, `hospcode`, `pre_diagnosis`, `refer_in_province`, `refer_in_region`, `referout_type_id`, `referout_emergency_type_id`, `referout_status_id`, `refer_cause`, `with_nurse`, `with_ambulance` all present.
* `referout_type` lookup — 3 fixed rows (general / accident / emergency).
* `referout_emergency_type` lookup — 5 fixed rows (life-threat / emergency / urgent / acute / non-acute).
* `referout_status` lookup — variable rows; LEFT JOIN by `referout_status_id`.
* `refer_cause` lookup — 1-byte coded; LEFT JOIN by `refer_cause`.
* `hospcode` lookup — 18 columns; for Kanchanaburi province `chwpart = '71'` (used to verify "in-province" vs hospital fields if needed).
* `patient` table provides display name (LEFT JOIN by `hn`).

Source: HOSxPReferPackage_FULL.md, HOSxPNCDRegistryPackage_FULL.md, HOSxPPCUAccount1Package_FULL.md (from `hosxp` knowledge collection).

---

## 6. Read-only SQL safety

* AGENT_RULES forbids INSERT/UPDATE/DELETE/CREATE/DROP. All queries start with `SELECT` or `WITH`.
* Use parameter binding (`:start_date`, `:end_date`, `:status_id`, etc.) per BMS-SESSION-FOR-DEV. No string concatenation of user input into SQL.
* Add `LIMIT 500` to detail queries; aggregates have no LIMIT (single row by definition).
* Avoid joining the blacklisted tables (`opduser`, `opdconfig`, `sys_var`, `user_var`, `user_jwt`).

---

## 7. Decisions captured

| Topic | Decision | Source |
|-------|----------|--------|
| Calendar display | พ.ศ. (Buddhist) via custom format helper | Section 3 |
| Severity palette | red → amber → sky (medical convention, WCAG-aware) | Section 2 |
| Drill-down depth | KPI card → modal; chart slice → modal; table row → side dialog | Section 1 |
| Trend bucketing | Daily for ≤31 days, monthly for longer | Brainstorm §2.4 |
| CSV export | Client-side Blob with `﻿` BOM | Section 4 |
| Detail page size | 50 with cap at 500/req, "โหลดเพิ่ม" beyond | Brainstorm §2.6 |
| New dependencies | NONE (frozen package.json) | AGENT_RULES |
| HN privacy toggle | "ซ่อน HN" client-side toggle | Section 1 |

---

## 8. Open risks (mitigated, not blocking)

* `refer_cause` codes are hospital-configurable — if the reference table is missing a row, we display the raw code as fallback.
* `referout_regist` schema is not in our knowledge cache; the timeline drill-down uses a defensive `try/catch` and degrades to "ไม่พบข้อมูลทะเบียน".
* PostgreSQL vs MySQL string quoting — use the existing `queryBuilder` helper or stick to ANSI SQL with single-quoted literals only (PostgreSQL-safe).
