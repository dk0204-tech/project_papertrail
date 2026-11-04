import React, { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  ArrowRight, BarChart3, BookOpen, FileText, Network, Quote, Repeat, Target, TrendingUp,
} from 'lucide-react'
import { Navbar } from '../components/Navbar'

gsap.registerPlugin(ScrollTrigger)

/**
 * Cinematic landing page — five scroll-driven scenes that turn academic
 * documents into analytical intelligence.
 *
 * Animation notes:
 *  - GSAP ScrollTrigger drives parallax + the document→data morph (scrubbed).
 *  - Framer Motion handles in-view reveals.
 *  - Everything is disabled under prefers-reduced-motion.
 *  - No scroll-jacking: native scroll position is never hijacked.
 */

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

// ── Paper sheet ──────────────────────────────────────────────────────────────

const Sheet: React.FC<{
  className?: string
  style?: React.CSSProperties
  lines?: number
  label?: string
  opacity?: number
  blur?: number
}> = ({ className = '', style, lines = 6, label, opacity = 1, blur = 0 }) => (
  <div
    className={`absolute rounded-[6px] border border-ivory-400 bg-white shadow-lift ${className}`}
    style={{
      opacity,
      filter: blur ? `blur(${blur}px)` : undefined,
      transform: `rotate(${(style as Record<string, string | number> | undefined)?.['--r'] ?? 0}deg)`,
      ...(style as React.CSSProperties),
    }}
    aria-hidden
  >
    <div className="px-3 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[6px] uppercase tracking-[0.18em] text-academic">{label ?? 'Question paper'}</span>
        <span className="h-1.5 w-1.5 rounded-full bg-gold/70" />
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="mb-[5px] h-[3px] rounded-full bg-ivory-300"
          style={{ width: `${[96, 78, 88, 64, 92, 70, 84, 60][i % 8]}%` }}
        />
      ))}
    </div>
  </div>
)

// ── Scene 1 — Hero ───────────────────────────────────────────────────────────

const HERO_SHEETS = [
  { left: '4%', top: '14%', w: 168, r: -9, depth: 'far', lines: 7, label: 'Endterm 2023' },
  { left: '11%', top: '58%', w: 148, r: 6, depth: 'mid', lines: 6, label: 'Midterm 2024' },
  { left: '3%', top: '76%', w: 126, r: -4, depth: 'far', lines: 5, label: 'Unit test' },
  { left: '20%', top: '6%', w: 120, r: 11, depth: 'far', lines: 5, label: 'Syllabus' },
  { left: '78%', top: '12%', w: 158, r: 8, depth: 'mid', lines: 7, label: 'Endterm 2025' },
  { left: '86%', top: '52%', w: 142, r: -7, depth: 'far', lines: 6, label: 'Makeup 2024' },
  { left: '73%', top: '76%', w: 132, r: 4, depth: 'mid', lines: 5, label: 'Midterm 2026' },
  { left: '62%', top: '3%', w: 108, r: -12, depth: 'far', lines: 4, label: 'Notes' },
]

