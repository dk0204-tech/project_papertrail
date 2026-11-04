import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LucideIcon, ArrowRight, Inbox } from 'lucide-react'

// ── Page scaffolding ─────────────────────────────────────────────────────────

export const PageHeader: React.FC<{
  eyebrow?: string
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  demo?: boolean
}> = ({ eyebrow, title, description, actions, demo }) => (
  <header className="mb-8 md:mb-10">
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
      <div className="max-w-3xl">
        {eyebrow && <p className="eyebrow text-academic mb-3">{eyebrow}</p>}
        <h1 className="text-4xl md:text-5xl leading-[1.06] text-graphite">{title}</h1>
        {description && (
          <p className="mt-4 text-graphite-600 text-[15px] md:text-lg leading-relaxed max-w-prose2">
            {description}
          </p>
        )}
        {demo && <DemoBadge className="mt-4" />}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3 shrink-0">{actions}</div>}
    </div>
  </header>
)

export const DemoBadge: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span
    className={`inline-flex items-center gap-2 rounded-full border border-gold/50 bg-gold-100 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-gold-600 ${className}`}
    title="Demo statistics are fictional and do not represent real MIT Manipal examination records."
  >
    <span className="h-1.5 w-1.5 rounded-full bg-gold" />
    Illustrative demo data — not verified official exam statistics
  </span>
)

// ── Cards & stats ────────────────────────────────────────────────────────────

export const Card: React.FC<{
  children: React.ReactNode
  className?: string
  as?: 'div' | 'section' | 'article'
}> = ({ children, className = '', as: Tag = 'div' }) => (
  <Tag className={`card ${className}`}>{children}</Tag>
)

export const Stat: React.FC<{
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon?: LucideIcon
  accent?: 'navy' | 'academic' | 'gold' | 'lavender'
  hint?: string
}> = ({ label, value, sub, icon: Icon, accent = 'navy', hint }) => {
  const accentMap = {
    navy: 'text-navy',
    academic: 'text-academic',
    gold: 'text-gold-600',
    lavender: 'text-navy-600',
  }
  return (
    <div className="card p-5 md:p-6 group hover:shadow-lift2 transition-shadow duration-300">
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow text-graphite-600">{label}</p>
        {Icon && (
          <Icon className={`h-4 w-4 ${accentMap[accent]} opacity-70 group-hover:opacity-100 transition-opacity`} />
        )}
      </div>
      <p className={`mt-3 text-3xl md:text-4xl font-display leading-none ${accentMap[accent]}`}>{value}</p>
      {sub && <p className="mt-2 text-[12.5px] text-graphite-600 leading-snug">{sub}</p>}
      {hint && <p className="mt-1 font-mono text-[11px] text-graphite-500">{hint}</p>}
    </div>
  )
}

// ── Badges ───────────────────────────────────────────────────────────────────

type Tone = 'navy' | 'blue' | 'gold' | 'lavender' | 'grey' | 'green' | 'red'

const TONES: Record<Tone, string> = {
  navy: 'bg-navy/8 text-navy border-navy/15',
  blue: 'bg-academic-100 text-academic-600 border-academic/25',
  gold: 'bg-gold-100 text-gold-600 border-gold/40',
  lavender: 'bg-lavender-100 text-navy-600 border-lavender/60',
  grey: 'bg-ivory-200 text-graphite-600 border-ivory-400',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  red: 'bg-rose-50 text-rose-700 border-rose-200',
}

export const Badge: React.FC<{ children: React.ReactNode; tone?: Tone; className?: string; title?: string }> = ({
  children,
  tone = 'grey',
  className = '',
  title,
}) => (
  <span title={title} className={`chip border ${TONES[tone]} ${className}`}>
    {children}
  </span>
)

export const ConfidenceBadge: React.FC<{ value: number; needsReview?: boolean }> = ({ value, needsReview }) => {
  const pct = Math.round(value * 100)
  const tone: Tone = pct >= 80 ? 'green' : pct >= 60 ? 'gold' : 'red'
  return (
    <Badge tone={tone} title={`Heuristic confidence ${pct}% — not an AI judgement`}>
      {pct}%{needsReview ? ' · review' : ''}
    </Badge>
  )
}

export const ClassificationSourceBadge: React.FC<{ source: string }> = ({ source }) => {
  const map: Record<string, { tone: Tone; label: string }> = {
    'syllabus-match': { tone: 'blue', label: 'Syllabus keyword match' },
    'keyword-provisional': { tone: 'gold', label: 'Provisional — no syllabus' },
    manual: { tone: 'green', label: 'Manually classified' },
  }
  const m = map[source] ?? { tone: 'grey' as Tone, label: source }
  return <Badge tone={m.tone}>{m.label}</Badge>
}

