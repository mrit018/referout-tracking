import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { BmsSessionProvider } from '@/contexts/BmsSessionContext'
import { NotificationsProvider } from '@/contexts/NotificationsContext'
import { Toasts } from '@/components/ui/Toasts'
import { SessionValidator } from '@/components/session/SessionValidator'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'
import { AppLayout } from '@/components/layout/AppLayout'

const ReferOutDashboard = lazy(() => import('@/pages/ReferOutDashboard'))
const ReferOutPatientList = lazy(() => import('@/pages/ReferOutPatientList'))

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner size="lg" message="กำลังโหลดหน้า..." className="min-h-[50vh]" />}>
      <Routes>
        <Route path="/" element={<ReferOutDashboard />} />
        <Route path="/patients" element={<ReferOutPatientList />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <NotificationsProvider>
        <BmsSessionProvider>
          <SessionValidator>
            <AppLayout>
              <AppRoutes />
            </AppLayout>
          </SessionValidator>
          <Toasts />
        </BmsSessionProvider>
      </NotificationsProvider>
    </BrowserRouter>
  )
}
