import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowUpRight,
  Download,
  Eye,
  FileText,
  FolderOpen,
  MessageSquareQuote,
  Pencil,
  Search,
  Trash2,
  Upload,
} from 'lucide-react'
import { useAnalytics } from '../hooks/useAnalytics'
import {
  Badge,
  Card,
  ConfidenceBadge,
  DemoBadge,
  EmptyState,
  Modal,
  PageHeader,
  SectionTitle,
  Stat,
} from '../components/ui'
import { FilterBar } from '../components/FilterBar'
import { exportPapersCsv } from '../services/reportExporter'
import { ExamType, Paper, PaperStatus, SemesterNumber } from '../types'

/**
 * The archive: every paper in scope, searchable and sortable, with honest
 * extraction diagnostics and per-paper provenance actions. Nothing here is
 * inferred — each row shows what the parser actually extracted.
 */

const EXAM_TYPES: ExamType[] = ['Midterm', 'Endterm', 'Makeup', 'Internal', 'Supplementary']

const ALL_STATUSES: PaperStatus[] = [
  'Uploaded',
  'Extracting text',
  'Parsing questions',
  'Mapping topics',
  'Needs review',
  'Analysis complete',
  'Processing failed',
]

const STATUS_TONE: Record<PaperStatus, 'green' | 'blue' | 'gold' | 'lavender' | 'red' | 'grey'> = {
  'Analysis complete': 'green',
  Uploaded: 'blue',
  'Needs review': 'gold',
  'Processing failed': 'red',
  'Extracting text': 'lavender',
  'Parsing questions': 'lavender',
  'Mapping topics': 'lavender',
}

type SortKey = 'year-desc' | 'year-asc' | 'subject' | 'questions'

interface EditForm {
  title: string
  subjectId: string
  semester: number
  year: number
  examType: ExamType
  session: string
  maxMarks: number
}

const chipClass = (active: boolean) =>
  `rounded-full border px-3.5 py-1.5 text-xs font-grotesk font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 ${
    active ? 'border-navy bg-navy text-ivory-100' : 'border-ivory-300 bg-white text-graphite-600 hover:border-graphite-400'
  }`

const actionClass =
  'inline-flex items-center gap-1.5 rounded-lg border border-ivory-300 bg-white px-3 py-1.5 text-xs font-grotesk font-medium text-graphite-700 transition-colors hover:border-graphite-400 hover:text-graphite focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40'

