# Feature Specification: ระบบทะเบียนติดตามการส่งต่อผู้ป่วย (Refer Out) จังหวัดกาญจนบุรี

**Feature Branch**: `main` (single-page rewrite of `src/pages/Overview.tsx`)
**Created**: 2026-04-28
**Status**: Approved (autonomous mode)
**Input**: User requirement document `REQUIREMENTS.md` (Thai conversation transcript) + engineering constraints `AGENT_RULES.md`.

This spec is written so the consultant's accepted feature set ("เอาตามนี้" → "จัดมาให้ละเอียดที่สุด") is implemented in full. Every ambiguity is resolved with a documented industry-standard default in the `## Assumptions` section at the end. The pipeline runs in autonomous mode — clarification placeholders are not used; defaults are recorded as assumptions instead.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Executive Geography Snapshot (Priority: P1)

ผู้บริหารโรงพยาบาลไทรโยคเปิดแอป จะเห็นทันทีว่าในเดือนปัจจุบันมีการส่งต่อผู้ป่วยทั้งหมดกี่ราย และแบ่งเป็น "ในจังหวัด / นอกจังหวัด / นอกเขต" จำนวนเท่าไหร่ พร้อมเปรียบเทียบกับเดือนก่อนหน้า

**Why this priority**: เป็นวัตถุประสงค์หลักที่ผู้ใช้ระบุไว้โดยตรงใน REQUIREMENTS.md และถูกย้ำในการสนทนากับ ที่ปรึกษา. ถ้ามีฟีเจอร์นี้เพียงอย่างเดียวก็ใช้งานได้แล้ว.

**Independent Test**: เปิดหน้าแอปด้วยช่วงวันที่ default (เดือนนี้) ตรวจสอบว่าเลข "ทั้งหมด" เท่ากับ COUNT(*) และ ผลรวม "ในจังหวัด+นอกจังหวัด+นอกเขต+ไม่ระบุพื้นที่" เท่ากับ "ทั้งหมด" ทุกครั้ง.

**Acceptance Scenarios**:

1. **Given** ฐานข้อมูลมีรายการ refer-out 120 รายการในเดือนนี้ (`refer_in_province='Y'` 60 ราย, `refer_in_province='N' AND refer_in_region='Y'` 40 ราย, `refer_in_region='N'` 20 ราย), **When** ผู้ใช้เปิดหน้าแอป, **Then** เห็นการ์ด 4 ใบ: ทั้งหมด=120, ในจังหวัด=60, นอกจังหวัด=40, นอกเขต=20
2. **Given** เดือนก่อนหน้ามี 100 รายการ, เดือนนี้มี 120, **When** หน้าแอปโหลดเสร็จ, **Then** การ์ด "ทั้งหมด" แสดง "+20%" สีเขียวและ caption "เทียบกับเดือนก่อน"
3. **Given** ไม่มีรายการในช่วงที่เลือก, **When** หน้าแอปโหลดเสร็จ, **Then** การ์ดแสดง 0 ทุกใบ และพื้นที่ตารางแสดง empty state พร้อมข้อความ "ไม่พบข้อมูลในช่วงที่เลือก ลองขยายช่วงวันที่หรือลบตัวกรอง"

---

### User Story 2 — Detailed Tracking Table (Priority: P1)

เจ้าหน้าที่งานส่งต่อต้องการตรวจสอบรายการผู้ป่วยที่ถูกส่งออกแต่ละราย พร้อมเลขที่ใบส่งตัว วันที่ โรงพยาบาลปลายทาง และการวินิจฉัยเบื้องต้น

**Why this priority**: ระบุไว้โดยตรงใน REQUIREMENTS.md และเป็นเครื่องมือทำงานหลักของเจ้าหน้าที่งานส่งต่อ.

**Independent Test**: เลือกช่วงวันที่ที่มีอย่างน้อย 1 รายการ ตรวจว่าตารางแสดง `refer_number`, `refer_date`, `hospcode` (พร้อมชื่อ รพ.), `pre_diagnosis` ตรงกับ database; เรียงลำดับและส่งออก CSV ใช้งานได้.

**Acceptance Scenarios**:

