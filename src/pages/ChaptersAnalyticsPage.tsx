import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend,
} from 'recharts'
import { ArrowUpRight, BarChart3, BookOpen, Download, Layers, Trophy } from 'lucide-react'
import { useAnalytics } from '../hooks/useAnalytics'
import { usePaperTrail } from '../store/PaperTrailStore'
import {
  Badge, Card, ChartCard, CHART_COLORS, ConfidenceBadge, DemoBadge, EmptyState, Modal,
  PageHeader, SectionTitle, Stat, TableWrap, Td, Th, truncate,
} from '../components/ui'
import { FilterBar } from '../components/FilterBar'
import { exportChaptersCsv } from '../services/reportExporter'
import { ChapterAnalytics, Paper, Question } from '../types'

/**
 * Chapter & unit analytics. Structure mirrors TopicAnalyticsPage: every number
 * comes from useAnalytics(), and every chart bar / table row opens the exact
 * questions behind it.
 */

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 12,
  border: '1px solid #E2DED4',
  fontSize: 12,
  fontFamily: 'DM Sans',
  boxShadow: '0 12px 32px -12px rgba(32,33,36,0.14)',
}

const AXIS_TICK = { fontSize: 11, fontFamily: 'IBM Plex Mono' }

/** Source-question list — the provenance panel shared by every drill-down. */
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

const SourceModal: React.FC<{
  source: { title: string; questions: Question[] } | null
  onClose: () => void
  papers: Paper[]
}> = ({ source, onClose, papers }) => (
  <Modal open={!!source} onClose={onClose} title={source?.title ?? ''} wide>
    {source && (
      <div className="space-y-4">
        <p className="max-w-prose2 text-sm leading-relaxed text-graphite-600">
          Every number behind “{source.title}” aggregates these {source.questions.length} question
          {source.questions.length === 1 ? '' : 's'} from the papers currently in scope.
        </p>
        <QuestionList questions={source.questions} papers={papers} />
      </div>
    )}
  </Modal>
)

