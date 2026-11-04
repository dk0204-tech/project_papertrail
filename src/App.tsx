import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { AppLayout } from './layouts/AppLayout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PageTransitionProvider } from './components/PageTransition'

// ── Code-split heavy surfaces so the landing page stays light ────────────────
const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const UploadPage = lazy(() => import('./pages/UploadPage').then((m) => ({ default: m.UploadPage })))
const ArchivePage = lazy(() => import('./pages/ArchivePage').then((m) => ({ default: m.ArchivePage })))
const QuestionsPage = lazy(() => import('./pages/QuestionsPage').then((m) => ({ default: m.QuestionsPage })))
const TopicAnalyticsPage = lazy(() => import('./pages/TopicAnalyticsPage').then((m) => ({ default: m.TopicAnalyticsPage })))
const ChaptersAnalyticsPage = lazy(() => import('./pages/ChaptersAnalyticsPage').then((m) => ({ default: m.ChaptersAnalyticsPage })))
const MarksAnalyticsPage = lazy(() => import('./pages/MarksAnalyticsPage').then((m) => ({ default: m.MarksAnalyticsPage })))
const TrendsAnalyticsPage = lazy(() => import('./pages/TrendsAnalyticsPage').then((m) => ({ default: m.TrendsAnalyticsPage })))
const RepetitionPage = lazy(() => import('./pages/RepetitionPage').then((m) => ({ default: m.RepetitionPage })))
const CoveragePage = lazy(() => import('./pages/CoveragePage').then((m) => ({ default: m.CoveragePage })))
const KnowledgeGraphPage = lazy(() => import('./pages/KnowledgeGraphPage').then((m) => ({ default: m.KnowledgeGraphPage })))
const SyllabusPage = lazy(() => import('./pages/SyllabusPage').then((m) => ({ default: m.SyllabusPage })))
const SubjectsPage = lazy(() => import('./pages/SubjectsPage').then((m) => ({ default: m.SubjectsPage })))
const SemestersPage = lazy(() => import('./pages/SemestersPage').then((m) => ({ default: m.SemestersPage })))
const ReportPage = lazy(() => import('./pages/ReportPage').then((m) => ({ default: m.ReportPage })))
const PlannerPage = lazy(() => import('./pages/PlannerPage').then((m) => ({ default: m.PlannerPage })))
const PracticePage = lazy(() => import('./pages/PracticePage').then((m) => ({ default: m.PracticePage })))
const MockExamPage = lazy(() => import('./pages/MockExamPage').then((m) => ({ default: m.MockExamPage })))
const AboutPage = lazy(() => import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))

const RouteFallback: React.FC = () => (
  <div className="flex min-h-[60vh] items-center justify-center px-6">
    <div className="flex items-center gap-3 rounded-xl border border-ivory-300 bg-white px-5 py-4 shadow-lift">
      <span className="relative flex h-4 w-4">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-academic-400 opacity-60" />
        <span className="relative inline-flex h-4 w-4 rounded-full bg-academic" />
      </span>
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite-600">Loading view…</span>
    </div>
  </div>
)

/** Scroll-to-top on route change (hash links are handled by the anchor). */
function ScrollToTop() {
  const { pathname } = useLocation()
  React.useEffect(() => {
    if (!window.location.hash) window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])
  return null
}

export function App() {
  return (
    // reducedMotion="user" makes every Framer Motion animation honour the OS
    // prefers-reduced-motion setting; GSAP scenes check the same query.
    <MotionConfig reducedMotion="user">
    <ErrorBoundary>
    <PageTransitionProvider>
    <div className="min-h-screen bg-ivory-100 text-graphite">
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/archive" element={<ArchivePage />} />
            <Route path="/questions" element={<QuestionsPage />} />
            <Route path="/analytics/topics" element={<TopicAnalyticsPage />} />
            <Route path="/analytics/chapters" element={<ChaptersAnalyticsPage />} />
            <Route path="/analytics/marks" element={<MarksAnalyticsPage />} />
            <Route path="/analytics/trends" element={<TrendsAnalyticsPage />} />
            <Route path="/analytics/repetition" element={<RepetitionPage />} />
            <Route path="/analytics/coverage" element={<CoveragePage />} />
            <Route path="/knowledge-graph" element={<KnowledgeGraphPage />} />
            <Route path="/syllabus" element={<SyllabusPage />} />
            <Route path="/subjects" element={<SubjectsPage />} />
            <Route path="/semesters" element={<SemestersPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/planner" element={<PlannerPage />} />
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/mock-exam" element={<MockExamPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            {/* legacy/typo-safe redirects */}
            <Route path="/index.html" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </div>
    </PageTransitionProvider>
    </ErrorBoundary>
    </MotionConfig>
  )
}

const NotFound: React.FC = () => (
  <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 text-center">
    <p className="eyebrow text-academic">404</p>
    <h1 className="mt-3 text-4xl text-graphite">This page is not in the archive.</h1>
    <p className="mt-3 text-sm text-graphite-600">
      The address you followed does not match any PaperTrail route. Try the dashboard or return to the
      landing page.
    </p>
    <div className="mt-7 flex gap-3">
      <Link to="/dashboard" className="btn-primary">Go to dashboard</Link>
      <Link to="/" className="btn-ghost">Back home</Link>
    </div>
  </div>
)

export default App
