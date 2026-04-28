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
 * KPI summary: total referrals broken down by province / zone-5 / outside zone-5.
 *
 * @param dbType   — target database flavour
 * @param daysBack — how many days to look back (0 = today only)
 */
export function getReferSummarySql(dbType: DatabaseType, daysBack: number): string {
  const dateExpr = daysBack === 0
    ? `${queryBuilder.currentDate(dbType)}`
    : `${queryBuilder.dateSubtract(dbType, daysBack)}`;

  return `
SELECT
  COUNT(*) AS total_refer,
  SUM(CASE WHEN h.chwpart = :current_chwpart THEN 1 ELSE 0 END) AS in_province,
  SUM(CASE WHEN h.chwpart != :current_chwpart AND h.chwpart IN ('70','71','76','77') THEN 1 ELSE 0 END) AS in_zone5,
  SUM(CASE WHEN h.chwpart NOT IN (:current_chwpart,'70','71','76','77') OR h.chwpart IS NULL THEN 1 ELSE 0 END) AS out_zone5
FROM referout r
LEFT JOIN hospcode h ON h.hospcode = r.refer_hospcode
WHERE r.refer_date >= ${dateExpr}
  AND r.refer_date <= ${queryBuilder.currentDate(dbType)}
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
  SUM(CASE WHEN h.chwpart = :current_chwpart THEN 1 ELSE 0 END) AS in_province,
  SUM(CASE WHEN h.chwpart != :current_chwpart AND h.chwpart IN ('70','71','76','77') THEN 1 ELSE 0 END) AS in_zone5,
  SUM(CASE WHEN h.chwpart NOT IN (:current_chwpart,'70','71','76','77') OR h.chwpart IS NULL THEN 1 ELSE 0 END) AS out_zone5
FROM referout r
LEFT JOIN hospcode h ON h.hospcode = r.refer_hospcode
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
LEFT JOIN hospcode h ON h.hospcode = r.refer_hospcode
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