const Hero: React.FC = () => (
  <section className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden pt-24 pb-16">
    {/* warm light + atmosphere */}
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,#FFFFFF_0%,#F5F3EE_45%,#EDEAE3_100%)]" />
      <div className="absolute left-1/2 top-1/3 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-academic/10 blur-[130px]" />
      <div className="absolute bottom-0 left-1/4 h-[380px] w-[380px] rounded-full bg-gold/15 blur-[120px]" />
      <div className="absolute right-[12%] top-[18%] h-[320px] w-[320px] rounded-full bg-lavender/25 blur-[110px]" />
      {/* fine grain */}
      <div className="absolute inset-0 opacity-[0.35] bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22140%22 height=%22140%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%222%22/></filter><rect width=%22140%22 height=%22140%22 filter=%22url(%23n%22) opacity=%220.35%22/></svg>')]" />
    </div>

    {/* floating archive */}
    <div className="pointer-events-none absolute inset-0 hidden md:block" aria-hidden>
      {HERO_SHEETS.map((s, i) => (
        <div key={i} data-depth={s.depth} className="absolute" style={{ left: s.left, top: s.top, width: s.w }}>
          <div
            className="animate-paper-drift"
            style={{ ['--r']: `${s.r}deg`, animationDelay: `${i * 0.9}s`, animationDuration: `${8 + (i % 4)}s` } as React.CSSProperties}
          >
            <Sheet
              style={{ ['--r']: `${s.r}deg`, position: 'relative', width: '100%' } as React.CSSProperties}
              lines={s.lines}
              label={s.label}
              opacity={s.depth === 'far' ? 0.5 : 0.82}
              blur={s.depth === 'far' ? 1.4 : 0}
            />
          </div>
        </div>
      ))}
    </div>

    {/* central floating document */}
    <div className="pointer-events-none absolute left-1/2 top-1/2 hidden h-[420px] w-[300px] -translate-x-1/2 -translate-y-[46%] lg:block" aria-hidden>
      <div data-hero-doc className="relative h-full w-full rotate-[-2deg]">
        <div className="absolute inset-0 rounded-lg border border-ivory-400 bg-white/85 shadow-lift2 backdrop-blur-[2px]">
          <div className="p-6">
            <p className="font-mono text-[8px] uppercase tracking-[0.24em] text-academic">MIT Manipal · Semester 4</p>
            <p className="mt-1 font-display text-[15px] text-graphite">Computer Networks — Endterm</p>
            <div className="mt-4 space-y-2.5">
              {['1. Explain the TCP three-way handshake and congestion control. [8]',
                 '2. a) Subnet the address block 192.168.10.0/24 for 4 networks. [6]',
                 '3. Compare distance vector with link state routing. [8]',
                 '4. Write short notes on VLANs and CSMA/CD. [6]',
                 '5. Derive the throughput expression for a sliding window protocol. [10]'].map((t, i) => (
                <p key={i} className="border-b border-ivory-200 pb-2 text-[9.5px] leading-snug text-graphite-600">{t}</p>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-gold-600">Parsed · 5 questions</span>
              <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-graphite-400">Page 1 / 4</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* copy */}
    <div className="relative z-10 mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="eyebrow text-academic"
        >
          PaperTrail · MIT Manipal Academic Intelligence
        </motion.p>

        <h1 className="mt-6 text-[clamp(2.9rem,8vw,6.4rem)] leading-[0.98] tracking-tight text-graphite">
          <span className="reveal-mask">
            <motion.span
              className="block"
              initial={{ y: '110%' }}
              animate={{ y: 0 }}
              transition={{ duration: 1, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              Every question
            </motion.span>
          </span>
          <span className="reveal-mask">
            <motion.span
              className="block italic text-navy"
              initial={{ y: '110%' }}
              animate={{ y: 0 }}
              transition={{ duration: 1, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              tells a story.
            </motion.span>
          </span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45 }}
          className="mt-7 max-w-xl text-lg leading-relaxed text-graphite-600 md:text-xl"
        >
          Transform four years of examinations into academic intelligence. Upload previous-year
          papers and watch unstructured documents become structured, searchable, analysable
          knowledge.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-9 flex flex-col gap-3 sm:flex-row"
        >
          <Link to="/semesters" className="btn-primary !px-7 !py-4">
            Explore PaperTrail <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/upload" className="btn-ghost !px-7 !py-4">
            <FileText className="h-4 w-4" /> Analyze Your Papers
          </Link>
        </motion.div>

        {/* subtle eight-semester journey */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.9 }}
          className="mt-12"
        >
          <p className="eyebrow mb-3 text-graphite-400">The four-year journey</p>
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n, i) => (
              <motion.span
                key={n}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 + i * 0.07, duration: 0.5 }}
                className="rounded-md border border-ivory-300 bg-white/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-graphite-600 backdrop-blur-sm"
              >
                Sem {n}
              </motion.span>
            ))}
          </div>
        </motion.div>
      </div>
    </div>

    {/* scroll cue */}
    <div className="absolute bottom-7 left-1/2 z-10 -translate-x-1/2" aria-hidden>
      <div className="flex flex-col items-center gap-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-graphite-400">Scroll</span>
        <span className="relative block h-10 w-px bg-ivory-400">
          <motion.span
            className="absolute left-0 top-0 block h-3 w-px bg-navy"
            animate={{ y: [0, 28, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </span>
      </div>
    </div>
  </section>
)

// ── Scene 2 — Eight semesters ────────────────────────────────────────────────

const SEMESTER_CARDS = [
  { n: 1, note: 'Foundations' }, { n: 2, note: 'Core methods' }, { n: 3, note: 'Data & logic' },
  { n: 4, note: 'Systems' }, { n: 5, note: 'Intelligence I' }, { n: 6, note: 'Intelligence II' },
  { n: 7, note: 'Advanced' }, { n: 8, note: 'Specialisation' },
]

const SceneSemesters: React.FC = () => (
  <section className="relative overflow-hidden py-24 md:py-32">
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <p className="eyebrow text-academic">Scene 02 · The archive organises itself</p>
        <h2 className="mt-5 text-[clamp(2.1rem,4.6vw,3.7rem)] leading-[1.05] text-graphite">
          Eight semesters. Thousands of questions.{' '}
          <span className="italic text-navy">Patterns waiting to be discovered.</span>
        </h2>
        <p className="mt-5 max-w-prose2 text-graphite-600">
          Scattered papers align into an academic timeline — every document keeping its programme,
          department, semester, subject, session and year attached as it joins the archive.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {SEMESTER_CARDS.map((s, i) => (
          <motion.div
            key={s.n}
            initial={{ opacity: 0, y: 46 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
            className="group relative"
          >
            <div className="rounded-xl border border-ivory-300 bg-white p-4 shadow-lift transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-lift2">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-3xl text-navy">0{s.n}</span>
                <span className="h-2 w-2 rounded-full bg-gold opacity-70" />
              </div>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-graphite-500">{s.note}</p>
              <div className="mt-3.5 space-y-1.5" aria-hidden>
                <div className="h-1.5 w-full rounded-full bg-ivory-200" />
                <div className="h-1.5 w-4/5 rounded-full bg-academic-200" />
                <div className="h-1.5 w-3/5 rounded-full bg-lavender-200" />
              </div>
            </div>
            {/* stacked sheets hint */}
            <div className="absolute -bottom-2 left-2 right-2 -z-10 h-4 rounded-xl border border-ivory-300 bg-ivory-50 opacity-70" aria-hidden />
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 font-mono text-[11px] uppercase tracking-[0.16em] text-graphite-500"
      >
        <span>Multiple departments</span><span className="text-ivory-400">/</span>
        <span>Multiple programmes</span><span className="text-ivory-400">/</span>
        <span>Midterm · Endterm · Makeup</span><span className="text-ivory-400">/</span>
        <span>Five academic years</span>
      </motion.div>
    </div>
  </section>
)

// ── Scene 3 — Documents become data ─────────────────────────────────────────

const SceneTransform: React.FC = () => {
  const scope = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (prefersReduced() || !scope.current) return
    const ctx = gsap.context(() => {
      // document fades back while structured rows + bars come forward
      const tl = gsap.timeline({
        scrollTrigger: { trigger: scope.current, start: 'top 72%', end: 'bottom 65%', scrub: 0.6 },
      })
      tl.fromTo('[data-doc]', { y: 40, rotate: -4, opacity: 1 }, { y: -26, rotate: 2, opacity: 0.22, ease: 'none' }, 0)
        .fromTo('[data-row]', { y: 26, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.08, ease: 'none' }, 0.15)
        .fromTo('[data-bar]', { scaleY: 0.04 }, { scaleY: 1, stagger: 0.06, transformOrigin: 'bottom', ease: 'none' }, 0.35)
        .fromTo('[data-dot]', { scale: 0 }, { scale: 1, stagger: 0.05, ease: 'none' }, 0.5)
    }, scope)
    return () => ctx.revert()
  }, [])

  const rows = [
    ['Q1(a)', 'TCP congestion control', 'Transport', '8'],
    ['Q2', 'Subnetting 192.168.10.0/24', 'Network layer', '6'],
    ['Q3', 'Distance vs link-state routing', 'Network layer', '8'],
    ['Q4', 'VLANs and CSMA/CD', 'Data link', '6'],
    ['Q5', 'Sliding window throughput', 'Transport', '10'],
  ]

  return (
    <section ref={scope} className="relative overflow-hidden border-y border-ivory-300 bg-white py-24 md:py-32">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="eyebrow text-academic">Scene 03 · Extraction</p>
          <h2 className="mt-5 text-[clamp(2.1rem,4.6vw,3.7rem)] leading-[1.05] text-graphite">
            From unstructured papers to <span className="italic text-navy">structured intelligence.</span>
          </h2>
        </div>

        <div className="mt-12 grid items-center gap-10 lg:grid-cols-2">
          {/* left: the document */}
          <div className="relative min-h-[300px]" aria-hidden>
            <div
              data-doc
              className="absolute left-0 top-2 w-[74%] max-w-[340px] rounded-lg border border-ivory-400 bg-ivory-50 p-5 shadow-lift2"
            >
              <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-academic">Source · PDF.js extraction</p>
              <div className="mt-3 space-y-2">
                {['1. Explain the TCP three', '   way handshake. [8]',
                  '2. a) Subnet the block', '3. Compare DV with LS', 'SECTION B', '4. Short notes on VLANs'].map((l, i) => (
                  <p key={i} className="whitespace-pre font-mono text-[9.5px] leading-relaxed text-graphite-600">{l}</p>
                ))}
              </div>
            </div>
            <div className="absolute bottom-0 right-0 w-[70%] max-w-[420px] space-y-2.5 rounded-xl border border-ivory-300 bg-white p-4 shadow-lift">
              <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-gold-600">Structured records</p>
              {rows.map((r, i) => (
                <div
                  key={i}
                  data-row
                  className="flex items-center justify-between gap-3 border-b border-ivory-200 pb-1.5 text-[11px]"
                >
                  <span className="font-mono text-navy">{r[0]}</span>
                  <span className="flex-1 truncate text-graphite-700">{r[1]}</span>
                  <span className="hidden font-mono text-[9px] uppercase tracking-wide text-graphite-400 sm:inline">{r[2]}</span>
                  <span className="font-mono text-gold-600">{r[3]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* right: the data */}
          <div className="rounded-2xl border border-ivory-300 bg-ivory-50 p-6">
            <p className="eyebrow text-graphite-500">Parsed into analytics</p>
            <div className="mt-5 flex h-40 items-end gap-3" aria-hidden>
              {[38, 62, 45, 88, 70, 52, 96].map((h, i) => (
                <div
                  key={i}
                  data-bar
                  className="flex-1 rounded-t-md"
                  style={{
                    height: `${h}%`,
                    background: i === 3 ? '#C6A76B' : i === 6 ? '#172554' : '#5478A8',
                    opacity: i === 3 || i === 6 ? 1 : 0.55,
                  }}
                />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[['Questions', '5'], ['Marks', '38'], ['Units', '3']].map(([l, v]) => (
                <div key={l} className="rounded-lg border border-ivory-300 bg-white px-3 py-2.5">
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-graphite-500">{l}</p>
                  <p className="font-display text-2xl text-navy">{v}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {['unit', 'chapter', 'topic', 'marks', 'difficulty', 'type'].map((t) => (
                <span key={t} className="rounded-full border border-ivory-300 bg-white px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-academic">
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-5 flex gap-1.5" aria-hidden>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <span key={i} data-dot className="h-2.5 w-2.5 rounded-full" style={{ background: i % 3 === 0 ? '#172554' : i % 3 === 1 ? '#B8B5E8' : '#C6A76B' }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Scene 4 — Patterns emerge (dark, cinematic) ─────────────────────────────

const PATTERN_CARDS = [
  { icon: Repeat, title: 'Topic recurrence', copy: 'Which syllabus topics return year after year — and which do not.' },
  { icon: BarChart3, title: 'Chapter frequency', copy: 'Question counts and marks concentrated across units and chapters.' },
  { icon: Quote, title: 'Marks distribution', copy: 'Weightage by topic, type, subject, semester and academic year.' },
  { icon: TrendingUp, title: 'Historical trends', copy: 'Difficulty, unit share and question types evolving over five years.' },
  { icon: Network, title: 'Question similarity', copy: 'Repeat and near-repeat questions clustered with explainable scores.' },
  { icon: Target, title: 'Syllabus coverage', copy: 'Observed vs not observed — with honest dataset-quality reporting.' },
]

const ScenePatterns: React.FC = () => (
  <section className="relative overflow-hidden bg-navy py-24 text-ivory-100 md:py-32">
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="absolute -left-24 top-10 h-[420px] w-[420px] rounded-full bg-academic/25 blur-[130px]" />
      <div className="absolute -right-16 bottom-0 h-[360px] w-[360px] rounded-full bg-gold/15 blur-[120px]" />
      <div className="absolute inset-0 opacity-[0.16] bg-[linear-gradient(rgba(245,243,238,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(245,243,238,0.14)_1px,transparent_1px)] bg-[size:64px_64px]" />
    </div>

    <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <p className="eyebrow text-gold">Scene 04 · Analysis</p>
        <h2 className="mt-5 text-[clamp(2.1rem,4.6vw,3.9rem)] leading-[1.04] text-ivory-100">
          Patterns hidden <span className="italic text-gold">in plain sight.</span>
        </h2>
        <p className="mt-5 max-w-prose2 text-ivory-100/75">
          Discover the patterns hidden inside academic history. Every figure is computed from the
          papers in scope — and every figure opens the questions behind it.
        </p>
      </div>

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PATTERN_CARDS.map((c, i) => (
          <motion.div
            key={c.title}
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
            className="group rounded-2xl border border-ivory-100/12 bg-ivory-100/[0.045] p-6 backdrop-blur-[2px] transition-colors duration-300 hover:border-gold/40 hover:bg-ivory-100/[0.07]"
          >
            <c.icon className="h-5 w-5 text-gold" />
            <h3 className="mt-4 text-2xl text-ivory-100">{c.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ivory-100/65">{c.copy}</p>
          </motion.div>
        ))}
      </div>

      {/* micro visualisation strip */}
      <div className="mt-12 flex items-end gap-1.5" aria-hidden>
        {Array.from({ length: 40 }).map((_, i) => (
          <motion.span
            key={i}
            initial={{ height: 6 }}
            whileInView={{ height: 8 + ((i * 37) % 54) }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: i * 0.018, ease: [0.22, 1, 0.36, 1] }}
            className="w-full rounded-sm"
            style={{ background: i % 7 === 0 ? '#C6A76B' : 'rgba(245,243,238,0.34)', maxWidth: 'calc(100% / 40)' }}
          />
        ))}
      </div>
    </div>
  </section>
)

// ── Scene 5 — Enter PaperTrail ──────────────────────────────────────────────

const PREVIEW_ROWS = [
  { topic: 'TCP congestion control', papers: 76, marks: 52, streak: 4 },
  { topic: 'Subnetting & CIDR', papers: 68, marks: 46, streak: 3 },
  { topic: 'Link state routing', papers: 61, marks: 38, streak: 2 },
  { topic: 'VLANs & switching', papers: 54, marks: 30, streak: 3 },
  { topic: 'Sliding window protocols', papers: 47, marks: 41, streak: 1 },
]

const SceneEnter: React.FC = () => (
  <section className="relative overflow-hidden py-24 md:py-32">
    <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-academic/10 blur-[130px]" aria-hidden />
    <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="eyebrow text-academic">Scene 05 · Intelligence</p>
          <h2 className="mt-5 text-[clamp(2.2rem,5vw,4rem)] leading-[1.03] text-graphite">
            Understand the history.
            <br />
            <span className="italic text-navy">Prepare with purpose.</span>
          </h2>
          <p className="mt-6 max-w-prose2 text-lg text-graphite-600">
            Topic rankings, historical recurrence, chapter distribution and marks analytics — all
            traceable to the original questions and papers that produced them.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/semesters" className="btn-primary !px-7 !py-4">
              Enter PaperTrail <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/report" className="btn-ghost !px-7 !py-4">
              <BookOpen className="h-4 w-4" /> See the report
            </Link>
          </div>
          <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-graphite-400">
            Runs entirely in your browser · No account · No server
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl border border-ivory-300 bg-white p-6 shadow-lift2"
        >
          <div className="flex items-center justify-between border-b border-ivory-200 pb-4">
            <div>
              <p className="eyebrow text-graphite-500">Preview · Topic ranking</p>
              <p className="mt-1 font-mono text-[11px] text-graphite-400">CSE2002 · Computer Networks · 4 papers</p>
            </div>
            <span className="rounded-full border border-gold/50 bg-gold-100 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-gold-600">
              Demo
            </span>
          </div>
          <ul className="mt-4 space-y-3.5">
            {PREVIEW_ROWS.map((r, i) => (
              <li key={r.topic} className="group">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-graphite-700">
                    <span className="mr-2 font-mono text-[10px] text-graphite-400">0{i + 1}</span>
                    {r.topic}
                  </span>
                  <span className="font-mono text-[11px] text-navy">{r.papers}% · {r.marks}m</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ivory-200">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${r.papers}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.9, delay: 0.15 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full rounded-full"
                    style={{ background: i === 0 ? '#C6A76B' : i < 3 ? '#172554' : '#5478A8' }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="chip border border-ivory-300 bg-ivory-50 text-graphite-600">Every row opens its source questions</span>
            <span className="chip border border-ivory-300 bg-ivory-50 text-graphite-600">Filters recalculate everything</span>
          </div>
        </motion.div>
      </div>

      {/* footer */}
      <footer className="no-print mt-20 border-t border-ivory-300 pt-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-display text-3xl text-graphite">PaperTrail</p>
            <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.26em] text-academic">
              MIT Manipal Academic Intelligence
            </p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-graphite-600">
              Discover the patterns hidden inside academic history. A frontend-only research
              instrument — PDF extraction, explainable classification and aggregate analytics, all
              on-device.
            </p>
          </div>
          <nav className="grid grid-cols-2 gap-x-10 gap-y-1.5 text-sm sm:grid-cols-3" aria-label="Footer">
            {[['/dashboard', 'Dashboard'], ['/upload', 'Upload'], ['/archive', 'Archive'],
              ['/analytics/topics', 'Topics'], ['/analytics/trends', 'Trends'], ['/report', 'Report'],
              ['/syllabus', 'Syllabus'], ['/planner', 'Planner'], ['/about', 'About']].map(([to, label]) => (
              <Link key={to} to={to} className="text-graphite-600 transition-colors hover:text-navy">{label}</Link>
            ))}
          </nav>
        </div>
        <p className="mt-8 border-t border-ivory-200 pt-5 font-mono text-[10px] leading-relaxed text-graphite-400">
          Demo statistics are illustrative and are not verified MIT Manipal examination records.
          Classification is explainable keyword matching, not an AI model.
        </p>
      </footer>
    </div>
  </section>
)

// ── Page ─────────────────────────────────────────────────────────────────────

export const LandingPage: React.FC = () => {
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (prefersReduced()) return
    const ctx = gsap.context(() => {
      // Parallax: sheets drift at different rates as the camera moves down.
      gsap.utils.toArray<HTMLElement>('[data-depth="far"]').forEach((el, i) => {
        gsap.to(el, {
          yPercent: -46 - i * 6,
          ease: 'none',
          scrollTrigger: { trigger: heroRef.current, start: 'top top', end: 'bottom top', scrub: 0.5 },
        })
      })
      gsap.utils.toArray<HTMLElement>('[data-depth="mid"]').forEach((el, i) => {
        gsap.to(el, {
          yPercent: -22 - i * 5,
          xPercent: i % 2 === 0 ? -7 : 7,
          ease: 'none',
          scrollTrigger: { trigger: heroRef.current, start: 'top top', end: 'bottom top', scrub: 0.5 },
        })
      })
      // camera-like drift of the central document
      const doc = heroRef.current?.querySelector('[data-hero-doc]')
      if (doc) {
        gsap.to(doc, {
          yPercent: -16,
          scale: 1.05,
          rotate: 1.5,
          ease: 'none',
          scrollTrigger: { trigger: heroRef.current, start: 'top top', end: 'bottom top', scrub: 0.4 },
        })
      }
      // hero copy eases away as the story continues
      gsap.to('[data-hero-copy]', {
        yPercent: -12,
        opacity: 0.25,
        ease: 'none',
        scrollTrigger: { trigger: heroRef.current, start: '40% top', end: 'bottom top', scrub: 0.4 },
      })
    }, heroRef)
    return () => ctx.revert()
  }, [])

  return (
    <div className="relative overflow-x-hidden bg-ivory-100 text-graphite">
      <a
        href="#story"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-navy focus:px-4 focus:py-2 focus:text-ivory-100"
      >
        Skip to content
      </a>
      <Navbar />
      <div data-hero-copy>
        <div ref={heroRef}>
          <Hero />
        </div>
      </div>
      <main id="story">
        <SceneSemesters />
        <SceneTransform />
        <ScenePatterns />
        <SceneEnter />
      </main>
    </div>
  )
}
