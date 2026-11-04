import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import {
  AlertTriangle, BookOpen, CalendarRange, CalendarX, Download, FileText,
  History, Target,
} from 'lucide-react'
import { useAnalytics } from '../hooks/useAnalytics'
import { usePaperTrail } from '../store/PaperTrailStore'
import {
  Badge, Card, ChartCard, CHART_COLORS, ConfidenceBadge, DemoBadge, EmptyState, Modal,
  PageHeader, SectionTitle, Stat, TableWrap, Td, Th,
} from '../components/ui'
import { FilterBar } from '../components/FilterBar'
import { exportCoverageCsv } from '../services/reportExporter'
import { Paper, Question } from '../types'

/**
 * Syllabus coverage — what the uploaded papers actually contain, split into
 * "observed" and "not observed". Absence is always reported as absence from
 * this dataset, never as a claim about what was or was not ever examined.
 */

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 12,
  border: '1px solid #E2DED4',
  fontSize: 12,
  fontFamily: 'DM Sans',
  boxShadow: '0 12px 32px -12px rgba(32,33,36,0.14)',
}

const AXIS_TICK = { fontSize: 11, fontFamily: 'IBM Plex Mono' }

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

const QualityRow: React.FC<{ label: string; value: React.ReactNode; note?: string }> = ({
  label, value, note,
}) => (
  <div className="flex items-start justify-between gap-4 py-3">
    <div className="min-w-0">
      <p className="text-sm font-medium text-graphite">{label}</p>
      {note && <p className="mt-0.5 text-xs leading-snug text-graphite-500">{note}</p>}
    </div>
    <span className="shrink-0 font-mono text-sm text-navy">{value}</span>
  </div>
)

