// =============================================================================
// Refer Out Dashboard — ระบบทะเบียนติดตามการส่งต่อผู้ป่วย (Refer Out)
// =============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useBmsSessionContext } from '@/contexts/BmsSessionContext';
import { useQuery } from '@/hooks/useQuery';
import { executeSqlViaApiQueued, getHospitalInfo } from '@/services/bmsSession';
import {
  getCurrentHospitalChwpartSql,
  getReferSummarySql,
  getMonthlyTrendSql,
  getTopDestinationsSql,
  getReferByEmergencyTypeSql,
  getSpTypeBreakdownSql,
  getIcd10TopSql,
  getReferCauseBreakdownSql,
  getReferBackSummarySql,
  getReferBackListSql,
  buildChwpartParams,
  buildDateRangeParams,
} from '@/services/referOutQueries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsTrigger, TabsList } from '@/components/ui/tabs';
import SqlPreviewDialog from '@/components/SqlPreviewDialog';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  ArrowRightLeft,
  MapPin,
  Building2,
  AlertTriangle,
  TrendingUp,
  Activity,
  Siren,
  Filter,
  RefreshCw,
  ChevronDown,
  Code2,
  Ambulance,
  HeartPulse,
  ArrowDownLeft,
  Stethoscope,
  Pill,
} from 'lucide-react';
import type { DatabaseType } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TimeRange = 'today' | '7days' | '30days' | 'thisMonth' | 'thisYear' | 'custom';

interface ReferSummary {
  total_refer: number;
  in_province: number;
  in_region: number;
  out_region: number;
  life_threat: number;
  with_ambulance: number;
  with_nurse: number;
}

interface MonthlyTrend {
  month: string;
  total: number;
  in_province: number;
  in_region: number;
  out_region: number;
}

interface TopDestination {
  hospcode: string;
  hospname: string;
  chwpart: string;
  refer_count: number;
}

interface EmergencyBreakdown {
  emergency_type: string;
  count: number;
}

interface SpTypeBreakdown {
  sp_type_name: string;
  count: number;
}

interface Icd10Top {
  icd10: string;
  pre_diagnosis: string;
  count: number;
}

interface CauseBreakdown {
  cause_name: string;
  count: number;
}

interface ReferBackSummary {
  total_referback: number;
  from_province: number;
  from_zone5: number;
  from_outside: number;
}

interface ReferBackRow {
  referin_number: string;
  refer_date: string;
  refer_time: string;
  hn: string;
  patient_name: string;
  icd10: string;
  pre_diagnosis: string;
  source_hospital: string;
  spclty: string;
}

interface DateRange {
  start: string;
  end: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Time-range helpers
// ---------------------------------------------------------------------------

function getDateRange(range: TimeRange, _dbType: DatabaseType): DateRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');

  switch (range) {
    case 'today':
      return { start: `${y}-${m}-${d}`, end: `${y}-${m}-${d}`, label: 'วันนี้' };
    case '7days': {
      const seven = new Date(now);
      seven.setDate(seven.getDate() - 6);
      return {
        start: `${seven.getFullYear()}-${String(seven.getMonth() + 1).padStart(2, '0')}-${String(seven.getDate()).padStart(2, '0')}`,
        end: `${y}-${m}-${d}`,
        label: '7 วันล่าสุด',
      };
    }
    case '30days': {
      const thirty = new Date(now);
      thirty.setDate(thirty.getDate() - 29);
      return {
        start: `${thirty.getFullYear()}-${String(thirty.getMonth() + 1).padStart(2, '0')}-${String(thirty.getDate()).padStart(2, '0')}`,
        end: `${y}-${m}-${d}`,
        label: '30 วันล่าสุด',
      };
    }
    case 'thisMonth':
      return { start: `${y}-${m}-01`, end: `${y}-${m}-${d}`, label: 'เดือนนี้' };
    case 'thisYear':
      return { start: `${y}-01-01`, end: `${y}-${m}-${d}`, label: 'ปีนี้' };
    default:
      return { start: `${y}-${m}-01`, end: `${y}-${m}-${d}`, label: 'เดือนนี้' };
  }
}

function daysBackFromRange(range: TimeRange): number {
  switch (range) {
    case 'today': return 0;
    case '7days': return 7;
    case '30days': return 30;
    case 'thisMonth': return 30;
    case 'thisYear': return 365;
    default: return 30;
  }
}

// ---------------------------------------------------------------------------
// Geography label helper
// ---------------------------------------------------------------------------