1. **Given** มี 50 รายการในช่วง, **When** หน้าโหลดเสร็จ, **Then** ตารางแสดง 50 แถว มีคอลัมน์ refer_number, refer_date (พ.ศ.), HN, ชื่อผู้ป่วย, pre_diagnosis + pdx, รพ.ปลายทาง, ประเภทพื้นที่ (badge), ประเภทการส่งต่อ, ระดับเร่งด่วน (badge สี), สถานะ
2. **Given** ผู้ใช้คลิกหัวคอลัมน์ refer_date, **When** คลิกครั้งแรก, **Then** เรียงน้อยไปมาก; คลิกซ้ำ → มากไปน้อย; คลิก 3 → reset
3. **Given** ผู้ใช้คลิกปุ่ม "ส่งออก CSV", **When** คลิก, **Then** ดาวน์โหลดไฟล์ `referout-yyyy-MM-dd_HH-mm.csv` ที่เปิดใน Excel แล้วภาษาไทยถูกต้อง (UTF-8 BOM)
4. **Given** มีข้อมูล > 500 รายการ, **When** ดึงข้อมูล, **Then** ตารางแสดง 500 แถวแรก พร้อมปุ่ม "โหลดเพิ่ม 500 รายการถัดไป"
5. **Given** ผู้ใช้คลิกแถวหนึ่ง, **When** คลิก, **Then** เปิด Dialog ด้านข้างแสดงรายละเอียดเต็ม (HPI, PMH, lab_text, treatment_text, with_nurse, with_ambulance, doctor, depcode, response_text) พร้อม timeline จาก `referout_regist`

---

### User Story 3 — Deep Filters (Priority: P1)

ผู้ใช้ทั้งสองกลุ่มต้องการกรองข้อมูลตามช่วงวันที่ ประเภทการส่งต่อ สถานะ และระดับความเร่งด่วน เพื่อโฟกัสกลุ่มที่สนใจ

**Why this priority**: ระบุไว้โดยตรงใน REQUIREMENTS.md และเป็น prerequisite ของ US1/US2.

**Independent Test**: เลือก filter หลายตัวพร้อมกัน ตรวจว่า KPI cards + ตาราง + กราฟ อัปเดตสอดคล้องกัน.

**Acceptance Scenarios**:

1. **Given** ผู้ใช้เปลี่ยนช่วงวันที่จาก "เดือนนี้" → "7 วันล่าสุด", **When** เลือก preset, **Then** ทุก KPI/กราฟ/ตาราง refresh และ URL ไม่เปลี่ยน (filter อยู่ใน state)
2. **Given** ผู้ใช้เลือก `referout_type_id IN (2,3)` (อุบัติเหตุ + ฉุกเฉิน) และ `referout_emergency_type_id = 1` (คุกคามชีวิต), **When** apply, **Then** เห็นเฉพาะรายการที่ตรงเงื่อนไขทั้งสอง
3. **Given** ผู้ใช้พิมพ์ใน search box "RF66", **When** หยุดพิมพ์ 300ms, **Then** ตารางกรองเฉพาะ refer_number ที่ขึ้นต้น/มี "RF66" หรือชื่อ รพ. หรือ pre_diagnosis ที่มี "RF66"
4. **Given** ผู้ใช้คลิก "ล้างตัวกรอง", **When** คลิก, **Then** filters reset เป็นค่า default (เดือนนี้, ทุกประเภท, ทุกสถานะ, ทุกระดับ)
5. **Given** ผู้ใช้เลือกช่วงวันที่กว้างเกิน 365 วัน, **When** apply, **Then** แสดงคำเตือน "ช่วงวันที่กว้างเกิน 1 ปีอาจดึงข้อมูลช้า กรุณายืนยันก่อนโหลด" + ปุ่ม "ยืนยันโหลด" / "ยกเลิก"

---

### User Story 4 — Cause & Categorization Analytics (Priority: P2)

ผู้บริหารต้องการเห็นว่าการส่งต่อส่วนใหญ่เกิดจากสาเหตุใด เป็นผู้ป่วยประเภทใด และระดับความเร่งด่วนระดับใด เพื่อวางแผนพัฒนาศักยภาพการรักษาของโรงพยาบาล

