// =============================================================================
// Refer Out Patient List — รายชื่อผู้ป่วยส่งต่อ (Card View)
// =============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useBmsSessionContext } from '@/contexts/BmsSessionContext';
import { useQuery } from '@/hooks/useQuery';
import { executeSqlViaApiQueued } from '@/services/bmsSession';
import {
  getReferOutPatientListSql,
  getReferOutPatientCountSql,
  getRecentReferOutSql,
  buildPatientListParams,
} from '@/services/referOutQueries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import SqlPreviewDialog from '@/components/SqlPreviewDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  Calendar,
  Clock,
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Stethoscope,
  Shield,
  Siren,
  Ambulance,
  UserCheck,
  HeartPulse,
  FileText,
  Building2,
  Code2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReferPatient {
  refer_number: string;
  refer_date: string;
  refer_time: string;
  hn: string;
  patient_name: string;
  sex: string;
  birthday: string;
  dest_hospital: string;
  chwpart: string;
  doctor_name: string;
  pttype_name: string;
  emergency_type: string;
  department_name: string;
  pdx: string;
  pre_diagnosis: string;
  refer_point: string;
  with_nurse: string;
  with_doctor: string;
  with_ambulance: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatThaiDate(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(timeStr: string): string {
  if (!timeStr) return '-';
  return timeStr.slice(0, 5);
}

function calcAge(birthday: string): number {
  if (!birthday) return 0;
  const birth = new Date(birthday);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function getSexLabel(sex: string): string {
  if (sex === '1' || sex === 'M') return 'ชาย';
  if (sex === '2' || sex === 'F') return 'หญิง';
  return sex || '-';
}

function getSexColor(sex: string): string {
  if (sex === '1' || sex === 'M') return 'bg-sky-100 text-sky-700 border-sky-200';
  if (sex === '2' || sex === 'F') return 'bg-pink-100 text-pink-700 border-pink-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

function getEmergencyColor(type: string): string {
  const t = (type || '').toLowerCase();
  if (t.includes('life') || t.includes('resuscitation')) return 'bg-red-100 text-red-700 border-red-200';
  if (t.includes('emergency')) return 'bg-orange-100 text-orange-700 border-orange-200';
  if (t.includes('urgent')) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-green-100 text-green-700 border-green-200';
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthAgoStr(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface RecentRefer {
  refer_number: string;
  refer_date: string;
  refer_time: string;
  hn: string;
  patient_name: string;
  dest_hospital: string;
  pdx: string;
  refer_point: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PAGE_SIZE = 12;

export default function ReferOutPatientList() {
  const { session, connectionConfig, marketplaceToken } = useBmsSessionContext();
  const dbType = session?.databaseType ?? 'mysql';

  const [startDate, setStartDate] = useState(monthAgoStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:59');
  const [page, setPage] = useState(0);
  const [detailRecord, setDetailRecord] = useState<RecentRefer | null>(null);
  const [showSql, setShowSql] = useState(false);

  // -----------------------------------------------------------------
  // Fetch recent referrals
  // -----------------------------------------------------------------
  const recentQuery = useQuery({
    queryFn: async () => {
      if (!connectionConfig) throw new Error('No connection');
      const sql = getRecentReferOutSql(dbType, 30, 50);
      const res = await executeSqlViaApiQueued(sql, connectionConfig, undefined, marketplaceToken);
      return (res.data ?? []) as unknown as RecentRefer[];
    },
    enabled: !!connectionConfig,
  });

  // -----------------------------------------------------------------
  // Fetch count
  // -----------------------------------------------------------------
  const countQuery = useQuery({
    queryFn: async () => {
      if (!connectionConfig) throw new Error('No connection');
      const sql = getReferOutPatientCountSql();
      const params = buildPatientListParams(startDate, endDate, startTime, endTime, PAGE_SIZE, page * PAGE_SIZE);
      delete params.limit;
      delete params.offset;
      const res = await executeSqlViaApiQueued(sql, connectionConfig, params, marketplaceToken);
      return Number((res.data?.[0] as Record<string, number> | undefined)?.total_count ?? 0);
    },
    enabled: false,
  });

  // -----------------------------------------------------------------
  // Fetch list
  // -----------------------------------------------------------------
  const listQuery = useQuery({
    queryFn: async () => {
      if (!connectionConfig) throw new Error('No connection');
      const sql = getReferOutPatientListSql(dbType);
      const params = buildPatientListParams(startDate, endDate, startTime, endTime, PAGE_SIZE, page * PAGE_SIZE);
      const res = await executeSqlViaApiQueued(sql, connectionConfig, params, marketplaceToken);
      return (res.data ?? []) as unknown as ReferPatient[];
    },
    enabled: false,
  });

  const doSearch = useCallback(() => {
    setPage(0);
    countQuery.execute();
    listQuery.execute();
  }, [countQuery, listQuery]);

  const doReset = useCallback(() => {
    setStartDate(monthAgoStr());
    setEndDate(todayStr());
    setStartTime('00:00');
    setEndTime('23:59');
    setPage(0);
    countQuery.reset();
    listQuery.reset();
  }, [countQuery, listQuery]);

  useEffect(() => {
    if (connectionConfig) {
      doSearch();
    }
  }, [connectionConfig]);

  useEffect(() => {
    if (page >= 0) {
      listQuery.execute();
    }
  }, [page]);

  const totalPages = countQuery.data ? Math.ceil(countQuery.data / PAGE_SIZE) : 0;
  const isLoading = countQuery.isLoading || listQuery.isLoading;

  const sqlQueries = useMemo(() => [
    { label: 'รายการส่งต่อล่าสุด (30 วัน)', sql: getRecentReferOutSql(dbType, 30, 50) },
    { label: 'รายชื่อผู้ป่วยส่งต่อ', sql: getReferOutPatientListSql(dbType) },
    { label: 'นับจำนวนผู้ป่วย', sql: getReferOutPatientCountSql() },
  ], [dbType]);

  return (
    <div className="patient-list-page">
      {/* Header */}
      <div className="patient-list-header">
        <div>
          <h1 className="patient-list-title">
            <Users className="h-6 w-6" />
            รายชื่อผู้ป่วยส่งต่อ
          </h1>
          <p className="patient-list-subtitle">
            แสดงรายชื่อผู้ป่วยที่ส่งต่อไปโรงพยาบาลอื่น
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowSql(true)} className="gap-1.5">
          <Code2 className="h-4 w-4" />
          SQL
        </Button>
      </div>

      {/* Filters */}
      <Card className="filter-card">
        <CardContent className="p-4">
          <div className="filter-grid">
            <div className="filter-group">
              <label className="filter-label">
                <Calendar className="h-3.5 w-3.5" />
                วันที่เริ่มต้น
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="filter-input"
              />
            </div>
            <div className="filter-group">
              <label className="filter-label">
                <Calendar className="h-3.5 w-3.5" />
                วันที่สิ้นสุด
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="filter-input"
              />
            </div>
            <div className="filter-group">
              <label className="filter-label">
                <Clock className="h-3.5 w-3.5" />
                เวลาเริ่มต้น
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="filter-input"
              />
            </div>
            <div className="filter-group">
              <label className="filter-label">
                <Clock className="h-3.5 w-3.5" />
                เวลาสิ้นสุด
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="filter-input"
              />
            </div>
            <div className="filter-actions">
              <Button onClick={doSearch} disabled={isLoading} className="gap-1.5">
                <Search className="h-4 w-4" />
                ค้นหา
              </Button>
              <Button variant="outline" onClick={doReset} disabled={isLoading} className="gap-1.5">
                <RotateCcw className="h-4 w-4" />
                รีเซ็ต
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {countQuery.data !== null && (
        <div className="stats-bar">
          <span className="stats-text">
            พบ <strong>{countQuery.data?.toLocaleString('th-TH') ?? 0}</strong> ราย
            {countQuery.data && countQuery.data > 0 && (
              <>
                {' '}
                · หน้า <strong>{page + 1}</strong> / {totalPages}
              </>
            )}
          </span>
        </div>
      )}

      {/* Cards Grid */}
      {isLoading ? (
        <div className="cards-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full rounded-xl" />
          ))}
        </div>
      ) : listQuery.data && listQuery.data.length > 0 ? (
        <>
          <div className="cards-grid">
            {listQuery.data.map((patient, idx) => (
              <PatientCard key={`${patient.refer_number}-${idx}`} patient={patient} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination-bar">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || isLoading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                ก่อนหน้า
              </Button>
              <span className="pagination-info">
                หน้า {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || isLoading}
              >
                ถัดไป
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state-box">
          <Users className="h-12 w-12 text-muted-foreground/40" />
          <p className="empty-state-title">ไม่พบรายการ</p>
          <p className="empty-state-desc">ลองปรับช่วงวันที่หรือเงื่อนไขการค้นหาใหม่</p>
        </div>
      )}

      {/* Recent Referrals Table */}
      <Card>
        <CardHeader className="recent-table-header">
          <CardTitle className="recent-table-title">
            <Calendar className="h-5 w-5" />
            รายการส่งต่อล่าสุด
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentQuery.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : recentQuery.data && recentQuery.data.length > 0 ? (
            <div className="table-wrapper">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>เลขที่ส่งต่อ</TableHead>
                    <TableHead>วันที่</TableHead>
                    <TableHead>HN</TableHead>
                    <TableHead>ผู้ป่วย</TableHead>
                    <TableHead>โรงพยาบาลปลายทาง</TableHead>
                    <TableHead>PDX</TableHead>
                    <TableHead>จุดส่งต่อ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentQuery.data.map((row, i) => (
                    <TableRow
                      key={`${row.refer_number}-${i}`}
                      className="table-row-clickable"
                      onClick={() => setDetailRecord(row)}
                    >
                      <TableCell className="font-medium">{row.refer_number}</TableCell>
                      <TableCell>
                        {row.refer_date}
                        <span className="text-muted-foreground text-xs block">
                          {row.refer_time?.slice(0, 5)}
                        </span>
                      </TableCell>
                      <TableCell>{row.hn}</TableCell>
                      <TableCell>{row.patient_name}</TableCell>
                      <TableCell>{row.dest_hospital || 'ไม่ระบุ'}</TableCell>
                      <TableCell>{row.pdx}</TableCell>
                      <TableCell>{row.refer_point}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="empty-state-text">ไม่พบรายการส่งต่อใน 30 วันล่าสุด</div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailRecord !== null} onOpenChange={(open) => { if (!open) setDetailRecord(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>รายละเอียดการส่งต่อ</DialogTitle>
            <DialogDescription>
              เลขที่ส่งต่อ {detailRecord?.refer_number}
            </DialogDescription>
          </DialogHeader>
          {detailRecord && (
            <div className="detail-grid">
              <DetailItem label="วันที่ส่งต่อ" value={`${detailRecord.refer_date} ${detailRecord.refer_time?.slice(0, 5)}`} />
              <DetailItem label="HN" value={detailRecord.hn} />
              <DetailItem label="ผู้ป่วย" value={detailRecord.patient_name} />
              <DetailItem label="โรงพยาบาลปลายทาง" value={detailRecord.dest_hospital || 'ไม่ระบุ'} />
              <DetailItem label="PDX (ICD-10)" value={detailRecord.pdx} />
              <DetailItem label="จุดส่งต่อ" value={detailRecord.refer_point} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* SQL Preview */}
      <SqlPreviewDialog open={showSql} onOpenChange={setShowSql} queries={sqlQueries} />

      {/* Styles */}
      <style>{`
        .patient-list-page {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .patient-list-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }

        .patient-list-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 1.5rem;
          font-weight: 700;
          color: hsl(var(--foreground));
          margin: 0;
        }

        .patient-list-subtitle {
          font-size: 0.875rem;
          color: hsl(var(--muted-foreground));
          margin: 0.25rem 0 0;
        }

        .filter-card {
          border: 1px solid hsl(var(--border));
        }

        .filter-grid {
          display: grid;
          grid-template-columns: repeat(1, 1fr);
          gap: 1rem;
        }

        @media (min-width: 640px) {
          .filter-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (min-width: 1024px) {
          .filter-grid {
            grid-template-columns: repeat(5, 1fr);
          }
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }

        .filter-label {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.75rem;
          font-weight: 500;
          color: hsl(var(--muted-foreground));
        }

        .filter-input {
          padding: 0.5rem 0.75rem;
          border: 1px solid hsl(var(--border));
          border-radius: 0.5rem;
          font-size: 0.875rem;
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .filter-input:focus {
          border-color: hsl(var(--ring));
          box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2);
        }

        .filter-actions {
          display: flex;
          align-items: flex-end;
          gap: 0.5rem;
        }

        @media (max-width: 1023px) {
          .filter-actions {
            grid-column: 1 / -1;
            justify-content: flex-start;
          }
        }

        .stats-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .stats-text {
          font-size: 0.875rem;
          color: hsl(var(--muted-foreground));
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(1, 1fr);
          gap: 1rem;
        }

        @media (min-width: 640px) {
          .cards-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (min-width: 1280px) {
          .cards-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        .pagination-bar {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          padding: 0.5rem 0;
        }

        .pagination-info {
          font-size: 0.875rem;
          color: hsl(var(--muted-foreground));
        }

        .empty-state-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem 1rem;
          gap: 0.75rem;
          text-align: center;
        }

        .empty-state-title {
          font-size: 1rem;
          font-weight: 600;
          color: hsl(var(--foreground));
          margin: 0;
        }

        .empty-state-desc {
          font-size: 0.875rem;
          color: hsl(var(--muted-foreground));
          margin: 0;
        }

        .recent-table-header {
          padding-bottom: 0.75rem;
        }

        .recent-table-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1rem;
          font-weight: 600;
        }

        .table-wrapper {
          overflow-x: auto;
        }

        .table-row-clickable {
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .table-row-clickable:hover {
          background: hsl(var(--muted) / 0.4);
        }

        .empty-state-text {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 200px;
          color: hsl(var(--muted-foreground));
          font-size: 0.875rem;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
          padding-top: 0.5rem;
        }

        @media (max-width: 640px) {
          .detail-grid {
            grid-template-columns: 1fr;
          }
        }

        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .detail-label {
          font-size: 0.75rem;
          color: hsl(var(--muted-foreground));
        }

        .detail-value {
          font-size: 0.9375rem;
          font-weight: 500;
          color: hsl(var(--foreground));
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Patient Card
// ---------------------------------------------------------------------------

function PatientCard({ patient }: { patient: ReferPatient }) {
  const age = calcAge(patient.birthday);

  return (
    <Card className="patient-card">
      <CardContent className="p-0">
        {/* Card Header */}
        <div className="patient-card-header">
          <div className="patient-card-header-left">
            <div className="patient-avatar">
              {patient.patient_name?.charAt(0) || '?'}
            </div>
            <div>
              <h3 className="patient-name">{patient.patient_name || 'ไม่ระบุชื่อ'}</h3>
              <div className="patient-meta-row">
                <Badge variant="outline" className={`text-xs ${getSexColor(patient.sex)}`}>
                  {getSexLabel(patient.sex)}
                </Badge>
                <span className="patient-meta-text">HN: {patient.hn}</span>
                {age > 0 && <span className="patient-meta-text">{age} ปี</span>}
              </div>
            </div>
          </div>
          {patient.emergency_type && (
            <Badge className={`text-xs ${getEmergencyColor(patient.emergency_type)}`}>
              <Siren className="h-3 w-3 mr-0.5" />
              {patient.emergency_type}
            </Badge>
          )}
        </div>

        {/* Card Body */}
        <div className="patient-card-body">
          <div className="patient-info-row">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="patient-info-label">เลขที่ส่งต่อ:</span>
            <span className="patient-info-value">{patient.refer_number}</span>
          </div>

          <div className="patient-info-row">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="patient-info-label">วันที่:</span>
            <span className="patient-info-value">
              {formatThaiDate(patient.refer_date)} {formatTime(patient.refer_time)}
            </span>
          </div>

          <div className="patient-info-row">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="patient-info-label">ส่งไป:</span>
            <span className="patient-info-value">{patient.dest_hospital || 'ไม่ระบุ'}</span>
          </div>

          {patient.department_name && (
            <div className="patient-info-row">
              <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="patient-info-label">แผนก:</span>
              <span className="patient-info-value">{patient.department_name}</span>
            </div>
          )}

          {patient.doctor_name && (
            <div className="patient-info-row">
              <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="patient-info-label">แพทย์:</span>
              <span className="patient-info-value">{patient.doctor_name}</span>
            </div>
          )}

          {patient.pttype_name && (
            <div className="patient-info-row">
              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="patient-info-label">สิทธิ:</span>
              <span className="patient-info-value">{patient.pttype_name}</span>
            </div>
          )}

          {patient.pdx && (
            <div className="patient-info-row">
              <HeartPulse className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="patient-info-label">PDX:</span>
              <span className="patient-info-value font-mono">{patient.pdx}</span>
            </div>
          )}

          {patient.pre_diagnosis && (
            <div className="patient-info-row">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="patient-info-label">วินิจฉัย:</span>
              <span className="patient-info-value">{patient.pre_diagnosis}</span>
            </div>
          )}

          {/* Escort badges */}
          <div className="escort-row">
            {patient.with_nurse === 'Y' && (
              <Badge variant="secondary" className="text-xs gap-1">
                <HeartPulse className="h-3 w-3" />
                พยาบาล
              </Badge>
            )}
            {patient.with_doctor === 'Y' && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Stethoscope className="h-3 w-3" />
                แพทย์
              </Badge>
            )}
            {patient.with_ambulance === 'Y' && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Ambulance className="h-3 w-3" />
                รถพยาบาล
              </Badge>
            )}
          </div>
        </div>
      </CardContent>

      <style>{`
        .patient-card {
          overflow: hidden;
          border: 1px solid hsl(var(--border));
          transition: box-shadow 0.2s ease, transform 0.15s ease;
        }

        .patient-card:hover {
          box-shadow: 0 4px 12px -2px hsl(var(--muted) / 0.4);
          transform: translateY(-1px);
        }

        .patient-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 1rem 1rem 0.75rem;
          background: linear-gradient(135deg, hsl(var(--muted) / 0.15) 0%, hsl(var(--muted) / 0.05) 100%);
          border-bottom: 1px solid hsl(var(--border));
        }

        .patient-card-header-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          min-width: 0;
        }

        .patient-avatar {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2.5rem;
          height: 2.5rem;
          background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%);
          border-radius: 50%;
          font-size: 0.875rem;
          font-weight: 600;
          color: white;
          flex-shrink: 0;
        }

        .patient-name {
          font-size: 0.9375rem;
          font-weight: 600;
          color: hsl(var(--foreground));
          margin: 0;
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .patient-meta-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 0.25rem;
        }

        .patient-meta-text {
          font-size: 0.75rem;
          color: hsl(var(--muted-foreground));
        }

        .patient-card-body {
          padding: 0.75rem 1rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .patient-info-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8125rem;
        }

        .patient-info-label {
          color: hsl(var(--muted-foreground));
          min-width: 4.5rem;
          flex-shrink: 0;
        }

        .patient-info-value {
          color: hsl(var(--foreground));
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .escort-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.375rem;
          margin-top: 0.5rem;
          padding-top: 0.5rem;
          border-top: 1px solid hsl(var(--border));
        }
      `}</style>
    </Card>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-item">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value || '-'}</span>
    </div>
  );
}
