import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Braces, Download, FileText, Printer } from 'lucide-react'
import { useAnalytics } from '../hooks/useAnalytics'
import {
  Badge, Card, ChartCard, CHART_COLORS, DemoBadge, EmptyState, PageHeader, Stat, TableWrap, Td, Th, truncate,
} from '../components/ui'
import { FilterBar } from '../components/FilterBar'
import { DEMO_DISCLAIMER } from '../data/demoSubjects'
import {
  exportQuestionsCsv, exportReportJson, exportTopicsCsv, printReport, ReportPayload,
} from '../services/reportExporter'

/**
 * Consolidated analytics report — one long-form, print-friendly document that
 * numbers every section ("01 —" … "17 —") and states, in its own words, what
 * the figures can and cannot claim. Every number comes from useAnalytics();
 * exports call the shared reportExporter functions.
 */

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 12, border: '1px solid #E2DED4', fontSize: 12, fontFamily: 'DM Sans',
}

const Section: React.FC<{
  n: number
  title: string
  lede?: string
  children: React.ReactNode
}> = ({ n, title, lede, children }) => (
  <section className="mt-10 border-t border-ivory-300 pt-8 first:mt-0 first:border-t-0 first:pt-0">
    <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)] md:gap-8">
      <div className="md:sticky md:top-[150px] md:self-start">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">
          {String(n).padStart(2, '0')} —
        </p>
        <h2 className="mt-1.5 text-xl leading-snug text-graphite md:text-2xl">{title}</h2>
        {lede && <p className="mt-2 text-xs leading-relaxed text-graphite-600">{lede}</p>}
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </div>
  </section>
)

const chartAxis = { stroke: '#9A9B9F', tick: { fontSize: 11, fontFamily: 'IBM Plex Mono' }, axisLine: false, tickLine: false }

