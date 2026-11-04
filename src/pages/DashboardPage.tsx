import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, ComposedChart, Line,
} from 'recharts'
import {
  ArrowLeft, ArrowRight, ChevronRight, FileText, GraduationCap, Layers, Library,
  MessageSquareQuote, Network, PieChart, ShieldCheck, Sparkles, TriangleAlert, Upload,
} from 'lucide-react'
import { useAnalytics } from '../hooks/useAnalytics'
import { usePaperTrail } from '../store/PaperTrailStore'
import { FilterBar } from '../components/FilterBar'
import {
  Badge, Card, ChartCard, CHART_COLORS, ConfidenceBadge, DemoBadge, EmptyState, Modal,
  PageHeader, Reveal, SectionTitle, Stat, TableWrap, Td, Th, truncate,
} from '../components/ui'
import { semesterAnalytics } from '../services/analyticsEngine'
import { DEMO_DISCLAIMER } from '../data/demoSubjects'

/**
 * Institution-wide dashboard with hierarchical drill-down:
 * All semesters → Semester → Subject → Unit → Chapter → Topic → Question → Paper.
 */
export const DashboardPage: React.FC = () => {
  const a = useAnalytics()
  const store = usePaperTrail()
  const { overview, questions, papers, topics, trends, marks, filters, filtersActive } = a

  const [drill, setDrill] = useState<{
    semester?: number
    subjectId?: string
    unit?: string
    chapter?: string
    topic?: string
  }>({})
  const [questionScope, setQuestionScope] = useState<{ title: string; questions: typeof questions } | null>(null)

  const semesterRows = useMemo(() => {
    const counts = semesterAnalytics(questions, papers)
    return counts
  }, [questions, papers])

  const chartSemesters = semesterRows.map((s) => ({ name: `S${s.semester}`, questions: s.questions, papers: s.papers }))
  const chartYears = trends.map((t) => ({ year: t.year, questions: t.questions, marks: t.marks }))
  const topTopics = topics.slice(0, 8)

  const syllabusMapped = useMemo(() => {
    const withSyllabus = a.subjects.filter((s) => store.syllabi[s.id]).length
    return { mapped: withSyllabus, total: a.subjects.length || 1 }
  }, [a.subjects, store.syllabi])

  const needsReview = useMemo(
    () => questions.filter((q) => q.needsReview && !q.confirmed).slice(0, 6),
    [questions],
  )

  const avgConfidencePct = Math.round(overview.avgConfidence * 100)

  // ── Drill-down helpers ───────────────────────────────────────────────────
  const inDrillSemester = drill.semester
    ? questions.filter((q) => q.semester === drill.semester)
    : questions
  const drillSubject = drill.subjectId ? store.subjectById(drill.subjectId) : undefined
  const subjectQuestions = drill.subjectId ? inDrillSemester.filter((q) => q.subjectId === drill.subjectId) : inDrillSemester
  const unitList = Array.from(new Set(subjectQuestions.map((q) => q.unit))).sort()
  const chapterList = drill.unit
    ? Array.from(new Set(subjectQuestions.filter((q) => q.unit === drill.unit).map((q) => q.chapter))).sort()
    : []
  const chapterQuestions = drill.chapter
    ? subjectQuestions.filter((q) => q.chapter === drill.chapter)
    : subjectQuestions
  const topicList = drill.chapter
    ? Array.from(new Set(chapterQuestions.filter((q) => q.chapter === drill.chapter).map((q) => q.topic))).sort()
    : []

  const crumbs: { label: string; onClick?: () => void }[] = [
    { label: 'All semesters', onClick: () => setDrill({}) },
  ]
  if (drill.semester) crumbs.push({ label: `Semester ${drill.semester}`, onClick: () => setDrill({ semester: drill.semester }) })
  if (drill.subjectId) crumbs.push({ label: drillSubject?.name ?? 'Subject', onClick: () => setDrill({ semester: drill.semester, subjectId: drill.subjectId }) })
  if (drill.unit) crumbs.push({ label: drill.unit.split(':')[0], onClick: () => setDrill({ semester: drill.semester, subjectId: drill.subjectId, unit: drill.unit }) })
  if (drill.chapter) crumbs.push({ label: drill.chapter, onClick: () => setDrill({ semester: drill.semester, subjectId: drill.subjectId, unit: drill.unit, chapter: drill.chapter }) })
  if (drill.topic) crumbs.push({ label: drill.topic })

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Overview"
        title="Academic intelligence dashboard"
        description="An institution-wide view of every paper, subject and semester in the current dataset. Drill from eight semesters down to a single question — every number recomputes with the global filters."
        actions={
          <>
            <Link to="/upload" className="btn-ghost !py-2.5 !text-[13px]"><Upload className="h-4 w-4" /> Upload papers</Link>
            <Link to="/report" className="btn-primary !py-2.5 !text-[13px]"><Sparkles className="h-4 w-4" /> Full report</Link>
          </>
        }
        demo={overview.demoPapers > 0}
      />

      <FilterBar />

      {/* ── Headline statistics ─────────────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Papers" value={overview.totalPapers} sub={`${overview.userPapers} uploaded · ${overview.demoPapers} demo`} icon={FileText} />
        <Stat label="Questions" value={overview.totalQuestions} sub="Extracted & classified" icon={MessageSquareQuote} accent="academic" />
        <Stat label="Subjects" value={overview.totalSubjects} sub={`${overview.departments} departments`} icon={Library} accent="gold" />
        <Stat label="Semesters" value={`${overview.semestersRepresented}/8`} sub="Represented in scope" icon={GraduationCap} accent="lavender" />
        <Stat label="Marks mapped" value={marks.total} sub="Sum of question marks" icon={PieChart} />
        <Stat
          label="Years covered"
          value={overview.yearsRepresented.length}
          sub={overview.missingYears.length ? `Missing: ${overview.missingYears.join(', ')}` : 'No gaps detected'}
          icon={Network}
        />
      </div>

      {/* ── Data quality strip ──────────────────────────────────────────── */}
      <Card className="mt-4 p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <span className="eyebrow text-graphite-500">Dataset quality</span>
          <span className="flex items-center gap-2 text-xs text-graphite-700">
            <ShieldCheck className="h-4 w-4 text-academic" />
            Classification confidence <strong className="font-mono text-navy">{avgConfidencePct}%</strong>
            <span className="text-graphite-400">(heuristic, not AI)</span>
          </span>
          <span className="flex items-center gap-2 text-xs text-graphite-700">
            <Layers className="h-4 w-4 text-academic" />
            Syllabus mapping <strong className="font-mono text-navy">{syllabusMapped.mapped}/{syllabusMapped.total}</strong> subjects
          </span>
          <span className="flex items-center gap-2 text-xs text-graphite-700">
            <TriangleAlert className={`h-4 w-4 ${overview.needsReviewCount ? 'text-gold-600' : 'text-graphite-400'}`} />
            <strong className="font-mono text-navy">{overview.needsReviewCount}</strong> questions need review
          </span>
          <span className="flex items-center gap-2 text-xs text-graphite-700">
            <FileText className="h-4 w-4 text-graphite-500" />
            <strong className="font-mono text-navy">{overview.extractionWarnings}</strong> extraction warnings
          </span>
          <Link to="/questions?review=1" className="ml-auto text-xs font-grotesk font-medium text-navy hover:underline">
            Review questions <ArrowRight className="inline h-3.5 w-3.5" />
          </Link>
        </div>
      </Card>

      {filtersActive && (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-academic">
          Filters active — statistics below reflect the filtered scope only.
        </p>
      )}

      {/* ── Charts row ──────────────────────────────────────────────────── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <ChartCard title="Questions by semester" description="Distribution across the four-year programme.">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartSemesters}>
                <CartesianGrid stroke="#E2DED4" vertical={false} />
                <XAxis dataKey="name" stroke="#9A9B9F" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
                <YAxis stroke="#9A9B9F" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2DED4', fontSize: 12 }} cursor={{ fill: 'rgba(23,37,84,0.05)' }} />
                <Bar dataKey="questions" fill="#172554" radius={[5, 5, 0, 0]}
                  onClick={(_, i) => setDrill({ semester: i + 1 })} className="cursor-pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Questions & marks by year" description="Volume and weightage per academic year.">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartYears}>
                <CartesianGrid stroke="#E2DED4" vertical={false} />
                <XAxis dataKey="year" stroke="#9A9B9F" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="l" stroke="#9A9B9F" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis yAxisId="r" orientation="right" stroke="#C6A76B" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2DED4', fontSize: 12 }} />
                <Bar yAxisId="l" dataKey="questions" fill="#5478A8" radius={[5, 5, 0, 0]} />
                <Line yAxisId="r" type="monotone" dataKey="marks" stroke="#C6A76B" strokeWidth={2} dot={{ r: 3, fill: '#C6A76B' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Top topics in scope" description="Click to inspect the source questions." right={overview.demoPapers > 0 ? <DemoBadge /> : undefined}>
          <ul className="space-y-3">
            {topTopics.map((t, i) => (
              <li key={`${t.subjectId}-${t.topic}`}>
                <button
                  onClick={() => setQuestionScope({ title: t.topic, questions: store.questions.filter((q) => q.topic === t.topic && q.subjectId === t.subjectId) })}
                  className="group w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 rounded"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm text-graphite-700 group-hover:text-navy">{truncate(t.topic, 40)}</span>
                    <span className="font-mono text-[11px] text-navy">{t.totalQuestions}q · {t.totalMarks}m</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ivory-200">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, t.frequencyPercentage)}%`, background: i === 0 ? '#C6A76B' : i < 4 ? '#172554' : '#5478A8' }} />
                  </div>
                </button>
              </li>
            ))}
            {topTopics.length === 0 && <p className="py-6 text-center text-sm text-graphite-500">No topics in scope.</p>}
          </ul>
        </ChartCard>
      </div>

      {/* ── Drill-down explorer ─────────────────────────────────────────── */}
      <SectionTitle
        kicker="Drill-down"
        title={drill.topic ? drill.topic : drill.chapter ? `${drill.chapter}` : drill.unit ? drill.unit : drillSubject?.name ?? `Semester ${drill.semester} overview`}
        description="All semesters → semester → subject → unit → chapter → topic → question → source paper."
        right={
          <div className="flex items-center gap-2">
            {(drill.semester || drill.subjectId || drill.unit || drill.chapter || drill.topic) && (
              <button
                className="btn-ghost !py-2 !text-xs"
                onClick={() =>
                  setDrill((d) =>
                    d.topic ? { semester: d.semester, subjectId: d.subjectId, unit: d.unit, chapter: d.chapter }
                    : d.chapter ? { semester: d.semester, subjectId: d.subjectId, unit: d.unit }
                    : d.unit ? { semester: d.semester, subjectId: d.subjectId }
                    : d.subjectId ? { semester: d.semester }
                    : {},
                  )
                }
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite-400">
              {subjectQuestions.length} questions in view
            </span>
          </div>
        }
      />

      {/* breadcrumbs */}
      <nav aria-label="Drill-down path" className="mb-4 flex flex-wrap items-center gap-1.5">
        {crumbs.map((c, i) => (
          <React.Fragment key={`${c.label}-${i}`}>
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-graphite-400" />}
            <button
              onClick={c.onClick}
              disabled={!c.onClick}
              className={`rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 ${
                i === crumbs.length - 1 ? 'bg-navy text-ivory-100' : 'bg-ivory-200 text-graphite-600 hover:bg-ivory-300'
              }`}
            >
              {c.label}
            </button>
          </React.Fragment>
        ))}
      </nav>

      <Card className="p-5 md:p-6">
        {/* LEVEL: semesters */}
        {!drill.semester && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {semesterRows.map((s) => (
              <button
                key={s.semester}
                onClick={() => setDrill({ semester: s.semester })}
                disabled={s.papers === 0}
                className="group rounded-xl border border-ivory-300 bg-ivory-50 p-4 text-left transition-all hover:-translate-y-1 hover:border-navy/40 hover:shadow-lift disabled:opacity-45 disabled:hover:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
              >
                <span className="font-display text-3xl text-navy">0{s.semester}</span>
                <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.16em] text-graphite-500">
                  {s.papers === 0 ? 'no papers' : `${s.papers} papers`}
                </span>
                <span className="mt-2 block font-mono text-[10px] text-graphite-600">{s.questions} q</span>
                <ChevronRight className="mt-2 h-3.5 w-3.5 text-graphite-400 transition-transform group-hover:translate-x-1" />
              </button>
            ))}
          </div>
        )}

        {/* LEVEL: subjects */}
        {drill.semester && !drill.subjectId && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from(new Set(inDrillSemester.map((q) => q.subjectId))).map((sid) => {
              const meta = store.subjectById(sid)
              const qs = inDrillSemester.filter((q) => q.subjectId === sid)
              const ps = papers.filter((p) => p.subjectId === sid)
              return (
                <button
                  key={sid}
                  onClick={() => setDrill({ semester: drill.semester, subjectId: sid })}
                  className="rounded-xl border border-ivory-300 bg-ivory-50 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-navy/40 hover:shadow-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-academic">{meta?.code ?? '—'}</p>
                      <p className="mt-0.5 font-display text-xl text-graphite">{meta?.name ?? sid}</p>
                    </div>
                    <Badge tone="navy">{meta?.department?.split(' ')[0] ?? ''}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 font-mono text-[11px] text-graphite-600">
                     <span>{ps.length} papers</span><span>{qs.length} questions</span>
                    <span>{qs.reduce((n, q) => n + (q.marks ?? 0), 0)} marks</span>
                    <span>{store.syllabi[sid] ? 'syllabus mapped' : 'no syllabus'}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* LEVEL: units */}
        {drill.subjectId && !drill.unit && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {unitList.map((u) => {
              const qs = subjectQuestions.filter((q) => q.unit === u)
              return (
                <button
                  key={u}
                  onClick={() => setDrill({ semester: drill.semester, subjectId: drill.subjectId, unit: u })}
                  className="rounded-xl border border-ivory-300 bg-ivory-50 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-navy/40 hover:shadow-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-academic">{u.split(':')[0]}</p>
                  <p className="mt-1 text-sm text-graphite-700">{u.split(': ').slice(1).join(': ') || u}</p>
                   <p className="mt-2 font-mono text-[11px] text-graphite-500">{qs.length} questions · {qs.reduce((n, q) => n + (q.marks ?? 0), 0)} marks</p>
                </button>
              )
            })}
          </div>
        )}

        {/* LEVEL: chapters */}
        {drill.unit && !drill.chapter && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {chapterList.map((c) => {
              const qs = subjectQuestions.filter((q) => q.unit === drill.unit && q.chapter === c)
              return (
                <button
                  key={c}
                  onClick={() => setDrill({ semester: drill.semester, subjectId: drill.subjectId, unit: drill.unit, chapter: c })}
                  className="rounded-xl border border-ivory-300 bg-ivory-50 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-navy/40 hover:shadow-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
                >
                  <p className="text-sm font-medium text-graphite">{c}</p>
                  <div className="mt-2 flex gap-3 font-mono text-[11px] text-graphite-500">
                    <span>{qs.length} questions</span><span>{new Set(qs.map((q) => q.topic)).size} topics</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* LEVEL: topics */}
        {drill.chapter && !drill.topic && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topicList.map((t) => {
              const qs = chapterQuestions.filter((q) => q.chapter === drill.chapter && q.topic === t)
              return (
                <button
                  key={t}
                  onClick={() => setQuestionScope({ title: t, questions: qs })}
                  className="rounded-xl border border-ivory-300 bg-ivory-50 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-navy/40 hover:shadow-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
                >
                  <p className="text-sm font-medium text-graphite">{t}</p>
                   <p className="mt-2 font-mono text-[11px] text-graphite-500">{qs.length} questions · {qs.reduce((n, q) => n + (q.marks ?? 0), 0)} marks</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-academic">open questions →</p>
                </button>
              )
            })}
          </div>
        )}

        {/* LEVEL: question */}
        {drill.topic && (
          <TableWrap>
            <thead>
              <tr><Th>Q</Th><Th>Text</Th><Th>Year</Th><Th className="text-right">Marks</Th><Th>Confidence</Th><Th>Source</Th></tr>
            </thead>
            <tbody>
              {chapterQuestions.filter((q) => q.topic === drill.topic).map((q) => (
                <tr key={q.id}>
                  <Td className="font-mono text-navy">{q.questionNumber}{q.subQuestion ? `(${q.subQuestion})` : ''}</Td>
                  <Td>{truncate(q.text, 90)}</Td>
                  <Td className="font-mono">{q.year}</Td>
                  <Td className="text-right font-mono">{q.marks}</Td>
                  <Td><ConfidenceBadge value={q.confidence} needsReview={q.needsReview} /></Td>
                  <Td className="font-mono text-[11px] text-graphite-500">{papers.find((p) => p.id === q.paperId)?.filename ?? '—'}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      {/* ── Two-column: review queue + subject matrix ───────────────────── */}
      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl text-graphite">Needs review</h3>
            <Link to="/questions?review=1" className="text-xs font-grotesk font-medium text-navy hover:underline">Open all</Link>
          </div>
          {needsReview.length === 0 ? (
            <p className="py-6 text-center text-sm text-graphite-500">Nothing flagged — every classification is above the review threshold or confirmed.</p>
          ) : (
            <ul className="space-y-3">
              {needsReview.map((q) => (
                <li key={q.id} className="rounded-xl border border-ivory-200 bg-ivory-50 p-3.5">
                  <p className="line-clamp-2 text-sm text-graphite-700">{truncate(q.text, 110)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <ConfidenceBadge value={q.confidence} needsReview />
                    <Badge tone="grey">{q.topic}</Badge>
                    <span className="font-mono text-[10px] text-graphite-400">{q.year} · {q.examType}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <ChartCard className="lg:col-span-3" title="Semester matrix" description="Papers and questions per semester — click a bar to drill in." right={overview.demoPapers > 0 ? <DemoBadge /> : undefined}>
          <TableWrap>
            <thead>
              <tr><Th>Semester</Th><Th className="text-right">Subjects</Th><Th className="text-right">Papers</Th><Th className="text-right">Questions</Th><Th className="text-right">Marks</Th><Th><span className="sr-only">Actions</span></Th></tr>
            </thead>
            <tbody>
              {semesterRows.map((s) => (
                <tr key={s.semester}>
                  <Td className="font-medium text-graphite">Semester {s.semester}</Td>
                  <Td className="text-right font-mono">{s.subjects}</Td>
                  <Td className="text-right font-mono">{s.papers}</Td>
                  <Td className="text-right font-mono">{s.questions}</Td>
                  <Td className="text-right font-mono">{s.marks}</Td>
                  <Td className="text-right">
                    {s.papers > 0 ? (
                      <button onClick={() => setDrill({ semester: s.semester })} className="text-xs font-grotesk text-navy hover:underline" aria-label={`Drill into semester ${s.semester}`}>
                        Explore <ArrowRight className="inline h-3 w-3" />
                      </button>
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-wide text-graphite-400">no papers</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </ChartCard>
      </div>

      {/* demo disclaimer */}
      {overview.demoPapers > 0 && (
        <Reveal className="mt-6">
          <p className="rounded-xl border border-gold/40 bg-gold-100/60 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-gold-600">
            {DEMO_DISCLAIMER} — upload your own papers for real analysis
          </p>
        </Reveal>
      )}

      {/* provenance modal */}
      <Modal open={!!questionScope} onClose={() => setQuestionScope(null)} title={questionScope?.title ?? ''} wide>
        {questionScope && (
          <div className="space-y-4">
            <p className="text-sm text-graphite-600">
              {questionScope.questions.length} supporting questions — every figure on this dashboard
              is derived from records like these.
            </p>
            <ul className="space-y-3">
              {questionScope.questions.slice(0, 25).map((q) => {
                const paper = papers.find((p) => p.id === q.paperId)
                return (
                  <li key={q.id} className="rounded-xl border border-ivory-200 bg-ivory-50 p-4">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-graphite-500">
                      <span className="text-navy">{q.questionNumber}{q.subQuestion ? `(${q.subQuestion})` : ''}</span>
                      <span>· {q.year} · {q.examType} · {q.marks} marks · p.{q.sourcePage}</span>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-graphite-700">{q.text}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <ConfidenceBadge value={q.confidence} needsReview={q.needsReview} />
                      <Badge tone="blue">{q.topic}</Badge>
                      <span className="font-mono text-[10px] text-graphite-400">{paper?.filename}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
            {questionScope.questions.length > 25 && (
              <p className="font-mono text-[11px] text-graphite-400">…and {questionScope.questions.length - 25} more.</p>
            )}
            <Link to={`/questions?topic=${encodeURIComponent(questionScope.questions[0]?.topic ?? '')}`} className="btn-primary">
              Open in question explorer <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </Modal>
    </div>
  )
}
