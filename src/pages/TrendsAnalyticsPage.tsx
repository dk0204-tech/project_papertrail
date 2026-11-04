import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, CartesianGrid, Cell, ComposedChart, Legend, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { CalendarRange, Download, Layers, MessageSquareQuote, TrendingUp } from 'lucide-react'
import { useAnalytics } from '../hooks/useAnalytics'
import { usePaperTrail } from '../store/PaperTrailStore'
import {
  Badge, ChartCard, CHART_COLORS, ConfidenceBadge, DemoBadge, EmptyState,
  Modal, PageHeader, SectionTitle, Stat, truncate,
} from '../components/ui'
import { FilterBar } from '../components/FilterBar'
import { exportQuestionsCsv } from '../services/reportExporter'
import { Question } from '../types'

const AXIS_TICK = { fontSize: 11, fontFamily: 'IBM Plex Mono' }
const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 12,
  border: '1px solid #E2DED4',
  fontSize: 12,
  fontFamily: 'DM Sans',
}
const LEGEND_STYLE: React.CSSProperties = { fontSize: 11, fontFamily: 'DM Sans' }

/**
 * Provenance dialog shared by every chart element on this page: shows the
 * exact supporting questions (number, text, year, exam type, marks, page,
 * heuristic confidence and source filename) behind the clicked element.
 */