const GEO_COLORS = {
  in_province: '#22c55e',
  in_region: '#3b82f6',
  out_region: '#f59e0b',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ReferOutDashboard() {
  const { session, connectionConfig, marketplaceToken } = useBmsSessionContext();
  const dbType = session?.databaseType ?? 'mysql';
  const [timeRange, setTimeRange] = useState<TimeRange>('thisMonth');
  const [currentChwpart, setCurrentChwpart] = useState<string>('');
  const [hospitalName, setHospitalName] = useState<string>('');
  const [showSql, setShowSql] = useState(false);

  // -----------------------------------------------------------------
  // Load current hospital info
  // -----------------------------------------------------------------
  const hospitalInfoQuery = useQuery({
    queryFn: async () => {
      if (!connectionConfig) throw new Error('No connection');
      return getHospitalInfo(connectionConfig);
    },
    enabled: !!connectionConfig,
  });

  useEffect(() => {
    if (hospitalInfoQuery.data) {
      setHospitalName(hospitalInfoQuery.data.hospitalName);
    }
  }, [hospitalInfoQuery.data]);

  // -----------------------------------------------------------------
  // Load current hospital chwpart
  // -----------------------------------------------------------------
  const chwpartQuery = useQuery({
    queryFn: async () => {
      if (!connectionConfig || !hospitalInfoQuery.data?.hospitalCode) {
        throw new Error('Missing connection or hospital code');
      }
      const sql = getCurrentHospitalChwpartSql();
      const params = buildChwpartParams(hospitalInfoQuery.data.hospitalCode, '');
      delete params.current_chwpart;
      const res = await executeSqlViaApiQueued(sql, connectionConfig, params, marketplaceToken);
      return (res.data?.[0]?.chwpart as string) ?? '';
    },
    enabled: !!connectionConfig && !!hospitalInfoQuery.data?.hospitalCode,
  });

  useEffect(() => {
    if (chwpartQuery.data) {
      setCurrentChwpart(chwpartQuery.data);
    }
  }, [chwpartQuery.data]);

  // -----------------------------------------------------------------
  // Load summary KPI
  // -----------------------------------------------------------------
  const summaryQuery = useQuery({
    queryFn: async () => {
      if (!connectionConfig) throw new Error('Missing data');
      const days = daysBackFromRange(timeRange);
      const sql = getReferSummarySql(dbType, days);
      const res = await executeSqlViaApiQueued(sql, connectionConfig, undefined, marketplaceToken);
      const row = res.data?.[0] as Record<string, number> | undefined;
      return {
        total_refer: Number(row?.total_refer ?? 0),
        in_province: Number(row?.in_province ?? 0),
        in_region: Number(row?.in_region ?? 0),
        out_region: Number(row?.out_region ?? 0),
        life_threat: Number(row?.life_threat ?? 0),
        with_ambulance: Number(row?.with_ambulance ?? 0),
        with_nurse: Number(row?.with_nurse ?? 0),
      } as ReferSummary;
    },
    enabled: !!connectionConfig,
  });

  // -----------------------------------------------------------------
  // Load monthly trend
  // -----------------------------------------------------------------
  const trendQuery = useQuery({
    queryFn: async () => {
      if (!connectionConfig) throw new Error('Missing data');
      const sql = getMonthlyTrendSql(dbType, 12);
      const res = await executeSqlViaApiQueued(sql, connectionConfig, undefined, marketplaceToken);
      return (res.data ?? []) as unknown as MonthlyTrend[];
    },
    enabled: !!connectionConfig,
  });

  // -----------------------------------------------------------------
  // Load emergency breakdown
  // -----------------------------------------------------------------
  const emergencyQuery = useQuery({
    queryFn: async () => {
      if (!connectionConfig) throw new Error('Missing data');
      const days = daysBackFromRange(timeRange);
      const sql = getReferByEmergencyTypeSql(dbType, days);
      const res = await executeSqlViaApiQueued(sql, connectionConfig, undefined, marketplaceToken);
      return (res.data ?? []) as unknown as EmergencyBreakdown[];
    },
    enabled: !!connectionConfig,
  });

  // -----------------------------------------------------------------
  // Load top destinations
  // -----------------------------------------------------------------
  const topDestQuery = useQuery({
    queryFn: async () => {
      if (!connectionConfig) throw new Error('Missing data');
      const days = daysBackFromRange(timeRange);
      const sql = getTopDestinationsSql(dbType, days, 10);
      const res = await executeSqlViaApiQueued(sql, connectionConfig, undefined, marketplaceToken);
      return (res.data ?? []) as unknown as TopDestination[];
    },
    enabled: !!connectionConfig,
  });

  // -----------------------------------------------------------------
  // Load SERVICE PLAN breakdown
  // -----------------------------------------------------------------
  const spTypeQuery = useQuery({
    queryFn: async () => {
      if (!connectionConfig) throw new Error('Missing data');
      const days = daysBackFromRange(timeRange);
      const sql = getSpTypeBreakdownSql(dbType, days);
      const res = await executeSqlViaApiQueued(sql, connectionConfig, undefined, marketplaceToken);
      return (res.data ?? []) as unknown as SpTypeBreakdown[];
    },
    enabled: !!connectionConfig,
  });

  // -----------------------------------------------------------------
  // Load ICD-10 top
  // -----------------------------------------------------------------
  const icd10Query = useQuery({
    queryFn: async () => {
      if (!connectionConfig) throw new Error('Missing data');
      const days = daysBackFromRange(timeRange);
      const sql = getIcd10TopSql(dbType, days, 10);
      const res = await executeSqlViaApiQueued(sql, connectionConfig, undefined, marketplaceToken);
      return (res.data ?? []) as unknown as Icd10Top[];
    },
    enabled: !!connectionConfig,
  });

  // -----------------------------------------------------------------
  // Load cause breakdown
  // -----------------------------------------------------------------
  const causeQuery = useQuery({
    queryFn: async () => {
      if (!connectionConfig) throw new Error('Missing data');
      const days = daysBackFromRange(timeRange);
      const sql = getReferCauseBreakdownSql(dbType, days);
      const res = await executeSqlViaApiQueued(sql, connectionConfig, undefined, marketplaceToken);
      return (res.data ?? []) as unknown as CauseBreakdown[];
    },
    enabled: !!connectionConfig,
  });

  // -----------------------------------------------------------------
  // Load Refer Back summary
  // -----------------------------------------------------------------
  const referBackSummaryQuery = useQuery({
    queryFn: async () => {
      if (!connectionConfig || !currentChwpart) throw new Error('Missing data');
      const days = daysBackFromRange(timeRange);
      const sql = getReferBackSummarySql(dbType, days);
      const params = buildDateRangeParams(currentChwpart);
      const res = await executeSqlViaApiQueued(sql, connectionConfig, params, marketplaceToken);
      const row = res.data?.[0] as Record<string, number> | undefined;
      return {
        total_referback: Number(row?.total_referback ?? 0),
        from_province: Number(row?.from_province ?? 0),
        from_zone5: Number(row?.from_zone5 ?? 0),
        from_outside: Number(row?.from_outside ?? 0),
      } as ReferBackSummary;
    },
    enabled: !!connectionConfig && !!currentChwpart,
  });

  // -----------------------------------------------------------------
  // Load Refer Back detail list
  // -----------------------------------------------------------------
  const referBackListQuery = useQuery({
    queryFn: async () => {
      if (!connectionConfig) throw new Error('Missing data');
      const days = daysBackFromRange(timeRange);
      const sql = getReferBackListSql(dbType, days, 50);
      const res = await executeSqlViaApiQueued(sql, connectionConfig, undefined, marketplaceToken);
      return (res.data ?? []) as unknown as ReferBackRow[];
    },
    enabled: !!connectionConfig,
  });

  // -----------------------------------------------------------------
  // Refresh all
  // -----------------------------------------------------------------
  const refreshAll = useCallback(() => {
    summaryQuery.execute();
    trendQuery.execute();
    emergencyQuery.execute();
    topDestQuery.execute();
    spTypeQuery.execute();
    icd10Query.execute();
    causeQuery.execute();
    referBackSummaryQuery.execute();
    referBackListQuery.execute();
  }, [summaryQuery, trendQuery, emergencyQuery, topDestQuery, spTypeQuery, icd10Query, causeQuery, referBackSummaryQuery, referBackListQuery]);

  useEffect(() => {
    refreshAll();
  }, [timeRange, currentChwpart]);

  // -----------------------------------------------------------------
  // Derived data
  // -----------------------------------------------------------------
  const dateRange = useMemo(() => getDateRange(timeRange, dbType), [timeRange, dbType]);
  const days = daysBackFromRange(timeRange);

  const sqlQueries = useMemo(() => [
    { label: 'จังหวัดของโรงพยาบาล', sql: getCurrentHospitalChwpartSql() },
    { label: 'สรุปจำนวนส่งต่อ', sql: getReferSummarySql(dbType, days) },
    { label: 'แนวโน้มรายเดือน (12 เดือน)', sql: getMonthlyTrendSql(dbType, 12) },
    { label: 'สัดส่วนตามระดับเร่งด่วน', sql: getReferByEmergencyTypeSql(dbType, days) },
    { label: 'สาขา SERVICE PLAN', sql: getSpTypeBreakdownSql(dbType, days) },
    { label: 'ICD-10 Top 10', sql: getIcd10TopSql(dbType, days, 10) },
    { label: 'สาเหตุการส่งต่อ', sql: getReferCauseBreakdownSql(dbType, days) },
    { label: 'Top 10 โรงพยาบาลปลายทาง', sql: getTopDestinationsSql(dbType, days, 10) },
    { label: 'Refer Back สรุป', sql: getReferBackSummarySql(dbType, days) },
  ], [dbType, days]);

  const pieData = useMemo(() => {
    if (!summaryQuery.data) return [];
    return [
      { name: 'ในจังหวัด', value: summaryQuery.data.in_province, color: GEO_COLORS.in_province },
      { name: 'ในเขต', value: summaryQuery.data.in_region, color: GEO_COLORS.in_region },
      { name: 'นอกเขต', value: summaryQuery.data.out_region, color: GEO_COLORS.out_region },
    ].filter((d) => d.value > 0);
  }, [summaryQuery.data]);

  // -----------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------
  const isLoading =
    summaryQuery.isLoading ||
    trendQuery.isLoading ||
    emergencyQuery.isLoading ||
    topDestQuery.isLoading;

  return (
    <div className="refer-out-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">
            <ArrowRightLeft className="h-6 w-6" />
            ทะเบียนข้อมูลส่งผู้ป่วยไปโรงพยาบาล
          </h1>
          <p className="dashboard-subtitle">
            {hospitalName ? `${hospitalName} · ` : ''}
            ข้อมูลล่าสุด: {dateRange.label}
          </p>
        </div>
        <div className="dashboard-actions">
          <Button variant="outline" size="sm" onClick={() => setShowSql(true)} className="gap-1.5">
            <Code2 className="h-4 w-4" />
            SQL
          </Button>
          <div className="time-filter">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="time-filter-select"
            >
              <option value="today">วันนี้</option>
              <option value="7days">7 วันล่าสุด</option>
              <option value="30days">30 วันล่าสุด</option>
              <option value="thisMonth">เดือนนี้</option>
              <option value="thisYear">ปีนี้</option>
            </select>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
          <Button variant="outline" size="sm" onClick={refreshAll} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* SECTION 1: KPI Cards — 7 cards (3 geography + 4 operational)      */}
      {/* ================================================================= */}
      <div className="kpi-grid-7">
        <KpiCard title="จำนวนส่งต่อทั้งหมด" value={summaryQuery.data?.total_refer ?? 0} icon={<Activity className="h-5 w-5" />} color="primary" loading={summaryQuery.isLoading} />
        <KpiCard title="ส่งต่อในจังหวัด" value={summaryQuery.data?.in_province ?? 0} icon={<MapPin className="h-5 w-5" />} color="green" loading={summaryQuery.isLoading}
          subtitle={`${summaryQuery.data && summaryQuery.data.total_refer > 0 ? Math.round((summaryQuery.data.in_province / summaryQuery.data.total_refer) * 100) : 0}% ของทั้งหมด`} />
        <KpiCard title="ส่งต่อในเขต" value={summaryQuery.data?.in_region ?? 0} icon={<Building2 className="h-5 w-5" />} color="blue" loading={summaryQuery.isLoading}
          subtitle={`${summaryQuery.data && summaryQuery.data.total_refer > 0 ? Math.round((summaryQuery.data.in_region / summaryQuery.data.total_refer) * 100) : 0}% ของทั้งหมด`} />
        <KpiCard title="ส่งต่อนอกเขต" value={summaryQuery.data?.out_region ?? 0} icon={<AlertTriangle className="h-5 w-5" />} color="amber" loading={summaryQuery.isLoading}
          subtitle={`${summaryQuery.data && summaryQuery.data.total_refer > 0 ? Math.round((summaryQuery.data.out_region / summaryQuery.data.total_refer) * 100) : 0}% ของทั้งหมด`} />
        <KpiCard title="คุกคามชีวิต" value={summaryQuery.data?.life_threat ?? 0} icon={<Siren className="h-5 w-5" />} color="red" loading={summaryQuery.isLoading} />
        <KpiCard title="ใช้รถพยาบาล" value={summaryQuery.data?.with_ambulance ?? 0} icon={<Ambulance className="h-5 w-5" />} color="purple" loading={summaryQuery.isLoading} />
        <KpiCard title="มีพยาบาลร่วม" value={summaryQuery.data?.with_nurse ?? 0} icon={<HeartPulse className="h-5 w-5" />} color="pink" loading={summaryQuery.isLoading} />
      </div>

      {/* ================================================================= */}
      {/* SECTION 2-4: Tabbed Refer Out by Geography + Refer Back           */}
      {/* ================================================================= */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="overview" className="gap-1.5">
            <TrendingUp className="h-4 w-4" /> ภาพรวม
          </TabsTrigger>
          <TabsTrigger value="in-province" className="gap-1.5">
            <MapPin className="h-4 w-4" /> ในจังหวัด
          </TabsTrigger>
          <TabsTrigger value="in-region" className="gap-1.5">
            <Building2 className="h-4 w-4" /> ในเขต
          </TabsTrigger>
          <TabsTrigger value="out-region" className="gap-1.5">
            <AlertTriangle className="h-4 w-4" /> นอกเขต
          </TabsTrigger>
          <TabsTrigger value="refer-back" className="gap-1.5">
            <ArrowDownLeft className="h-4 w-4" /> Refer Back
          </TabsTrigger>
        </TabsList>

        {/* ---- Overview Tab ---- */}
        <TabsContent value="overview" className="mt-4 space-y-6">
          {/* Charts Row 1: Trend + Zone Pie */}
          <div className="charts-grid">
            <Card className="chart-card">
              <CardHeader className="chart-header">
                <CardTitle className="chart-title"><TrendingUp className="h-5 w-5" /> แนวโน้มการส่งต่อรายเดือน</CardTitle>
              </CardHeader>
              <CardContent>
                {trendQuery.isLoading ? <Skeleton className="h-64 w-full" /> : trendQuery.data && trendQuery.data.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={trendQuery.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
                      <Legend />
                      <Bar dataKey="in_province" name="ในจังหวัด" fill={GEO_COLORS.in_province} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="in_region" name="ในเขต" fill={GEO_COLORS.in_region} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="out_region" name="นอกเขต" fill={GEO_COLORS.out_region} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="empty-state">ไม่พบข้อมูลการส่งต่อใน 12 เดือนล่าสุด</div>}
              </CardContent>
            </Card>

            <Card className="chart-card">
              <CardHeader className="chart-header">
                <CardTitle className="chart-title">สัดส่วนการส่งต่อตามเขต</CardTitle>
              </CardHeader>
              <CardContent>
                {summaryQuery.isLoading ? <Skeleton className="h-64 w-full" /> : pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value"
                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                        {pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div className="empty-state">ไม่พบข้อมูล</div>}
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2: Emergency + SERVICE PLAN */}
          <div className="charts-grid">
            <Card className="chart-card">
              <CardHeader className="chart-header">
                <CardTitle className="chart-title"><Siren className="h-5 w-5" /> ระดับความเร่งด่วน</CardTitle>
              </CardHeader>
              <CardContent>
                {emergencyQuery.isLoading ? <Skeleton className="h-64 w-full" /> : emergencyQuery.data && emergencyQuery.data.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={emergencyQuery.data} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis dataKey="emergency_type" type="category" tick={{ fontSize: 11 }} width={120} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
                      <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="empty-state">ไม่พบข้อมูล</div>}
              </CardContent>
            </Card>

            <Card className="chart-card">
              <CardHeader className="chart-header">
                <CardTitle className="chart-title"><Stethoscope className="h-5 w-5" /> สาขา SERVICE PLAN</CardTitle>
              </CardHeader>
              <CardContent>
                {spTypeQuery.isLoading ? <Skeleton className="h-64 w-full" /> : spTypeQuery.data && spTypeQuery.data.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={spTypeQuery.data} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis dataKey="sp_type_name" type="category" tick={{ fontSize: 11 }} width={140} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="empty-state">ไม่พบข้อมูล</div>}
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 3: ICD-10 + Cause + Top Destinations */}
          <div className="charts-grid-3">
            <Card className="chart-card">
              <CardHeader className="chart-header">
                <CardTitle className="chart-title"><Pill className="h-5 w-5" /> ICD-10 Top 10 รหัสโรค</CardTitle>
              </CardHeader>
              <CardContent>
                {icd10Query.isLoading ? <Skeleton className="h-64 w-full" /> : icd10Query.data && icd10Query.data.length > 0 ? (
                  <div className="icd-list">
                    {icd10Query.data.map((item, i) => (
                      <div key={i} className="icd-item">
                        <div className="icd-rank">{i + 1}</div>
                        <div className="icd-info">
                          <span className="icd-code">{item.icd10}</span>
                          <span className="icd-desc">{item.pre_diagnosis || '-'}</span>
                        </div>
                        <div className="icd-count">{item.count} ราย</div>
                      </div>
                    ))}
                  </div>
                ) : <div className="empty-state">ไม่พบข้อมูล ICD-10</div>}
              </CardContent>
            </Card>

            <Card className="chart-card">
              <CardHeader className="chart-header">
                <CardTitle className="chart-title">สาเหตุการส่งต่อ</CardTitle>
              </CardHeader>
              <CardContent>
                {causeQuery.isLoading ? <Skeleton className="h-64 w-full" /> : causeQuery.data && causeQuery.data.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={causeQuery.data} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis dataKey="cause_name" type="category" tick={{ fontSize: 11 }} width={160} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
                      <Bar dataKey="count" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="empty-state">ไม่พบข้อมูล</div>}
              </CardContent>
            </Card>

            <Card className="chart-card">
              <CardHeader className="chart-header">
                <CardTitle className="chart-title"><Building2 className="h-5 w-5" /> Top 10 รพ.ปลายทาง</CardTitle>
              </CardHeader>
              <CardContent>
                {topDestQuery.isLoading ? <Skeleton className="h-64 w-full" /> : topDestQuery.data && topDestQuery.data.length > 0 ? (
                  <div className="top-dest-list">
                    {topDestQuery.data.map((dest, i) => (
                      <div key={dest.hospcode || i} className="top-dest-item">
                        <div className="top-dest-rank">{i + 1}</div>
                        <div className="top-dest-info">
                          <span className="top-dest-name">{dest.hospname || 'ไม่ระบุ'}</span>
                        </div>
                        <div className="top-dest-count">{dest.refer_count} ราย</div>
                      </div>
                    ))}
                  </div>
                ) : <div className="empty-state">ไม่พบข้อมูล</div>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---- Refer Back Tab ---- */}
        <TabsContent value="refer-back" className="mt-4 space-y-6">
          {/* Refer Back KPI */}
          <div className="kpi-grid-4">
            <KpiCard title="Refer Back ทั้งหมด" value={referBackSummaryQuery.data?.total_referback ?? 0} icon={<ArrowDownLeft className="h-5 w-5" />} color="teal" loading={referBackSummaryQuery.isLoading} />
            <KpiCard title="จากในจังหวัด" value={referBackSummaryQuery.data?.from_province ?? 0} icon={<MapPin className="h-5 w-5" />} color="green" loading={referBackSummaryQuery.isLoading} />
            <KpiCard title="จากในเขต" value={referBackSummaryQuery.data?.from_zone5 ?? 0} icon={<Building2 className="h-5 w-5" />} color="blue" loading={referBackSummaryQuery.isLoading} />
            <KpiCard title="จากนอกเขต" value={referBackSummaryQuery.data?.from_outside ?? 0} icon={<AlertTriangle className="h-5 w-5" />} color="amber" loading={referBackSummaryQuery.isLoading} />
          </div>

          {/* Refer Back List */}
          <Card>
            <CardHeader className="chart-header">
              <CardTitle className="chart-title">รายการ Refer Back ล่าสุด</CardTitle>
            </CardHeader>
            <CardContent>
              {referBackListQuery.isLoading ? <Skeleton className="h-64 w-full" /> : referBackListQuery.data && referBackListQuery.data.length > 0 ? (
                <div className="refer-back-table-wrap">
                  <table className="refer-back-table">
                    <thead>
                      <tr>
                        <th>เลขที่</th>
                        <th>วันที่</th>
                        <th>HN</th>
                        <th>ชื่อผู้ป่วย</th>
                        <th>ICD-10</th>
                        <th>การวินิจฉัย</th>
                        <th>รพ.ต้นทาง</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referBackListQuery.data.map((row, i) => (
                        <tr key={i}>
                          <td>{row.referin_number || '-'}</td>
                          <td>{row.refer_date || '-'}</td>
                          <td>{row.hn || '-'}</td>
                          <td>{row.patient_name || '-'}</td>
                          <td><Badge variant="outline">{row.icd10 || '-'}</Badge></td>
                          <td>{row.pre_diagnosis || '-'}</td>
                          <td>{row.source_hospital || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div className="empty-state">ไม่พบข้อมูล Refer Back</div>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Placeholder tabs for geography-filtered views ---- */}
        {(['in-province', 'in-region', 'out-region'] as const).map((tab) => {
          const tabConfig = {
            'in-province': { label: 'ในจังหวัด', filter: 'ในจังหวัด', color: GEO_COLORS.in_province },
            'in-region': { label: 'ในเขต', filter: 'ในเขต', color: GEO_COLORS.in_region },
            'out-region': { label: 'นอกเขต', filter: 'นอกเขต', color: GEO_COLORS.out_region },
          }[tab];

          const filteredCount = tab === 'in-province'
            ? (summaryQuery.data?.in_province ?? 0)
            : tab === 'in-region'
              ? (summaryQuery.data?.in_region ?? 0)
              : (summaryQuery.data?.out_region ?? 0);

          return (
            <TabsContent key={tab} value={tab} className="mt-4 space-y-6">
              <Card>
                <CardHeader className="chart-header">
                  <CardTitle className="chart-title">
                    Refer Out {tabConfig.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="section-summary">
                    <div className="section-summary-item">
                      <span className="section-summary-label">จำนวนทั้งหมด</span>
                      <span className="section-summary-value" style={{ color: tabConfig.color }}>
                        {filteredCount.toLocaleString('th-TH')} ราย
                      </span>
                    </div>
                    {summaryQuery.data && summaryQuery.data.total_refer > 0 && (
                      <div className="section-summary-item">
                        <span className="section-summary-label">สัดส่วน</span>
                        <span className="section-summary-value">
                          {Math.round((filteredCount / summaryQuery.data.total_refer) * 100)}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* SERVICE PLAN breakdown for this section */}
                  {spTypeQuery.data && spTypeQuery.data.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold mb-2">สาขา SERVICE PLAN</h4>
                      <div className="sp-type-grid">
                        {spTypeQuery.data.map((sp, i) => (
                          <div key={i} className="sp-type-item">
                            <span className="sp-type-name">{sp.sp_type_name}</span>
                            <span className="sp-type-count">{sp.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ICD-10 for this section */}
                  {icd10Query.data && icd10Query.data.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold mb-2">ICD-10 ที่พบบ่อย</h4>
                      <div className="icd-mini-grid">
                        {icd10Query.data.map((item, i) => (
                          <div key={i} className="icd-mini-item">
                            <Badge variant="outline" className="text-xs">{item.icd10}</Badge>
                            <span className="text-xs text-muted-foreground">{item.pre_diagnosis || '-'}</span>
                            <span className="text-xs font-medium">{item.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Causes for this section */}
                  {causeQuery.data && causeQuery.data.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold mb-2">สาเหตุการส่งต่อ</h4>
                      <div className="cause-grid">
                        {causeQuery.data.map((c, i) => (
                          <div key={i} className="cause-item">
                            <span className="cause-name">{c.cause_name}</span>
                            <span className="cause-count">{c.count} ราย</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      {/* SQL Preview */}
      <SqlPreviewDialog open={showSql} onOpenChange={setShowSql} queries={sqlQueries} />

      {/* Styles */}
      <style>{`
        .refer-out-dashboard {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .dashboard-header {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        @media (min-width: 768px) {
          .dashboard-header {
            flex-direction: row;
            align-items: flex-end;
            justify-content: space-between;
          }
        }

        .dashboard-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 1.5rem;
          font-weight: 700;
          color: hsl(var(--foreground));
          margin: 0;
        }

        .dashboard-subtitle {
          font-size: 0.875rem;
          color: hsl(var(--muted-foreground));
          margin: 0.25rem 0 0;
        }

        .dashboard-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .time-filter {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: hsl(var(--background));
          border: 1px solid hsl(var(--border));
          border-radius: 0.5rem;
        }

        .time-filter-select {
          background: transparent;
          border: none;
          font-size: 0.875rem;
          font-weight: 500;
          color: hsl(var(--foreground));
          cursor: pointer;
          outline: none;
        }

        .kpi-grid-7 {
          display: grid;
          grid-template-columns: repeat(1, 1fr);
          gap: 0.75rem;
        }

        @media (min-width: 640px) {
          .kpi-grid-7 { grid-template-columns: repeat(2, 1fr); }
        }

        @media (min-width: 1024px) {
          .kpi-grid-7 { grid-template-columns: repeat(4, 1fr); }
        }

        @media (min-width: 1280px) {
          .kpi-grid-7 { grid-template-columns: repeat(7, 1fr); }
        }

        .kpi-grid-4 {
          display: grid;
          grid-template-columns: repeat(1, 1fr);
          gap: 0.75rem;
        }

        @media (min-width: 640px) {
          .kpi-grid-4 { grid-template-columns: repeat(2, 1fr); }
        }

        @media (min-width: 1024px) {
          .kpi-grid-4 { grid-template-columns: repeat(4, 1fr); }
        }

        .charts-grid {
          display: grid;
          grid-template-columns: repeat(1, 1fr);
          gap: 1.5rem;
        }

        @media (min-width: 1024px) {
          .charts-grid { grid-template-columns: repeat(2, 1fr); }
        }

        .charts-grid-3 {
          display: grid;
          grid-template-columns: repeat(1, 1fr);
          gap: 1.5rem;
        }

        @media (min-width: 1280px) {
          .charts-grid-3 { grid-template-columns: repeat(3, 1fr); }
        }

        .chart-card { overflow: hidden; }
        .chart-header { padding-bottom: 0.75rem; }

        .chart-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1rem;
          font-weight: 600;
        }

        .empty-state {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 280px;
          color: hsl(var(--muted-foreground));
          font-size: 0.875rem;
        }

        .top-dest-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-height: 280px;
          overflow-y: auto;
        }

        .top-dest-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.625rem 0.75rem;
          border-radius: 0.5rem;
          background: hsl(var(--muted) / 0.3);
          transition: background 0.15s ease;
        }

        .top-dest-item:hover { background: hsl(var(--muted) / 0.5); }

        .top-dest-rank {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 1.75rem;
          height: 1.75rem;
          background: linear-gradient(135deg, #60a5fa, #a78bfa);
          border-radius: 0.375rem;
          font-size: 0.75rem;
          font-weight: 700;
          color: white;
          flex-shrink: 0;
        }

        .top-dest-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .top-dest-name {
          font-size: 0.875rem;
          font-weight: 500;
          color: hsl(var(--foreground));
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .top-dest-count {
          font-size: 0.875rem;
          font-weight: 600;
          color: hsl(var(--foreground));
          flex-shrink: 0;
        }

        .icd-list {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
          max-height: 280px;
          overflow-y: auto;
        }

        .icd-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.625rem;
          border-radius: 0.375rem;
          background: hsl(var(--muted) / 0.2);
        }

        .icd-rank {
          width: 1.5rem;
          height: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #ef4444;
          color: white;
          font-size: 0.625rem;
          font-weight: 700;
          flex-shrink: 0;
        }

        .icd-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .icd-code {
          font-size: 0.8rem;
          font-weight: 700;
          color: hsl(var(--foreground));
        }

        .icd-desc {
          font-size: 0.7rem;
          color: hsl(var(--muted-foreground));
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .icd-count {
          font-size: 0.8rem;
          font-weight: 600;
          flex-shrink: 0;
        }

        .section-summary {
          display: flex;
          gap: 2rem;
          padding: 1rem;
          background: hsl(var(--muted) / 0.3);
          border-radius: 0.5rem;
        }

        .section-summary-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .section-summary-label {
          font-size: 0.75rem;
          color: hsl(var(--muted-foreground));
        }

        .section-summary-value {
          font-size: 1.5rem;
          font-weight: 700;
        }

        .sp-type-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 0.5rem;
        }

        .sp-type-item {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem 0.75rem;
          border-radius: 0.375rem;
          background: hsl(var(--muted) / 0.3);
          font-size: 0.8rem;
        }

        .sp-type-name { color: hsl(var(--foreground)); }
        .sp-type-count { font-weight: 600; }

        .icd-mini-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 0.5rem;
        }

        .icd-mini-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.375rem 0.5rem;
          border-radius: 0.375rem;
          background: hsl(var(--muted) / 0.2);
        }

        .cause-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 0.5rem;
        }

        .cause-item {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem 0.75rem;
          border-radius: 0.375rem;
          background: hsl(var(--muted) / 0.3);
          font-size: 0.8rem;
        }

        .cause-name { color: hsl(var(--foreground)); }
        .cause-count { font-weight: 600; }

        .refer-back-table-wrap {
          overflow-x: auto;
        }

        .refer-back-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8rem;
        }

        .refer-back-table th {
          padding: 0.5rem 0.75rem;
          text-align: left;
          font-weight: 600;
          color: hsl(var(--muted-foreground));
          border-bottom: 1px solid hsl(var(--border));
          white-space: nowrap;
        }

        .refer-back-table td {
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid hsl(var(--border) / 0.5);
          white-space: nowrap;
        }

        .refer-back-table tr:hover td {
          background: hsl(var(--muted) / 0.3);
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({
  title,
  value,
  icon,
  color,
  loading,
  subtitle,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'primary' | 'green' | 'blue' | 'amber' | 'red' | 'purple' | 'pink' | 'teal';
  loading: boolean;
  subtitle?: string;
}) {
  const colorMap = {
    primary: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    blue: 'bg-sky-50 text-sky-600 border-sky-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    pink: 'bg-pink-50 text-pink-600 border-pink-200',
    teal: 'bg-teal-50 text-teal-600 border-teal-200',
  };

  return (
    <Card className={`border ${colorMap[color]}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-16 mt-1" />
            ) : (
              <p className="text-2xl font-bold mt-0.5">{value.toLocaleString('th-TH')}</p>
            )}
            {subtitle && !loading && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className={`p-1.5 rounded-lg ${colorMap[color].split(' ')[0]}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
