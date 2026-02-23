import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppLayout } from './layout/AppLayout'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { AuthProvider } from '../features/auth/AuthContext'
import { AuthPage } from '../features/auth/AuthPage'

const DashboardPage = lazy(async () => {
  const module = await import('../features/dashboard/DashboardPage')
  return {
    default: module.DashboardPage,
  }
})

const MetricsPage = lazy(async () => {
  const module = await import('../features/metrics/MetricsPage')
  return {
    default: module.MetricsPage,
  }
})

const OutcomesPage = lazy(async () => {
  const module = await import('../features/outcomes/OutcomesPage')
  return {
    default: module.OutcomesPage,
  }
})

const OutcomeDetailPage = lazy(async () => {
  const module = await import('../features/outcomes/OutcomeDetailPage')
  return {
    default: module.OutcomeDetailPage,
  }
})

const SkillDetailPage = lazy(async () => {
  const module = await import('../features/skills/SkillDetailPage')
  return {
    default: module.SkillDetailPage,
  }
})

const WeeklyReviewPage = lazy(async () => {
  const module = await import('../features/review/WeeklyReviewPage')
  return {
    default: module.WeeklyReviewPage,
  }
})

const SettingsPage = lazy(async () => {
  const module = await import('../features/settings/SettingsPage')
  return {
    default: module.SettingsPage,
  }
})

function routeLoadingFallback() {
  return <main className="auth-shell">Loading page...</main>
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AuthPage />} path="/auth" />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route
                element={<Suspense fallback={routeLoadingFallback()}><DashboardPage /></Suspense>}
                index
                path="/"
              />
              <Route
                element={<Suspense fallback={routeLoadingFallback()}><OutcomesPage /></Suspense>}
                path="/outcomes"
              />
              <Route
                element={<Suspense fallback={routeLoadingFallback()}><OutcomeDetailPage /></Suspense>}
                path="/outcomes/:outcomeId"
              />
              <Route
                element={<Suspense fallback={routeLoadingFallback()}><SkillDetailPage /></Suspense>}
                path="/outcomes/:outcomeId/skills/:skillId"
              />
              <Route
                element={<Suspense fallback={routeLoadingFallback()}><MetricsPage /></Suspense>}
                path="/metrics"
              />
              <Route
                element={<Suspense fallback={routeLoadingFallback()}><WeeklyReviewPage /></Suspense>}
                path="/weekly-review"
              />
              <Route
                element={<Suspense fallback={routeLoadingFallback()}><SettingsPage /></Suspense>}
                path="/settings"
              />
            </Route>
          </Route>

          <Route element={<Navigate replace to="/" />} path="*" />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