**Why this priority**: ระบุไว้ในการสนทนา ("จัดประเภท ด้วยว่า การส่งแบบไหน มีระดับความสำคัญ ระดับไหน") และเป็น value-add หลักสำหรับผู้บริหาร.

**Independent Test**: เลือกช่วงข้อมูลที่หลากหลาย ตรวจว่ากราฟ 3 ตัว (donut emergency, stacked bar type×area, top10 cause) แสดงสัดส่วนถูกต้องและรวมกันแล้วเท่ากับยอดทั้งหมด.

**Acceptance Scenarios**:

1. **Given** มีข้อมูล 100 รายการ (life-threat 10, emergency 30, urgent 40, acute 15, non-acute 5), **When** กราฟ donut โหลด, **Then** เห็น 5 ส่วน สีแดง→ส้ม→อำพัน→ฟ้า→เทา พร้อม % บนแต่ละส่วน และ center label "ทั้งหมด 100 ราย"
2. **Given** ผู้ใช้คลิกส่วน "ฉุกเฉิน" ใน donut, **When** คลิก, **Then** เปิด modal แสดงรายชื่อ 30 ราย พร้อมลิงก์เปิด detail dialog แต่ละราย
3. **Given** มี refer_cause 12 ค่า, **When** กราฟ horizontal bar โหลด, **Then** แสดง 10 อันดับแรก + แท่ง "อื่นๆ" รวมที่เหลือ
4. **Given** ผู้ใช้คลิก legend "นอกเขต" ใน stacked bar, **When** คลิก, **Then** ซ่อน segment "นอกเขต" จากทุกแท่ง; คลิกซ้ำ → แสดงกลับ
5. **Given** คลิกแท่งใน top-cause, **When** คลิก, **Then** เปิด modal รายชื่อผู้ป่วยที่มี refer_cause นั้น

---

### User Story 5 — Trend Visualization (Priority: P2)

ผู้บริหารต้องการเห็นแนวโน้มจำนวนการส่งต่อรายวัน/รายเดือน เพื่อจับภาวะผิดปกติ (เช่น ส่งต่อเพิ่มขึ้นกระทันหันหลังเทศกาล)

**Why this priority**: ส่วนหนึ่งของ "Cause Analysis" ในข้อสรุป + แนวปฏิบัติมาตรฐานของ healthcare KPI dashboard 2026.

**Acceptance Scenarios**:

1. **Given** ช่วงวันที่ ≤ 31 วัน, **When** กราฟแนวโน้มโหลด, **Then** แต่ละจุด = 1 วัน (bucket รายวัน)
2. **Given** ช่วงวันที่ > 31 วัน, **When** กราฟแนวโน้มโหลด, **Then** แต่ละจุด = 1 เดือน (bucket รายเดือน YYYY-MM)
3. **Given** ผู้ใช้คลิกจุดในกราฟ, **When** คลิก, **Then** เปิด modal แสดงรายการของวัน/เดือนนั้น

---

### User Story 6 — Privacy & Print (Priority: P3)

ผู้บริหารบางครั้งต้องนำเสนอข้อมูลในที่ประชุม → ต้องสามารถซ่อนข้อมูลส่วนตัว (HN, ชื่อ-นามสกุล) ก่อนการนำเสนอ และพิมพ์รายงานได้

**Acceptance Scenarios**:

1. **Given** ผู้ใช้เปิด toggle "ซ่อน HN", **When** toggle on, **Then** ทุก HN ในตาราง/dialog แสดงเป็น `XXXXX####` (เห็น 4 ตัวสุดท้าย); ชื่อ → "นาย/นาง XXX"
2. **Given** ผู้ใช้คลิกปุ่ม "พิมพ์", **When** คลิก, **Then** เปิด print preview ของหน้าปัจจุบันที่ซ่อนปุ่ม/dialog ไว้ และแสดงเฉพาะ KPI cards + กราฟ + ตาราง

---

### Edge Cases

