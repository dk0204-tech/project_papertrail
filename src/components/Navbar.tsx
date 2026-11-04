import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowRight, BarChart3, BookOpen, ChevronDown, FileUp, FolderOpen, GraduationCap,
  HelpCircle, LineChart, Menu, Network, PieChart, Repeat, Search, Settings,
  Sparkles, Target, Timer, Layers, X, ClipboardList, CalendarRange, Database,
} from 'lucide-react'
import { usePaperTrail } from '../store/PaperTrailStore'

interface NavItem { label: string; to: string; icon: React.ComponentType<{ className?: string }>; desc?: string }
interface NavGroup { label: string; items: NavItem[] }

const GROUPS: NavGroup[] = [
  {
    label: 'Library',
    items: [
      { label: 'Upload papers', to: '/upload', icon: FileUp, desc: 'Extract questions from PDFs' },
      { label: 'Archive', to: '/archive', icon: FolderOpen, desc: 'Every document, organised' },
      { label: 'Question explorer', to: '/questions', icon: Search, desc: 'Search & correct questions' },
      { label: 'Syllabus manager', to: '/syllabus', icon: BookOpen, desc: 'Units, chapters, topics' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { label: 'Topic frequency', to: '/analytics/topics', icon: BarChart3, desc: 'Which topics recur, and how often' },
      { label: 'Chapters & units', to: '/analytics/chapters', icon: Layers, desc: 'Distribution across the syllabus' },
      { label: 'Marks distribution', to: '/analytics/marks', icon: PieChart, desc: 'Weightage by every dimension' },
      { label: 'Historical trends', to: '/analytics/trends', icon: LineChart, desc: 'How patterns evolve year to year' },
      { label: 'Question repetition', to: '/analytics/repetition', icon: Repeat, desc: 'Similar & repeated questions' },
      { label: 'Syllabus coverage', to: '/analytics/coverage', icon: Target, desc: 'Observed vs not observed' },
      { label: 'Knowledge graph', to: '/knowledge-graph', icon: Network, desc: 'Relationships across the dataset' },
    ],
  },
  {
    label: 'Academics',
    items: [
      { label: 'Eight semesters', to: '/semesters', icon: GraduationCap, desc: 'The full four-year journey' },
      { label: 'Subjects', to: '/subjects', icon: Database, desc: 'Subject-level intelligence' },
    ],
  },
  {
    label: 'Study',
    items: [
      { label: 'Study planner', to: '/planner', icon: CalendarRange, desc: 'Track topic preparation' },
      { label: 'Practice mode', to: '/practice', icon: Timer, desc: 'Work through real questions' },
      { label: 'Mock examination', to: '/mock-exam', icon: ClipboardList, desc: 'Assemble a paper from your archive' },
      { label: 'Consolidated report', to: '/report', icon: Sparkles, desc: 'Full analytics report & exports' },
    ],
  },
]

const FLAT: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: BarChart3 },
  ...GROUPS.flatMap((g) => g.items),
  { label: 'About', to: '/about', icon: HelpCircle },
  { label: 'Settings', to: '/settings', icon: Settings },
]