const ProvenanceModal: React.FC<{
  open: boolean
  onClose: () => void
  title: string
  questions: Question[]
  papers: { id: string; filename: string }[]
}> = ({ open, onClose, title, questions, papers }) => (
  <Modal open={open} onClose={onClose} title={title} wide>
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">
          {questions.length} supporting {questions.length === 1 ? 'question' : 'questions'}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-400">
          Actual occurrences in the current dataset — not a forecast.
        </p>
      </div>

      {questions.length === 0 ? (
        <p className="rounded-xl border border-ivory-200 bg-ivory-50 p-4 text-sm leading-relaxed text-graphite-600">
          Not observed in the uploaded papers for this element in the current scope.
        </p>
      ) : (
        <ul className="space-y-3">
          {questions.map((q) => {
            const paper = papers.find((p) => p.id === q.paperId)
            return (
              <li key={q.id} className="rounded-xl border border-ivory-200 bg-ivory-50 p-4">
                <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-graphite-500">
                  <span className="text-navy">
                    {q.questionNumber}
                    {q.subQuestion ? `(${q.subQuestion})` : ''}
                  </span>
                  <span>· {q.year} · {q.examType}</span>
                  <span>· {q.marks} marks</span>
                  <span>· p.{q.sourcePage}</span>
                  {q.demo && <span className="text-gold-600">· demo</span>}
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-graphite-700">{q.text}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ConfidenceBadge value={q.confidence} needsReview={q.needsReview} />
                  <span className="font-mono text-[10px] text-graphite-400">
                    {paper?.filename ?? 'source unavailable'}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex justify-end">
        <Link to="/questions" className="btn-ghost !py-2.5 !text-[13px]">
          Open question explorer
        </Link>
      </div>
    </div>
  </Modal>
)

/**
 * Historical trends — volume, marks, difficulty, unit spread and question
 * types per academic year, plus a topic recurrence explorer. Every number is
 * aggregated from useAnalytics(); every chart element opens the exact
 * questions behind it (provenance requirement).
 */
export const TrendsAnalyticsPage: React.FC = () => {
  const { questions, papers, topics, trends, difficultyTrend, unitTrend, filtersActive, store } = useAnalytics()

  const [prov, setProv] = useState<{ title: string; questions: Question[] } | null>(null)
  const [topicSearch, setTopicSearch] = useState('')
  const [topicKey, setTopicKey] = useState<string | null>(null)

  const hasDemo = useMemo(() => questions.some((q) => q.demo), [questions])

  const jump = useMemo(() => {
    let best: { from: number; to: number; delta: number } | null = null
    for (let i = 1; i < trends.length; i++) {
      const delta = trends[i].questions - trends[i - 1].questions
      if (!best || delta > best.delta) best = { from: trends[i - 1].year, to: trends[i].year, delta }
    }
    return best
  }, [trends])

  const subjectCount = useMemo(() => new Set(questions.map((q) => q.subjectId)).size, [questions])

  /** year × questionType counts — top 5 types plus an explicit "Other" bucket. */
  const typeTrend = useMemo(() => {
    const totals = new Map<string, number>()
    for (const q of questions) totals.set(q.questionType, (totals.get(q.questionType) ?? 0) + 1)
    const top = Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k)
    let other = 0
    const rows = trends.map((t) => {
      const row: Record<string, number> = { year: t.year }
      for (const ty of top) row[ty] = 0
      let otherHere = 0
      for (const q of questions) {
        if (q.year !== t.year) continue
        if (top.includes(q.questionType)) row[q.questionType] += 1
        else otherHere += 1
      }
      row.Other = otherHere
      other += otherHere
      return row
    })
    return { rows, types: other > 0 ? [...top, 'Other'] : top }
  }, [questions, trends])

  const unitKeys = useMemo(
    () => (unitTrend.length ? Object.keys(unitTrend[0]).filter((k) => k !== 'year') : []),
    [unitTrend],
  )
  const shortUnit = (u: string) => (u.includes(':') ? u.split(':')[0] : u)

  // ── Topic recurrence explorer ───────────────────────────────────────────────
  const topicOptions = useMemo(() => {
    const s = topicSearch.trim().toLowerCase()
    return topics.filter(
      (t) =>
        !s ||
        t.topic.toLowerCase().includes(s) ||
        t.chapter.toLowerCase().includes(s) ||
        t.subject.toLowerCase().includes(s),
    )
  }, [topics, topicSearch])

  const selectedTopic = useMemo(() => {
    if (topicKey) {
      const found = topics.find((t) => `${t.subjectId}|${t.topic}` === topicKey)
      if (found) return found
    }
    return topicOptions[0] ?? topics[0] ?? null
  }, [topicKey, topics, topicOptions])

  const topicQuestions = useMemo(
    () =>
      selectedTopic
        ? questions.filter((q) => q.topic === selectedTopic.topic && q.subjectId === selectedTopic.subjectId)
        : [],
    [questions, selectedTopic],
  )

  const topicSeries = useMemo(
    () =>
      trends.map((t) => {
        const qs = topicQuestions.filter((q) => q.year === t.year)
        return { year: t.year, questions: qs.length, marks: qs.reduce((s, q) => s + (q.marks ?? 0), 0) }
      }),
    [trends, topicQuestions],
  )

  const topicHistory = useMemo(
    () => [...topicQuestions].sort((a, b) => b.year - a.year || (b.marks ?? 0) - (a.marks ?? 0)),
    [topicQuestions],
  )

  // ── Provenance helpers ──────────────────────────────────────────────────────
  const openProv = (title: string, list: Question[]) => setProv({ title, questions: list })
  const yearAt = (i: number): number | null => trends[i]?.year ?? null
  const byYear = (year: number, pred?: (q: Question) => boolean) =>
    questions.filter((q) => q.year === year && (!pred || pred(q)))

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Analytics · Trends"
          title="Historical trends"
          description="Year-over-year view of question volume, marks, difficulty and syllabus spread."
        />
        <EmptyState
          icon={TrendingUp}
          title="No questions match the current filters"
          description={
            filtersActive
              ? 'The active filters exclude every question in the dataset. Clear some filters, or upload papers for this scope.'
              : 'There are no questions in the dataset yet. Upload question papers or enable the illustrative demo dataset in Settings.'
          }
          action={{ label: 'Upload papers', to: '/upload' }}
          secondaryAction={
            filtersActive ? (
              <button className="btn-ghost" onClick={store.resetFilters}>
                Clear filters
              </button>
            ) : undefined
          }
        />
      </div>
    )
  }

  const latest = trends[trends.length - 1]
  const firstYear = trends[0].year
  const lastYear = latest.year

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Analytics · Trends"
        title="Historical trends"
        description="How the papers in scope changed year over year: volume, marks, difficulty, unit spread and question types. Select any chart element to see the exact questions behind it."
        demo={hasDemo}
        actions={
          <>
            <button
              className="btn-ghost !py-2.5 !text-[13px]"
              onClick={() => exportQuestionsCsv(questions)}
              aria-label="Export the questions in scope as CSV"
            >
              <Download className="h-4 w-4" />
              Export scope CSV
            </button>
            <Link to="/analytics/topics" className="btn-ghost !py-2.5 !text-[13px]">
              Topic frequency
            </Link>
            <Link to="/questions" className="btn-primary !py-2.5 !text-[13px]">
              Open question explorer
            </Link>
          </>
        }
      />

      <FilterBar />

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Years in scope"
          value={trends.length}
          sub={firstYear === lastYear ? `${firstYear} only` : `${firstYear} – ${lastYear}`}
          icon={CalendarRange}
        />
        <Stat
          label={`Marks · ${lastYear}`}
          value={latest.marks}
          sub={`${latest.questions} questions in ${lastYear}`}
          icon={MessageSquareQuote}
          accent="gold"
        />
        <Stat
          label="Topics tracked"
          value={topics.length}
          sub={`across ${subjectCount} ${subjectCount === 1 ? 'subject' : 'subjects'} in scope`}
          icon={Layers}
          accent="lavender"
        />
        <Stat
          label="Biggest YoY increase"
          value={jump && jump.delta > 0 ? `+${jump.delta}` : '—'}
          sub={jump && jump.delta > 0 ? `${jump.from} → ${jump.to} questions` : 'Not observed in the uploaded papers'}
          icon={TrendingUp}
          accent="academic"
        />
      </div>

      <SectionTitle
        kicker="Year over year"
        title="Volume, marks and composition"
        description="Actual occurrences in the current dataset — not a forecast. Click any bar to open the supporting questions."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        {/* (a) Questions & marks by year */}
        <ChartCard
          className="xl:col-span-2"
          title="Questions & marks by year"
          description="Bars are question counts, the line is total marks. The most recent year is highlighted in gold."
          right={hasDemo ? <DemoBadge /> : undefined}
        >
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trends} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#E2DED4" vertical={false} />
                <XAxis
                  dataKey="year"
                  stroke="#9A9B9F"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="l"
                  stroke="#9A9B9F"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="r"
                  orientation="right"
                  stroke="#9A9B9F"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(23,37,84,0.05)' }} />
                <Legend wrapperStyle={LEGEND_STYLE} />
                <Bar
                  yAxisId="l"
                  dataKey="questions"
                  name="Questions"
                  fill="#172554"
                  radius={[5, 5, 0, 0]}
                  cursor="pointer"
                  onClick={(_, i) => {
                    const y = yearAt(i)
                    if (y !== null) openProv(`${y} — questions by year`, byYear(y))
                  }}
                >
                  {trends.map((t, i) => (
                    <Cell
                      key={t.year}
                      fill={i === trends.length - 1 ? '#C6A76B' : i < 3 ? '#172554' : '#5478A8'}
                    />
                  ))}
                </Bar>
                <Line
                  yAxisId="r"
                  type="monotone"
                  dataKey="marks"
                  name="Marks"
                  stroke="#C6A76B"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#C6A76B' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* (b) Difficulty over time */}
        <ChartCard
          title="Difficulty over time"
          description="Stacked counts of the heuristic difficulty label assigned to each question, per year."
        >
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={difficultyTrend} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#E2DED4" vertical={false} />
                <XAxis
                  dataKey="year"
                  stroke="#9A9B9F"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  stroke="#9A9B9F"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(23,37,84,0.05)' }} />
                <Legend wrapperStyle={LEGEND_STYLE} />
                <Bar
                  dataKey="Easy"
                  stackId="d"
                  name="Easy"
                  fill="#B8B5E8"
                  cursor="pointer"
                  onClick={(_, i) => {
                    const y = yearAt(i)
                    if (y !== null)
                      openProv(
                        `${y} · Easy difficulty`,
                        byYear(y, (q) => q.difficulty === 'Easy'),
                      )
                  }}
                />
                <Bar
                  dataKey="Medium"
                  stackId="d"
                  name="Medium"
                  fill="#5478A8"
                  cursor="pointer"
                  onClick={(_, i) => {
                    const y = yearAt(i)
                    if (y !== null)
                      openProv(
                        `${y} · Medium difficulty`,
                        byYear(y, (q) => q.difficulty === 'Medium'),
                      )
                  }}
                />
                <Bar
                  dataKey="Hard"
                  stackId="d"
                  name="Hard"
                  fill="#172554"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(_, i) => {
                    const y = yearAt(i)
                    if (y !== null)
                      openProv(`${y} · Hard difficulty`, byYear(y, (q) => q.difficulty === 'Hard'))
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* (c) Unit distribution over time */}
        <ChartCard
          title="Unit distribution over time"
          description="How the syllabus units in scope are spread across years (up to six units shown)."
        >
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={unitTrend} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#E2DED4" vertical={false} />
                <XAxis
                  dataKey="year"
                  stroke="#9A9B9F"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  stroke="#9A9B9F"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(23,37,84,0.05)' }} />
                <Legend wrapperStyle={LEGEND_STYLE} />
                {unitKeys.map((u, i) => (
                  <Bar
                    key={u}
                    dataKey={u}
                    stackId="u"
                    name={shortUnit(u)}
                    fill={CHART_COLORS[(i + 1) % CHART_COLORS.length]}
                    radius={i === unitKeys.length - 1 ? [4, 4, 0, 0] : undefined}
                    cursor="pointer"
                    onClick={(_, idx) => {
                      const y = yearAt(idx)
                      if (y !== null) openProv(`${y} · ${u}`, byYear(y, (q) => q.unit === u))
                    }}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* (d) Topic recurrence explorer */}
      <SectionTitle
        kicker="Explorer"
        title="Topic recurrence"
        description="Pick any topic in scope to see the years it appeared in, with the full history of source questions beside the chart."
      />

      <ChartCard
        title="Topic recurrence explorer"
        description="Per-year occurrences of the selected topic. Actual occurrences in the current dataset — not a forecast."
        right={hasDemo ? <DemoBadge /> : undefined}
      >
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {topicOptions.slice(0, 30).map((t) => {
              const key = `${t.subjectId}|${t.topic}`
              const active = selectedTopic ? `${selectedTopic.subjectId}|${selectedTopic.topic}` === key : false
              return (
                <button
                  key={key}
                  onClick={() => setTopicKey(key)}
                  title={`${t.topic} · ${t.subject}`}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-grotesk font-medium transition-all ${
                    active
                      ? 'border-navy bg-navy text-ivory-100'
                      : 'border-ivory-300 bg-white text-graphite-600 hover:border-graphite-400'
                  }`}
                >
                  {t.topic.length > 22 ? `${t.topic.slice(0, 21)}…` : t.topic}
                </button>
              )
            })}
            {topicOptions.length > 30 && (
              <span className="self-center font-mono text-[10px] text-graphite-400">
                +{topicOptions.length - 30} more — refine the search
              </span>
            )}
          </div>
          <input
            value={topicSearch}
            onChange={(e) => setTopicSearch(e.target.value)}
            placeholder="Search topics, chapters or subjects…"
            aria-label="Search topics for the recurrence explorer"
            className="field md:w-72"
          />
        </div>

        {topicOptions.length === 0 ? (
          <p className="py-10 text-center text-sm text-graphite-500">No topics match your search.</p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={topicSeries} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid stroke="#E2DED4" vertical={false} />
                    <XAxis
                      dataKey="year"
                      stroke="#9A9B9F"
                      tick={AXIS_TICK}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="l"
                      stroke="#9A9B9F"
                      tick={AXIS_TICK}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      yAxisId="r"
                      orientation="right"
                      stroke="#9A9B9F"
                      tick={AXIS_TICK}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(23,37,84,0.05)' }} />
                    <Legend wrapperStyle={LEGEND_STYLE} />
                    <Bar
                      yAxisId="l"
                      dataKey="questions"
                      name="Questions"
                      fill="#5478A8"
                      radius={[5, 5, 0, 0]}
                      cursor="pointer"
                      onClick={(_, i) => {
                        const y = topicSeries[i]?.year
                        if (y === undefined || !selectedTopic) return
                        openProv(
                          `${selectedTopic.topic} · ${y}`,
                          questions.filter(
                            (q) =>
                              q.year === y &&
                              q.topic === selectedTopic.topic &&
                              q.subjectId === selectedTopic.subjectId,
                          ),
                        )
                      }}
                    />
                    <Line
                      yAxisId="r"
                      type="monotone"
                      dataKey="marks"
                      name="Marks"
                      stroke="#C6A76B"
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      dot={{ r: 3, fill: '#C6A76B' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h4 className="text-lg text-graphite">Full history</h4>
                  {selectedTopic && <Badge tone="navy">{selectedTopic.subject}</Badge>}
                  <Badge tone="blue">{topicQuestions.length} questions</Badge>
                </div>
                {selectedTopic && (
                  <Link
                    to={`/questions?topic=${encodeURIComponent(selectedTopic.topic)}`}
                    className="inline-flex items-center gap-1 text-xs font-grotesk font-medium text-navy hover:underline"
                  >
                    Open in explorer
                  </Link>
                )}
              </div>
              <div className="max-h-[320px] overflow-y-auto rounded-xl border border-ivory-200 bg-ivory-50 p-3">
                {topicHistory.length === 0 ? (
                  <p className="px-2 py-8 text-center text-sm text-graphite-500">
                    Not observed in the uploaded papers for this topic in the current scope.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {topicHistory.slice(0, 40).map((q) => (
                      <li key={q.id}>
                        <button
                          type="button"
                          onClick={() =>
                            openProv(`${q.topic} · ${q.year} — source question`, [q])
                          }
                          className="w-full rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-ivory-300 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
                        >
                          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-graphite-500">
                            <span className="text-navy">{q.year}</span>
                            <span>· {q.examType}</span>
                            <span>· {q.marks} marks</span>
                            <span>· p.{q.sourcePage}</span>
                          </div>
                          <p className="mt-1 text-sm leading-snug text-graphite-700">
                            {truncate(q.text, 150)}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {topicHistory.length > 40 && (
                  <p className="mt-3 px-2 font-mono text-[11px] text-graphite-400">
                    …and {topicHistory.length - 40} more in the question explorer.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </ChartCard>

      {/* Question-type distribution over time */}
      <div className="mt-6">
        <ChartCard
          title="Question-type distribution over time"
          description="Stacked counts by year × question type (top five types in scope, plus an explicit “Other” bucket). Click a segment for its supporting questions."
          right={hasDemo ? <DemoBadge /> : undefined}
        >
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeTrend.rows} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#E2DED4" vertical={false} />
                <XAxis
                  dataKey="year"
                  stroke="#9A9B9F"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  stroke="#9A9B9F"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(23,37,84,0.05)' }} />
                <Legend wrapperStyle={LEGEND_STYLE} />
                {typeTrend.types.map((ty, i) => (
                  <Bar
                    key={ty}
                    dataKey={ty}
                    stackId="t"
                    name={ty}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                    radius={i === typeTrend.types.length - 1 ? [4, 4, 0, 0] : undefined}
                    cursor="pointer"
                    onClick={(_, idx) => {
                      const y = yearAt(idx)
                      if (y === null) return
                      openProv(
                        `${y} · ${ty}`,
                        byYear(y, (q) =>
                          ty === 'Other'
                            ? !typeTrend.types.slice(0, -1).includes(q.questionType)
                            : q.questionType === ty,
                        ),
                      )
                    }}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <ProvenanceModal
        open={!!prov}
        onClose={() => setProv(null)}
        title={prov?.title ?? ''}
        questions={prov?.questions ?? []}
        papers={papers}
      />
    </div>
  )
}
