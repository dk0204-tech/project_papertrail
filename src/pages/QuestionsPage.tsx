import React, { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight, CheckCircle2, Download, FileText, MessageSquareQuote, RotateCcw, Search,
  Sparkles, TriangleAlert,
} from 'lucide-react'
import { usePaperTrail } from '../store/PaperTrailStore'
import { useAnalytics } from '../hooks/useAnalytics'
import { exportQuestionsCsv } from '../services/reportExporter'
import { classifyQuestion } from '../services/topicClassifier'
import { Question, Syllabus } from '../types'
import {
  Badge, ClassificationSourceBadge, ConfidenceBadge, Card, EmptyState, Modal, PageHeader,
  SectionTitle, TableWrap, Td, Th, truncate,
} from '../components/ui'
import { FilterBar } from '../components/FilterBar'

/**
 * Question explorer + review workflow.
 * Every question keeps its provenance (paper, page, year, marks) and its
 * classification is editable — corrections flow straight back into analytics.
 */
export const QuestionsPage: React.FC = () => {
  const store = usePaperTrail()
  const { questions, papers, filters, filtersActive } = useAnalytics()
  const [params, setParams] = useSearchParams()

  const reviewOnly = params.get('review') === '1'
  const topicParam = params.get('topic')
  const paperParam = params.get('paperId')

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [difficultyFilter, setDifficultyFilter] = useState('All')
  const [marksFilter, setMarksFilter] = useState('All')
  const [onlyReview, setOnlyReview] = useState(reviewOnly)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Question | null>(null)

  useEffect(() => {
    setOnlyReview(reviewOnly)
    if (topicParam) store.setFilters({ topic: topicParam })
    if (paperParam) setSearch('')
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewOnly, topicParam, paperParam])

  const paperFilter = paperParam ? papers.find((p) => p.id === paperParam) : undefined

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return questions.filter((q) => {
      if (onlyReview && (q.confirmed || !q.needsReview)) return false
      if (paperFilter && q.paperId !== paperFilter.id) return false
      if (typeFilter !== 'All' && q.questionType !== typeFilter) return false
      if (difficultyFilter !== 'All' && q.difficulty !== difficultyFilter) return false
      if (marksFilter === 'short' && (q.marks ?? 0) > 4) return false
      if (marksFilter === 'medium' && ((q.marks ?? 0) <= 4 || (q.marks ?? 0) > 8)) return false
      if (marksFilter === 'long' && (q.marks ?? 0) <= 8) return false
      if (s && !(q.text.toLowerCase().includes(s) || q.topic.toLowerCase().includes(s) || q.questionNumber.toLowerCase().includes(s) || q.chapter.toLowerCase().includes(s))) return false
      return true
    })
  }, [questions, search, typeFilter, difficultyFilter, marksFilter, onlyReview, paperFilter])

  useEffect(() => setPage(1), [search, typeFilter, difficultyFilter, marksFilter, onlyReview, filters])

  const perPage = 25
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const visible = filtered.slice((page - 1) * perPage, page * perPage)
  const reviewCount = questions.filter((q) => q.needsReview && !q.confirmed).length

  const syllabusFor = (q: Question): Syllabus | null => store.syllabusFor(q.subjectId)

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Library · Questions"
        title="Question explorer"
        description="Search every extracted question with its full provenance — source paper, page, marks, classification and confidence. Corrections made here recalculate the analytics instantly."
        actions={
          <>
            <button onClick={() => exportQuestionsCsv(filtered)} className="btn-ghost !py-2.5 !text-[13px]">
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <Link to="/upload" className="btn-primary !py-2.5 !text-[13px]">
              Upload papers <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        }
        demo={questions.some((q) => q.demo)}
      />

      <FilterBar />

      {/* toolbar */}
      <Card className="mt-4 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="relative flex-1">
            <span className="label">Search text, topic or number</span>
            <Search className="pointer-events-none absolute left-3 top-[34px] h-4 w-4 text-graphite-400" />
            <input
              className="field pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. congestion control, Q3, AVL…"
            />
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[560px]">
            <label>
              <span className="label">Type</span>
              <select className="field" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                {['All', 'Theory', 'Numerical', 'Programming', 'Derivation', 'Proof', 'Application', 'Short Answer', 'Long Answer'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label>
              <span className="label">Difficulty</span>
              <select className="field" value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value)}>
                {['All', 'Easy', 'Medium', 'Hard'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label>
              <span className="label">Marks</span>
              <select className="field" value={marksFilter} onChange={(e) => setMarksFilter(e.target.value)}>
                <option value="All">All</option>
                <option value="short">Short (≤4)</option>
                <option value="medium">Mid (5–8)</option>
                <option value="long">Long (&gt;8)</option>
              </select>
            </label>
            <label className="flex items-end">
              <button
                onClick={() => { setOnlyReview((v) => !v); setParams((p) => { const n = new URLSearchParams(p); onlyReview ? n.delete('review') : n.set('review', '1'); return n }) }}
                className={`field !flex h-[42px] cursor-pointer items-center justify-center gap-1.5 !text-xs font-medium ${onlyReview ? 'border-gold bg-gold-100 text-gold-600' : ''}`}
              >
                <TriangleAlert className="h-3.5 w-3.5" /> Needs review {reviewCount > 0 && `(${reviewCount})`}
              </button>
            </label>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-ivory-200 pt-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">
            {filtered.length} questions in scope {filtersActive && '· filters active'}
            {paperFilter && <> · source: <span className="text-navy">{paperFilter.filename}</span></>}
            {topicParam && <> · topic: <span className="text-navy">{topicParam}</span></>}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => store.reclassifyAll()}
              className="rounded-full border border-ivory-300 bg-white px-3 py-1.5 text-[11px] font-grotesk font-medium text-graphite-600 hover:border-graphite-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
              title="Re-run syllabus keyword classification across the whole dataset. Manually classified questions are preserved."
            >
              <RotateCcw className="mr-1 inline h-3 w-3" /> Re-run classification
            </button>
            {(search || onlyReview || topicFilterActive(filters) || paperParam) && (
              <button
                onClick={() => { setSearch(''); setOnlyReview(false); setParams(new URLSearchParams()); store.resetFilters() }}
                className="rounded-full border border-ivory-300 bg-white px-3 py-1.5 text-[11px] font-grotesk font-medium text-graphite-600 hover:border-graphite-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
              >
                Reset view
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* list */}
      {visible.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={MessageSquareQuote}
            title={onlyReview ? 'Nothing needs review' : 'No questions match this view'}
            description={
              onlyReview
                ? 'Every classification in scope is either above the confidence threshold or already confirmed by you.'
                : filtersActive || search
                  ? 'Try clearing filters or the search term — the explorer shows only questions inside the current scope.'
                  : 'Upload question papers to build a searchable question database.'
            }
            action={{ label: 'Go to upload', to: '/upload' }}
            secondaryAction={
              filtersActive || search ? (
                <button className="btn-ghost" onClick={() => { setSearch(''); setOnlyReview(false); store.resetFilters() }}>Clear filters</button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <ul className="mt-5 space-y-3">
            {visible.map((q) => {
              const paper = papers.find((p) => p.id === q.paperId)
              return (
                <li key={q.id}>
                  <button
                    onClick={() => setSelected(q)}
                    className="card w-full p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift2 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
                  >
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">
                      <span className="text-navy">{q.questionNumber}{q.subQuestion ? ` (${q.subQuestion})` : ''}</span>
                      <span>· {q.year} · {q.examType}</span>
                      <span>· S{q.semester}</span>
                      <span className="text-gold-600">{q.marks} marks</span>
                      <span>· p.{q.sourcePage}</span>
                      {q.demo && <span className="text-academic">· demo</span>}
                    </div>
                    <p className="mt-2 text-[15px] leading-relaxed text-graphite">{truncate(q.text, 240)}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge tone="navy">{q.topic}</Badge>
                      <Badge tone="grey">{q.chapter}</Badge>
                      <Badge tone="blue">{q.questionType}</Badge>
                      <Badge tone={q.difficulty === 'Hard' ? 'red' : q.difficulty === 'Medium' ? 'gold' : 'green'}>{q.difficulty}</Badge>
                      <ConfidenceBadge value={q.confidence} needsReview={q.needsReview && !q.confirmed} />
                      {q.confirmed && <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> Confirmed</Badge>}
                      <span className="ml-auto truncate font-mono text-[10px] text-graphite-400">{paper?.filename ?? 'source unavailable'}</span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>

          {totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Pagination">
              <button className="btn-ghost !py-2 !text-xs" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <span className="font-mono text-[11px] text-graphite-500">Page {page} / {totalPages}</span>
              <button className="btn-ghost !py-2 !text-xs" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </nav>
          )}
        </>
      )}

      {/* ── Detail / correction modal ─────────────────────────────────────── */}
      <QuestionDetail
        question={selected}
        onClose={() => setSelected(null)}
        onSave={(updated) => { store.updateQuestion(updated); setSelected(updated) }}
        syllabus={selected ? syllabusFor(selected) : null}
        paper={selected ? papers.find((p) => p.id === selected.paperId) : undefined}
        onNavigate={(delta) => {
          const idx = filtered.findIndex((q) => q.id === selected?.id)
          const next = filtered[idx + delta]
          if (next) setSelected(next)
        }}
        canNavigate={filtered.findIndex((q) => q.id === selected?.id) > 0 || filtered.findIndex((q) => q.id === selected?.id) < filtered.length - 1}
      />
    </div>
  )
}

function topicFilterActive(f: { topic: string }) {
  return f.topic !== 'All'
}

// ── Detail panel ─────────────────────────────────────────────────────────────

const QuestionDetail: React.FC<{
  question: Question | null
  paper?: ReturnType<typeof useAnalytics>['papers'][number]
  syllabus: Syllabus | null
  onClose: () => void
  onSave: (q: Question) => void
  onNavigate: (delta: number) => void
  canNavigate: boolean
}> = ({ question, paper, syllabus, onClose, onSave, onNavigate, canNavigate }) => {
  const [draft, setDraft] = useState<Question | null>(question)
  const [alt, setAlt] = useState<{ topic: string; chapter: string; unit: string; score: number }[]>([])

  useEffect(() => {
    setDraft(question)
    setAlt([])
  }, [question])

  if (!question || !draft) return null

  const unitOptions = syllabus ? syllabus.units.map((u) => `Unit ${u.unitNumber}: ${u.title}`) : [draft.unit]
  const chapterOptions = syllabus
    ? syllabus.units.find((u) => `Unit ${u.unitNumber}: ${u.title}` === draft.unit)?.chapters.map((c) => c.name) ?? [draft.chapter]
    : [draft.chapter]
  const topicOptions = syllabus
    ? syllabus.units
        .find((u) => `Unit ${u.unitNumber}: ${u.title}` === draft.unit)
        ?.chapters.find((c) => c.name === draft.chapter)
        ?.topics.map((t) => t.name) ?? [draft.topic]
    : [draft.topic]

  const reclassify = () => {
    if (!syllabus) return
    const r = classifyQuestion(draft.text, syllabus, {
      subject: draft.subject, unit: draft.unit, chapter: draft.chapter, topic: draft.topic, subtopic: draft.subtopic,
    })
    setDraft({
      ...draft,
      unit: r.unit, chapter: r.chapter, topic: r.topic, subtopic: r.subtopic,
      questionType: r.questionType, difficulty: r.difficulty, cognitiveLevel: r.cognitiveLevel,
      confidence: r.confidence, classificationSource: r.source, matchedKeywords: r.matchedKeywords,
      explanation: r.explanation, needsReview: r.needsReview, confirmed: false,
    })
    setAlt(r.alternatives)
  }

  return (
    <Modal open={!!question} onClose={onClose} title="Question detail & provenance" wide>
      <div className="space-y-5">
        {/* provenance header */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">
          <Badge tone="navy">{draft.questionNumber}{draft.subQuestion ? ` (${draft.subQuestion})` : ''}</Badge>
          <Badge tone="gold">{draft.marks} marks</Badge>
          <Badge tone="grey">Page {draft.sourcePage}</Badge>
          <Badge tone="blue">{draft.examType} {draft.year}</Badge>
          <Badge tone="lavender">Semester {draft.semester}</Badge>
          {draft.demo && <Badge tone="gold">Demo record</Badge>}
          <span className="ml-auto">{draft.subject} · {draft.subjectCode}</span>
        </div>

        <div>
          <span className="label">Question text</span>
          <textarea
            className="field min-h-[88px] !text-[14px] leading-relaxed"
            value={draft.text}
            onChange={(e) => setDraft({ ...draft, text: e.target.value, classificationSource: draft.classificationSource === 'manual' ? 'manual' : draft.classificationSource })}
            aria-label="Question text"
          />
        </div>

        {/* source paper */}
        <div className="rounded-xl border border-ivory-300 bg-ivory-50 p-4">
          <p className="eyebrow text-graphite-500">Source document</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-graphite-700">
            <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-academic" /> {paper?.filename ?? 'unavailable'}</span>
            <span>{paper?.title}</span>
            <span className="font-mono">{paper?.session}</span>
            <span className="font-mono">max {paper?.maxMarks}</span>
          </div>
        </div>

        {/* classification controls */}
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow text-graphite-500">Classification</p>
            <div className="flex flex-wrap items-center gap-2">
              <ClassificationSourceBadge source={draft.classificationSource} />
              <ConfidenceBadge value={draft.confidence} needsReview={draft.needsReview && !draft.confirmed} />
              <button onClick={reclassify} disabled={!syllabus} className="rounded-lg border border-ivory-300 bg-white px-2.5 py-1 text-[11px] font-grotesk text-graphite-600 hover:border-graphite-400 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40">
                <Sparkles className="mr-1 inline h-3 w-3" /> Re-classify
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label>
              <span className="label">Unit</span>
              <select className="field" value={draft.unit} onChange={(e) => {
                const unit = e.target.value
                const firstChapter = syllabus?.units.find((u) => `Unit ${u.unitNumber}: ${u.title}` === unit)?.chapters[0]?.name ?? draft.chapter
                const firstTopic = syllabus?.units.find((u) => `Unit ${u.unitNumber}: ${u.title}` === unit)?.chapters[0]?.topics[0]?.name ?? draft.topic
                setDraft({ ...draft, unit, chapter: firstChapter, topic: firstTopic, classificationSource: 'manual', needsReview: false })
              }}>
                {unitOptions.map((u) => <option key={u}>{u}</option>)}
              </select>
            </label>
            <label>
              <span className="label">Chapter</span>
              <select className="field" value={draft.chapter} onChange={(e) => {
                const chapter = e.target.value
                const firstTopic = syllabus?.units.find((u) => `Unit ${u.unitNumber}: ${u.title}` === draft.unit)?.chapters.find((c) => c.name === chapter)?.topics[0]?.name ?? draft.topic
                setDraft({ ...draft, chapter, topic: firstTopic, classificationSource: 'manual', needsReview: false })
              }}>
                {chapterOptions.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label>
              <span className="label">Topic</span>
              <select className="field" value={draft.topic} onChange={(e) => setDraft({ ...draft, topic: e.target.value, classificationSource: 'manual', needsReview: false })}>
                {topicOptions.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <label><span className="label">Marks</span>
              <input type="number" className="field" value={draft.marks ?? ''} onChange={(e) => setDraft({ ...draft, marks: e.target.value === '' ? null : Number(e.target.value) })} /></label>
            <label><span className="label">Q. number</span>
              <input className="field" value={draft.questionNumber} onChange={(e) => setDraft({ ...draft, questionNumber: e.target.value })} /></label>
            <label><span className="label">Type</span>
              <select className="field" value={draft.questionType} onChange={(e) => setDraft({ ...draft, questionType: e.target.value as Question['questionType'], classificationSource: 'manual' })}>
                {['Theory', 'Numerical', 'Programming', 'Derivation', 'Proof', 'Application', 'Short Answer', 'Long Answer'].map((t) => <option key={t}>{t}</option>)}
              </select></label>
            <label><span className="label">Difficulty</span>
              <select className="field" value={draft.difficulty} onChange={(e) => setDraft({ ...draft, difficulty: e.target.value as Question['difficulty'], classificationSource: 'manual' })}>
                {['Easy', 'Medium', 'Hard'].map((t) => <option key={t}>{t}</option>)}
              </select></label>
          </div>

          <div className="mt-3 rounded-xl border border-ivory-300 bg-ivory-50 p-4">
            <p className="text-xs leading-relaxed text-graphite-600">
              <strong className="font-medium text-graphite">Reason:</strong> {draft.explanation || '—'}
            </p>
            {draft.matchedKeywords.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {draft.matchedKeywords.map((k) => (
                  <span key={k} className="rounded-full bg-academic-100 px-2 py-0.5 font-mono text-[10px] text-academic-600">{k}</span>
                ))}
              </div>
            )}
            {alt.length > 0 && (
              <div className="mt-3 border-t border-ivory-200 pt-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">Possible alternative matches</p>
                <ul className="mt-1.5 space-y-1">
                  {alt.map((o) => (
                    <li key={o.topic} className="flex items-center justify-between text-[11px] text-graphite-600">
                      <span>{o.topic} · {o.chapter}</span>
                      <button
                        className="font-grotesk text-navy hover:underline"
                        onClick={() => setDraft({ ...draft, unit: o.unit, chapter: o.chapter, topic: o.topic, classificationSource: 'manual', needsReview: false, confidence: Math.max(draft.confidence, 0.7), explanation: `Manually set to the alternative match "${o.topic}" (score ${o.score}).` })}
                      >
                        use this
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!syllabus && (
              <p className="mt-2 text-[11px] text-gold-600">
                No syllabus is mapped for this subject — classification is provisional. Add one in the syllabus manager.
              </p>
            )}
          </div>
        </div>

        {/* actions */}
        <div className="sticky bottom-0 -mx-6 flex flex-wrap items-center justify-between gap-3 border-t border-ivory-200 bg-white/95 px-6 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate(-1)}
              disabled={!canNavigate}
              className="btn-ghost !py-1.5 !px-3 !text-[11px]"
            >
              ← Previous
            </button>
            <button onClick={() => onNavigate(1)} disabled={!canNavigate} className="btn-ghost !py-1.5 !px-3 !text-[11px]">
              Next →
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onSave({ ...draft, classificationSource: 'manual', needsReview: false, confirmed: true, explanation: draft.explanation + ' (manually confirmed)' })}
              className="btn-ghost !py-2 !text-[13px]"
            >
              <CheckCircle2 className="h-4 w-4" /> Confirm as correct
            </button>
            <button onClick={() => onSave(draft)} className="btn-primary !py-2 !text-[13px]">Save changes</button>
          </div>
        </div>

        <p className="font-mono text-[10px] leading-relaxed text-graphite-400">
          Saving updates the stored record; all topic, chapter, marks and repetition statistics are
          recomputed from the updated data immediately.
        </p>
      </div>
    </Modal>
  )
}
