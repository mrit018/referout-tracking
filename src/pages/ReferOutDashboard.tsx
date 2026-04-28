// =============================================================================
// Refer Out Dashboard — ทะเบียนข้อมูลส่งผู้ป่วยไปโรงพยาบาล
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
  buildChwpartParams,
  buildDateRangeParams,
} from '@/services/referOutQueries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
} from 'lucide-react';
import type { DatabaseType } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TimeRange = 'today' | '7days' | '30days' | 'thisMonth' | 'thisYear' | 'custom';

interface ReferSummary {
  total_refer: number;
  in_province: number;
  in_zone5: number;
  out_zone5: number;
}

interface MonthlyTrend {
  month: string;
  total: number;
  in_province: number;
  in_zone5: number;
  out_zone5: number;
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
      return {
        start: `${y}-${m}-${d}`,
        end: `${y}-${m}-${d}`,
        label: 'วันนี้',
      };
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
      return {
        start: `${y}-${m}-01`,
        end: `${y}-${m}-${d}`,
        label: 'เดือนนี้',
      };
    case 'thisYear':
      return {
        start: `${y}-01-01`,
        end: `${y}-${m}-${d}`,
        label: 'ปีนี้',
      };
    default:
      return {
        start: `${y}-${m}-01`,
        end: `${y}-${m}-${d}`,
        label: 'เดือนนี้',
      };
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
// Zone helpers
// ---------------------------------------------------------------------------

function getZoneLabel(chwpart: string, currentChwpart: string): string {
  if (chwpart === currentChwpart) return 'ในจังหวัด';
  if (['70', '71', '76', '77'].includes(chwpart)) return 'นอกจังหวัดในเขต 5';
  return 'นอกเขต 5';
}

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
  // Load summary
  // -----------------------------------------------------------------
  const summaryQuery = useQuery({
    queryFn: async () => {
      if (!connectionConfig || !currentChwpart) throw new Error('Missing data');
      const days = daysBackFromRange(timeRange);
      const sql = getReferSummarySql(dbType, days);
      const params = buildDateRangeParams(currentChwpart);
      const res = await executeSqlViaApiQueued(sql, connectionConfig, params, marketplaceToken);
      const row = res.data?.[0] as Record<string, number> | undefined;
      return {
        total_refer: Number(row?.total_refer ?? 0),
        in_province: Number(row?.in_province ?? 0),
        in_zone5: Number(row?.in_zone5 ?? 0),
        out_zone5: Number(row?.out_zone5 ?? 0),
      } as ReferSummary;
    },
    enabled: !!connectionConfig && !!currentChwpart,
  });