export const CoveragePage: React.FC = () => {
  const { questions, papers, coverage, overview, filtersActive } = useAnalytics()
  const store = usePaperTrail()
  const [search, setSearch] = useState('')
  const [source, setSource] = useState<{ title: string; questions: Question[] } | null>(null)

  const hasDemo = useMemo(
    () => questions.some((q) => q.demo) || papers.some((p) => p.demo),
    [questions, papers],
  )

  const observedRows = useMemo(() => coverage.rows.filter((r) => r.observed), [coverage.rows])
  const missingRows = useMemo(() => coverage.rows.filter((r) => !r.observed), [coverage.rows])

  const matches = (row: { unit: string; chapter: string; topic: string }, s: string) =>
    !s || row.unit.toLowerCase().includes(s) || row.chapter.toLowerCase().includes(s) || row.topic.toLowerCase().includes(s)

  const s = search.trim().toLowerCase()
  const observedShown = useMemo(
    () => observedRows.filter((r) => matches(r, s)).slice(0, 60),
    [observedRows, s],
  )
  const missingShown = useMemo(
    () => missingRows.filter((r) => matches(r, s)).slice(0, 60),
    [missingRows, s],
  )

  /** Year × session slots (using the exam types observed) with no paper at all. */
  const sessionStats = useMemo(() => {
    const types = Array.from(new Set(papers.map((p) => p.examType)))
    const years = overview.yearsRepresented
    if (!years.length || !types.length) return { missing: 0, expected: 0 }
    const min = years[0]
    const max = years[years.length - 1]
    const present = new Set(papers.map((p) => `${p.year}::${p.examType}`))
    const expected = (max - min + 1) * types.length
    return { missing: Math.max(0, expected - present.size), expected }
  }, [papers, overview.yearsRepresented])

  /** Covered / total syllabus topics per unit. */
  const unitCoverage = useMemo(() => {
    const map = new Map<string, { unit: string; full: string; covered: number; total: number }>()
    for (const r of coverage.rows) {
      let e = map.get(r.unit)
      if (!e) {
        e = { unit: r.unit.length > 24 ? `${r.unit.slice(0, 23)}…` : r.unit, full: r.unit, covered: 0, total: 0 }
        map.set(r.unit, e)
      }
      e.total += 1
      if (r.observed) e.covered += 1
    }
    return Array.from(map.values())
      .map((e) => ({ ...e, pct: e.total ? Math.round((e.covered / e.total) * 100) : 0 }))
      .sort((a, b) => a.pct - b.pct || b.total - a.total)
      .slice(0, 14)
  }, [coverage.rows])

  const warnings = useMemo(
    () =>
      papers
        .flatMap((p) => (p.extraction?.warnings ?? []).map((w) => ({ file: p.filename, warning: w })))
        .slice(0, 8),
    [papers],
  )

  const openTopicSources = (topic: string, subject: string) =>
    setSource({ title: topic, questions: questions.filter((q) => q.topic === topic && q.subject === subject) })

  const yearsLabel = overview.yearsRepresented.length
    ? `${overview.yearsRepresented[0]}–${overview.yearsRepresented[overview.yearsRepresented.length - 1]}`
    : '—'

  // ── Empty states ───────────────────────────────────────────────────────────
  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Analytics · Coverage"
          title="Syllabus coverage"
          description="Which syllabus topics appear in the uploaded papers — and which ones have not been observed in them."
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

  if (coverage.rows.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Analytics · Coverage"
          title="Syllabus coverage"
          description="Which syllabus topics appear in the uploaded papers — and which ones have not been observed in them."
        />
        <FilterBar />
        <div className="mt-6">
          <EmptyState
            icon={Target}
            title="No syllabus loaded for the subjects in scope"
            description="Coverage is computed by matching questions against each subject's syllabus. Add a syllabus for the current subjects, or clear the filters to widen the scope."
            action={{ label: 'Manage syllabus', to: '/syllabus' }}
            secondaryAction={
              filtersActive ? <button className="btn-ghost" onClick={store.resetFilters}>Clear filters</button> : undefined
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Analytics · Coverage"
        title="Syllabus coverage"
        description="Topics are matched against the syllabus of each subject in scope. Select any observed topic to inspect the exact questions that produced the number."
        actions={
          <>
            <Link to="/syllabus" className="btn-ghost !py-2.5 !text-[13px]">Manage syllabus</Link>
            <button
              className="btn-primary !py-2.5 !text-[13px]"
              onClick={() => exportCoverageCsv(coverage.rows)}
              aria-label="Export syllabus coverage as CSV"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
          </>
        }
      />

      <FilterBar />

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat
          label="Syllabus coverage"
          value={`${coverage.percentage}%`}
          sub={`${coverage.covered} of ${coverage.total} topics observed`}
          icon={Target}
          accent="gold"
          hint="observed in the uploaded papers"
        />
        <Stat label="Papers analysed" value={overview.totalPapers} sub={`${overview.totalQuestions} questions`} icon={FileText} />
        <Stat label="Years represented" value={overview.yearsRepresented.length} sub={yearsLabel} icon={CalendarRange} accent="academic" />
        <Stat
          label="Missing years"
          value={overview.missingYears.length}
          sub={overview.missingYears.length ? overview.missingYears.join(', ') : 'none in the range'}
          icon={History}
          accent="lavender"
        />
        <Stat
          label="Missing exam sessions"
          value={sessionStats.missing}
          sub={sessionStats.expected ? `${sessionStats.missing} of ${sessionStats.expected} year × session slots` : 'no papers in scope'}
          icon={CalendarX}
          accent="academic"
        />
        <Stat
          label="Extraction warnings"
          value={overview.extractionWarnings}
          sub={`${overview.ocrPapers} papers used OCR`}
          icon={AlertTriangle}
          accent="gold"
        />
      </div>

      {/* Honesty note */}
      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-gold/40 bg-gold-100 px-5 py-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" aria-hidden />
        <p className="text-sm font-medium leading-relaxed text-graphite-700">
          The uploaded dataset may be incomplete — absence here does not mean a topic was never examined.
        </p>
      </div>

      {/* Coverage search */}
      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">
          Coverage recalculates with the global filters.
        </p>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search units, chapters or topics…"
          aria-label="Search coverage topics"
          className="field md:w-80"
        />
      </div>

      {/* Observed group */}
      <SectionTitle
        kicker="Coverage"
        title="Observed in the uploaded papers"
        description="Syllabus topics that appear in at least one question inside the current scope. Select a row to inspect the source questions."
        right={<Badge tone="green">{coverage.covered} topics</Badge>}
      />
      <Card className="p-5 md:p-6">
        {observedShown.length === 0 ? (
          <p className="py-8 text-center text-sm text-graphite-500">No observed topic matches your search.</p>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Unit</Th>
                <Th>Chapter</Th>
                <Th>Topic</Th>
                <Th className="text-right">Questions</Th>
                <Th className="text-right">Marks</Th>
                <Th className="text-right">Last appearance</Th>
              </tr>
            </thead>
            <tbody>
              {observedShown.map((r) => (
                <tr
                  key={`${r.subject}-${r.topic}`}
                  onClick={() => openTopicSources(r.topic, r.subject)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && openTopicSources(r.topic, r.subject)}
                  className="cursor-pointer transition-colors hover:bg-ivory-50 focus:outline-none focus-visible:bg-ivory-100"
                >
                  <Td className="text-graphite-500">{r.unit.split(':')[0]}</Td>
                  <Td className="text-graphite-500">{r.chapter}</Td>
                  <Td>
                    <span className="font-medium text-graphite">{r.topic}</span>
                    <span className="ml-2 font-mono text-[10px] text-graphite-400">{r.subject}</span>
                  </Td>
                  <Td className="text-right font-mono text-graphite">{r.questionCount}</Td>
                  <Td className="text-right font-mono">{r.totalMarks}</Td>
                  <Td className="text-right font-mono text-navy">{r.lastAppearance ?? '—'}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
        {observedRows.length > observedShown.length && (
          <p className="mt-4 font-mono text-[11px] text-graphite-400">
            Showing {observedShown.length} of {observedRows.length} observed topics — refine the search to narrow the list.
          </p>
        )}
      </Card>

      {/* Not observed group */}
      <SectionTitle
        kicker="Coverage"
        title="Not observed in the uploaded papers"
        description="Topics listed in the syllabus for which no question was found in the current scope. They may still have been examined in papers that are not part of this dataset."
        right={<Badge tone="gold">{coverage.total - coverage.covered} topics</Badge>}
      />
      <Card className="p-5 md:p-6">
        {missingShown.length === 0 ? (
          <p className="py-8 text-center text-sm text-graphite-500">
            Every syllabus topic in scope has been observed in the uploaded papers.
          </p>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Unit</Th>
                <Th>Chapter</Th>
                <Th>Topic</Th>
                <Th className="text-right">Questions</Th>
                <Th className="text-right">Marks</Th>
                <Th className="text-right">Last appearance</Th>
              </tr>
            </thead>
            <tbody>
              {missingShown.map((r) => (
                <tr key={`${r.subject}-${r.topic}`} className="transition-colors hover:bg-ivory-50">
                  <Td className="text-graphite-500">{r.unit.split(':')[0]}</Td>
                  <Td className="text-graphite-500">{r.chapter}</Td>
                  <Td>
                    <span className="font-medium text-graphite">{r.topic}</span>
                    <span className="ml-2 font-mono text-[10px] text-graphite-400">{r.subject}</span>
                  </Td>
                  <Td className="text-right font-mono text-graphite-400">0</Td>
                  <Td className="text-right font-mono text-graphite-400">0</Td>
                  <Td className="text-right font-mono text-graphite-400">not observed</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
        {missingRows.length > missingShown.length && (
          <p className="mt-4 font-mono text-[11px] text-graphite-400">
            Showing {missingShown.length} of {missingRows.length} topics — refine the search to narrow the list.
          </p>
        )}
      </Card>

      {/* Unit-level coverage */}
      <SectionTitle
        kicker="Unit level"
        title="Coverage by unit"
        description="Syllabus topics observed in the uploaded papers, out of the topics listed for each unit — lowest coverage first."
      />
      <ChartCard
        title="Observed topics per unit"
        description="Click a bar to filter your reading of the list above; the CSV export carries every row."
        right={hasDemo ? <DemoBadge /> : undefined}
      >
        <div className="h-[320px] w-full" role="img" aria-label="Bar chart of syllabus coverage percentage by unit">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={unitCoverage} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
              <CartesianGrid stroke="#E2DED4" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} stroke="#9A9B9F" tick={AXIS_TICK} axisLine={false} tickLine={false} unit="%" />
              <YAxis type="category" dataKey="unit" width={148} stroke="#9A9B9F" tick={{ fontSize: 11, fontFamily: 'DM Sans' }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(23,37,84,0.05)' }}
                contentStyle={TOOLTIP_STYLE}
                formatter={(v: number, _n, p) => [`${p.payload.covered}/${p.payload.total} topics`, p.payload.full]}
                labelFormatter={() => ''}
              />
              <Bar dataKey="pct" radius={[0, 5, 5, 0]}>
                {unitCoverage.map((u, i) => (
                  <Cell
                    key={i}
                    fill={u.pct >= 75 ? CHART_COLORS[0] : u.pct >= 40 ? CHART_COLORS[1] : CHART_COLORS[3]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Dataset quality */}
      <SectionTitle
        kicker="Quality"
        title="Dataset quality"
        description="Diagnostics recorded while the papers were parsed and classified — reported as-is, so you can judge how much weight the numbers above deserve."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5 md:p-6">
          <div className="divide-y divide-ivory-200">
            <QualityRow
              label="Extraction warnings"
              value={overview.extractionWarnings}
              note="Warnings recorded while pulling text out of the PDFs."
            />
            <QualityRow
              label="Papers that used OCR"
              value={overview.ocrPapers}
              note="Scanned pages that required optical character recognition."
            />
            <QualityRow
              label="Questions flagged for review"
              value={overview.needsReviewCount}
              note="Classification looked uncertain and has not been confirmed yet."
            />
            <QualityRow
              label="Low-confidence classifications"
              value={overview.lowConfidenceCount}
              note="Heuristic confidence below 50%."
            />
            <QualityRow
              label="Average classification confidence"
              value={`${Math.round(overview.avgConfidence * 100)}%`}
              note="Heuristic confidence, not AI accuracy."
            />
            <QualityRow
              label="Demo / uploaded papers"
              value={`${overview.demoPapers} / ${overview.userPapers}`}
              note="Illustrative demo papers versus papers you uploaded."
            />
          </div>
        </Card>

        <Card className="p-5 md:p-6">
          <h3 className="text-xl text-graphite">What these numbers mean</h3>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-graphite-600">
            <p>
              Classification confidence is a heuristic syllabus/keyword match score — heuristic confidence, not AI
              accuracy. It reflects how closely a question's wording matched its assigned syllabus entry; a human
              confirming the classification always outranks it.
            </p>
            <p>
              Extraction warnings describe what actually happened while reading a file (skipped pages, low OCR
              confidence, unreadable sections). They are not failures to hide: they bound how complete the
              extraction — and therefore this coverage view — can be.
            </p>
            <p>
              Coverage is computed only from the syllabus attached to each subject in scope. A topic missing here may
              be absent from the dataset, absent from the attached syllabus, or simply phrased differently in the
              paper.
            </p>
          </div>

          <h4 className="mt-5 text-lg text-graphite">Recent extraction warnings</h4>
          {warnings.length === 0 ? (
            <p className="mt-2 text-sm text-graphite-500">No extraction warnings recorded for the papers in scope.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {warnings.map((w, i) => (
                <li key={`${w.file}-${i}`} className="rounded-xl border border-ivory-200 bg-ivory-50 px-4 py-3">
                  <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500" title={w.file}>
                    {w.file}
                  </p>
                  <p className="mt-1 text-sm text-graphite-700">{w.warning}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge tone="grey">{overview.totalPapers} papers</Badge>
            <Badge tone="blue">{overview.totalQuestions} questions</Badge>
            {hasDemo && <DemoBadge />}
          </div>
        </Card>
      </div>

      <Modal open={!!source} onClose={() => setSource(null)} title={source?.title ?? ''} wide>
        {source && (
          <div className="space-y-4">
            <p className="max-w-prose2 text-sm leading-relaxed text-graphite-600">
              Observed in {source.questions.length} question{source.questions.length === 1 ? '' : 's'} currently in
              scope. Every row below is one of the questions behind this coverage entry.
            </p>
            <QuestionList questions={source.questions} papers={papers} />
          </div>
        )}
      </Modal>

      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">
        Last appearance = most recent year in which the topic was observed inside the current scope.
      </p>
    </div>
  )
}
