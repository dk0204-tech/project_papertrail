import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, FileText, FilePlus2, Loader2,
  ScanText, Trash2, Upload as UploadIcon, X,
} from 'lucide-react'
import { usePaperTrail } from '../store/PaperTrailStore'
import { extractPdfText, ocrPage, renderPdfPageToCanvas, ExtractionResult } from '../services/pdfExtraction'
import { parseQuestionsFromPages, materializeQuestions } from '../services/questionParser'
import { classifyQuestion } from '../services/topicClassifier'
import { Paper, Question, SemesterNumber, Subject, ExamType } from '../types'
import { Badge, Card, ConfidenceBadge, EmptyState, Modal, PageHeader, SectionTitle, TableWrap, Td, Th, truncate } from '../components/ui'
import { putDocument } from '../storage/indexedDB'

type Status = 'queued' | 'extracting' | 'parsing' | 'mapping' | 'needs-review' | 'complete' | 'failed'

interface QueueItem {
  id: string
  file: File
  status: Status
  page: number
  total: number
  result?: ExtractionResult
  paper?: Paper
  questions?: Question[]
  error?: string
}

const MAX_BYTES = 25 * 1024 * 1024

const STATUS_LABEL: Record<Status, string> = {
  queued: 'Uploaded',
  extracting: 'Extracting text',
  parsing: 'Parsing questions',
  mapping: 'Mapping topics',
  'needs-review': 'Needs review',
  complete: 'Analysis complete',
  failed: 'Processing failed',
}

/** Pull hints (year, code, exam type) out of the filename — editable afterwards. */
function hintsFromFilename(name: string) {
  const year = name.match(/(20\d{2})/)?.[1]
  const code = name.match(/\b([A-Z]{2,4}\d{3,4})\b/)?.[1]
  const examType: ExamType = /mid/i.test(name) ? 'Midterm' : /makeup/i.test(name) ? 'Makeup' : /internal/i.test(name) ? 'Internal' : 'Endterm'
  return { year: year ? Number(year) : new Date().getFullYear(), code: code ?? '', examType }
}

