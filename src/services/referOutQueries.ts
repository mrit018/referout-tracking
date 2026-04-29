// =============================================================================
// Refer Out Dashboard — SQL Query Builders
// Database-type-aware SQL for the patient-referral registry.
// =============================================================================

import { queryBuilder } from '@/services/queryBuilder';
import type { DatabaseType, SqlParams } from '@/types';

// ---------------------------------------------------------------------------
// Zone-5 province codes (Health Region 5)
// ---------------------------------------------------------------------------

/** Thai province codes (chwpart) that belong to Health Region 5. */
export const ZONE5_PROVINCE_CODES = ['70', '71', '76', '77'];

/** Excluded hospitals from "ในเขต" (รพ.บ้านแพ้ว, รพ.วัดไร่ขิง). Update as needed. */
export const ZONE5_EXCLUDED_HOSPCODES: string[] = [];

// ---------------------------------------------------------------------------
// Query builders
// ---------------------------------------------------------------------------

/**
 * Retrieve the `chwpart` (province code) of the current hospital.
 */
export function getCurrentHospitalChwpartSql(): string {
  return `SELECT chwpart FROM hospcode WHERE hospcode = :hospcode LIMIT 1`;
}

/**
 * KPI summary: total referrals broken down by geography (3-bucket).
 *   - ในจังหวัด  = destination in same province
 *   - ในเขต      = destination in Health Region 5 (excl. specific hospitals)
 *   - นอกเขต     = everything else
 */
export function getReferSummarySql(dbType: DatabaseType, daysBack: number): string {
  const dateExpr = daysBack === 0
    ? `${queryBuilder.currentDate(dbType)}`
    : `${queryBuilder.dateSubtract(dbType, daysBack)}`;

  return `
SELECT
  COUNT(*) AS total_refer,
  SUM(CASE WHEN r.refer_in_province = 'Y' THEN 1 ELSE 0 END) AS in_province,
  SUM(CASE WHEN r.refer_in_region = 'Y' THEN 1 ELSE 0 END) AS in_region,
  SUM(CASE WHEN COALESCE(r.refer_in_region,'N') = 'N' THEN 1 ELSE 0 END) AS out_region,
  SUM(CASE WHEN r.referout_emergency_type_id = 1 THEN 1 ELSE 0 END) AS life_threat,
  SUM(CASE WHEN r.with_ambulance = 'Y' THEN 1 ELSE 0 END) AS with_ambulance,
  SUM(CASE WHEN r.with_nurse = 'Y' THEN 1 ELSE 0 END) AS with_nurse
FROM referout r
WHERE r.refer_date >= ${dateExpr}
  AND r.refer_date <= ${queryBuilder.currentDate(dbType)}
`;
}

/**
 * SERVICE PLAN breakdown (referout_sp_type).
 */
export function getSpTypeBreakdownSql(dbType: DatabaseType, daysBack: number): string {
  const dateExpr = daysBack === 0
    ? `${queryBuilder.currentDate(dbType)}`
    : `${queryBuilder.dateSubtract(dbType, daysBack)}`;

  return `
SELECT
  COALESCE(sp.referout_sp_type_name, 'ไม่ระบุสาขา') AS sp_type_name,
  COUNT(*) AS count
FROM referout r
LEFT JOIN referout_sp_type sp ON sp.referout_sp_type_id = r.referout_sp_type_id
WHERE r.refer_date >= ${dateExpr}
  AND r.refer_date <= ${queryBuilder.currentDate(dbType)}
GROUP BY sp.referout_sp_type_name
ORDER BY count DESC
`;
}

/**
 * ICD-10 top diagnosis codes.
 */
export function getIcd10TopSql(dbType: DatabaseType, daysBack: number, limit = 10): string {
  const dateExpr = daysBack === 0
    ? `${queryBuilder.currentDate(dbType)}`
    : `${queryBuilder.dateSubtract(dbType, daysBack)}`;

  return `
SELECT
  COALESCE(r.pdx, 'ไม่ระบุ') AS icd10,
  r.pre_diagnosis,
  COUNT(*) AS count
FROM referout r
WHERE r.refer_date >= ${dateExpr}
  AND r.refer_date <= ${queryBuilder.currentDate(dbType)}
  AND r.pdx IS NOT NULL AND r.pdx != ''
GROUP BY r.pdx, r.pre_diagnosis
ORDER BY count DESC
LIMIT ${limit}
`;
}