export const ReportPage: React.FC = () => {
  const {
    overview, questions, papers, topics, chapters, trends, clusters, coverage, marks,
    subjectSummary, filters, filtersActive, store,
  } = useAnalytics()

  // ── Derived aggregates (purely from the in-scope data) ────────────────────
  const departments = useMemo(() => {
    const map = new Map<string, { papers: number; questions: number }>()
    for (const p of papers) {
      const e = map.get(p.department) ?? { papers: 0, questions: 0 }
      e.papers++
      map.set(p.department, e)
    }
    for (const q of questions) {
      const e = map.get(q.department) ?? { papers: 0, questions: 0 }
      e.questions++
      map.set(q.department, e)
    }
    return Array.from(map, ([name, v]) => ({ name, ...v })).sort((a, b) => b.questions - a.questions)
  }, [papers, questions])

  const semesterCounts = useMemo(() => {
    const counts = new Array(9).fill(0) as number[]
    for (const q of questions) counts[q.semester]++
    return counts
  }, [questions])

  const yearCounts = useMemo(() => {
    const map = new Map<number, number>()
    for (const p of papers) map.set(p.year, (map.get(p.year) ?? 0) + 1)
    return Array.from(map, ([year, count]) => ({ year, count })).sort((a, b) => a.year - b.year)
  }, [papers])

  const analysedSubjects = useMemo(
    () => subjectSummary.filter((s) => s.papers > 0 || s.questions > 0).sort((a, b) => b.questions - a.questions),
    [subjectSummary],
  )

  const chapterChart = useMemo(
    () => chapters.slice(0, 14).map((c) => ({
      name: c.chapter.length > 22 ? `${c.chapter.slice(0, 21)}…` : c.chapter,
      full: c.chapter, questions: c.questionCount, marks: c.totalMarks,
    })),
    [chapters],
  )

  const typeChart = useMemo(() => marks.byType.slice(0, 8).map((b) => ({ name: b.label, marks: b.marks, questions: b.questions })), [marks.byType])

  const difficultyChart = useMemo(() => {
    const order = ['Easy', 'Medium', 'Hard']
    return order.map((label) => {
      const b = marks.byDifficulty.find((x) => x.label === label)
      return { name: label, questions: b?.questions ?? 0, marks: b?.marks ?? 0 }
    })
  }, [marks.byDifficulty])

  const insight = useMemo(() => {
    const maxYear = trends.length ? trends[trends.length - 1].year : null
    const topByQuestions = topics.slice(0, 3)
    const topByMarks = [...topics].sort((a, b) => b.totalMarks - a.totalMarks).slice(0, 3)
    const recent = maxYear === null ? [] : topics.filter((t) => t.lastAppearance === maxYear).slice(0, 4)
    const byMarks = [...topics].sort((a, b) => b.totalMarks - a.totalMarks)
    const quartile = byMarks.length ? byMarks[Math.floor(byMarks.length / 4)]?.totalMarks ?? 0 : 0
    const highMarksLowFrequency = byMarks
      .filter((t) => t.totalMarks >= quartile && t.frequencyPercentage < 40)
      .slice(0, 4)
    return { maxYear, topByQuestions, topByMarks, recent, highMarksLowFrequency }
  }, [topics, trends])

  const limitations = useMemo<string[]>(() => {
    const out: string[] = []
    if (store.demoEnabled && overview.demoPapers > 0) {
      out.push(
        `Demo data is fictional: ${overview.demoPapers} of ${overview.totalPapers} papers in scope are illustrative examples bundled with the app — ${DEMO_DISCLAIMER}.`,
      )
    }
    if (overview.missingYears.length > 0) {
      out.push(
        `Missing academic years inside the observed range: ${overview.missingYears.join(', ')}. No papers were available for those years, so trends simply skip them.`,
      )
    }
    if (overview.ocrPapers > 0 || overview.extractionWarnings > 0) {
      out.push(
        `${overview.ocrPapers} paper(s) required OCR and ${overview.extractionWarnings} extraction warning(s) were recorded. Text recovered from scanned pages is best-effort and may contain reading errors.`,
      )
    }
    out.push(
      'Classification is explainable keyword matching — a heuristic, not an AI model. Confidence scores describe keyword overlap with the syllabus, not judgements about difficulty or importance.',
    )
    out.push(
      'The dataset may be incomplete: only papers you uploaded (plus bundled demo papers) are represented. A topic absent here means "not observed in the uploaded papers", never "never asked".',
    )
    if (filtersActive) {
      out.push(
        'Global filters are active — every figure in this report reflects the current filter scope rather than the whole archive.',
      )
    }
    return out
  }, [store.demoEnabled, overview, filtersActive])

  const onExportJson = () => {
    const payload: ReportPayload = {
      generatedAt: new Date().toISOString(),
      overview,
      disclaimer: DEMO_DISCLAIMER,
      filters: { ...filters },
      topics,
      chapters,
      coverage: coverage.rows,
      limitations,
    }
    exportReportJson(payload)
  }

  const onExportCsv = () => {
    exportTopicsCsv(topics)
    exportQuestionsCsv(questions)
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (questions.length === 0 || papers.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Report"
          title="Consolidated analytics report"
          description="Generated from the papers currently in scope — every figure traces back to source questions."
        />
        <EmptyState
          icon={FileText}
          title="Nothing to report yet"
          description={
            filtersActive
              ? 'The active filters exclude every paper in the archive. Clear the filters, or upload papers for this scope.'
              : 'Upload question papers (or enable the illustrative demo dataset in Settings) and the report will build itself from the extracted questions.'
          }
          action={{ label: 'Upload papers', to: '/upload' }}
          secondaryAction={
            filtersActive ? (
              <button className="btn-ghost" onClick={store.resetFilters}>Clear filters</button>
            ) : undefined
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Report"
        title="Consolidated analytics report"
        description="Generated from the papers currently in scope — every figure traces back to source questions."
        demo={store.demoEnabled && overview.demoPapers > 0}
        actions={
          <>
            <Link to="/analytics/topics" className="btn-ghost !py-2.5 !text-[13px]">Topic analytics</Link>
            <Link to="/questions" className="btn-primary !py-2.5 !text-[13px]">Open question explorer</Link>
          </>
        }
      />

      <FilterBar />

      {/* Sticky action bar — export & print controls (hidden when printing) */}
      <div className="no-print sticky top-16 z-40 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ivory-300 bg-white/95 px-4 py-3 shadow-lift backdrop-blur md:top-[68px]">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">
          <span className="h-1.5 w-1.5 rounded-full bg-academic" />
          {overview.totalPapers} papers · {overview.totalQuestions} questions in scope
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={onExportCsv} className="btn-ghost !px-4 !py-2 !text-[13px]" aria-label="Export topics and questions as CSV files">
            <Download className="h-4 w-4" /> Export CSV <span className="font-mono text-[10px] text-graphite-400">topics + questions</span>
          </button>
          <button onClick={onExportJson} className="btn-ghost !px-4 !py-2 !text-[13px]" aria-label="Export full report payload as JSON">
            <Braces className="h-4 w-4" /> Export JSON
          </button>
          <button onClick={printReport} className="btn-primary !px-4 !py-2 !text-[13px]" aria-label="Print this report or save it as a PDF">
            <Printer className="h-4 w-4" /> Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="mt-8">
        {/* 01 ─ Dataset overview */}
        <Section n={1} title="Dataset overview" lede="Everything below is scoped by the global filter bar.">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Papers in scope" value={overview.totalPapers} sub={`${overview.demoPapers} demo · ${overview.userPapers} uploaded`} />
            <Stat label="Questions analysed" value={overview.totalQuestions} accent="academic" />
            <Stat label="Subjects represented" value={overview.totalSubjects} accent="lavender" />
            <Stat label="Departments" value={overview.departments} accent="gold" />
          </div>
          <Card className="p-5">
            <p className="eyebrow text-graphite-500">Source split</p>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-ivory-200" role="img" aria-label={`${overview.demoPapers} demo papers and ${overview.userPapers} uploaded papers`}>
              <div className="bg-gold" style={{ width: `${(overview.demoPapers / (overview.totalPapers || 1)) * 100}%` }} />
              <div className="bg-navy" style={{ width: `${(overview.userPapers / (overview.totalPapers || 1)) * 100}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-graphite-600">
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-gold" /> Demo papers — {overview.demoPapers}</span>
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-navy" /> Uploaded papers — {overview.userPapers}</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-graphite-500">
              Demo papers are fictional illustrations bundled with the app. Uploaded papers are the files you processed
              on this device.
            </p>
            {store.demoEnabled && overview.demoPapers > 0 && <DemoBadge className="mt-3" />}
          </Card>
        </Section>

        {/* 02 ─ Departments */}
        <Section n={2} title="Departments represented" lede="Departments present among the papers in scope.">
          <Card className="p-5 md:p-6">
            <TableWrap>
              <thead>
                <tr>
                  <Th>Department</Th>
                  <Th className="text-right">Papers</Th>
                  <Th className="text-right">Questions</Th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.name}>
                    <Td className="font-medium text-graphite">{d.name}</Td>
                    <Td className="text-right font-mono">{d.papers}</Td>
                    <Td className="text-right font-mono">{d.questions}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            {departments.length === 0 && <p className="py-6 text-center text-sm text-graphite-500">No departments in scope.</p>}
          </Card>
        </Section>

        {/* 03 ─ Semesters */}
        <Section n={3} title="Semesters represented" lede="Question counts per semester (1–8).">
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => {
              const n = semesterCounts[s]
              return (
                <span
                  key={s}
                  className={`chip border ${n > 0 ? 'border-navy/20 bg-navy/6 text-navy' : 'border-ivory-300 bg-ivory-50 text-graphite-400'}`}
                  title={n > 0 ? `${n} questions from semester ${s}` : `No questions from semester ${s} in scope`}
                >
                  Sem {s} · {n}
                </span>
              )
            })}
          </div>
          <p className="text-xs text-graphite-500">
            {overview.semestersRepresented} of 8 semesters are represented in the current scope.
          </p>
        </Section>

        {/* 04 ─ Subjects */}
        <Section n={4} title="Subjects analysed" lede="Subjects with at least one paper or question in scope.">
          <Card className="p-5 md:p-6">
            <TableWrap>
              <thead>
                <tr>
                  <Th>Subject</Th>
                  <Th>Code</Th>
                  <Th>Sem</Th>
                  <Th className="text-right">Papers</Th>
                  <Th className="text-right">Questions</Th>
                  <Th className="text-right">Marks</Th>
                  <Th className="text-right">Years</Th>
                </tr>
              </thead>
              <tbody>
                {analysedSubjects.map((s) => (
                  <tr key={s.subject.id}>
                    <Td className="font-medium text-graphite">{s.subject.name}</Td>
                    <Td className="font-mono text-[11px] text-graphite-500">{s.subject.code}</Td>
                    <Td className="font-mono">{s.subject.semester}</Td>
                    <Td className="text-right font-mono">{s.papers}</Td>
                    <Td className="text-right font-mono">{s.questions}</Td>
                    <Td className="text-right font-mono">{s.marks}</Td>
                    <Td className="text-right font-mono text-graphite-500">{s.years.length ? `${s.years[0]}–${s.years[s.years.length - 1]}` : '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            {analysedSubjects.length === 0 && (
              <p className="py-6 text-center text-sm text-graphite-500">No subjects in the current scope.</p>
            )}
          </Card>
        </Section>

        {/* 05 ─ Academic years */}
        <Section n={5} title="Academic years covered" lede="Years with papers, and gaps between them.">
          <div className="flex flex-wrap gap-2">
            {yearCounts.map((y) => (
              <span key={y.year} className="chip border border-academic/25 bg-academic-100 text-academic-600">
                {y.year} · {y.count} paper{y.count === 1 ? '' : 's'}
              </span>
            ))}
            {yearCounts.length === 0 && <span className="text-sm text-graphite-500">No years in scope.</span>}
          </div>
          {overview.missingYears.length > 0 ? (
            <div className="rounded-xl border border-gold/40 bg-gold-100 p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold-600">Missing years</p>
              <p className="mt-1.5 text-sm text-graphite-700">
                {overview.missingYears.join(', ')} — no papers are available for these years inside the observed range,
                so year-over-year trends skip them rather than interpolate.
              </p>
            </div>
          ) : (
            <p className="text-xs text-graphite-500">No gaps inside the observed year range.</p>
          )}
        </Section>

        {/* 06 ─ Papers */}
        <Section n={6} title="Papers analysed" lede="The source documents behind every number in this report.">
          <Card className="p-5 md:p-6">
            <TableWrap>
              <thead>
                <tr>
                  <Th>Title</Th>
                  <Th>Code</Th>
                  <Th className="text-right">Year</Th>
                  <Th>Type</Th>
                  <Th className="text-right">Questions</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {papers.slice(0, 30).map((p) => (
                  <tr key={p.id}>
                    <Td>
                      <span className="font-medium text-graphite">{truncate(p.title, 58)}</span>
                      {p.demo && <span className="ml-2 font-mono text-[10px] uppercase tracking-wide text-gold-600">demo</span>}
                    </Td>
                    <Td className="font-mono text-[11px] text-graphite-500">{p.subjectCode}</Td>
                    <Td className="text-right font-mono">{p.year}</Td>
                    <Td className="text-graphite-600">{p.examType}</Td>
                    <Td className="text-right font-mono">{p.questionCount}</Td>
                    <Td>
                      <Badge tone={p.status === 'Analysis complete' ? 'green' : p.status === 'Needs review' ? 'gold' : p.status === 'Processing failed' ? 'red' : 'grey'}>
                        {p.status}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            {papers.length > 30 && (
              <p className="mt-4 font-mono text-[11px] text-graphite-400">Showing 30 of {papers.length} papers — export the CSV for the full list.</p>
            )}
          </Card>
        </Section>

        {/* 07 ─ Extraction quality */}
        <Section
          n={7}
          title="Extraction quality"
          lede="Honest diagnostics from the PDF pipeline. Confidence here is a heuristic score, not an AI judgement."
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Extraction warnings" value={overview.extractionWarnings} sub="Recorded during parsing" />
            <Stat label="Papers needing OCR" value={overview.ocrPapers} accent="gold" sub="Scanned pages, best-effort" />
            <Stat label="Avg. confidence" value={`${Math.round(overview.avgConfidence * 100)}%`} accent="academic" sub="Keyword-match heuristic" />
            <Stat label="Below 50% confidence" value={overview.lowConfidenceCount} accent="lavender" sub="Worth a manual check" />
          </div>
          <p className="text-xs leading-relaxed text-graphite-600">
            Confidence is computed from explainable keyword overlap between the question text and the syllabus entries.
            It is not a model's opinion about the question — treat low scores as a prompt to review the classification
            in the question explorer.
          </p>
        </Section>

        {/* 08 ─ Chapter distribution */}
        <Section n={8} title="Chapter distribution" lede="Where questions concentrate across chapters in scope.">
          <ChartCard title="Questions by chapter" description="Top 14 chapters by question count in the current scope.">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chapterChart} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }} barCategoryGap={6}>
                  <CartesianGrid stroke="#E2DED4" horizontal={false} />
                  <XAxis type="number" {...chartAxis} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={150} {...chartAxis} tick={{ fontSize: 11, fontFamily: 'DM Sans' }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(23,37,84,0.05)' }} formatter={(v: number, n) => [`${v} ${n === 'marks' ? 'marks' : 'questions'}`, '']} labelFormatter={() => ''} />
                  <Bar dataKey="questions" radius={[0, 5, 5, 0]}>
                    {chapterChart.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <Card className="p-5 md:p-6">
            <TableWrap>
              <thead>
                <tr>
                  <Th>Chapter</Th>
                  <Th>Unit</Th>
                  <Th className="text-right">Questions</Th>
                  <Th className="text-right">Marks</Th>
                  <Th className="text-right">Avg</Th>
                  <Th className="text-right">Topics</Th>
                </tr>
              </thead>
              <tbody>
                {chapters.slice(0, 30).map((c) => (
                  <tr key={`${c.subjectId}-${c.chapter}`}>
                    <Td className="font-medium text-graphite">{c.chapter}</Td>
                    <Td className="font-mono text-[11px] text-graphite-500">{c.unit.split(':')[0]}</Td>
                    <Td className="text-right font-mono">{c.questionCount}</Td>
                    <Td className="text-right font-mono">{c.totalMarks}</Td>
                    <Td className="text-right font-mono">{c.avgMarks}</Td>
                    <Td className="text-right font-mono">{c.topicCount}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            {chapters.length > 30 && (
              <p className="mt-4 font-mono text-[11px] text-graphite-400">Showing 30 of {chapters.length} chapters.</p>
            )}
          </Card>
        </Section>

        {/* 09 ─ Topic frequency */}
        <Section n={9} title="Topic frequency" lede="The 15 most frequent topics by question count in scope.">
          <Card className="p-5 md:p-6">
            <TableWrap>
              <thead>
                <tr>
                  <Th className="w-10">#</Th>
                  <Th>Topic</Th>
                  <Th>Subject</Th>
                  <Th className="text-right">Questions</Th>
                  <Th className="text-right">Marks</Th>
                  <Th className="text-right">Papers</Th>
                  <Th className="text-right">Recurrence</Th>
                  <Th className="text-right">Last seen</Th>
                </tr>
              </thead>
              <tbody>
                {topics.slice(0, 15).map((t, i) => (
                  <tr key={`${t.subjectId}-${t.topic}`}>
                    <Td className="font-mono text-[11px] text-graphite-400">{i + 1}</Td>
                    <Td className="font-medium text-graphite">{t.topic}</Td>
                    <Td className="text-graphite-500">{truncate(t.subject, 28)}</Td>
                    <Td className="text-right font-mono">{t.totalQuestions}</Td>
                    <Td className="text-right font-mono">{t.totalMarks}</Td>
                    <Td className="text-right font-mono">{t.papersContaining}</Td>
                    <Td className="text-right font-mono text-navy">{t.frequencyPercentage}%</Td>
                    <Td className="text-right font-mono text-graphite-500">{t.lastAppearance ?? '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            {topics.length === 0 && <p className="py-6 text-center text-sm text-graphite-500">No topics in the current scope.</p>}
          </Card>
        </Section>

        {/* 10 ─ Marks distribution */}
        <Section n={10} title="Marks distribution" lede={`Total marks across every question in scope: ${marks.total}.`}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Total marks" value={marks.total} accent="gold" />
            <Stat label="Question types" value={marks.byType.length} accent="academic" sub="Distinct type buckets" />
            <Stat label="Marks · by subject" value={marks.bySubject.length} accent="lavender" sub="Subjects contributing marks" />
            <Stat label="Marks · by semester" value={marks.bySemester.length} accent="navy" sub="Semesters contributing marks" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Marks by question type" description="Where the weight sits across question kinds.">
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typeChart} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid stroke="#E2DED4" vertical={false} />
                    <XAxis dataKey="name" {...chartAxis} tick={{ fontSize: 10, fontFamily: 'DM Sans' }} interval={0} angle={-20} textAnchor="end" height={54} />
                    <YAxis {...chartAxis} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v} marks`, '']} labelFormatter={() => ''} />
                    <Bar dataKey="marks" radius={[6, 6, 0, 0]}>
                      {typeChart.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
            <ChartCard title="Marks per question (histogram)" description="How individual questions are weighted.">
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={marks.histogram} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid stroke="#E2DED4" vertical={false} />
                    <XAxis dataKey="label" {...chartAxis} />
                    <YAxis {...chartAxis} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n) => [`${v} ${n === 'marks' ? 'marks' : 'questions'}`, '']} labelFormatter={() => ''} />
                    <Bar dataKey="questions" fill="#5478A8" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>
        </Section>

        {/* 11 ─ Historical trends */}
        <Section n={11} title="Historical trends" lede="Questions and marks per academic year, as observed in the papers in scope.">
          <ChartCard title="Questions & marks by year" description="Bars = questions, line = marks. Gaps in years are missing data, not zero activity.">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trends} margin={{ left: -18, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid stroke="#E2DED4" vertical={false} />
                  <XAxis dataKey="year" {...chartAxis} />
                  <YAxis yAxisId="q" {...chartAxis} allowDecimals={false} />
                  <YAxis yAxisId="m" orientation="right" {...chartAxis} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'DM Sans' }} />
                  <Bar yAxisId="q" dataKey="questions" name="Questions" fill="#B8B5E8" radius={[6, 6, 0, 0]} />
                  <Line yAxisId="m" type="monotone" dataKey="marks" name="Marks" stroke="#172554" strokeWidth={2} dot={{ r: 3, fill: '#172554' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <Card className="p-5 md:p-6">
            <TableWrap>
              <thead>
                <tr>
                  <Th>Year</Th>
                  <Th className="text-right">Questions</Th>
                  <Th className="text-right">Marks</Th>
                </tr>
              </thead>
              <tbody>
                {trends.map((t) => (
                  <tr key={t.year}>
                    <Td className="font-mono">{t.year}</Td>
                    <Td className="text-right font-mono">{t.questions}</Td>
                    <Td className="text-right font-mono">{t.marks}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            {trends.length === 0 && <p className="py-6 text-center text-sm text-graphite-500">No year data in scope.</p>}
          </Card>
        </Section>

        {/* 12 ─ Repetition */}
        <Section
          n={12}
          title="Question repetition"
          lede="Clusters of questions that share wording or structure, found by an explainable similarity score (threshold 0.55)."
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Clusters found" value={clusters.length} />
            <Stat label="Questions clustered" value={clusters.reduce((s, c) => s + c.questions.length, 0)} accent="academic" />
            <Stat label="Exact matches" value={clusters.filter((c) => c.kind === 'exact').length} accent="gold" />
            <Stat label="Highest similarity" value={clusters.length ? `${Math.round(Math.max(...clusters.map((c) => c.similarity)) * 100)}%` : '—'} accent="lavender" />
          </div>
          <Card className="p-5 md:p-6">
            <TableWrap>
              <thead>
                <tr>
                  <Th>Cluster</Th>
                  <Th>Kind</Th>
                  <Th>Subject</Th>
                  <Th className="text-right">Questions</Th>
                  <Th className="text-right">Similarity</Th>
                </tr>
              </thead>
              <tbody>
                {clusters.slice(0, 20).map((c) => (
                  <tr key={c.id}>
                    <Td>
                      <span className="font-medium text-graphite">{truncate(c.title, 60)}</span>
                      <span className="ml-2 font-mono text-[10px] text-graphite-400">{c.topic}</span>
                    </Td>
                    <Td>
                      <Badge tone={c.kind === 'exact' ? 'red' : c.kind === 'near-identical' ? 'gold' : 'grey'}>{c.kind}</Badge>
                    </Td>
                    <Td className="text-graphite-500">{truncate(c.subject, 26)}</Td>
                    <Td className="text-right font-mono">{c.questions.length}</Td>
                    <Td className="text-right font-mono text-navy">{Math.round(c.similarity * 100)}%</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            {clusters.length === 0 && (
              <p className="py-6 text-center text-sm text-graphite-500">
                No repeated question patterns found at the current threshold in this scope.
              </p>
            )}
            {clusters.length > 20 && (
              <p className="mt-4 font-mono text-[11px] text-graphite-400">Showing 20 of {clusters.length} clusters.</p>
            )}
          </Card>
        </Section>

        {/* 13 ─ Coverage */}
        <Section
          n={13}
          title="Syllabus coverage"
          lede="Syllabus topics observed in the papers in scope, versus those not observed."
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Coverage" value={`${coverage.percentage}%`} accent="gold" sub={`${coverage.covered} of ${coverage.total} syllabus topics`} />
            <Stat label="Observed" value={coverage.covered} accent="academic" sub="Appears in the papers in scope" />
            <Stat label="Not observed" value={coverage.total - coverage.covered} accent="lavender" sub="Not observed in the uploaded papers" />
            <Stat label="Syllabus rows" value={coverage.total} sub="Unit × chapter × topic rows" />
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-ivory-200" role="img" aria-label={`${coverage.percentage}% of syllabus topics observed`}>
            <div className="bg-navy" style={{ width: `${coverage.percentage}%` }} />
          </div>
          <Card className="p-5 md:p-6">
            <p className="eyebrow text-graphite-500">Not observed in the uploaded papers</p>
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {coverage.rows.filter((r) => !r.observed).slice(0, 14).map((r) => (
                <li key={`${r.subject}-${r.topic}`} className="rounded-lg border border-ivory-200 bg-ivory-50 px-3 py-2 text-xs text-graphite-600">
                  <span className="font-medium text-graphite">{r.topic}</span>
                  <span className="ml-2 font-mono text-[10px] text-graphite-400">{truncate(r.subject, 22)}</span>
                </li>
              ))}
            </ul>
            {coverage.total - coverage.covered === 0 && (
              <p className="py-4 text-center text-sm text-graphite-500">Every syllabus topic in scope was observed at least once.</p>
            )}
            <p className="mt-4 text-xs leading-relaxed text-graphite-500">
              "Not observed" means exactly that: no question in the papers currently in scope mapped to this topic. It is
              not a claim that the topic is never examined.
            </p>
          </Card>
        </Section>

        {/* 14 ─ Difficulty */}
        <Section
          n={14}
          title="Difficulty analysis"
          lede="Easy / Medium / Hard labels come from a keyword heuristic — a rough orientation, not a calibrated rating."
        >
          <ChartCard title="Question split by difficulty" description="Counts of questions per heuristic difficulty label in scope.">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={difficultyChart} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid stroke="#E2DED4" vertical={false} />
                  <XAxis dataKey="name" {...chartAxis} tick={{ fontSize: 12, fontFamily: 'DM Sans' }} />
                  <YAxis {...chartAxis} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n) => [`${v} ${n === 'marks' ? 'marks' : 'questions'}`, '']} labelFormatter={() => ''} />
                  <Bar dataKey="questions" radius={[6, 6, 0, 0]}>
                    <Cell fill={CHART_COLORS[1]} />
                    <Cell fill={CHART_COLORS[3]} />
                    <Cell fill={CHART_COLORS[0]} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <Card className="p-5 md:p-6">
            <TableWrap>
              <thead>
                <tr>
                  <Th>Difficulty</Th>
                  <Th className="text-right">Questions</Th>
                  <Th className="text-right">Marks</Th>
                  <Th className="text-right">Share</Th>
                </tr>
              </thead>
              <tbody>
                {difficultyChart.map((d) => {
                  const total = difficultyChart.reduce((s, x) => s + x.questions, 0) || 1
                  return (
                    <tr key={d.name}>
                      <Td className="font-medium text-graphite">{d.name}</Td>
                      <Td className="text-right font-mono">{d.questions}</Td>
                      <Td className="text-right font-mono">{d.marks}</Td>
                      <Td className="text-right font-mono text-navy">{Math.round((d.questions / total) * 100)}%</Td>
                    </tr>
                  )
                })}
              </tbody>
            </TableWrap>
          </Card>
        </Section>

        {/* 15 ─ Confidence */}
        <Section
          n={15}
          title="Classification confidence"
          lede="How strongly each question's keyword classification was supported by the syllabus match."
        >
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Average confidence" value={`${Math.round(overview.avgConfidence * 100)}%`} accent="academic" sub="Heuristic score, 0–100" />
            <Stat label="Low confidence (<50%)" value={overview.lowConfidenceCount} accent="gold" sub="Suggest manual review" />
            <Stat label="Needs review" value={overview.needsReviewCount} accent="lavender" sub="Unconfirmed flagged questions" />
          </div>
          <p className="text-xs leading-relaxed text-graphite-600">
            These are explainable keyword-overlap scores, not model outputs. A low score means the question text matched
            few syllabus keywords — useful signal for deciding what to reclassify by hand in the question explorer.
          </p>
        </Section>

        {/* 16 ─ Limitations */}
        <Section n={16} title="Data limitations" lede="Read this before acting on anything above.">
          <Card className="p-5 md:p-6">
            <ul className="space-y-3">
              {limitations.map((l, i) => (
                <li key={i} className="flex gap-3 text-sm leading-relaxed text-graphite-600">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden />
                  <span>{l}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 rounded-xl border border-gold/40 bg-gold-100 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold-600">{DEMO_DISCLAIMER}</p>
            </div>
          </Card>
        </Section>

        {/* 17 ─ Insights */}
        <Section
          n={17}
          title="Preparation insights"
          lede="Computed strictly from the papers in scope. These are descriptions of past papers, not predictions."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <p className="eyebrow text-graphite-500">Most recurring topics</p>
              <p className="mt-2 text-xs text-graphite-500">By question count, based on the papers in scope.</p>
              <ul className="mt-3 space-y-2">
                {insight.topByQuestions.map((t) => (
                  <li key={`${t.subjectId}-${t.topic}`} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-graphite-700">{t.topic}</span>
                    <span className="shrink-0 font-mono text-[11px] text-navy">{t.totalQuestions} q · {t.totalMarks} m</span>
                  </li>
                ))}
                {insight.topByQuestions.length === 0 && <li className="text-sm text-graphite-500">No topics in scope.</li>}
              </ul>
            </Card>

            <Card className="p-5">
              <p className="eyebrow text-graphite-500">Highest marks concentration</p>
              <p className="mt-2 text-xs text-graphite-500">Topics carrying the most marks in the papers in scope.</p>
              <ul className="mt-3 space-y-2">
                {insight.topByMarks.map((t) => (
                  <li key={`${t.subjectId}-${t.topic}`} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-graphite-700">{t.topic}</span>
                    <span className="shrink-0 font-mono text-[11px] text-gold-600">{t.totalMarks} marks</span>
                  </li>
                ))}
                {insight.topByMarks.length === 0 && <li className="text-sm text-graphite-500">No topics in scope.</li>}
              </ul>
            </Card>

            <Card className="p-5">
              <p className="eyebrow text-graphite-500">
                Seen in {insight.maxYear ?? 'the latest year in scope'}
              </p>
              <p className="mt-2 text-xs text-graphite-500">
                Topics whose most recent appearance is the newest year represented — based on the papers in scope.
              </p>
              <ul className="mt-3 space-y-2">
                {insight.recent.map((t) => (
                  <li key={`${t.subjectId}-${t.topic}`} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-graphite-700">{t.topic}</span>
                    <span className="shrink-0 font-mono text-[11px] text-graphite-500">{t.totalQuestions} q</span>
                  </li>
                ))}
                {insight.recent.length === 0 && <li className="text-sm text-graphite-500">No topic data in scope.</li>}
              </ul>
            </Card>

            <Card className="p-5">
              <p className="eyebrow text-graphite-500">High marks, lower frequency</p>
              <p className="mt-2 text-xs text-graphite-500">
                Heavy-hitting topics that appear in fewer papers — based on the papers in scope, worth a second look.
              </p>
              <ul className="mt-3 space-y-2">
                {insight.highMarksLowFrequency.map((t) => (
                  <li key={`${t.subjectId}-${t.topic}`} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-graphite-700">{t.topic}</span>
                    <span className="shrink-0 font-mono text-[11px] text-graphite-500">
                      {t.totalMarks} m · {t.frequencyPercentage}% of papers
                    </span>
                  </li>
                ))}
                {insight.highMarksLowFrequency.length === 0 && (
                  <li className="text-sm text-graphite-500">No topic meets this description in the current scope.</li>
                )}
              </ul>
            </Card>
          </div>

          <div className="rounded-xl border border-ivory-300 bg-ivory-50 px-4 py-3">
            <p className="text-xs leading-relaxed text-graphite-600">
              Historical frequency is context from your dataset, not a prediction of what will be asked. Nothing here
              should be read as a claim about future examinations.
            </p>
          </div>
        </Section>
      </div>

      <div className="mt-12 border-t border-ivory-300 pt-6">
        <p className="font-mono text-[10px] leading-relaxed tracking-wide text-graphite-400">
          Report generated {new Date().toLocaleString()} · PaperTrail runs entirely in your browser · {DEMO_DISCLAIMER}
        </p>
      </div>
    </div>
  )
}