  // -----------------------------------------------------------------
  // Load monthly trend
  // -----------------------------------------------------------------
  const trendQuery = useQuery({
    queryFn: async () => {
      if (!connectionConfig || !currentChwpart) throw new Error('Missing data');
      const sql = getMonthlyTrendSql(dbType, 12);
      const params = buildDateRangeParams(currentChwpart);
      const res = await executeSqlViaApiQueued(sql, connectionConfig, params, marketplaceToken);
      return (res.data ?? []) as unknown as MonthlyTrend[];
    },
    enabled: !!connectionConfig && !!currentChwpart,
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
  // Refresh all
  // -----------------------------------------------------------------
  const refreshAll = useCallback(() => {
    summaryQuery.execute();
    trendQuery.execute();
    emergencyQuery.execute();
    topDestQuery.execute();
  }, [summaryQuery, trendQuery, emergencyQuery, topDestQuery]);

  useEffect(() => {
    if (currentChwpart) {
      refreshAll();
    }
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
    { label: 'Top 10 โรงพยาบาลปลายทาง', sql: getTopDestinationsSql(dbType, days, 10) },
  ], [dbType, days]);

  const pieData = useMemo(() => {
    if (!summaryQuery.data) return [];
    return [
      { name: 'ในจังหวัด', value: summaryQuery.data.in_province, color: '#22c55e' },
      { name: 'นอกจังหวัดในเขต 5', value: summaryQuery.data.in_zone5, color: '#3b82f6' },
      { name: 'นอกเขต 5', value: summaryQuery.data.out_zone5, color: '#f59e0b' },
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

      {/* KPI Cards */}
      <div className="kpi-grid">
        <KpiCard
          title="จำนวนส่งต่อทั้งหมด"
          value={summaryQuery.data?.total_refer ?? 0}
          icon={<Activity className="h-5 w-5" />}
          color="primary"
          loading={summaryQuery.isLoading}
        />
        <KpiCard
          title="ส่งต่อในจังหวัด"
          value={summaryQuery.data?.in_province ?? 0}
          icon={<MapPin className="h-5 w-5" />}
          color="green"
          loading={summaryQuery.isLoading}
          subtitle={`${summaryQuery.data && summaryQuery.data.total_refer > 0
            ? Math.round((summaryQuery.data.in_province / summaryQuery.data.total_refer) * 100)
            : 0}% ของทั้งหมด`}
        />
        <KpiCard
          title="นอกจังหวัดในเขต 5"
          value={summaryQuery.data?.in_zone5 ?? 0}
          icon={<Building2 className="h-5 w-5" />}
          color="blue"
          loading={summaryQuery.isLoading}
          subtitle={`${summaryQuery.data && summaryQuery.data.total_refer > 0
            ? Math.round((summaryQuery.data.in_zone5 / summaryQuery.data.total_refer) * 100)
            : 0}% ของทั้งหมด`}
        />
        <KpiCard
          title="นอกเขต 5"
          value={summaryQuery.data?.out_zone5 ?? 0}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="amber"
          loading={summaryQuery.isLoading}
          subtitle={`${summaryQuery.data && summaryQuery.data.total_refer > 0
            ? Math.round((summaryQuery.data.out_zone5 / summaryQuery.data.total_refer) * 100)
            : 0}% ของทั้งหมด`}
        />
      </div>

      {/* Charts Row */}
      <div className="charts-grid">
        {/* Monthly Trend */}
        <Card className="chart-card">
          <CardHeader className="chart-header">
            <CardTitle className="chart-title">
              <TrendingUp className="h-5 w-5" />
              แนวโน้มการส่งต่อรายเดือน
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trendQuery.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : trendQuery.data && trendQuery.data.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={trendQuery.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Legend />
                  <Bar dataKey="in_province" name="ในจังหวัด" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="in_zone5" name="นอกจังหวัดในเขต 5" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="out_zone5" name="นอกเขต 5" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">ไม่พบข้อมูลการส่งต่อใน 12 เดือนล่าสุด</div>
            )}
          </CardContent>
        </Card>

        {/* Zone Distribution */}
        <Card className="chart-card">
          <CardHeader className="chart-header">
            <CardTitle className="chart-title">
              <PieChart className="h-5 w-5" />
              สัดส่วนการส่งต่อตามเขต
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summaryQuery.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">ไม่พบข้อมูล</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Emergency Type + Top Destinations */}
      <div className="charts-grid">
        {/* Emergency Breakdown */}
        <Card className="chart-card">
          <CardHeader className="chart-header">
            <CardTitle className="chart-title">
              <Siren className="h-5 w-5" />
              สัดส่วนตามระดับความเร่งด่วน
            </CardTitle>
          </CardHeader>
          <CardContent>
            {emergencyQuery.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : emergencyQuery.data && emergencyQuery.data.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={emergencyQuery.data} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="emergency_type" type="category" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">ไม่พบข้อมูล</div>
            )}
          </CardContent>
        </Card>

        {/* Top Destinations */}
        <Card className="chart-card">
          <CardHeader className="chart-header">
            <CardTitle className="chart-title">
              <Building2 className="h-5 w-5" />
              Top 10 โรงพยาบาลปลายทาง
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topDestQuery.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : topDestQuery.data && topDestQuery.data.length > 0 ? (
              <div className="top-dest-list">
                {topDestQuery.data.map((dest, i) => (
                  <div
                    key={dest.hospcode || i}
                    className="top-dest-item"
                    onClick={() => {}}
                    style={{ cursor: 'default' }}
                  >
                    <div className="top-dest-rank">{i + 1}</div>
                    <div className="top-dest-info">
                      <span className="top-dest-name">{dest.hospname || 'ไม่ระบุ'}</span>
                      <Badge variant="outline" className="text-xs">
                        {getZoneLabel(dest.chwpart, currentChwpart)}
                      </Badge>
                    </div>
                    <div className="top-dest-count">{dest.refer_count} ราย</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">ไม่พบข้อมูล</div>
            )}
          </CardContent>
        </Card>
      </div>

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

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(1, 1fr);
          gap: 1rem;
        }

        @media (min-width: 640px) {
          .kpi-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (min-width: 1024px) {
          .kpi-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }

        .charts-grid {
          display: grid;
          grid-template-columns: repeat(1, 1fr);
          gap: 1.5rem;
        }

        @media (min-width: 1024px) {
          .charts-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        .chart-card {
          overflow: hidden;
        }

        .chart-header {
          padding-bottom: 0.75rem;
        }

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

        .top-dest-item:hover {
          background: hsl(var(--muted) / 0.5);
        }

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
  color: 'primary' | 'green' | 'blue' | 'amber';
  loading: boolean;
  subtitle?: string;
}) {
  const colorMap = {
    primary: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    blue: 'bg-sky-50 text-sky-600 border-sky-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
  };

  return (
    <Card className={`border ${colorMap[color]}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-9 w-20 mt-2" />
            ) : (
              <p className="text-3xl font-bold mt-1">{value.toLocaleString('th-TH')}</p>
            )}
            {subtitle && !loading && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className={`p-2 rounded-lg ${colorMap[color].split(' ')[0]}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