- **Session expired**: บริการ `executeSqlViaApi` โยน `Session unauthorized` → app redirect ไปหน้า session expired (handled โดย context อยู่แล้ว) — หน้าจอแสดง error ของตัวเองพร้อมปุ่ม "กลับเข้าระบบ"
- **Network timeout** (>60s): แสดง error card "การดึงข้อมูลใช้เวลาเกินกำหนด ลองช่วงวันที่ที่แคบลง" + ปุ่ม "ลองใหม่"
- **HTTP 429 / rate-limited**: แสดง warning toast (ใช้ notify service ที่มีอยู่) "มีการร้องขอบ่อยเกินไป กรุณารอสักครู่"
- **NULL geography fields** (refer_in_province และ refer_in_region เป็น NULL ทั้งคู่): แยกเป็น bucket "ไม่ระบุพื้นที่" และนับใน KPI "ทั้งหมด" เพื่อให้ผลรวมตรง
- **Missing lookup row** (เช่น `referout_status_id` มีค่าแต่ไม่มี row ใน `referout_status`): แสดง "ไม่ระบุ" แทน
- **Database flavor** (PostgreSQL vs MySQL): ใช้ single-quoted literals (PostgreSQL-safe) และ ANSI SQL functions
- **Refer_date NULL**: ตัดออกจากกราฟ time-series แต่นับใน KPI "ทั้งหมด" และแสดงในตารางเป็น "—"
- **Refer_number ซ้ำ**: ใช้ `referout_id` เป็น React key เสมอ (PK)
- **Empty result**: แสดง empty state พร้อมข้อความและปุ่ม "ล้างตัวกรอง"

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: ระบบต้องดึงข้อมูล refer-out ทั้งหมดของโรงพยาบาล 11278 (ไทรโยค) จากตาราง `referout` ผ่าน `executeSqlViaApi()` (read-only SELECT เท่านั้น)
- **FR-002**: ระบบต้องแสดง KPI cards 7 ใบ: ทั้งหมด, ในจังหวัด, นอกจังหวัด, นอกเขต, คุกคามชีวิต, ใช้รถพยาบาล, มีพยาบาลร่วม
- **FR-003**: ระบบต้องคำนวณ "ในจังหวัด" จาก `refer_in_province = 'Y'`, "นอกจังหวัด" จาก `refer_in_province = 'N' AND refer_in_region = 'Y'`, "นอกเขต" จาก `refer_in_region = 'N'` (รายการที่ทั้งสองฟิลด์เป็น NULL → bucket "ไม่ระบุพื้นที่")
- **FR-004**: ระบบต้องเปรียบเทียบ KPI ทั้งหมดกับช่วงเวลาก่อนหน้า (ความยาวเท่ากัน ก่อนเริ่มช่วง) และแสดงเป็น %
- **FR-005**: ระบบต้องแสดงตารางรายละเอียดที่มีคอลัมน์: refer_number, refer_date+refer_time (พ.ศ.), HN, ชื่อผู้ป่วย, pre_diagnosis + pdx, ชื่อ รพ.ปลายทาง, ประเภทพื้นที่ (badge), ประเภทการส่งต่อ, ระดับเร่งด่วน (badge สี), สถานะ
- **FR-006**: ระบบต้องรองรับการเรียงคอลัมน์ตาราง (asc / desc / reset)
- **FR-007**: ระบบต้องรองรับ pagination: หน้าละ 50 แถว, hard cap 500 แถวต่อ query, มีปุ่ม "โหลดเพิ่ม"
- **FR-008**: ระบบต้องรองรับการกรอง: ช่วงวันที่ (preset + custom), `referout_type_id`, `referout_status_id`, `referout_emergency_type_id`, area bucket, free-text search
- **FR-009**: ระบบต้องแสดงกราฟ 4 ตัว: donut ระดับเร่งด่วน, stacked bar type×area, horizontal bar top-10 refer_cause, line trend จำนวนต่อวัน/เดือน
- **FR-010**: ทุก KPI / chart slice / table row ต้องคลิกเพื่อ drill-down ได้
- **FR-011**: ระบบต้องส่งออก CSV ของตารางที่กรองอยู่ ด้วย UTF-8 BOM และ Thai column headers
- **FR-012**: ระบบต้องรองรับการพิมพ์ (print view) ของ KPI cards + กราฟ + ตาราง
- **FR-013**: ระบบต้องรองรับ toggle "ซ่อน HN" ที่ปิดบังข้อมูลส่วนตัว
- **FR-014**: ระบบต้องแสดง loading skeleton, empty state, error card พร้อมปุ่มลองใหม่
- **FR-015**: ระบบต้องแสดงวันที่/เวลาภาษาไทย (พ.ศ.) ทุกที่ที่ผู้ใช้เห็น
- **FR-016**: ระบบต้องเตือนผู้ใช้เมื่อช่วงวันที่กว้างเกิน 365 วัน
- **FR-017**: SQL ทุกตัวต้องใช้ parameter binding (`:start_date`, `:end_date`, etc.) — ห้าม string concatenation ของ user input
- **FR-018**: SQL ทุกตัวต้องเริ่มด้วย SELECT หรือ WITH เท่านั้น — ห้าม INSERT/UPDATE/DELETE/CREATE/DROP/ALTER/TRUNCATE
- **FR-019**: ระบบต้อง LEFT JOIN lookup tables (`hospcode`, `referout_type`, `referout_emergency_type`, `referout_status`, `refer_cause`, `patient`) เพื่อให้ลูปขาดยังคงแสดงข้อมูลหลัก
- **FR-020**: ระบบต้องแสดงรายละเอียดแบบเต็มเมื่อคลิกแถว — รวม timeline จาก `referout_regist` (ถ้ามี); ถ้า table ไม่มี/ขาดสิทธิ์ ให้แสดง "ไม่พบข้อมูลทะเบียน" โดยไม่ throw