/**
 * Referral cause breakdown (5 causes per user spec).
 * Maps refer_cause to standard 5 categories.
 */
export function getReferCauseBreakdownSql(dbType: DatabaseType, daysBack: number): string {
  const dateExpr = daysBack === 0
    ? `${queryBuilder.currentDate(dbType)}`
    : `${queryBuilder.dateSubtract(dbType, daysBack)}`;

  return `
SELECT
  COALESCE(c.name, 'ไม่ระบุสาเหตุ') AS cause_name,
  COUNT(*) AS count
FROM referout r
LEFT JOIN refer_cause c ON c.id = r.refer_cause
WHERE r.refer_date >= ${dateExpr}
  AND r.refer_date <= ${queryBuilder.currentDate(dbType)}
GROUP BY c.name
ORDER BY count DESC
`;
}

/**
 * Monthly trend for the last N months.
 */
export function getMonthlyTrendSql(dbType: DatabaseType, monthsBack: number): string {
  const startDateExpr = queryBuilder.dateSubtract(dbType, monthsBack * 30);
  const monthFormat = queryBuilder.dateFormat(dbType, 'r.refer_date', '%Y-%m');

  return `
SELECT
  ${monthFormat} AS month,
  COUNT(*) AS total,
  SUM(CASE WHEN r.refer_in_province = 'Y' THEN 1 ELSE 0 END) AS in_province,
  SUM(CASE WHEN r.refer_in_region = 'Y' THEN 1 ELSE 0 END) AS in_region,
  SUM(CASE WHEN COALESCE(r.refer_in_region,'N') = 'N' THEN 1 ELSE 0 END) AS out_region
FROM referout r
WHERE r.refer_date >= ${startDateExpr}
GROUP BY ${monthFormat}
ORDER BY month
`;
}

/**
 * Top destination hospitals by referral count.
 */
export function getTopDestinationsSql(dbType: DatabaseType, daysBack: number, limit = 10): string {
  const dateExpr = daysBack === 0
    ? `${queryBuilder.currentDate(dbType)}`
    : `${queryBuilder.dateSubtract(dbType, daysBack)}`;

  return `
SELECT
  h.hospcode,
  CONCAT(h.hosptype, ' ', h.name) AS hospname,
  h.chwpart,
  COUNT(*) AS refer_count
FROM referout r
LEFT JOIN hospcode h ON h.hospcode = r.hospcode
WHERE r.refer_date >= ${dateExpr}
  AND r.refer_date <= ${queryBuilder.currentDate(dbType)}
GROUP BY h.hospcode, h.hosptype, h.name, h.chwpart
ORDER BY refer_count DESC
LIMIT ${limit}
`;
}

/**
 * Recent referral-out records with patient & destination info.
 */
export function getRecentReferOutSql(dbType: DatabaseType, daysBack: number, limit = 50): string {
  const dateExpr = daysBack === 0
    ? `${queryBuilder.currentDate(dbType)}`
    : `${queryBuilder.dateSubtract(dbType, daysBack)}`;

  return `
SELECT
  r.refer_number,
  r.refer_date,
  r.refer_time,
  r.hn,
  CONCAT(p.pname, p.fname, ' ', p.lname) AS patient_name,
  CONCAT(h.hosptype, ' ', h.name) AS dest_hospital,
  h.chwpart,
  r.pdx,
  r.refer_point
FROM referout r
LEFT JOIN hospcode h ON h.hospcode = r.refer_hospcode
LEFT JOIN patient p ON p.hn = r.hn
WHERE r.refer_date >= ${dateExpr}
  AND r.refer_date <= ${queryBuilder.currentDate(dbType)}
ORDER BY r.refer_date DESC, r.refer_time DESC
LIMIT ${limit}
`;
}

/**
 * Referral breakdown by emergency type.
 */
