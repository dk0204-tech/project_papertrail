import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend,
  PieChart, Pie,
} from 'recharts'
import { BarChart3, BookOpen, Download, Gauge, Percent } from 'lucide-react'
import { useAnalytics } from '../hooks/useAnalytics'
import { usePaperTrail } from '../store/PaperTrailStore'
import {
  Badge, Card, ChartCard, CHART_COLORS, ConfidenceBadge, DemoBadge, EmptyState, Modal,
  PageHeader, SectionTitle, Stat, TableWrap, Td, Th, pct,
} from '../components/ui'
import { FilterBar } from '../components/FilterBar'
import { download, toCsv } from '../services/reportExporter'
import { MarksBucket } from '../services/analyticsEngine'
import { Paper, Question } from '../types'

/**
 * Marks distribution analytics. Every number comes from useAnalytics(); every
 * chart element opens the exact questions behind it (provenance requirement).
 */

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 12,
  border: '1px solid #E2DED4',
  fontSize: 12,
  fontFamily: 'DM Sans',
  boxShadow: '0 12px 32px -12px rgba(32,33,36,0.14)',
}

const AXIS_TICK = { fontSize: 11, fontFamily: 'IBM Plex Mono' }

type DimKey = 'topic' | 'chapter' | 'unit' | 'type' | 'subject' | 'semester'

const DIMENSIONS: { key: DimKey; label: string }[] = [
  { key: 'topic', label: 'Topic' },
  { key: 'chapter', label: 'Chapter' },
  { key: 'unit', label: 'Unit' },
  { key: 'type', label: 'Question type' },
  { key: 'subject', label: 'Subject' },
  { key: 'semester', label: 'Semester' },
]

/** Mirror of the histogram bucketing used by the analytics engine. */
function bucketLabel(marks: number): string {
  const buckets = [1, 2, 4, 6, 8, 10, 12, 15, 20]
  const b = buckets.find((x) => marks <= x) ?? 25
  return b === 25 ? '20+' : `≤ ${b}`
}

const QuestionList: React.FC<{ questions: Question[]; papers: Paper[] }> = ({ questions, papers }) => (
  <div>
    <div className="mb-3 flex items-center justify-between gap-3">
      <h4 className="text-lg text-graphite">Source questions ({questions.length})</h4>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">Provenance</span>
    </div>
    <ul className="space-y-3">
      {questions.slice(0, 14).map((q) => {
        const paper = papers.find((p) => p.id === q.paperId)
        return (
          <li key={q.id} className="rounded-xl border border-ivory-200 bg-ivory-50 p-4">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-graphite-500">
              <span className="text-navy">{q.questionNumber}{q.subQuestion ? `(${q.subQuestion})` : ''}</span>
              <span>· {q.year} · {q.examType}</span>
              <span>· {q.marks} marks</span>
              <span>· p.{q.sourcePage}</span>
              {q.demo && <span className="text-gold-600">· demo</span>}
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-graphite-700">{q.text}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <ConfidenceBadge value={q.confidence} needsReview={q.needsReview} />
              <span className="font-mono text-[10px] text-graphite-400">{paper?.filename ?? 'source unavailable'}</span>
            </div>
          </li>
        )
      })}
    </ul>
    {questions.length > 14 && (
      <p className="mt-3 font-mono text-[11px] text-graphite-400">
        …and {questions.length - 14} more questions behind this figure.
      </p>
    )}
  </div>
)