### Key Entities

- **Referral (referout)**: เรคคอร์ดใบส่งตัวออก 1 ใบ. คีย์: `referout_id`. ฟิลด์สำคัญ: refer_number, refer_date/time, hn, vn, hospcode, pre_diagnosis, pdx, refer_in_province, refer_in_region, referout_type_id, referout_emergency_type_id, referout_status_id, refer_cause, with_nurse, with_ambulance, doctor, depcode, hpi, pmh, lab_text, treatment_text, request_text, ptstatus_text, refer_response_type_id, refer_response_text
- **DestinationHospital (hospcode)**: รพ.ปลายทาง. คีย์: `hospcode`. ฟิลด์: name, hosptype, chwpart (จังหวัด).
- **ReferralType (referout_type)**: 3 ค่า — 1 ทั่วไป, 2 อุบัติเหตุ, 3 ฉุกเฉิน.
- **EmergencyLevel (referout_emergency_type)**: 5 ค่า — 1 Life-threatening, 2 Emergency, 3 Urgent, 4 Acute, 5 Non-acute.
- **ReferralStatus (referout_status)**: workflow status (configurable).
- **ReferralCause (refer_cause)**: 1-byte coded reason mapped to Thai label.
- **ReferralRegist (referout_regist)**: timeline log per referral (used in drill-down).
- **Patient (patient)**: source of `pname/fname/lname` for display only.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: ผู้บริหารเห็นการ์ดสรุปและกราฟทั้งหมดภายใน 3 วินาทีหลังเปิดหน้า (90th percentile บน LAN รพ.ปกติ)
- **SC-002**: ตารางรายละเอียดรองรับข้อมูลอย่างน้อย 5,000 รายการต่อช่วงวันที่ (paginated 500/round-trip) โดยไม่หมด memory
- **SC-003**: ผลรวม "ในจังหวัด + นอกจังหวัด + นอกเขต + ไม่ระบุพื้นที่" ต้องเท่ากับ "ทั้งหมด" ในทุกช่วงวันที่ (data integrity test)
- **SC-004**: CSV export เปิดด้วย Microsoft Excel แล้วภาษาไทยแสดงถูกต้อง 100% (UTF-8 BOM)
- **SC-005**: เจ้าหน้าที่งานส่งต่อสามารถค้นหาผู้ป่วยรายหนึ่งและดูรายละเอียดเต็มได้ภายใน 3 คลิก (filter → row click → detail dialog)
- **SC-006**: ผู้ใช้ใหม่ที่ไม่เคยเปิดแอปสามารถใช้งานหลักได้ภายใน 5 นาทีโดยไม่ต้องอ่าน manual (ทุกฟิลด์มี Thai label, สีและ legend อ่านง่าย)
- **SC-007**: 0 SQL injection / write operations ตลอดอายุการใช้งาน (verified โดย grep ใน CI step)
- **SC-008**: `npm run build` exit code 0 และ `npx tsc -b` zero error ก่อน merge