export function getReferByEmergencyTypeSql(dbType: DatabaseType, daysBack: number): string {
  const dateExpr = daysBack === 0
    ? `${queryBuilder.currentDate(dbType)}`
    : `${queryBuilder.dateSubtract(dbType, daysBack)}`;

  return `
SELECT
  e.referout_emergency_type_name AS emergency_type,
  COUNT(*) AS count
FROM referout r
LEFT JOIN referout_emergency_type e ON e.referout_emergency_type_id = r.referout_emergency_type_id
WHERE r.refer_date >= ${dateExpr}
  AND r.refer_date <= ${queryBuilder.currentDate(dbType)}
GROUP BY e.referout_emergency_type_name
ORDER BY count DESC
`;
}

// ---------------------------------------------------------------------------
// Refer Back queries (referin table)
// ---------------------------------------------------------------------------

/**
 * Refer Back summary from referin table.
 */
export function getReferBackSummarySql(dbType: DatabaseType, daysBack: number): string {
  const dateExpr = daysBack === 0
    ? `${queryBuilder.currentDate(dbType)}`
    : `${queryBuilder.dateSubtract(dbType, daysBack)}`;

  return `
SELECT
  COUNT(*) AS total_referback,
  SUM(CASE WHEN h.chwpart = :current_chwpart THEN 1 ELSE 0 END) AS from_province,
  SUM(CASE WHEN h.chwpart IN ('70','71','76','77') AND h.chwpart != :current_chwpart THEN 1 ELSE 0 END) AS from_zone5,
  SUM(CASE WHEN h.chwpart NOT IN ('70','71','76','77') OR h.chwpart IS NULL THEN 1 ELSE 0 END) AS from_outside
FROM referin ri
LEFT JOIN hospcode h ON h.hospcode = ri.hospcode
WHERE ri.refer_date >= ${dateExpr}
  AND ri.refer_date <= ${queryBuilder.currentDate(dbType)}
`;
}

/**
 * Refer Back SERVICE PLAN breakdown by spclty (specialty).
 */
export function getReferBackBySpTypeSql(dbType: DatabaseType, daysBack: number): string {
  const dateExpr = daysBack === 0
    ? `${queryBuilder.currentDate(dbType)}`
    : `${queryBuilder.dateSubtract(dbType, daysBack)}`;

  return `
SELECT
  COALESCE(ri.spclty, 'ไม่ระบุ') AS spclty,
  COUNT(*) AS count
FROM referin ri
WHERE ri.refer_date >= ${dateExpr}
  AND ri.refer_date <= ${queryBuilder.currentDate(dbType)}
GROUP BY ri.spclty
ORDER BY count DESC
`;
}

/**
 * Refer Back ICD-10 top diagnosis.
 */
export function getReferBackIcd10TopSql(dbType: DatabaseType, daysBack: number, limit = 10): string {
  const dateExpr = daysBack === 0
    ? `${queryBuilder.currentDate(dbType)}`
    : `${queryBuilder.dateSubtract(dbType, daysBack)}`;

  return `
SELECT
  COALESCE(ri.icd10, 'ไม่ระบุ') AS icd10,
  ri.pre_diagnosis,
  COUNT(*) AS count
FROM referin ri
WHERE ri.refer_date >= ${dateExpr}
  AND ri.refer_date <= ${queryBuilder.currentDate(dbType)}
  AND ri.icd10 IS NOT NULL AND ri.icd10 != ''
GROUP BY ri.icd10, ri.pre_diagnosis
ORDER BY count DESC
LIMIT ${limit}
`;
}

/**
 * Refer Back detail list.
 */
export function getReferBackListSql(dbType: DatabaseType, daysBack: number, limit = 50): string {
  const dateExpr = daysBack === 0
    ? `${queryBuilder.currentDate(dbType)}`
    : `${queryBuilder.dateSubtract(dbType, daysBack)}`;

  const dateFmt = queryBuilder.dateFormat(dbType, 'ri.refer_date', '%Y-%m-%d');

  return `
SELECT
  ri.referin_number,
  ${dateFmt} AS refer_date,
  ri.refer_time,
  ri.hn,
  CONCAT(p.pname, p.fname, ' ', p.lname) AS patient_name,
  ri.icd10,
  ri.pre_diagnosis,
  CONCAT(h.hosptype, ' ', h.name) AS source_hospital,
  ri.spclty
FROM referin ri
LEFT JOIN hospcode h ON h.hospcode = ri.hospcode
LEFT JOIN patient p ON p.hn = ri.hn
WHERE ri.refer_date >= ${dateExpr}
  AND ri.refer_date <= ${queryBuilder.currentDate(dbType)}
ORDER BY ri.refer_date DESC, ri.refer_time DESC
LIMIT ${limit}
`;
}