export const UploadPage: React.FC = () => {
  const store = usePaperTrail()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [processing, setProcessing] = useState(false)
  const [review, setReview] = useState<QueueItem | null>(null)
  const [reviewDraft, setReviewDraft] = useState<Question[]>([])
  const [previewPage, setPreviewPage] = useState(1)
  const [previewSource, setPreviewSource] = useState<ArrayBuffer | null>(null)
  const [previewError, setPreviewError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // metadata applied to the batch (prefilled per file once selected)
  const [meta, setMeta] = useState({
    subjectId: store.subjects[0]?.id ?? '',
    year: new Date().getFullYear(),
    examType: 'Endterm' as ExamType,
    session: '',
    maxMarks: 100,
    creatingSubject: false,
    newName: '',
    newCode: '',
    newDepartment: store.subjects[0]?.department ?? 'Computer Science & Engineering',
    newProgramme: store.subjects[0]?.programme ?? 'B.Tech Computer Science',
    newSemester: 3 as SemesterNumber,
  })

  const update = useCallback((id: string, patch: Partial<QueueItem>) => {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)))
  }, [])

  const existingNames = useMemo(() => new Set(store.papers.map((p) => p.filename)), [store.papers])

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files)
      const items: QueueItem[] = []
      const skipped: string[] = []
      for (const file of arr) {
        if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
          items.push({ id: `${file.name}-${file.size}-${Date.now()}`, file, status: 'failed', page: 0, total: 0, error: 'Not a PDF file — only .pdf documents can be processed.' })
          continue
        }
        if (file.size > MAX_BYTES) {
          items.push({ id: `${file.name}-${file.size}-${Date.now()}`, file, status: 'failed', page: 0, total: 0, error: `File is ${(file.size / 1048576).toFixed(1)} MB — the limit is 25 MB per document.` })
          continue
        }
        if (existingNames.has(file.name)) {
          skipped.push(file.name)
          continue
        }
        const hints = hintsFromFilename(file.name)
        setMeta((m) => ({ ...m, year: hints.year, examType: hints.examType, newCode: hints.code || m.newCode }))
        items.push({ id: `${file.name}-${file.size}-${Date.now()}`, file, status: 'queued', page: 0, total: 0 })
      }
      setQueue((prev) => [...prev, ...items])
      if (skipped.length > 0) {
        setQueue((prev) => [
          ...prev,
          ...skipped.map((name) => ({
            id: `dup-${name}-${Date.now()}`,
            file: new File([], name),
            status: 'failed' as Status,
            page: 0,
            total: 0,
            error: 'Possible duplicate — a paper with this filename already exists in the archive. It was not queued again.',
          })),
        ])
      }
    },
    [existingNames],
  )

  const resolveSubject = (): Subject => {
    if (meta.creatingSubject || !meta.subjectId) {
      const id = `sub-${(meta.newName || 'subject').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32)}-${Date.now().toString(36)}`
      const subject: Subject = {
        id,
        name: meta.newName.trim() || 'Untitled subject',
        code: meta.newCode.trim() || 'NEW000',
        department: meta.newDepartment,
        programme: meta.newProgramme,
        semester: meta.newSemester,
        courseType: 'Core',
        scheme: 'User supplied',
      }
      store.upsertSubject(subject)
      return subject
    }
    const found = store.subjectById(meta.subjectId)
    if (!found) throw new Error('Selected subject no longer exists.')
    return found
  }

  const processAll = async () => {
    const pending = queue.filter((q) => q.status === 'queued')
    if (pending.length === 0) return
    setProcessing(true)

    let subject: Subject | null = null
    try {
      subject = resolveSubject()
    } catch (e) {
      setProcessing(false)
      alert(e instanceof Error ? e.message : 'Could not resolve the subject for this batch.')
      return
    }
    const syllabus = store.syllabusFor(subject.id)

    for (const item of pending) {
      try {
        // 1 — extraction (real page-by-page progress from PDF.js)
        update(item.id, { status: 'extracting', page: 0, total: 0, error: undefined })
        const result = await extractPdfText(item.file, (page, total) => update(item.id, { page, total }))
        update(item.id, { result })

        if (result.totalChars === 0) {
          update(item.id, {
            status: 'failed',
            error:
              'No selectable text found — this document appears to be a scan. Use “Run OCR” below, or add the questions manually after creating the paper.',
          })
          continue
        }

        // 2 — structure parsing
        update(item.id, { status: 'parsing' })
        await new Promise((r) => setTimeout(r, 30)) // yield so the UI paints honestly
        const parsed = parseQuestionsFromPages(result.pages)

        if (parsed.questions.length === 0) {
          update(item.id, {
            status: 'failed',
            error: parsed.warnings[0] ?? 'No questions could be identified in the extracted text.',
          })
          continue
        }

        // 3 — classification
        update(item.id, { status: 'mapping' })
        await new Promise((r) => setTimeout(r, 30))

        const paper: Paper = {
          id: `up-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          subjectId: subject.id,
          title: `${subject.name} ${meta.examType} Examination ${meta.year}`,
          subject: subject.name,
          subjectCode: subject.code,
          department: subject.department,
          programme: subject.programme,
          semester: subject.semester,
          year: meta.year,
          examType: meta.examType,
          session: meta.session.trim() || `${meta.year}`,
          maxMarks: meta.maxMarks,
          scheme: subject.scheme,
          filename: item.file.name,
          status: 'Analysis complete',
          questionCount: parsed.questions.length,
          uploadDate: new Date().toISOString().slice(0, 10),
          fileSize: `${(item.file.size / 1048576).toFixed(1)} MB`,
          pageCount: result.pages.length,
          demo: false,
          extraction: {
            textPages: result.pages.filter((p) => !p.likelyScanned).length,
            scannedPages: result.scannedPages,
            ocrUsed: false,
            charsExtracted: result.totalChars,
            warnings: [...result.warnings, ...parsed.warnings],
          },
        }

        const questions = materializeQuestions(parsed.questions, paper, subject, syllabus)

        store.addUploadedPaper(paper, questions)
        // keep the raw file locally for the preview (best effort — quota safe)
        try {
          const buf = await item.file.arrayBuffer()
          await putDocument({
            id: paper.id, name: item.file.name, size: item.file.size,
            type: item.file.type, addedAt: Date.now(), blob: new Blob([buf], { type: 'application/pdf' }),
          })
        } catch {
          /* preview will fall back to text-only; not a processing failure */
        }

        const needsReview = questions.some((q) => q.needsReview)
        update(item.id, {
          status: needsReview ? 'needs-review' : 'complete',
          paper,
          questions,
        })
      } catch (err) {
        update(item.id, {
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unexpected error while processing this document.',
        })
      }
    }
    setProcessing(false)
  }

  const removeItem = (id: string) => setQueue((prev) => prev.filter((q) => q.id !== id))

  const runOcr = async (item: QueueItem) => {
    if (!item.result) return
    update(item.id, { status: 'extracting', page: 0, total: item.result.pages.filter((p) => p.likelyScanned).length })
    let ok = 0
    const pages = [...item.result.pages]
    for (const p of pages) {
      if (!p.likelyScanned) continue
      const res = await ocrPage(p.pageNumber, item.file)
      if (res && res.text.trim().length > 20) {
        p.text = res.text
        p.likelyScanned = false
        ok++
      }
    }
    update(item.id, { result: { ...item.result, pages, scannedPages: item.result.scannedPages - ok } })
    if (ok > 0) {
      const parsed = parseQuestionsFromPages(pages)
      if (parsed.questions.length > 0) {
        const subject = store.subjectById(meta.subjectId)
        if (subject) {
          const paper: Paper = {
            id: `ocr-${Date.now().toString(36)}`, subjectId: subject.id,
            title: `${subject.name} ${meta.examType} Examination ${meta.year}`,
            subject: subject.name, subjectCode: subject.code, department: subject.department,
            programme: subject.programme, semester: subject.semester, year: meta.year,
            examType: meta.examType, session: meta.session || `${meta.year}`, maxMarks: meta.maxMarks,
            scheme: subject.scheme, filename: item.file.name, status: 'Needs review',
            questionCount: parsed.questions.length, uploadDate: new Date().toISOString().slice(0, 10),
            fileSize: `${(item.file.size / 1048576).toFixed(1)} MB`, pageCount: pages.length, demo: false,
            extraction: {
              textPages: pages.filter((p) => !p.likelyScanned).length, scannedPages: 0, ocrUsed: true,
              ocrConfidence: 0.5, charsExtracted: pages.reduce((n, p) => n + p.text.length, 0),
              warnings: ['Text recovered by OCR — wording may contain recognition errors. Review each question.'],
            },
          }
          const questions = materializeQuestions(parsed.questions, paper, subject, store.syllabusFor(subject.id))
          store.addUploadedPaper(paper, questions)
          update(item.id, { status: 'needs-review', paper, questions })
          return
        }
      }
    }
    update(item.id, { status: 'failed', error: 'OCR could not recover usable text (engine or language data unavailable, or the page image was unreadable).' })
  }

  const openReview = async (item: QueueItem) => {
    setReview(item)
    setReviewDraft(item.questions ?? [])
    setPreviewPage(1)
    setPreviewError('')
    setPreviewSource(null)
    try {
      const doc = await item.file.arrayBuffer()
      setPreviewSource(doc)
    } catch {
      setPreviewError('Original file is no longer available in this session — showing extracted text only.')
    }
  }

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !previewSource || !review) return
    let cancelled = false
    renderPdfPageToCanvas(previewSource, previewPage, canvas)
      .catch((e) => !cancelled && setPreviewError(e instanceof Error ? e.message : 'Could not render this page.'))
    return () => {
      cancelled = true
    }
  }, [previewSource, previewPage, review])

  const saveReview = () => {
    if (!review) return
    store.bulkUpdateQuestions(reviewDraft)
    setReview((r) => (r ? { ...r, questions: reviewDraft, status: 'complete' } : r))
    setQueue((prev) => prev.map((q) => (q.id === review!.id ? { ...q, questions: reviewDraft, status: 'complete' } : q)))
    setReview(null)
  }

  const stats = useMemo(() => ({
    queued: queue.filter((q) => q.status === 'queued').length,
    done: queue.filter((q) => q.status === 'complete' || q.status === 'needs-review').length,
    failed: queue.filter((q) => q.status === 'failed').length,
    questions: queue.reduce((n, q) => n + (q.questions?.length ?? 0), 0),
  }), [queue])

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Library · Ingest"
        title="Upload question papers"
        description="PDFs are read entirely in your browser with PDF.js — questions, numbering, marks and page references are extracted, then classified against your syllabus. Nothing is uploaded to a server."
        actions={
          <>
            <Link to="/archive" className="btn-ghost !py-2.5 !text-[13px]">Open archive</Link>
            <button onClick={processAll} disabled={processing || stats.queued === 0} className="btn-primary !py-2.5 !text-[13px]">
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {processing ? 'Processing…' : `Process ${stats.queued || ''} ${stats.queued === 1 ? 'paper' : 'papers'}`}
            </button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ── Left: dropzone + metadata ─────────────────────────────────── */}
        <div className="space-y-4 lg:col-span-2">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files) }}
            className={`rounded-2xl border-2 border-dashed p-8 text-center transition-all ${dragOver ? 'border-navy bg-navy/5' : 'border-ivory-400 bg-white hover:border-academic'}`}
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-ivory-300 bg-ivory-100 text-academic">
              <UploadIcon className="h-5 w-5" />
            </div>
            <h3 className="text-xl text-graphite">Drag & drop PDF papers</h3>
            <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-graphite-500">
              Multiple files supported · 25 MB each · scanned PDFs can be OCR'd after extraction
            </p>
            <button onClick={() => inputRef.current?.click()} className="btn-primary mt-5 !py-2.5 !text-[13px]">
              <FilePlus2 className="h-4 w-4" /> Choose PDF files
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = '' }}
              aria-label="Select question paper PDF files"
            />
          </div>

          <Card className="p-5">
            <h3 className="text-lg text-graphite">Paper metadata</h3>
            <p className="mt-1 text-xs text-graphite-500">Applied to every file in this batch — subject, session and marks stay attached to the questions they produce.</p>

            <div className="mt-4 space-y-3">
              <div className="flex gap-2">
                <label className="flex-1">
                  <span className="label">Subject</span>
                  <select
                    className="field"
                    value={meta.creatingSubject ? '__new' : meta.subjectId}
                    onChange={(e) => {
                      if (e.target.value === '__new') setMeta((m) => ({ ...m, creatingSubject: true }))
                      else setMeta((m) => ({ ...m, subjectId: e.target.value, creatingSubject: false }))
                    }}
                  >
                    {store.subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.code} · {s.name} (S{s.semester})</option>
                    ))}
                    <option value="__new">＋ Create new subject…</option>
                  </select>
                </label>
              </div>

              {meta.creatingSubject && (
                <div className="rounded-xl border border-ivory-300 bg-ivory-50 p-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="col-span-2"><span className="label">Subject name</span>
                      <input className="field" value={meta.newName} onChange={(e) => setMeta((m) => ({ ...m, newName: e.target.value }))} placeholder="e.g. Computer Networks" /></label>
                    <label><span className="label">Code</span>
                      <input className="field" value={meta.newCode} onChange={(e) => setMeta((m) => ({ ...m, newCode: e.target.value }))} placeholder="CSE2002" /></label>
                    <label><span className="label">Semester</span>
                      <select className="field" value={meta.newSemester} onChange={(e) => setMeta((m) => ({ ...m, newSemester: Number(e.target.value) as SemesterNumber }))}>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>Semester {n}</option>)}
                      </select></label>
                    <label><span className="label">Department</span>
                      <input className="field" value={meta.newDepartment} onChange={(e) => setMeta((m) => ({ ...m, newDepartment: e.target.value }))} /></label>
                    <label><span className="label">Programme</span>
                      <input className="field" value={meta.newProgramme} onChange={(e) => setMeta((m) => ({ ...m, newProgramme: e.target.value }))} /></label>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label><span className="label">Academic year</span>
                  <input type="number" className="field" value={meta.year} onChange={(e) => setMeta((m) => ({ ...m, year: Number(e.target.value) }))} /></label>
                <label><span className="label">Exam type</span>
                  <select className="field" value={meta.examType} onChange={(e) => setMeta((m) => ({ ...m, examType: e.target.value as ExamType }))}>
                    {['Endterm', 'Midterm', 'Makeup', 'Internal', 'Supplementary'].map((t) => <option key={t}>{t}</option>)}
                  </select></label>
                <label><span className="label">Session</span>
                  <input className="field" value={meta.session} onChange={(e) => setMeta((m) => ({ ...m, session: e.target.value }))} placeholder="e.g. May 2025" /></label>
                <label><span className="label">Max marks</span>
                  <input type="number" className="field" value={meta.maxMarks} onChange={(e) => setMeta((m) => ({ ...m, maxMarks: Number(e.target.value) }))} /></label>
              </div>

              {!meta.creatingSubject && meta.subjectId && (
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">
                  {store.syllabusFor(meta.subjectId) ? 'Syllabus mapped — questions will be classified by keyword match' : 'No syllabus for this subject — classification will be provisional'}
                </p>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-lg text-graphite">How processing works</h3>
            <ol className="mt-3 space-y-2.5 text-xs leading-relaxed text-graphite-600">
              {[
                'PDF.js reads every page in your browser and reconstructs text lines.',
                'A layout heuristic finds question numbers, subquestions and marks.',
                'Each question is matched against the syllabus with explainable keyword scoring.',
                'Anything uncertain is flagged “Needs review” — you confirm or correct it.',
              ].map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="font-mono text-[10px] text-academic">0{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 border-t border-ivory-200 pt-3 font-mono text-[10px] leading-relaxed text-graphite-400">
              This is heuristic parsing and keyword matching — not a language model. Complex layouts
              may need manual correction.
            </p>
          </Card>
        </div>

        {/* ── Right: queue ──────────────────────────────────────────────── */}
        <div className="space-y-4 lg:col-span-3">
          <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="flex flex-wrap gap-5 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite-500">
              <span><strong className="text-graphite">{stats.queued}</strong> queued</span>
              <span><strong className="text-navy">{stats.done}</strong> complete</span>
              <span><strong className="text-graphite">{stats.questions}</strong> questions extracted</span>
              {stats.failed > 0 && <span><strong className="text-rose-700">{stats.failed}</strong> failed</span>}
            </div>
            {queue.length > 0 && (
              <button onClick={() => setQueue([])} className="text-xs font-grotesk text-graphite-500 hover:text-graphite">Clear list</button>
            )}
          </Card>

          {queue.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No documents queued"
              description="Drop one or several previous-year question papers on the panel. Each file is read, parsed and classified independently, and failures always explain why."
              action={{ label: 'Browse the archive first', to: '/archive' }}
            />
          ) : (
            <ul className="space-y-3">
              {queue.map((item) => (
                <li key={item.id}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-graphite">{item.file.name || 'Duplicate entry'}</p>
                        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">
                          {item.file.size ? `${(item.file.size / 1048576).toFixed(1)} MB · ` : ''}
                          {STATUS_LABEL[item.status]}
                          {item.status === 'extracting' && item.total > 0 ? ` · page ${item.page}/${item.total}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge tone={
                          item.status === 'failed' ? 'red'
                          : item.status === 'complete' ? 'green'
                          : item.status === 'needs-review' ? 'gold'
                          : item.status === 'queued' ? 'grey' : 'blue'
                        }>
                          {item.status === 'extracting' || item.status === 'parsing' || item.status === 'mapping'
                            ? <><Loader2 className="h-3 w-3 animate-spin" /> {STATUS_LABEL[item.status]}</> 
                            : item.status === 'complete' ? <><CheckCircle2 className="h-3 w-3" /> Complete</>
                            : STATUS_LABEL[item.status]}
                        </Badge>
                        <button onClick={() => removeItem(item.id)} aria-label={`Remove ${item.file.name}`} className="rounded-lg border border-ivory-300 p-1.5 text-graphite-500 hover:border-rose-300 hover:text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* real progress bar while extracting */}
                    {item.status === 'extracting' && item.total > 0 && (
                      <div className="mt-3">
                        <div className="h-1.5 overflow-hidden rounded-full bg-ivory-200">
                          <div className="h-full rounded-full bg-academic transition-[width] duration-300" style={{ width: `${(item.page / item.total) * 100}%` }} />
                        </div>
                        <p className="mt-1 font-mono text-[10px] text-graphite-400">Reading page {item.page} of {item.total}…</p>
                      </div>
                    )}

                    {item.error && (
                      <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-700" />
                        <div>
                          <p className="text-xs leading-relaxed text-rose-800">{item.error}</p>
                          {item.result && item.result.scannedPages > 0 && item.status === 'failed' && (
                            <button onClick={() => runOcr(item)} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-2.5 py-1.5 text-[11px] font-grotesk font-medium text-rose-800 hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40">
                              <ScanText className="h-3.5 w-3.5" /> Try OCR on scanned pages
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {(item.result?.warnings.length ?? 0) > 0 && item.status !== 'failed' && (
                      <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-gold-600">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        {item.result!.warnings.join(' ')}
                      </p>
                    )}

                    {(item.status === 'complete' || item.status === 'needs-review') && item.paper && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ivory-200 pt-3">
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">
                          {item.questions?.length} questions · {item.paper.pageCount ?? '?'} pages · {item.paper.subjectCode}
                        </span>
                        <button onClick={() => openReview(item)} className="btn-ghost !py-1.5 !px-3 !text-[11px]">
                          Review extraction
                        </button>
                        <Link to="/analytics/topics" className="btn-primary !py-1.5 !px-3 !text-[11px]">
                          See analytics <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          )}

          {stats.done > 0 && (
            <div className="flex flex-wrap gap-3">
              <button onClick={() => navigate('/questions?review=1')} className="btn-primary">Review classifications</button>
              <button onClick={() => navigate('/dashboard')} className="btn-ghost">Open dashboard</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Review modal: original document ⇄ extracted text ─────────────── */}
      <Modal open={!!review} onClose={() => setReview(null)} title="Review extraction" wide>
        {review && (
          <div className="space-y-5">
            {previewError && (
              <p className="flex items-start gap-2 rounded-lg border border-gold/40 bg-gold-100 p-3 text-xs text-gold-600">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {previewError}
              </p>
            )}
            <div className="grid gap-5 lg:grid-cols-2">
              {/* original */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="eyebrow text-graphite-500">Original document</p>
                  {review.result && (
                    <label className="flex items-center gap-1.5 text-[11px] text-graphite-500">
                      Page
                      <select className="field !w-auto !py-1 !text-[11px]" value={previewPage} onChange={(e) => setPreviewPage(Number(e.target.value))}>
                        {Array.from({ length: review.result.pages.length }, (_, i) => (
                          <option key={i + 1} value={i + 1}>{i + 1}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                <div className="flex max-h-[60vh] items-start justify-center overflow-auto rounded-xl border border-ivory-300 bg-ivory-100 p-3">
                  {previewSource ? (
                    <canvas ref={canvasRef} className="h-auto w-full max-w-[420px] shadow-lift" aria-label={`Page ${previewPage} of the uploaded PDF`} />
                  ) : (
                    <p className="p-6 text-center text-xs text-graphite-500">{previewError || 'Original file unavailable in this session.'}</p>
                  )}
                </div>
              </div>

              {/* extracted */}
              <div>
                <p className="eyebrow mb-2 text-graphite-500">Extracted text — page {previewPage}</p>
                <pre className="max-h-[60vh] whitespace-pre-wrap overflow-auto rounded-xl border border-ivory-300 bg-white p-3 font-mono text-[11px] leading-relaxed text-graphite-700">
                  {review.result?.pages.find((p) => p.pageNumber === previewPage)?.text || '(no text on this page)'}
                </pre>
              </div>
            </div>

            <SectionTitle kicker="Parsed questions" title="Correct anything the parser got wrong" description="Edits update analytics immediately. Confirm classification only when the topic is right." />
            <div className="space-y-3">
              {reviewDraft.map((q, idx) => (
                <div key={q.id} className={`rounded-xl border p-4 ${q.needsReview && !q.confirmed ? 'border-gold/50 bg-gold-100/40' : 'border-ivory-300 bg-ivory-50'}`}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <input
                      className="field !w-16 !py-1 !text-center font-mono !text-xs"
                      value={q.questionNumber}
                      aria-label="Question number"
                      onChange={(e) => setReviewDraft((d) => d.map((x, i) => (i === idx ? { ...x, questionNumber: e.target.value } : x)))}
                    />
                    <input
                      className="field !w-16 !py-1 !text-center font-mono !text-xs"
                      value={q.marks ?? ''}
                      type="number"
                      aria-label="Marks"
                      onChange={(e) => setReviewDraft((d) => d.map((x, i) => (i === idx ? { ...x, marks: e.target.value === '' ? null : Number(e.target.value) } : x)))}
                    />
                    <Badge tone="blue">{q.topic}</Badge>
                    <ConfidenceBadge value={q.confidence} needsReview={q.needsReview} />
                    <span className="font-mono text-[10px] text-graphite-400">p.{q.sourcePage}</span>
                    <button
                      onClick={() => setReviewDraft((d) => d.map((x, i) => (i === idx ? { ...x, confirmed: !x.confirmed, needsReview: !x.confirmed ? x.needsReview : false } : x)))}
                      className={`ml-auto rounded-lg border px-2.5 py-1 text-[11px] font-grotesk font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 ${q.confirmed ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-ivory-300 bg-white text-graphite-600 hover:border-graphite-400'}`}
                    >
                      {q.confirmed ? 'Confirmed ✓' : 'Confirm'}
                    </button>
                  </div>
                  <textarea
                    className="field min-h-[64px] !text-[13px]"
                    value={q.text}
                    aria-label="Question text"
                    onChange={(e) => setReviewDraft((d) => d.map((x, i) => (i === idx ? { ...x, text: e.target.value, classificationSource: x.classificationSource === 'manual' ? 'manual' : x.classificationSource } : x)))}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[10px] text-graphite-500">
                    <span>{q.unit.split(':')[0]} · {q.chapter}</span>
                    <span>{q.questionType} · {q.difficulty} · {q.cognitiveLevel}</span>
                    {q.classificationSource === 'syllabus-match' && q.matchedKeywords.length > 0 && <span className="text-academic">matched: {q.matchedKeywords.join(', ')}</span>}
                  </div>
                  {idx === 0 && q.explanation && <p className="mt-1 text-[11px] italic text-graphite-500">{q.explanation}</p>}
                </div>
              ))}
            </div>

            <div className="sticky bottom-0 -mx-6 flex items-center justify-between gap-3 border-t border-ivory-200 bg-white/95 px-6 py-3 backdrop-blur">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">
                {reviewDraft.filter((q) => q.confirmed).length}/{reviewDraft.length} confirmed
              </span>
              <div className="flex gap-2">
                <button onClick={() => setReview(null)} className="btn-ghost !py-2 !text-[13px]">Cancel</button>
                <button onClick={saveReview} className="btn-primary !py-2 !text-[13px]">Save changes</button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