export const ArchivePage: React.FC = () => {
  const { papers, questions, filtersActive, store } = useAnalytics()

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('year-desc')
  const [examChip, setExamChip] = useState<ExamType | 'All'>('All')
  const [statusChip, setStatusChip] = useState<PaperStatus | 'All'>('All')

  const [preview, setPreview] = useState<Paper | null>(null)
  const [editing, setEditing] = useState<Paper | null>(null)
  const [deleting, setDeleting] = useState<Paper | null>(null)
  const [form, setForm] = useState<EditForm | null>(null)

  // ── Duplicate detection: identical subject + year + exam type + filename ──
  const duplicateKeys = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of papers) {
      const key = `${p.subjectId}|${p.year}|${p.examType}|${p.filename.toLowerCase()}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [papers])

  const dupKey = (p: Paper) => `${p.subjectId}|${p.year}|${p.examType}|${p.filename.toLowerCase()}`
  const isDuplicate = (p: Paper) => (duplicateKeys.get(dupKey(p)) ?? 0) > 1

  // ── Local (search + chip) filtering, then sorting ─────────────────────────
  const view = useMemo(() => {
    const s = search.trim().toLowerCase()
    const filtered = papers.filter((p) => {
      if (examChip !== 'All' && p.examType !== examChip) return false
      if (statusChip !== 'All' && p.status !== statusChip) return false
      if (s) {
        const hay = `${p.title} ${p.subject} ${p.subjectCode} ${p.filename}`.toLowerCase()
        if (!hay.includes(s)) return false
      }
      return true
    })
    const sorted = [...filtered]
    sorted.sort((a, b) => {
      if (sort === 'year-desc') return b.year - a.year || a.subject.localeCompare(b.subject)
      if (sort === 'year-asc') return a.year - b.year || a.subject.localeCompare(b.subject)
      if (sort === 'subject') return a.subject.localeCompare(b.subject) || b.year - a.year
      return b.questionCount - a.questionCount || b.year - a.year
    })
    return sorted
  }, [papers, search, sort, examChip, statusChip])

  const viewIds = useMemo(() => new Set(view.map((p) => p.id)), [view])
  const viewQuestions = useMemo(() => questions.filter((q) => viewIds.has(q.paperId)), [questions, viewIds])

  const demoCount = view.filter((p) => p.demo).length
  const distinctSubjects = new Set(view.map((p) => p.subjectId)).size

  const examTypesPresent = useMemo(
    () => EXAM_TYPES.filter((t) => papers.some((p) => p.examType === t)),
    [papers],
  )
  const statusesPresent = useMemo(
    () => ALL_STATUSES.filter((s) => papers.some((p) => p.status === s)),
    [papers],
  )

  const previewQuestions = useMemo(
    () => (preview ? store.questions.filter((q) => q.paperId === preview.id) : []),
    [store.questions, preview],
  )

  const openEdit = (p: Paper) => {
    setEditing(p)
    setForm({
      title: p.title,
      subjectId: p.subjectId,
      semester: p.semester,
      year: p.year,
      examType: p.examType,
      session: p.session,
      maxMarks: p.maxMarks,
    })
  }

  const saveEdit = () => {
    if (!editing || !form) return
    const subj = store.subjectById(form.subjectId)
    store.updatePaper({
      ...editing,
      title: form.title.trim() || editing.title,
      subjectId: form.subjectId,
      subject: subj?.name ?? editing.subject,
      subjectCode: subj?.code ?? editing.subjectCode,
      department: subj?.department ?? editing.department,
      programme: subj?.programme ?? editing.programme,
      semester: form.semester as SemesterNumber,
      year: Number(form.year) || editing.year,
      examType: form.examType,
      session: form.session.trim(),
      maxMarks: Number(form.maxMarks) || editing.maxMarks,
    })
    setEditing(null)
    setForm(null)
  }

  // ── Empty scope ───────────────────────────────────────────────────────────
  if (papers.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Library"
          title="Academic archive"
          description="Every question paper in scope — searchable, sortable, and openable down to the individual question."
        />
        <FilterBar compact />
        <div className="mt-6">
          <EmptyState
            icon={FolderOpen}
            title="No papers in the current scope"
            description={
              filtersActive
                ? 'The active filters exclude every paper in the dataset. Clear the filters, or upload papers for this scope.'
                : 'The archive is empty. Upload question papers as PDFs, or enable the illustrative demo dataset from Settings.'
            }
            action={{ label: 'Upload papers', to: '/upload' }}
            secondaryAction={
              filtersActive ? (
                <button className="btn-ghost" onClick={store.resetFilters}>
                  Clear filters
                </button>
              ) : (
                <Link to="/settings" className="btn-ghost">
                  Open settings
                </Link>
              )
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Library"
        title="Academic archive"
        description="Searchable, sortable archive of every paper in scope. Open a paper to preview its extracted questions, correct its metadata, or export the whole list."
        actions={
          <>
            <button className="btn-ghost !py-2.5 !text-[13px]" onClick={() => exportPapersCsv(papers)}>
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <Link to="/upload" className="btn-primary !py-2.5 !text-[13px]">
              <Upload className="h-4 w-4" />
              Upload papers
            </Link>
          </>
        }
      />

      <FilterBar compact />

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Papers in view" value={view.length} sub={`${papers.length} in the current scope`} icon={FolderOpen} />
        <Stat
          label="Demo / uploaded"
          value={`${demoCount} / ${view.length - demoCount}`}
          sub="Bundled demo vs. papers you added"
          icon={FileText}
          accent="gold"
        />
        <Stat label="Questions in view" value={viewQuestions.length} sub="Extracted from the papers shown" icon={MessageSquareQuote} accent="academic" />
        <Stat label="Distinct subjects" value={distinctSubjects} sub="Across the papers shown" icon={Search} accent="lavender" />
      </div>
      {demoCount > 0 && (
        <div className="mt-4">
          <DemoBadge />
        </div>
      )}

      {/* ── Controls ──────────────────────────────────────────────────────── */}
      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="w-full lg:max-w-sm">
          <label className="label" htmlFor="archive-search">
            Search title, subject or filename
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" aria-hidden />
            <input
              id="archive-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. Operating Systems, CSE2003, Endterm…"
              className="field pl-9"
            />
          </div>
        </div>
        <div className="w-full lg:w-56">
          <label className="label" htmlFor="archive-sort">
            Sort by
          </label>
          <select
            id="archive-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="field cursor-pointer"
          >
            <option value="year-desc">Year — newest first</option>
            <option value="year-asc">Year — oldest first</option>
            <option value="subject">Subject — A to Z</option>
            <option value="questions">Questions — most first</option>
          </select>
        </div>
      </div>

      {/* ── Local filter chips ────────────────────────────────────────────── */}
      <div className="mt-5 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">Exam type</span>
          <button onClick={() => setExamChip('All')} aria-pressed={examChip === 'All'} className={chipClass(examChip === 'All')}>
            All
          </button>
          {examTypesPresent.map((t) => (
            <button
              key={t}
              onClick={() => setExamChip(t)}
              aria-pressed={examChip === t}
              className={chipClass(examChip === t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">Status</span>
          <button onClick={() => setStatusChip('All')} aria-pressed={statusChip === 'All'} className={chipClass(statusChip === 'All')}>
            All
          </button>
          {statusesPresent.map((s) => (
            <button
              key={s}
              onClick={() => setStatusChip(s)}
              aria-pressed={statusChip === s}
              className={chipClass(statusChip === s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Paper list ────────────────────────────────────────────────────── */}
      <SectionTitle
        kicker="Archive"
        title={`${view.length} paper${view.length === 1 ? '' : 's'}`}
        description="Diagnostics are reported exactly as the parser produced them — including warnings and OCR usage."
      />

      {view.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No papers match your search"
          description="Nothing in the current scope matches the search text and chips. Try clearing them to see every paper."
          action={{ label: 'Upload papers', to: '/upload' }}
          secondaryAction={
            <button
              className="btn-ghost"
              onClick={() => {
                setSearch('')
                setExamChip('All')
                setStatusChip('All')
              }}
            >
              Clear search & chips
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {view.map((p) => (
            <Card as="article" key={p.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg leading-snug text-graphite">{p.title}</h3>
                  <p className="mt-1 font-mono text-[11px] text-graphite-500">
                    {p.subjectCode} · {p.department}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  <Badge tone="navy">Semester {p.semester}</Badge>
                  <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
                  {p.demo && <Badge tone="gold" title="Bundled illustrative demo paper — fictional data">demo</Badge>}
                  {isDuplicate(p) && (
                    <Badge tone="red" title="Another paper shares this subject, year, exam type and filename">
                      Possible duplicate
                    </Badge>
                  )}
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">Year</dt>
                  <dd className="text-sm text-graphite-700">{p.year}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">Exam type</dt>
                  <dd className="text-sm text-graphite-700">{p.examType}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">Session</dt>
                  <dd className="text-sm text-graphite-700">{p.session}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">Max marks</dt>
                  <dd className="text-sm text-graphite-700">{p.maxMarks}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">Questions</dt>
                  <dd className="text-sm text-graphite-700">{p.questionCount}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">Pages</dt>
                  <dd className="text-sm text-graphite-700">{p.pageCount ?? '—'}</dd>
                </div>
              </dl>

              <p className="mt-3 break-all font-mono text-[11px] text-graphite-400">{p.filename}</p>

              {p.extraction && (
                <div className="mt-3 rounded-xl border border-ivory-200 bg-ivory-50 px-3.5 py-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">Extraction diagnostics</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-graphite-600">
                    <span>{p.extraction.textPages} text pages</span>
                    <span>{p.extraction.scannedPages} scanned pages</span>
                    <span>{p.extraction.charsExtracted.toLocaleString()} chars</span>
                    {p.extraction.ocrUsed && (
                      <span>
                        OCR used
                        {typeof p.extraction.ocrConfidence === 'number'
                          ? ` · ${Math.round(p.extraction.ocrConfidence * 100)}% confidence`
                          : ''}
                      </span>
                    )}
                  </div>
                  {p.extraction.warnings.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {p.extraction.warnings.slice(0, 2).map((w, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[11px] leading-snug text-gold-600">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                          {w}
                        </li>
                      ))}
                      {p.extraction.warnings.length > 2 && (
                        <li className="font-mono text-[10px] text-graphite-400">
                          +{p.extraction.warnings.length - 2} more warnings
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2 pt-1">
                <button className={actionClass} onClick={() => setPreview(p)} aria-label={`Preview questions from ${p.title}`}>
                  <Eye className="h-3.5 w-3.5" aria-hidden />
                  Preview
                </button>
                <button
                  className={actionClass}
                  onClick={() => openEdit(p)}
                  aria-label={`Edit metadata for ${p.title}`}
                  disabled={p.demo}
                  title={p.demo ? 'Demo paper metadata is fixed and cannot be edited' : 'Edit metadata'}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Edit metadata
                </button>
                <Link
                  to={`/questions?paperId=${encodeURIComponent(p.id)}`}
                  className={actionClass}
                  aria-label={`Open questions for ${p.title}`}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  Open questions
                </Link>
                <button
                  className={`${actionClass} !border-rose-200 text-rose-700 hover:!border-rose-400 hover:text-rose-800`}
                  onClick={() => setDeleting(p)}
                  aria-label={`Delete ${p.title}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Preview modal ─────────────────────────────────────────────────── */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.title ?? ''} wide>
        {preview && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="navy">{preview.subjectCode}</Badge>
              <Badge tone="grey">Semester {preview.semester}</Badge>
              <Badge tone="blue">{preview.examType} · {preview.year}</Badge>
              <Badge tone={STATUS_TONE[preview.status]}>{preview.status}</Badge>
              {preview.demo && <Badge tone="gold">demo</Badge>}
            </div>
            <p className="font-mono text-[11px] text-graphite-400">
              {preview.filename} · {previewQuestions.length} extracted question{previewQuestions.length === 1 ? '' : 's'}
            </p>

            {previewQuestions.length === 0 ? (
              <p className="rounded-xl border border-ivory-200 bg-ivory-50 px-4 py-6 text-center text-sm text-graphite-600">
                No questions were extracted from this paper yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {previewQuestions.map((q) => (
                  <li key={q.id} className="rounded-xl border border-ivory-200 bg-ivory-50 p-4">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-graphite-500">
                      <span className="text-navy">
                        {q.questionNumber}
                        {q.subQuestion ? `(${q.subQuestion})` : ''}
                      </span>
                      <span>· {q.marks} marks</span>
                      <span>· page {q.sourcePage}</span>
                      <span>· {q.topic}</span>
                      {q.demo && <span className="text-gold-600">· demo</span>}
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-graphite-700">{q.text}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <ConfidenceBadge value={q.confidence} needsReview={q.needsReview} />
                      {q.needsReview && !q.confirmed && <Badge tone="gold">Needs review</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>

      {/* ── Edit metadata modal ───────────────────────────────────────────── */}
      <Modal
        open={!!editing}
        onClose={() => {
          setEditing(null)
          setForm(null)
        }}
        title="Edit paper metadata"
      >
        {editing && form && (
          <div className="space-y-4">
            {editing.demo && (
              <div className="rounded-xl border border-gold/40 bg-gold-100 px-4 py-3 text-xs leading-relaxed text-gold-600">
                This is a bundled demo paper. Demo metadata is fixed so the illustrative dataset stays
                reproducible — editing is disabled. Upload your own paper to change its metadata.
              </div>
            )}

            <div>
              <label className="label" htmlFor="edit-title">
                Title
              </label>
              <input
                id="edit-title"
                className="field"
                value={form.title}
                disabled={editing.demo}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div>
              <label className="label" htmlFor="edit-subject">
                Subject
              </label>
              <select
                id="edit-subject"
                className="field cursor-pointer"
                value={form.subjectId}
                disabled={editing.demo}
                onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
              >
                {!store.subjects.some((s) => s.id === form.subjectId) && (
                  <option value={form.subjectId}>{editing.subject}</option>
                )}
                {store.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="edit-semester">
                  Semester
                </label>
                <select
                  id="edit-semester"
                  className="field cursor-pointer"
                  value={String(form.semester)}
                  disabled={editing.demo}
                  onChange={(e) => setForm({ ...form, semester: Number(e.target.value) })}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      Semester {n}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="edit-year">
                  Year
                </label>
                <input
                  id="edit-year"
                  type="number"
                  min={1990}
                  max={2100}
                  className="field"
                  value={form.year}
                  disabled={editing.demo}
                  onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label" htmlFor="edit-exam">
                  Exam type
                </label>
                <select
                  id="edit-exam"
                  className="field cursor-pointer"
                  value={form.examType}
                  disabled={editing.demo}
                  onChange={(e) => setForm({ ...form, examType: e.target.value as ExamType })}
                >
                  {EXAM_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="edit-marks">
                  Max marks
                </label>
                <input
                  id="edit-marks"
                  type="number"
                  min={1}
                  className="field"
                  value={form.maxMarks}
                  disabled={editing.demo}
                  onChange={(e) => setForm({ ...form, maxMarks: Number(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="edit-session">
                Session
              </label>
              <input
                id="edit-session"
                className="field"
                value={form.session}
                disabled={editing.demo}
                placeholder="e.g. May 2025"
                onChange={(e) => setForm({ ...form, session: e.target.value })}
              />
            </div>

            <div className="flex flex-wrap justify-end gap-3 pt-1">
              <button
                className="btn-ghost !py-2.5 !text-[13px]"
                onClick={() => {
                  setEditing(null)
                  setForm(null)
                }}
              >
                Cancel
              </button>
              <button className="btn-primary !py-2.5 !text-[13px]" onClick={saveEdit} disabled={editing.demo}>
                Save metadata
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Delete confirmation ───────────────────────────────────────────── */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete this paper?">
        {deleting && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-graphite-600">
              <span className="font-medium text-graphite">{deleting.title}</span> and its{' '}
              {deleting.questionCount} extracted question{deleting.questionCount === 1 ? '' : 's'} will be removed
              from your local dataset. This cannot be undone
              {deleting.demo ? ' — for a demo paper, the exclusion is remembered so it stays hidden.' : '.'}
            </p>
            <p className="font-mono text-[11px] text-graphite-400">{deleting.filename}</p>
            <div className="flex flex-wrap justify-end gap-3">
              <button className="btn-ghost !py-2.5 !text-[13px]" onClick={() => setDeleting(null)}>
                Keep paper
              </button>
              <button
                className="btn-primary !py-2.5 !text-[13px] !bg-rose-700 hover:!bg-rose-800"
                onClick={() => {
                  store.removePaper(deleting.id)
                  setDeleting(null)
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Delete paper
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