// ---------------------------------------------------------------------------
// Parameter helpers
// ---------------------------------------------------------------------------

/** Build the params object for queries that need the current hospital chwpart. */
export function buildChwpartParams(hospitalCode: string, currentChwpart: string): SqlParams {
  return {
    hospcode: { value: hospitalCode, value_type: 'string' },
    current_chwpart: { value: currentChwpart, value_type: 'string' },
  };
}

/** Build params for date-range queries when chwpart is already known. */
export function buildDateRangeParams(currentChwpart: string): SqlParams {
  return {
    current_chwpart: { value: currentChwpart, value_type: 'string' },
  };
}

/**
 * Full patient referral-out list with date/time range filter.
 *
 * @param dbType — target database flavour
 */
export function getReferOutPatientListSql(dbType: DatabaseType): string {
  const dateFmt = queryBuilder.dateFormat(dbType, 'r.refer_date', '%Y-%m-%d');

  return `
SELECT
  r.refer_number,
  ${dateFmt} AS refer_date,
  r.refer_time,
  r.hn,
  CONCAT(p.pname, p.fname, ' ', p.lname) AS patient_name,
  p.sex,
  p.birthday,
  CONCAT(h.hosptype, ' ', h.name) AS dest_hospital,
  h.chwpart,
  d.name AS doctor_name,
  pt.name AS pttype_name,
  e.referout_emergency_type_name AS emergency_type,
  sp.referout_sp_type_name AS sp_type,
  k.department AS department_name,
  r.pdx,
  r.pre_diagnosis,
  r.refer_point,
  r.with_nurse,
  r.with_doctor,
  r.with_ambulance
FROM referout r
LEFT JOIN patient p ON p.hn = r.hn
LEFT JOIN hospcode h ON h.hospcode = r.refer_hospcode
LEFT JOIN doctor d ON d.code = r.doctor
LEFT JOIN ovst o ON o.vn = r.vn
LEFT JOIN pttype pt ON pt.pttype = o.pttype
LEFT JOIN referout_emergency_type e ON e.referout_emergency_type_id = r.referout_emergency_type_id
LEFT JOIN referout_sp_type sp ON sp.referout_sp_type_id = r.referout_sp_type_id
LEFT JOIN kskdepartment k ON k.depcode = r.depcode
WHERE r.refer_date >= :start_date
  AND r.refer_date <= :end_date
  AND (COALESCE(:start_time, '') = '' OR r.refer_time >= :start_time)
  AND (COALESCE(:end_time, '') = '' OR r.refer_time <= :end_time)
ORDER BY r.refer_date DESC, r.refer_time DESC
LIMIT :limit OFFSET :offset
`;
}

/**
 * Count total records for pagination.
 */
export function getReferOutPatientCountSql(): string {
  return `
SELECT COUNT(*) AS total_count
FROM referout r
WHERE r.refer_date >= :start_date
  AND r.refer_date <= :end_date
  AND (COALESCE(:start_time, '') = '' OR r.refer_time >= :start_time)
  AND (COALESCE(:end_time, '') = '' OR r.refer_time <= :end_time)
`;
}

/** Build params for patient-list date/time range queries. */
export function buildPatientListParams(
  startDate: string,
  endDate: string,
  startTime: string,
  endTime: string,
  limit: number,
  offset: number,
): SqlParams {
  return {
    start_date: { value: startDate, value_type: 'date' },
    end_date: { value: endDate, value_type: 'date' },
    start_time: { value: startTime, value_type: 'time' },
    end_time: { value: endTime, value_type: 'time' },
    limit: { value: limit, value_type: 'integer' },
    offset: { value: offset, value_type: 'integer' },
  };
}
