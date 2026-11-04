import React from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { usePaperTrail } from '../store/PaperTrailStore'
import { DEMO_DISCLAIMER } from '../data/demoSubjects'
import { AlertTriangle } from 'lucide-react'

/**
 * Shell for every non-landing route: navigation, honest demo-data banner,
 * route content, and a compact footer. `min-h` + flex keeps content from
 * clipping on short pages.
 */
export const AppLayout: React.FC = () => {
  const { demoEnabled, questions, papers } = usePaperTrail()
  const location = useLocation()
  const showBanner = demoEnabled && papers.some((p) => p.demo) && location.pathname !== '/settings'

  return (
    <div className="flex min-h-screen flex-col bg-ivory-100">
      <Navbar />
      {showBanner && (
        <div className="no-print border-b border-gold/30 bg-gold-100/70">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 sm:px-6 lg:px-8">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-gold-600" />
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold-600">{DEMO_DISCLAIMER}</p>
            <span className="hidden text-xs text-graphite-600 sm:inline">
              · {papers.filter((p) => p.demo).length} demo papers, {questions.filter((q) => q.demo).length} demo questions —
              upload your own papers for real analysis.
            </span>
            <Link to="/settings" className="ml-auto text-[11px] font-grotesk font-medium text-navy underline underline-offset-2 hover:text-navy-700">
              Manage demo data
            </Link>
          </div>
        </div>
      )}
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

const Footer: React.FC = () => (
  <footer className="no-print mt-16 border-t border-ivory-300 bg-ivory-100">
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-8 md:flex-row md:justify-between">
        <div className="max-w-sm">
          <p className="font-display text-2xl text-graphite">PaperTrail</p>
          <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.24em] text-academic">
            MIT Manipal Academic Intelligence
          </p>
          <p className="mt-4 text-sm leading-relaxed text-graphite-600">
            Every question tells a story. A frontend-only research instrument for turning years of
            examination papers into structured, inspectable academic intelligence.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm sm:grid-cols-3">
          {[
            ['/dashboard', 'Dashboard'], ['/upload', 'Upload'], ['/archive', 'Archive'],
            ['/analytics/topics', 'Topics'], ['/analytics/trends', 'Trends'], ['/analytics/repetition', 'Repetition'],
            ['/syllabus', 'Syllabus'], ['/subjects', 'Subjects'], ['/semesters', 'Semesters'],
            ['/report', 'Report'], ['/planner', 'Planner'], ['/about', 'About'],
          ].map(([to, label]) => (
            <Link key={to} to={to} className="text-graphite-600 transition-colors hover:text-navy">
              {label}
            </Link>
          ))}
        </div>
      </div>
      <div className="rule mt-8 pt-5">
        <p className="font-mono text-[10px] leading-relaxed tracking-wide text-graphite-400">
          Processing happens entirely in your browser. Demo statistics are illustrative and are not verified
          MIT Manipal examination records. Classification is explainable keyword matching, not an AI model.
        </p>
      </div>
    </div>
  </footer>
)