export const ChaptersAnalyticsPage: React.FC = () => {
  const { chapters, units, topics, questions, papers, marks, filtersActive } = useAnalytics()
  const store = usePaperTrail()
  const [search, setSearch] = useState('')
  const [unitFilter, setUnitFilter] = useState('All')
  const [selectedChapter, setSelectedChapter] = useState<ChapterAnalytics | null>(null)
  const [source, setSource] = useState<{ title: string; questions: Question[] } | null>(null)

  const hasDemo = useMemo(
    () => questions.some((q) => q.demo) || papers.some((p) => p.demo),
    [questions, papers],
  )

  const unitLabels = useMemo(() => Array.from(new Set(chapters.map((c) => c.unit))), [chapters])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return chapters.filter((c) => {
      if (unitFilter !== 'All' && c.unit !== unitFilter) return false
      if (s && !c.chapter.toLowerCase().includes(s) && !c.subject.toLowerCase().includes(s)) return false
      return true
    })
  }, [chapters, search, unitFilter])

  const chartData = useMemo(
    () =>
      filtered.slice(0, 18).map((c) => ({
        name: c.chapter.length > 26 ? `${c.chapter.slice(0, 25)}…` : c.chapter,
        full: c.chapter,
        questions: c.questionCount,
      })),
    [filtered],
  )

  /** Marks per unit, stacked by difficulty (top 12 units by marks). */
  const unitMarksData = useMemo(() => {
    const map = new Map<string, { unit: string; full: string; Easy: number; Medium: number; Hard: number; marks: number }>()
    for (const q of questions) {
      let e = map.get(q.unit)
      if (!e) {
        e = { unit: q.unit.length > 24 ? `${q.unit.slice(0, 23)}…` : q.unit, full: q.unit, Easy: 0, Medium: 0, Hard: 0, marks: 0 }
        map.set(q.unit, e)
      }
      e[q.difficulty] += (q.marks ?? 0)
      e.marks += (q.marks ?? 0)
    }
    return Array.from(map.values()).sort((a, b) => b.marks - a.marks).slice(0, 12)
  }, [questions])

  const openUnitSources = (unitLabel: string) =>
    setSource({ title: unitLabel, questions: questions.filter((q) => q.unit === unitLabel) })

  // ── Chapter detail (selected row / bar) ────────────────────────────────────
  const activeChapter = selectedChapter ?? chapters[0] ?? null

  const chapterQuestions = useMemo(
    () =>
      activeChapter
        ? questions.filter((q) => q.chapter === activeChapter.chapter && q.subjectId === activeChapter.subjectId)
        : [],
    [questions, activeChapter],
  )

  const chapterTopicRank = useMemo(() => {
    const map = new Map<string, { topic: string; questions: number; marks: number }>()
    for (const q of chapterQuestions) {
      const e = map.get(q.topic) ?? { topic: q.topic, questions: 0, marks: 0 }
      e.questions += 1
      e.marks += (q.marks ?? 0)
      map.set(q.topic, e)
    }
    return Array.from(map.values()).sort((a, b) => b.questions - a.questions || b.marks - a.marks)
  }, [chapterQuestions])

  const chapterTimeline = useMemo(() => {
    const years = Array.from(new Set(chapterQuestions.map((q) => q.year))).sort((a, b) => a - b)
    return years.map((year) => ({
      year,
      questions: chapterQuestions.filter((q) => q.year === year).length,
    }))
  }, [chapterQuestions])

  const chapterPapers = useMemo(() => {
    const ids = Array.from(new Set(chapterQuestions.map((q) => q.paperId)))
    return ids
      .map((id) => papers.find((p) => p.id === id))
      .filter((p): p is Paper => !!p)
      .sort((a, b) => b.year - a.year)
  }, [chapterQuestions, papers])

  const mostExamined = chapters[0]

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Analytics · Chapters"
          title="Chapters & units"
          description="How the questions in scope distribute across the syllabus structure — chapters, units and the topics inside them."
        />
        <EmptyState
          icon={BookOpen}
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
        eyebrow="Analytics · Chapters"
        title="Chapters & units"
        description="Every statistic below is aggregated from the questions in scope. Select a chapter — from the chart or the table — to inspect its topics, its per-year history and the exact source questions."
        actions={
          <>
            <Link to="/analytics/topics" className="btn-ghost !py-2.5 !text-[13px]">Topic frequency</Link>
            <button
              className="btn-primary !py-2.5 !text-[13px]"
              onClick={() => exportChaptersCsv(filtered)}
              aria-label="Export chapters and units as CSV"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
          </>
        }
      />

      <FilterBar />

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Chapters in scope" value={chapters.length} icon={BookOpen} />
        <Stat label="Units in scope" value={units.length} icon={Layers} accent="academic" />
        <Stat label="Total marks" value={marks.total} icon={BarChart3} accent="gold" />
        <Stat
          label="Most examined chapter"
          value={truncate(mostExamined.chapter, 22)}
          sub={`${mostExamined.questionCount} questions · ${mostExamined.totalMarks} marks`}
          icon={Trophy}
          accent="lavender"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        {/* Chapter question counts */}
        <ChartCard
          className="xl:col-span-3"
          title="Questions by chapter"
          description="Top 18 chapters by question count in the current scope. Click a bar to open the chapter detail and its source questions."
          right={hasDemo ? <DemoBadge /> : undefined}
        >
          {chartData.length === 0 ? (
            <p className="py-10 text-center text-sm text-graphite-500">No chapters match your search.</p>
          ) : (
            <div className="h-[320px] w-full" role="img" aria-label="Horizontal bar chart of question counts by chapter">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }} barCategoryGap={6}>
                  <CartesianGrid stroke="#E2DED4" horizontal={false} />
                  <XAxis type="number" stroke="#9A9B9F" tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={168} stroke="#9A9B9F" tick={{ fontSize: 11, fontFamily: 'DM Sans' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(23,37,84,0.05)' }}
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v: number, _n, p) => [`${v} questions`, p.payload.full]}
                    labelFormatter={() => ''}
                  />
                  <Bar
                    dataKey="questions"
                    radius={[0, 5, 5, 0]}
                    onClick={(_, i) => {
                      const row = filtered[i]
                      if (row) setSelectedChapter(row)
                    }}
                    className="cursor-pointer"
                  >
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#C6A76B' : i < 5 ? '#172554' : '#5478A8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        {/* Marks by unit, stacked by difficulty */}
        <ChartCard
          className="xl:col-span-2"
          title="Marks by unit"
          description="Top 12 units by marks, split by question difficulty. Click a segment for the source questions."
          right={hasDemo ? <DemoBadge /> : undefined}
        >
          <div className="h-[320px] w-full" role="img" aria-label="Stacked bar chart of marks by unit">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={unitMarksData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid stroke="#E2DED4" horizontal={false} />
                <XAxis type="number" stroke="#9A9B9F" tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="unit" width={120} stroke="#9A9B9F" tick={{ fontSize: 11, fontFamily: 'DM Sans' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(23,37,84,0.05)' }}
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number, _n, p) => [`${v} marks`, p.payload.full]}
                  labelFormatter={() => ''}
                />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'DM Sans' }} />
                <Bar dataKey="Easy" stackId="a" name="Easy" fill="#D6BC89" onClick={(_, i) => { const row = unitMarksData[i]; if (row) openUnitSources(row.full) }} />
                <Bar dataKey="Medium" stackId="a" name="Medium" fill="#5478A8" onClick={(_, i) => { const row = unitMarksData[i]; if (row) openUnitSources(row.full) }} />
                <Bar dataKey="Hard" stackId="a" name="Hard" fill="#172554" onClick={(_, i) => { const row = unitMarksData[i]; if (row) openUnitSources(row.full) }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Controls */}
      <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter chapters by unit">
          <button
            onClick={() => setUnitFilter('All')}
            aria-pressed={unitFilter === 'All'}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-grotesk font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 ${unitFilter === 'All' ? 'border-navy bg-navy text-ivory-100' : 'border-ivory-300 bg-white text-graphite-600 hover:border-graphite-400'}`}
          >
            All units
          </button>
          {unitLabels.map((u) => (
            <button
              key={u}
              onClick={() => setUnitFilter(u)}
              title={u}
              aria-pressed={unitFilter === u}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-grotesk font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 ${unitFilter === u ? 'border-navy bg-navy text-ivory-100' : 'border-ivory-300 bg-white text-graphite-600 hover:border-graphite-400'}`}
            >
              {u.split(':')[0]}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chapters or subjects…"
          aria-label="Search chapters"
          className="field md:w-72"
        />
      </div>

      {/* Unit coverage table */}
      <SectionTitle
        kicker="Units"
        title="Unit coverage"
        description="Question load and syllabus coverage per unit in the current scope. Select a row to open the source questions."
        right={hasDemo ? <DemoBadge /> : undefined}
      />
      <Card className="p-5 md:p-6">
        <TableWrap>
          <thead>
            <tr>
              <Th>Unit</Th>
              <Th>Subject</Th>
              <Th className="text-right">Questions</Th>
              <Th className="text-right">Marks</Th>
              <Th className="text-right">Chapters</Th>
              <Th className="text-right">Share of questions</Th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <tr
                key={`${u.subjectId}-${u.unit}`}
                onClick={() => setSource({ title: u.unit, questions: questions.filter((q) => q.unit === u.unit && q.subjectId === u.subjectId) })}
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setSource({ title: u.unit, questions: questions.filter((q) => q.unit === u.unit && q.subjectId === u.subjectId) })}
                className="cursor-pointer transition-colors hover:bg-ivory-50 focus:outline-none focus-visible:bg-ivory-100"
              >
                <Td>
                  <span className="font-medium text-graphite">{u.unit}</span>
                </Td>
                <Td className="text-graphite-500">{u.subject}</Td>
                <Td className="text-right font-mono text-graphite">{u.questionCount}</Td>
                <Td className="text-right font-mono">{u.totalMarks}</Td>
                <Td className="text-right font-mono">{u.chapterCount}</Td>
                <Td className="text-right font-mono text-navy">{u.coveragePercentage}%</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>

      {/* Chapter table */}
      <SectionTitle
        kicker="Ranking"
        title="Chapter table"
        description="Sorted by question count. Select a row to inspect the chapter detail and its provenance."
      />
      <Card className="p-5 md:p-6">
        <TableWrap>
          <thead>
            <tr>
              <Th className="w-10">#</Th>
              <Th>Chapter</Th>
              <Th>Unit</Th>
              <Th>Subject</Th>
              <Th className="text-right">Questions</Th>
              <Th className="text-right">Marks</Th>
              <Th className="text-right">Avg</Th>
              <Th className="text-right">Coverage</Th>
              <Th className="text-right">Topics</Th>
              <Th className="text-right">Years</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 60).map((c, i) => (
              <tr
                key={`${c.subjectId}-${c.chapter}`}
                onClick={() => setSelectedChapter(c)}
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedChapter(c)}
                className="cursor-pointer transition-colors hover:bg-ivory-50 focus:outline-none focus-visible:bg-ivory-100"
              >
                <Td className="font-mono text-[11px] text-graphite-400">{i + 1}</Td>
                <Td>
                  <span className="font-medium text-graphite">{c.chapter}</span>
                </Td>
                <Td className="text-graphite-500">{c.unit.split(':')[0]}</Td>
                <Td className="text-graphite-500">{c.subject}</Td>
                <Td className="text-right font-mono text-graphite">{c.questionCount}</Td>
                <Td className="text-right font-mono">{c.totalMarks}</Td>
                <Td className="text-right font-mono">{c.avgMarks}</Td>
                <Td className="text-right">
                  <span className="font-mono text-navy">{c.coveragePercentage}%</span>
                </Td>
                <Td className="text-right font-mono">{c.topicCount}</Td>
                <Td className="text-right font-mono text-graphite-500">
                  {c.years.length === 0
                    ? '—'
                    : c.years.length === 1
                      ? c.years[0]
                      : `${c.years[0]}–${c.years[c.years.length - 1]}`}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
        {filtered.length > 60 && (
          <p className="mt-4 font-mono text-[11px] text-graphite-400">
            Showing 60 of {filtered.length} chapters — refine the search or pick a unit to narrow the list.
          </p>
        )}
      </Card>

      {/* Topic concentration for the selected chapter */}
      <SectionTitle
        kicker="Topic concentration"
        title={`Topics inside ${activeChapter?.chapter ?? '—'}`}
        description="The chapter's topics ranked by question count — where the questions inside a chapter actually cluster. Select a different chapter in the table above to change the selection."
      />
      <Card className="p-5 md:p-6">
        {chapterTopicRank.length === 0 ? (
          <p className="py-6 text-center text-sm text-graphite-500">No topics in scope for this chapter.</p>
        ) : (
          <ul className="space-y-2">
            {chapterTopicRank.map((t, i) => {
              const max = chapterTopicRank[0].questions || 1
              return (
                <li
                  key={t.topic}
                  onClick={() => setSource({ title: t.topic, questions: questions.filter((q) => q.topic === t.topic && q.chapter === activeChapter?.chapter && q.subjectId === activeChapter?.subjectId) })}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSource({ title: t.topic, questions: questions.filter((q) => q.topic === t.topic && q.chapter === activeChapter?.chapter && q.subjectId === activeChapter?.subjectId) })}
                  className="flex cursor-pointer items-center gap-4 rounded-xl border border-ivory-200 bg-ivory-50 px-4 py-3 transition-colors hover:border-ivory-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
                >
                  <span className="w-6 shrink-0 font-mono text-[11px] text-graphite-400">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-graphite">{t.topic}</span>
                    <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-ivory-200">
                      <span
                        className="block h-full rounded-full bg-navy"
                        style={{ width: `${Math.max(6, (t.questions / max) * 100)}%` }}
                      />
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-graphite-500">{t.questions} q</span>
                  <span className="shrink-0 font-mono text-[11px] text-navy">{t.marks} marks</span>
                </li>
              )
            })}
          </ul>
        )}
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">
          Counts reflect the questions currently in scope.
        </p>
      </Card>

      {/* Chapter detail — provenance panel */}
      <Modal open={!!selectedChapter} onClose={() => setSelectedChapter(null)} title={selectedChapter?.chapter ?? ''} wide>
        {selectedChapter && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="navy">{selectedChapter.unit.split(':')[0]}</Badge>
              <Badge tone="blue" title={selectedChapter.unit}>{truncate(selectedChapter.unit, 42)}</Badge>
              <Badge tone="grey">{selectedChapter.subject}</Badge>
              <Badge tone="gold" title="Share of questions in scope belonging to this chapter">
                {selectedChapter.coveragePercentage}% of questions
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Questions" value={selectedChapter.questionCount} />
              <Stat label="Total marks" value={selectedChapter.totalMarks} accent="gold" />
              <Stat label="Avg marks" value={selectedChapter.avgMarks} accent="academic" />
              <Stat label="Topics seen" value={selectedChapter.topicCount} accent="lavender" />
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-lg text-graphite">Topics in this chapter ({chapterTopicRank.length})</h4>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">Ranked by questions</span>
              </div>
              <ul className="space-y-2">
                {chapterTopicRank.map((t, i) => (
                  <li key={t.topic} className="flex items-center gap-3 rounded-xl border border-ivory-200 bg-ivory-50 px-4 py-2.5">
                    <span className="w-5 shrink-0 font-mono text-[11px] text-graphite-400">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-graphite-700">{t.topic}</span>
                    <span className="shrink-0 font-mono text-[11px] text-graphite-500">{t.questions} q</span>
                    <span className="shrink-0 font-mono text-[11px] text-navy">{t.marks}</span>
                  </li>
                ))}
              </ul>
            </div>

            <ChartCard title="Questions per year" description="Occurrences inside the current filter scope — not a prediction.">
              <div className="h-[180px] w-full" role="img" aria-label="Bar chart of questions per year for the selected chapter">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chapterTimeline} margin={{ left: -18, right: 12, top: 8, bottom: 0 }}>
                    <CartesianGrid stroke="#E2DED4" vertical={false} />
                    <XAxis dataKey="year" stroke="#9A9B9F" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis stroke="#9A9B9F" tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(23,37,84,0.05)' }} formatter={(v: number) => [`${v} questions`]} />
                    <Bar dataKey="questions" fill="#172554" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <div>
              <h4 className="text-lg text-graphite">Source papers ({chapterPapers.length})</h4>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {chapterPapers.map((p) => (
                  <li key={p.id} className="rounded-xl border border-ivory-200 bg-ivory-50 px-4 py-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">
                      {p.year} · {p.examType} · {p.session}
                    </p>
                    <p className="mt-1 truncate text-sm text-graphite-700" title={p.filename}>{p.filename}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-lg text-graphite">Source questions ({chapterQuestions.length})</h4>
                <Link
                  to={`/questions?chapter=${encodeURIComponent(selectedChapter.chapter)}`}
                  className="inline-flex items-center gap-1 text-xs font-grotesk font-medium text-navy hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
                >
                  Open in explorer <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <QuestionList questions={chapterQuestions} papers={papers} />
            </div>
          </div>
        )}
      </Modal>

      <SourceModal source={source} onClose={() => setSource(null)} papers={papers} />

      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">
        Coverage % = share of the questions in scope. Values recalculate with the global filters.
      </p>
    </div>
  )
}