export const Navbar: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const location = useLocation()
  const { papers, questions, demoEnabled } = usePaperTrail()
  const headerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    setMobileOpen(false)
    setOpenGroup(null)
  }, [location.pathname])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenGroup(null)
        setMobileOpen(false)
      }
    }
    const onClick = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) setOpenGroup(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [])

  const isActive = (to: string) => location.pathname === to || location.pathname.startsWith(`${to}/`)
  const groupActive = (g: NavGroup) => g.items.some((i) => isActive(i.to))
  const isLanding = location.pathname === '/'

  return (
    <header
      ref={headerRef}
      className={`no-print sticky top-0 z-[70] border-b transition-colors duration-300 ${
        isLanding
          ? 'border-transparent bg-ivory-100/70 backdrop-blur-md'
          : 'border-ivory-300 bg-ivory-100/92 backdrop-blur-md'
      }`}
    >
      <div className="mx-auto flex h-16 md:h-[68px] max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link to="/" className="group flex items-center gap-3 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 rounded-lg">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy text-ivory-100 shadow-lift transition-transform duration-300 group-hover:-translate-y-0.5">
            <span className="font-display text-lg leading-none pt-0.5">P</span>
          </span>
          <span className="leading-none">
            <span className="block font-display text-[22px] tracking-tight text-graphite">PaperTrail</span>
            <span className="mt-0.5 block font-mono text-[8.5px] uppercase tracking-[0.26em] text-academic">
              MIT Manipal Academic Intelligence
            </span>
          </span>
        </Link>

        {/* Desktop grouped nav */}
        <nav aria-label="Primary" className="hidden xl:flex items-center gap-1">
          <Link
            to="/dashboard"
            className={`rounded-lg px-3 py-2 text-[13.5px] font-grotesk font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 ${
              isActive('/dashboard') ? 'bg-navy text-ivory-100' : 'text-graphite-700 hover:bg-ivory-200 hover:text-graphite'
            }`}
          >
            Dashboard
          </Link>
          {GROUPS.map((g) => {
            const active = groupActive(g)
            const open = openGroup === g.label
            return (
              <div key={g.label} className="relative">
                <button
                  aria-expanded={open}
                  aria-haspopup="true"
                  onClick={() => setOpenGroup(open ? null : g.label)}
                  onMouseEnter={() => setOpenGroup(g.label)}
                  className={`flex items-center gap-1 rounded-lg px-3 py-2 text-[13.5px] font-grotesk font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 ${
                    active && !open ? 'text-navy' : open ? 'bg-white text-graphite shadow-lift' : 'text-graphite-700 hover:bg-ivory-200 hover:text-graphite'
                  }`}
                >
                  {g.label}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                  <div
                    onMouseLeave={() => setOpenGroup(null)}
                    className="absolute left-1/2 top-[calc(100%+10px)] w-[320px] -translate-x-1/2 overflow-hidden rounded-2xl border border-ivory-300 bg-white shadow-lift2 animate-fade-up"
                  >
                    <div className="border-b border-ivory-200 bg-ivory-50 px-4 py-2.5">
                      <p className="eyebrow text-graphite-500">{g.label}</p>
                    </div>
                    <ul className="p-1.5">
                      {g.items.map((item) => (
                        <li key={item.to}>
                          <Link
                            to={item.to}
                            className={`flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 ${
                              isActive(item.to) ? 'bg-navy/6' : 'hover:bg-ivory-100'
                            }`}
                          >
                            <item.icon className={`mt-0.5 h-4 w-4 shrink-0 ${isActive(item.to) ? 'text-navy' : 'text-academic'}`} />
                            <span className="min-w-0">
                              <span className="block text-[13.5px] font-grotesk font-medium text-graphite">{item.label}</span>
                              {item.desc && <span className="mt-0.5 block text-[12px] leading-snug text-graphite-600">{item.desc}</span>}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2.5">
          <span
            className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-ivory-300 bg-white px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.13em] text-graphite-600"
            title={`${papers.length} papers · ${questions.length} questions in the current dataset`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${demoEnabled ? 'bg-gold' : 'bg-emerald-500'}`} />
            {papers.length} papers · {questions.length} questions
          </span>
          <Link to="/dashboard" className="btn-primary !px-4 !py-2.5 !text-[13.5px]">
            Open dashboard
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="xl:hidden rounded-lg border border-ivory-300 bg-white p-2.5 text-graphite hover:border-graphite-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Scroll progress line */}
      <ScrollProgress />

      {/* Mobile panel */}
      {mobileOpen && (
        <div className="xl:hidden fixed inset-0 z-[90] flex flex-col bg-ivory-100">
          <div className="flex h-16 items-center justify-between border-b border-ivory-300 px-4">
            <span className="font-display text-xl text-graphite">PaperTrail</span>
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="rounded-lg border border-ivory-300 bg-white p-2.5 text-graphite focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-4 py-5">
            <Link to="/dashboard" className="mb-4 flex items-center justify-between rounded-xl bg-navy px-4 py-3.5 text-sm font-grotesk font-medium text-ivory-100">
              Dashboard <ArrowRight className="h-4 w-4" />
            </Link>
            {GROUPS.map((g) => (
              <div key={g.label} className="mb-5">
                <p className="eyebrow mb-2 text-graphite-500">{g.label}</p>
                <ul className="space-y-1">
                  {g.items.map((item) => (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                          isActive(item.to) ? 'bg-white font-medium text-navy shadow-lift' : 'text-graphite-700 hover:bg-ivory-200'
                        }`}
                      >
                        <item.icon className="h-4 w-4 text-academic" />
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="rule my-4" />
            <div className="grid grid-cols-2 gap-2">
              <Link to="/about" className="rounded-xl border border-ivory-300 bg-white px-4 py-3 text-center text-sm font-grotesk text-graphite-700">About</Link>
              <Link to="/settings" className="rounded-xl border border-ivory-300 bg-white px-4 py-3 text-center text-sm font-grotesk text-graphite-700">Settings</Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}

const ScrollProgress: React.FC = () => {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement
      const max = h.scrollHeight - h.clientHeight
      setProgress(max > 0 ? (h.scrollTop / max) * 100 : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <div className="absolute inset-x-0 bottom-0 h-[2px] bg-transparent" aria-hidden>
      <div className="h-full bg-gradient-to-r from-navy via-academic to-gold transition-[width] duration-150" style={{ width: `${progress}%` }} />
    </div>
  )
}

export { FLAT as NAV_ITEMS }