// ── Empty & loading states ───────────────────────────────────────────────────

export const EmptyState: React.FC<{
  icon?: LucideIcon
  title: string
  description: string
  action?: { label: string; to: string }
  secondaryAction?: React.ReactNode
}> = ({ icon: Icon = Inbox, title, description, action, secondaryAction }) => (
  <div className="card flex flex-col items-center justify-center px-8 py-16 text-center">
    <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-ivory-300 bg-ivory-100 text-graphite-500">
      <Icon className="h-6 w-6" />
    </div>
    <h3 className="text-2xl text-graphite">{title}</h3>
    <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-graphite-600">{description}</p>
    {(action || secondaryAction) && (
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {action && (
          <Link to={action.to} className="btn-primary">
            {action.label}
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
        {secondaryAction}
      </div>
    )}
  </div>
)

export const LoadingBlock: React.FC<{ label?: string }> = ({ label = 'Working…' }) => (
  <div className="card flex items-center gap-4 px-6 py-8">
    <span className="relative flex h-5 w-5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-academic-400 opacity-60" />
      <span className="relative inline-flex h-5 w-5 rounded-full bg-academic" />
    </span>
    <span className="font-mono text-[12px] uppercase tracking-[0.16em] text-graphite-600">{label}</span>
  </div>
)

// ── Section heading ──────────────────────────────────────────────────────────

export const SectionTitle: React.FC<{
  kicker?: string
  title: string
  description?: string
  right?: React.ReactNode
}> = ({ kicker, title, description, right }) => (
  <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
    <div className="max-w-2xl">
      {kicker && <p className="eyebrow text-graphite-600 mb-2">{kicker}</p>}
      <h2 className="text-2xl md:text-3xl text-graphite leading-tight">{title}</h2>
      {description && <p className="mt-2 text-[13.5px] text-graphite-600 leading-relaxed">{description}</p>}
    </div>
    {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
  </div>
)

// ── Reveal-on-scroll wrapper ─────────────────────────────────────────────────

export const Reveal: React.FC<{
  children: React.ReactNode
  delay?: number
  className?: string
}> = ({ children, delay = 0, className = '' }) => {
  const reduce =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

// ── Chart frame (consistent axes/legend look across Recharts) ────────────────

export const CHART_COLORS = ['#172554', '#5478A8', '#B8B5E8', '#C6A76B', '#7593BC', '#D6BC89', '#DCDAF4', '#3C3D40']

export const ChartCard: React.FC<{
  title: string
  description?: string
  right?: React.ReactNode
  children: React.ReactNode
  className?: string
}> = ({ title, description, right, children, className = '' }) => (
  <section className={`card p-5 md:p-6 ${className}`}>
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-xl text-graphite">{title}</h3>
        {description && <p className="mt-1 text-[12.5px] text-graphite-600 max-w-prose2">{description}</p>}
      </div>
      {right}
    </div>
    {children}
  </section>
)

// ── Table ────────────────────────────────────────────────────────────────────

export const TableWrap: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`overflow-x-auto -mx-1 px-1 ${className}`}>
    <table className="w-full min-w-[560px] border-collapse text-[13.5px]">{children}</table>
  </div>
)

export const Th: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <th className={`border-b border-ivory-300 pb-2.5 text-left font-mono text-[11px] font-medium uppercase tracking-[0.13em] text-graphite-600 ${className}`}>
    {children}
  </th>
)

export const Td: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <td className={`border-b border-ivory-200 py-3 pr-4 align-top text-[13.5px] text-graphite-700 ${className}`}>{children}</td>
)

// ── Modal ────────────────────────────────────────────────────────────────────

export const Modal: React.FC<{
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  wide?: boolean
}> = ({ open, onClose, title, children, wide }) => {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6 no-print">
      <div className="absolute inset-0 bg-navy/30 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ opacity: 0, y: 24, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className={`relative w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-ivory-300 bg-white shadow-lift2`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ivory-200 bg-white/95 px-6 py-4 backdrop-blur">
          <h2 className="text-xl text-graphite">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg border border-ivory-300 px-2.5 py-1.5 text-xs font-grotesk text-graphite-600 hover:border-graphite-400 hover:text-graphite focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
          >
            Esc ✕
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </motion.div>
    </div>
  )
}

// ── Small utilities ──────────────────────────────────────────────────────────

export const Prose: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`max-w-prose2 text-[13.5px] leading-relaxed text-graphite-600 ${className}`}>{children}</div>
)

export const Mono: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <span className={`font-mono text-[12px] tracking-wide ${className}`}>{children}</span>
)

export function pct(n: number): string {
  return `${Math.round(n)}%`
}

export function truncate(text: string, n = 120): string {
  return text.length <= n ? text : `${text.slice(0, n - 1)}…`
}
