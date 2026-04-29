// =============================================================================
// Overview — entry page for the Refer Out Tracking dashboard.
// Switches between the executive dashboard view and the patient list view via
// shadcn Tabs. AGENT_RULES requires Overview.tsx to be the dashboard target;
// the two large views live in their own page modules and are imported here.
// =============================================================================

import { lazy, Suspense } from 'react';
import { LayoutDashboard, Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/layout/LoadingSpinner';

const ReferOutDashboard = lazy(() => import('@/pages/ReferOutDashboard'));
const ReferOutPatientList = lazy(() => import('@/pages/ReferOutPatientList'));

const FALLBACK = (
  <LoadingSpinner
    size="lg"
    message="กำลังโหลดข้อมูล..."
    className="min-h-[40vh]"
  />
);

export default function Overview() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="dashboard" className="space-y-4">
        <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6">
          <TabsList className="bg-slate-200/70 dark:bg-slate-800/60">
            <TabsTrigger value="dashboard" className="gap-2">
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              <span>แดชบอร์ดสรุป</span>
            </TabsTrigger>
            <TabsTrigger value="patients" className="gap-2">
              <Users className="h-4 w-4" aria-hidden="true" />
              <span>รายชื่อผู้ป่วย</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dashboard" className="mt-0">
          <Suspense fallback={FALLBACK}>
            <ReferOutDashboard />
          </Suspense>
        </TabsContent>

        <TabsContent value="patients" className="mt-0">
          <Suspense fallback={FALLBACK}>
            <ReferOutPatientList />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