---

## Assumptions

ทุก ambiguity แก้ด้วย default แบบ industry-standard ดังนี้:

1. **Hospital scope** — ข้อมูล `referout` ทั้งหมดของ session (HOSxP DB) เป็น scope ของโรงพยาบาลไทรโยคโดย default เพราะแต่ละ HOSxP server เป็นของโรงพยาบาลเดียว. ไม่มี filter รายโรงพยาบาลเพิ่ม.
2. **Default date range** — "เดือนนี้" (1 ของเดือน → วันนี้). ครอบคลุม use case ปกติของผู้ใช้รายวัน.
3. **Time bucket boundary** — `refer_date` 31 วันหรือน้อยกว่า → daily bucket; มากกว่า → monthly bucket (`DATE_FORMAT(refer_date,'%Y-%m')` หรือ `to_char(refer_date,'YYYY-MM')`).
4. **Page size** — 50 แถวต่อหน้า, hard cap 500/round-trip. ค่าเริ่มต้น industry-standard ของ TanStack Table / DataGrid.
5. **Comparison window** — ช่วงเวลาก่อนหน้า = ช่วงเวลาที่ความยาวเท่ากัน ก่อนเริ่ม current range (เช่น current = 1-30 เม.ย., previous = 2-31 มี.ค.).
6. **Severity color order** — แดง→ส้ม→อำพัน→ฟ้า→เทา (Tailwind 600-shade) — มาตรฐาน emergency triage.
7. **CSV file name** — `referout-yyyy-MM-dd_HH-mm.csv` ใช้ Gregorian เพราะ machine-friendly; column headers ใช้ Thai เพราะคนอ่าน.
8. **Free-text search debounce** — 300 ms (ค่ามาตรฐาน UX).
9. **HN masking format** — `XXXXX####` แสดง 4 ตัวสุดท้าย (Thai PDPA standard).
10. **Marketplace token** — ไม่จำเป็นเพราะใช้ `/api/sql` (read-only) เท่านั้น; bearer token จาก session เพียงพอ.
11. **Lookup table joins** — LEFT JOIN ทุกตัว เพื่อให้ row คงอยู่แม้ FK ขาด.
12. **NULL geography handling** — bucket แยก "ไม่ระบุพื้นที่" นับใน "ทั้งหมด" — preserve count integrity.
13. **Drill-down modal** — ใช้ shadcn `<Dialog>` ที่ติดตั้งอยู่แล้ว เปิด modal กลางหน้าจอ; row click → side dialog (right panel).
14. **Print layout** — ใช้ Tailwind `print:` modifier ซ่อน controls; ไม่มี dedicated print stylesheet.
15. **Lookup label fallback** — ถ้า join ไม่เจอ ให้แสดง "ไม่ระบุ" แทน raw code.
16. **Refer_cause top-N** — แสดง 10 อันดับ + แท่ง "อื่นๆ" รวมที่เหลือ.
17. **Trend axis** — แกน x แสดงวันที่/เดือนเป็น พ.ศ. (เช่น "5 พ.ค. 2569" หรือ "เม.ย. 2569"); แกน y เป็นจำนวน.
18. **Province code 71** = กาญจนบุรี (FIPS/MOPH standard) — ใช้ตรวจสอบ "ในจังหวัด" เผื่อ refer_in_province เป็น NULL แล้ว `chwpart` ของ hospcode มีค่า (ใช้เป็น secondary signal เท่านั้น เพื่อรักษาความสอดคล้องกับฟิลด์หลัก).
19. **Database type** — รองรับทั้ง MySQL และ PostgreSQL (ตามที่ session แจ้ง). ใช้ ANSI SQL เป็นหลัก; switch quoting/format functions ผ่าน helper.
20. **Hospital name in header** — แสดง "โรงพยาบาลไทรโยค (11278)" ใน hero band ของหน้า. ดึงจาก `getHospitalInfo()` ของ bmsSession service.