export const MarksAnalyticsPage: React.FC = () => {
  const { questions, papers, topics, marks, filtersActive } = useAnalytics()
  const store = usePaperTrail()
  const [dim, setDim] = useState<DimKey>('topic')
  const [source, setSource] = useState<{ title: string; questions: Question[] } | null>(null)

  const hasDemo = useMemo(
    () => questions.some((q) => q.demo) || papers.some((p) => p.demo),
    [questions, papers],
  )

  const openSources = (title: string, qs: Question[]) => setSource({ title, questions: qs })

  // ── Headline stats ─────────────────────────────────────────────────────────
  const shortCount = useMemo(() => questions.filter((q) => (q.marks ?? 0) <= 4).length, [questions])
  const longCount = useMemo(() => questions.filter((q) => (q.marks ?? 0) >= 10).length, [questions])
  const avgMarks = questions.length ? (marks.total / questions.length).toFixed(1) : '0'
  const share = (n: number) => (questions.length ? Math.round((n / questions.length) * 100) : 0)

  // ── Dimension switcher chart ───────────────────────────────────────────────
  const rowsFor = (key: DimKey): MarksBucket[] => {
    switch (key) {
      case 'topic': return marks.byTopic
      case 'chapter': return marks.byChapter
      case 'unit': return marks.byUnit
      case 'type': return marks.byType
      case 'subject': return marks.bySubject
      case 'semester': return marks.bySemester
      default: return []
    }
  }

  const sourcesFor = (key: DimKey, label: string): Question[] => {
    switch (key) {
      case 'topic': return questions.filter((q) => q.topic === label)
      case 'chapter': return questions.filter((q) => q.chapter === label)
      case 'unit': return questions.filter((q) => q.unit === label)
      case 'type': return questions.filter((q) => q.questionType === label)
      case 'subject': return questions.filter((q) => q.subject === label)
      case 'semester': return questions.filter((q) => `Semester ${q.semester}` === label)
      default: return []
    }
  }

  const dimLabel = DIMENSIONS.find((d) => d.key === dim)?.label ?? 'Dimension'
  const dimRows = rowsFor(dim)
  const dimData = useMemo(
    () =>
      dimRows.slice(0, 16).map((r) => ({
        name: r.label.length > 28 ? `${r.label.slice(0, 27)}…` : r.label,
        full: r.label,
        marks: r.marks,
      })),
    [dimRows],
  )

  // ── Unit donut ─────────────────────────────────────────────────────────────
  const unitPieData = useMemo(
    () =>
      marks.byUnit.slice(0, 10).map((u) => ({
        name: u.label.length > 26 ? `${u.label.slice(0, 25)}…` : u.label,
        full: u.label,
        marks: u.marks,
      })),
    [marks.byUnit],
  )

  // ── Difficulty & histogram ─────────────────────────────────────────────────
  const difficultyData = useMemo(() => marks.byDifficulty.map((d) => ({ ...d, full: d.label })), [marks.byDifficulty])
  const histogramData = useMemo(() => marks.histogram.map((h) => ({ ...h, full: h.label })), [marks.histogram])

  // ── Marks-by-topic table ───────────────────────────────────────────────────
  const topicRows = useMemo(() => [...topics].sort((a, b) => b.totalMarks - a.totalMarks), [topics])
  const markShare = (m: number) => (marks.total ? Number(((m / marks.total) * 100).toFixed(1)) : 0)

  const exportMarksCsv = () => {
    const headers = ['Topic', 'Subject', 'Unit', 'Chapter', 'Questions', 'Total Marks', 'Avg Marks', 'Share %']
    const rows = topicRows.map((t) => [
      t.topic, t.subject, t.unit, t.chapter, t.totalQuestions, t.totalMarks, t.avgMarks, markShare(t.totalMarks),
    ])
    download('papertrail_marks_by_topic.csv', toCsv(headers, rows), 'text/csv;charset=utf-8')
  }

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Analytics · Marks"
          title="Marks distribution"
          description="How the marks in scope are spread across topics, chapters, units, question types, subjects and semesters."
        />
        <EmptyState
          icon={BarChart3}
          title="No questions match the current filters"
          description={
            filtersActive
              ? 'The active filters exclude every question in the dataset. Clear some filters, or upload papers for this scope.'
              : 'There are no questions in the dataset yet. Upload question papers or enable the illustrative demo dataset in Settings.'
          }
          action={{ label: 'Upload papers', to: '/upload' }}
          secondaryAction={
            filtersActive ? <button className="btn-ghost" onClick={store.resetFilters}>Clear filters</button> : undefined
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Analytics · Marks"
        title="Marks distribution"
        description="Every figure below aggregates the marks of the questions in scope. Switch the dimension, then select any bar or slice to inspect the exact questions behind the number."
        actions={
          <>
            <Link to="/analytics/topics" className="btn-ghost !py-2.5 !text-[13px]">Topic frequency</Link>
            <button
              className="btn-primary !py-2.5 !text-[13px]"
              onClick={exportMarksCsv}
              aria-label="Export marks by topic as CSV"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
          </>
        }
      />

      <FilterBar />

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total marks in scope" value={marks.total} icon={BarChart3} />
        <Stat label="Avg marks / question" value={avgMarks} sub={`${questions.length} questions`} icon={Gauge} accent="academic" />
        <Stat
          label="Short answers (≤ 4 marks)"
          value={pct(share(shortCount))}
          sub={`${shortCount} questions`}
          icon={Percent}
          accent="gold"
        />
        <Stat
          label="Long answers (≥ 10 marks)"
          value={pct(share(longCount))}
          sub={`${longCount} questions`}
          icon={BookOpen}
          accent="lavender"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        {/* Dimension switcher */}
        <ChartCard
          className="xl:col-span-3"
          title={`Marks by ${dimLabel.toLowerCase()}`}
          description="Top 16 entries by marks for the selected dimension. Click a bar to open the source questions."
          right={hasDemo ? <DemoBadge /> : undefined}
        >
          <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Choose a marks dimension">
            {DIMENSIONS.map((d) => (
              <button
                key={d.key}
                aria-pressed={dim === d.key}
                onClick={() => setDim(d.key)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-grotesk font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 ${dim === d.key ? 'border-navy bg-navy text-ivory-100' : 'border-ivory-300 bg-white text-graphite-600 hover:border-graphite-400'}`}
              >
                {d.label}
              </button>
            ))}
          </div>
          {dimData.length === 0 ? (
            <p className="py-10 text-center text-sm text-graphite-500">No data for this dimension.</p>
          ) : (
            <div className="h-[320px] w-full" role="img" aria-label={`Bar chart of marks by ${dimLabel.toLowerCase()}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dimData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }} barCategoryGap={6}>
                  <CartesianGrid stroke="#E2DED4" horizontal={false} />
                  <XAxis type="number" stroke="#9A9B9F" tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={168} stroke="#9A9B9F" tick={{ fontSize: 11, fontFamily: 'DM Sans' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(23,37,84,0.05)' }}
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v: number, _n, p) => [`${v} marks`, p.payload.full]}
                    labelFormatter={() => ''}
                  />
                  <Bar
                    dataKey="marks"
                    radius={[0, 5, 5, 0]}
                    onClick={(_, i) => {
                      const row = dimRows[i]
                      if (row) openSources(`${dimLabel} · ${row.label}`, sourcesFor(dim, row.label))
                    }}
                    className="cursor-pointer"
                  >
                    {dimData.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#C6A76B' : i < 5 ? '#172554' : '#5478A8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        {/* Marks by unit donut */}
        <ChartCard
          className="xl:col-span-2"
          title="Marks by unit"
          description="Top 10 units by marks in the current scope. Click a slice for the source questions."
          right={hasDemo ? <DemoBadge /> : undefined}
        >
          {unitPieData.length === 0 ? (
            <p className="py-10 text-center text-sm text-graphite-500">No unit data in scope.</p>
          ) : (
            <div className="h-[320px] w-full" role="img" aria-label="Donut chart of marks by unit">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={unitPieData}
                    dataKey="marks"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={1}
                    onClick={(_, i) => {
                      const slice = unitPieData[i]
                      if (slice) openSources(`Unit · ${slice.full}`, questions.filter((q) => q.unit === slice.full))
                    }}
                  >
                    {unitPieData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v: number, _n, p) => [`${v} marks`, p.payload.full]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'DM Sans' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Difficulty */}
        <ChartCard
          title="Marks by difficulty"
          description="Marks contributed by each difficulty band. Click a bar for the source questions."
          right={hasDemo ? <DemoBadge /> : undefined}
        >
          <div className="h-[320px] w-full" role="img" aria-label="Bar chart of marks by difficulty">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={difficultyData} margin={{ left: -12, right: 12, top: 8, bottom: 4 }}>
                <CartesianGrid stroke="#E2DED4" vertical={false} />
                <XAxis dataKey="label" stroke="#9A9B9F" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis stroke="#9A9B9F" tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(23,37,84,0.05)' }}
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number, _n, p) => [`${v} marks`, `${p.payload.questions} questions`]}
                  labelFormatter={() => ''}
                />
                <Bar
                  dataKey="marks"
                  radius={[6, 6, 0, 0]}
                  onClick={(_, i) => {
                    const row = difficultyData[i]
                    if (row) openSources(`Difficulty · ${row.label}`, questions.filter((q) => q.difficulty === row.label))
                  }}
                  className="cursor-pointer"
                >
                  {difficultyData.map((_, i) => (
                    <Cell key={i} fill={[CHART_COLORS[3], CHART_COLORS[1], CHART_COLORS[0]][i % 3]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Histogram */}
        <ChartCard
          title="Marks per question"
          description="How many questions fall into each marks bucket. Click a bar for the source questions."
          right={hasDemo ? <DemoBadge /> : undefined}
        >
          <div className="h-[320px] w-full" role="img" aria-label="Histogram of marks per question">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData} margin={{ left: -12, right: 12, top: 8, bottom: 4 }}>
                <CartesianGrid stroke="#E2DED4" vertical={false} />
                <XAxis dataKey="label" stroke="#9A9B9F" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis stroke="#9A9B9F" tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(23,37,84,0.05)' }}
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number, _n, p) => [`${v} questions`, `${p.payload.marks} marks total`]}
                  labelFormatter={() => ''}
                />
                <Bar
                  dataKey="questions"
                  fill="#5478A8"
                  radius={[5, 5, 0, 0]}
                  onClick={(_, i) => {
                    const row = histogramData[i]
                    if (row) openSources(`${row.label} marks`, questions.filter((q) => bucketLabel(q.marks ?? 0) === row.label))
                  }}
                  className="cursor-pointer"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">
        Values recalculate with the global filters.
      </p>

      {/* Marks by topic table */}
      <SectionTitle
        kicker="Breakdown"
        title="Marks by topic"
        description="Topics ranked by total marks, with their average marks and share of the marks in scope."
        right={
          <button
            className="btn-ghost !py-2.5 !text-[13px]"
            onClick={exportMarksCsv}
            aria-label="Export marks by topic as CSV"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        }
      />
      <Card className="p-5 md:p-6">
        <TableWrap>
          <thead>
            <tr>
              <Th className="w-10">#</Th>
              <Th>Topic</Th>
              <Th>Subject</Th>
              <Th>Unit</Th>
              <Th className="text-right">Questions</Th>
              <Th className="text-right">Total marks</Th>
              <Th className="text-right">Avg marks</Th>
              <Th className="text-right">Share</Th>
            </tr>
          </thead>
          <tbody>
            {topicRows.slice(0, 50).map((t, i) => (
              <tr
                key={`${t.subjectId}-${t.topic}`}
                onClick={() =>
                  openSources(
                    t.topic,
                    questions.filter((q) => q.topic === t.topic && q.subjectId === t.subjectId),
                  )
                }
                tabIndex={0}
                onKeyDown={(e) =>
                  e.key === 'Enter' &&
                  openSources(
                    t.topic,
                    questions.filter((q) => q.topic === t.topic && q.subjectId === t.subjectId),
                  )
                }
                className="cursor-pointer transition-colors hover:bg-ivory-50 focus:outline-none focus-visible:bg-ivory-100"
              >
                <Td className="font-mono text-[11px] text-graphite-400">{i + 1}</Td>
                <Td>
                  <span className="font-medium text-graphite">{t.topic}</span>
                  <span className="ml-2 font-mono text-[10px] text-graphite-400">{t.chapter}</span>
                </Td>
                <Td className="text-graphite-500">{t.subject}</Td>
                <Td className="text-graphite-500">{t.unit.split(':')[0]}</Td>
                <Td className="text-right font-mono text-graphite">{t.totalQuestions}</Td>
                <Td className="text-right font-mono">{t.totalMarks}</Td>
                <Td className="text-right font-mono">{t.avgMarks}</Td>
                <Td className="text-right">
                  <span className="font-mono text-navy">{markShare(t.totalMarks)}%</span>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
        {topicRows.length > 50 && (
          <p className="mt-4 font-mono text-[11px] text-graphite-400">
            Showing 50 of {topicRows.length} topics — export the CSV for the full breakdown.
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone="grey">{questions.length} questions</Badge>
          <Badge tone="navy">{marks.total} marks</Badge>
          <Badge tone="gold" title="Marks in scope divided by questions in scope">avg {avgMarks} marks</Badge>
          {hasDemo && <DemoBadge />}
        </div>
      </Card>

      <Modal open={!!source} onClose={() => setSource(null)} title={source?.title ?? ''} wide>
        {source && (
          <div className="space-y-4">
            <p className="max-w-prose2 text-sm leading-relaxed text-graphite-600">
              Every figure behind “{source.title}” aggregates these {source.questions.length} question
              {source.questions.length === 1 ? '' : 's'} from the papers currently in scope.
            </p>
            <QuestionList questions={source.questions} papers={papers} />
          </div>
        )}
      </Modal>

      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">
        Marks are read from each question exactly as parsed from the source paper — nothing is estimated.
      </p>
    </div>
  )
}
