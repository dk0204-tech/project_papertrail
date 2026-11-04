import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  LineChart, Line, Legend,
} from 'recharts'
import { ArrowUpRight, CalendarRange, FileText, Layers, MessageSquareQuote } from 'lucide-react'
import { useAnalytics } from '../hooks/useAnalytics'
import { usePaperTrail } from '../store/PaperTrailStore'
import { Badge, Card, ChartCard, CHART_COLORS, ConfidenceBadge, EmptyState, Modal, PageHeader, SectionTitle, Stat, TableWrap, Td, Th, DemoBadge, truncate } from '../components/ui'
import { FilterBar } from '../components/FilterBar'
import { TopicAnalytics } from '../types'

/**
 * Topic frequency analytics — the reference implementation for analytics
 * pages. Every number comes from useAnalytics(); every chart element opens
 * the exact questions behind it (provenance requirement).
 */
export const TopicAnalyticsPage: React.FC = () => {
  const { topics, questions, papers, filters, filtersActive } = useAnalytics()
  const store = usePaperTrail()
  const [search, setSearch] = useState('')
  const [unitFilter, setUnitFilter] = useState('All')
  const [selected, setSelected] = useState<TopicAnalytics | null>(null)

  const units = useMemo(() => Array.from(new Set(topics.map((t) => t.unit))), [topics])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return topics.filter((t) => {
      if (unitFilter !== 'All' && t.unit !== unitFilter) return false
      if (s && !t.topic.toLowerCase().includes(s) && !t.chapter.toLowerCase().includes(s)) return false
      return true
    })
  }, [topics, search, unitFilter])

  const chartData = useMemo(
    () => filtered.slice(0, 16).map((t) => ({ name: t.topic.length > 26 ? `${t.topic.slice(0, 25)}…` : t.topic, full: t.topic, questions: t.totalQuestions, marks: t.totalMarks })),
    [filtered],
  )

  const subjectQuestions = useMemo(
    () => (selected ? questions.filter((q) => q.topic === selected.topic) : []),
    [questions, selected],
  )

  const timeline = useMemo(() => {
    if (!selected) return []
    const years = Array.from(new Set(questions.map((q) => q.year))).sort()
    return years.map((year) => ({
      year,
      questions: subjectQuestions.filter((q) => q.year === year).length,
      marks: subjectQuestions.filter((q) => q.year === year).reduce((s, q) => s + (q.marks ?? 0), 0),
    }))
  }, [selected, questions, subjectQuestions])

  if (topics.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
        <PageHeader eyebrow="Analytics · Topics" title="Topic frequency" description="How often each syllabus topic appears across the papers in scope." />
        <EmptyState
          icon={Layers}
          title="No questions match the current filters"
          description={filtersActive
            ? 'The active filters exclude every question in the dataset. Clear some filters, or upload papers for this scope.'
            : 'There are no questions in the dataset yet. Upload question papers or enable the illustrative demo dataset in Settings.'}
          action={{ label: 'Upload papers', to: '/upload' }}
          secondaryAction={filtersActive ? <button className="btn-ghost" onClick={store.resetFilters}>Clear filters</button> : undefined}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Analytics · Topics"
        title="Topic frequency"
        description="Every statistic below is aggregated from the questions in scope. Select any topic to inspect the exact questions and source papers behind the number."
        actions={
          <>
            <Link to="/analytics/chapters" className="btn-ghost !py-2.5 !text-[13px]">Chapters & units</Link>
            <Link to="/questions" className="btn-primary !py-2.5 !text-[13px]">Open question explorer</Link>
          </>
        }
      />

      <FilterBar />

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Topics in scope" value={topics.length} icon={Layers} />
        <Stat label="Questions analysed" value={questions.length} icon={MessageSquareQuote} accent="academic" />
        <Stat label="Papers in scope" value={papers.length} icon={FileText} accent="gold" />
        <Stat
          label="Most frequent topic"
          value={truncate(topics[0].topic, 22)}
          sub={`${topics[0].totalQuestions} questions · ${topics[0].frequencyPercentage}% of papers`}
          icon={CalendarRange}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        {/* Frequency chart */}
        <ChartCard
          className="xl:col-span-3"
          title="Question frequency by topic"
          description="Top 16 topics by question count in the current scope. Click a bar to open the source questions."
          right={<DemoBadge />}
        >
          {chartData.length === 0 ? (
            <p className="py-10 text-center text-sm text-graphite-500">No topics match your search.</p>
          ) : (
            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }} barCategoryGap={6}>
                  <CartesianGrid stroke="#E2DED4" horizontal={false} />
                  <XAxis type="number" stroke="#9A9B9F" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={168} stroke="#9A9B9F" tick={{ fontSize: 11, fontFamily: 'DM Sans' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(23,37,84,0.05)' }}
                    contentStyle={{ borderRadius: 12, border: '1px solid #E2DED4', fontSize: 12, fontFamily: 'DM Sans', boxShadow: '0 12px 32px -12px rgba(32,33,36,0.14)' }}
                    formatter={(v: number, _n, p) => [`${v} questions`, p.payload.full]}
                    labelFormatter={() => ''}
                  />
                  <Bar dataKey="questions" radius={[0, 5, 5, 0]} onClick={(_, i) => setSelected(filtered[i])} className="cursor-pointer">
                    {chartData.map((_, i) => <Cell key={i} fill={i === 0 ? '#C6A76B' : i < 5 ? '#172554' : '#5478A8'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        {/* Unit distribution */}
        <ChartCard
          className="xl:col-span-2"
          title="Questions by unit"
          description="Where the marks concentrate inside the syllabus structure."
        >
          <div className="h-[340px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={units.map((u) => ({ name: u.split(':')[0].replace('Unit ', 'U'), full: u, questions: topics.filter((t) => t.unit === u).reduce((s, t) => s + t.totalQuestions, 0) }))}>
                <CartesianGrid stroke="#E2DED4" vertical={false} />
                <XAxis dataKey="name" stroke="#9A9B9F" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
                <YAxis stroke="#9A9B9F" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #E2DED4', fontSize: 12, fontFamily: 'DM Sans' }}
                  formatter={(v: number, _n, p) => [`${v} questions`, p.payload.full]}
                  labelFormatter={() => ''}
                />
                <Bar dataKey="questions" fill="#B8B5E8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Controls */}
      <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setUnitFilter('All')}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-grotesk font-medium transition-all ${unitFilter === 'All' ? 'border-navy bg-navy text-ivory-100' : 'border-ivory-300 bg-white text-graphite-600 hover:border-graphite-400'}`}
          >
            All units
          </button>
          {units.map((u) => (
            <button
              key={u}
              onClick={() => setUnitFilter(u)}
              title={u}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-grotesk font-medium transition-all ${unitFilter === u ? 'border-navy bg-navy text-ivory-100' : 'border-ivory-300 bg-white text-graphite-600 hover:border-graphite-400'}`}
            >
              {u.split(':')[0].replace('Unit ', 'Unit ')}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search topics or chapters…"
          aria-label="Search topics"
          className="field md:w-72"
        />
      </div>

      {/* Ranking table */}
      <SectionTitle kicker="Ranking" title="Topic frequency table" description="Sorted by question count. Select a row to inspect provenance." />
      <Card className="p-5 md:p-6">
        <TableWrap>
          <thead>
            <tr>
              <Th className="w-10">#</Th>
              <Th>Topic</Th>
              <Th>Chapter</Th>
              <Th className="text-right">Questions</Th>
              <Th className="text-right">Papers</Th>
              <Th className="text-right">Years</Th>
              <Th className="text-right">Marks</Th>
              <Th className="text-right">Avg</Th>
              <Th className="text-right">Recurrence</Th>
              <Th className="text-right">Last seen</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 40).map((t, i) => (
              <tr
                key={`${t.subjectId}-${t.topic}`}
                onClick={() => setSelected(t)}
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setSelected(t)}
                className="cursor-pointer transition-colors hover:bg-ivory-50 focus:outline-none focus-visible:bg-ivory-100"
              >
                <Td className="font-mono text-[11px] text-graphite-400">{i + 1}</Td>
                <Td>
                  <span className="font-medium text-graphite">{t.topic}</span>
                  {topics.length > 0 && t.subject !== topics[0].subject && (
                    <span className="ml-2 font-mono text-[10px] text-graphite-400">{t.subject}</span>
                  )}
                </Td>
                <Td className="text-graphite-500">{t.chapter}</Td>
                <Td className="text-right font-mono text-graphite">{t.totalQuestions}</Td>
                <Td className="text-right font-mono">{t.papersContaining}</Td>
                <Td className="text-right font-mono">{t.yearsRepresented}</Td>
                <Td className="text-right font-mono">{t.totalMarks}</Td>
                <Td className="text-right font-mono">{t.avgMarks}</Td>
                <Td className="text-right">
                  <span className="font-mono text-navy">{t.frequencyPercentage}%</span>
                </Td>
                <Td className="text-right font-mono text-graphite-500">{t.lastAppearance ?? '—'}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
        {filtered.length > 40 && (
          <p className="mt-4 font-mono text-[11px] text-graphite-400">Showing 40 of {filtered.length} topics — refine the search to narrow the list.</p>
        )}
      </Card>

      {/* Topic detail — provenance panel */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.topic ?? ''} wide>
        {selected && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="navy">{selected.unit.split(':')[0]}</Badge>
              <Badge tone="blue">{selected.chapter}</Badge>
              <Badge tone="grey">{selected.subject}</Badge>
              <Badge tone="gold" title="Share of papers in scope containing this topic">{selected.frequencyPercentage}% of papers</Badge>
              {selected.consecutiveAppearances > 1 && <Badge tone="lavender">{selected.consecutiveAppearances} consecutive years</Badge>}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Questions" value={selected.totalQuestions} />
              <Stat label="Total marks" value={selected.totalMarks} accent="gold" />
              <Stat label="Avg marks" value={selected.avgMarks} accent="academic" />
              <Stat label="Years seen" value={selected.yearsRepresented} accent="lavender" />
            </div>

            <ChartCard title="Year-wise recurrence" description="Actual occurrences inside the current filter scope — not a prediction.">
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeline} margin={{ left: -18, right: 12, top: 8, bottom: 0 }}>
                    <CartesianGrid stroke="#E2DED4" vertical={false} />
                    <XAxis dataKey="year" stroke="#9A9B9F" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
                    <YAxis stroke="#9A9B9F" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2DED4', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'DM Sans' }} />
                    <Line type="monotone" dataKey="questions" stroke="#172554" strokeWidth={2} dot={{ r: 3, fill: '#172554' }} name="Questions" />
                    <Line type="monotone" dataKey="marks" stroke="#C6A76B" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: '#C6A76B' }} name="Marks" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-lg text-graphite">Source questions ({subjectQuestions.length})</h4>
                <Link to={`/questions?topic=${encodeURIComponent(selected.topic)}`} className="inline-flex items-center gap-1 text-xs font-grotesk font-medium text-navy hover:underline">
                  Open in explorer <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <ul className="space-y-3">
                {subjectQuestions.slice(0, 12).map((q) => {
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
              {subjectQuestions.length > 12 && (
                <p className="mt-3 font-mono text-[11px] text-graphite-400">…and {subjectQuestions.length - 12} more in the question explorer.</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
