import React, { useMemo, useRef, useState } from 'react'
import {
  BookOpen, CheckCircle2, Download, FileUp, FolderPlus, MessageSquareWarning, Plus,
  RotateCcw, Save, Trash2, Upload as UploadIcon,
} from 'lucide-react'
import { usePaperTrail } from '../store/PaperTrailStore'
import { Syllabus, SyllabusChapter, SyllabusUnit, Subject, SemesterNumber } from '../types'
import { importSyllabusJson, importSyllabusPdf, emptySyllabus, syllabusToJson } from '../services/syllabusMapper'
import { download } from '../services/reportExporter'
import { Badge, Card, EmptyState, PageHeader, SectionTitle, Modal } from '../components/ui'

/**
 * Syllabus manager — the primary source of truth for question classification.
 * Structure: Subject → Unit → Chapter → Topic → Subtopic.
 * Users may upload (PDF), import JSON, or edit manually; nothing here claims
 * to be official MIT Manipal curriculum data.
 */
export const SyllabusPage: React.FC = () => {
  const store = usePaperTrail()
  const [subjectId, setSubjectId] = useState(store.subjects[0]?.id ?? '')
  const fileRef = useRef<HTMLInputElement>(null)
  const jsonRef = useRef<HTMLInputElement>(null)

  const [draft, setDraft] = useState<Syllabus | null>(null)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null)
  const [jsonOpen, setJsonOpen] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [confirmReclass, setConfirmReclass] = useState(false)

  const subject = store.subjectById(subjectId)
  const stored = store.syllabusFor(subjectId)
  const dirty = draft !== null
  const syllabus = draft ?? stored

  const questionCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const q of store.questions) if (q.subjectId === subjectId) map.set(q.topic, (map.get(q.topic) ?? 0) + 1)
    return map
  }, [store.questions, subjectId])

  if (!subject) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
        <PageHeader eyebrow="Library · Syllabus" title="Syllabus manager" description="Map units, chapters and topics to every subject in your programme." />
        <EmptyState icon={BookOpen} title="No subjects yet" description="Add subjects from the subject explorer, or upload papers to create one automatically." action={{ label: 'Open subjects', to: '/subjects' }} />
      </div>
    )
  }

  const edit = (fn: (s: Syllabus) => Syllabus) => setDraft(fn(structuredClone(syllabus!)))

  const save = (reclassify: boolean) => {
    if (!draft) return
    store.setSyllabus(subjectId, draft)
    if (reclassify) store.reclassifyAll(subjectId)
    setDraft(null)
    setNotice({ kind: 'ok', text: reclassify ? 'Syllabus saved and questions re-classified against it.' : 'Syllabus saved.' })
  }

  const onPdf = async (file: File) => {
    setNotice(null)
    const res = await importSyllabusPdf(file, subject)
    if (res.syllabus) {
      setDraft(res.syllabus)
      setNotice({
        kind: res.warnings.length ? 'warn' : 'ok',
        text: `Parsed ${res.syllabus.units.length} units from "${file.name}". Review the structure below before saving.${res.warnings.length ? ` Warnings: ${res.warnings.join(' ')}` : ''}`,
      })
    } else {
      setNotice({ kind: 'err', text: res.errors.join(' ') })
    }
  }

  const onJsonFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const res = importSyllabusJson(String(reader.result), subject)
      if (res.syllabus) {
        setDraft(res.syllabus)
        setNotice({ kind: res.warnings.length ? 'warn' : 'ok', text: `Imported ${res.syllabus.units.length} units from JSON.${res.warnings.length ? ` ${res.warnings.join(' ')}` : ''}` })
      } else setNotice({ kind: 'err', text: res.errors.join(' ') })
    }
    reader.readAsText(file)
  }

  const addUnit = () => edit((s) => ({ ...s, units: [...s.units, { unitNumber: s.units.length + 1, title: `Unit ${s.units.length + 1}`, chapters: [] }] }))
  const addChapter = (ui: number) => edit((s) => ({ ...s, units: s.units.map((u, i) => (i === ui ? { ...u, chapters: [...u.chapters, { name: 'New chapter', topics: [] }] } : u)) }))
  const addTopic = (ui: number, ci: number) => edit((s) => ({ ...s, units: s.units.map((u, i) => i === ui ? { ...u, chapters: u.chapters.map((c, j) => j === ci ? { ...c, topics: [...c.topics, { name: 'New topic', subTopics: [] }] } : c) } : u) }))
  const addSubtopic = (ui: number, ci: number, ti: number) => edit((s) => ({ ...s, units: s.units.map((u, i) => i === ui ? { ...u, chapters: u.chapters.map((c, j) => j === ci ? { ...c, topics: c.topics.map((t, k) => k === ti ? { ...t, subTopics: [...t.subTopics, 'New subtopic'] } : t) } : c) } : u) }))

  const removeUnit = (ui: number) => edit((s) => ({ ...s, units: s.units.filter((_, i) => i !== ui).map((u, i) => ({ ...u, unitNumber: i + 1 })) }))
  const removeChapter = (ui: number, ci: number) => edit((s) => ({ ...s, units: s.units.map((u, i) => i === ui ? { ...u, chapters: u.chapters.filter((_, j) => j !== ci) } : u) }))
  const removeTopic = (ui: number, ci: number, ti: number) => edit((s) => ({ ...s, units: s.units.map((u, i) => i === ui ? { ...u, chapters: u.chapters.map((c, j) => j === ci ? { ...c, topics: c.topics.filter((_, k) => k !== ti) } : c) } : u) }))
  const removeSubtopic = (ui: number, ci: number, ti: number, si: number) => edit((s) => ({ ...s, units: s.units.map((u, i) => i === ui ? { ...u, chapters: u.chapters.map((c, j) => j === ci ? { ...c, topics: c.topics.map((t, k) => k === ti ? { ...t, subTopics: t.subTopics.filter((_, x) => x !== si) } : t) } : c) } : u) }))

  const provenanceLabel = stored
    ? stored.provenance === 'demo-illustrative'
      ? 'Illustrative demo structure — not official MIT Manipal curriculum'
      : stored.provenance === 'user-upload'
        ? 'Imported by you'
        : 'Created manually'
    : 'No syllabus yet'

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Library · Syllabus"
        title="Syllabus manager"
        description="Structure: subject → unit → chapter → topic → subtopic. The syllabus is the primary source for question classification — if it isn't here, questions can only be classified provisionally."
        actions={
          <>
            <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPdf(f); e.target.value = '' }} />
            <input ref={jsonRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onJsonFile(f); e.target.value = '' }} />
            <button onClick={() => fileRef.current?.click()} className="btn-ghost !py-2.5 !text-[13px]"><FileUp className="h-4 w-4" /> Upload syllabus PDF</button>
            <button onClick={() => { setJsonText(syllabus ? syllabusToJson(syllabus) : ''); setJsonOpen(true) }} className="btn-primary !py-2.5 !text-[13px]"><UploadIcon className="h-4 w-4" /> Import / export JSON</button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-4">
        {/* subject picker */}
        <div className="space-y-4 lg:col-span-1">
          <Card className="p-4">
            <label>
              <span className="label">Subject</span>
              <select
                className="field"
                value={subjectId}
                onChange={(e) => { setSubjectId(e.target.value); setDraft(null); setNotice(null) }}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => {
                  const list = store.subjects.filter((s) => s.semester === sem)
                  if (list.length === 0) return null
                  return (
                    <optgroup key={sem} label={`Semester ${sem}`}>
                      {list.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
                    </optgroup>
                  )
                })}
              </select>
            </label>
            <p className="mt-3 border-t border-ivory-200 pt-3 text-[11px] leading-relaxed text-graphite-500">
              {provenanceLabel}
            </p>
          </Card>

          <Card className="p-4">
            <p className="eyebrow text-graphite-500">Status</p>
            <ul className="mt-2.5 space-y-2 text-xs text-graphite-700">
              <li className="flex justify-between"><span>Units</span><strong className="font-mono">{syllabus?.units.length ?? 0}</strong></li>
              <li className="flex justify-between"><span>Chapters</span><strong className="font-mono">{syllabus?.units.reduce((n, u) => n + u.chapters.length, 0) ?? 0}</strong></li>
              <li className="flex justify-between"><span>Topics</span><strong className="font-mono">{syllabus?.units.reduce((n, u) => n + u.chapters.reduce((m, c) => m + c.topics.length, 0), 0) ?? 0}</strong></li>
              <li className="flex justify-between"><span>Questions mapped</span><strong className="font-mono text-navy">{store.questions.filter((q) => q.subjectId === subjectId).length}</strong></li>
            </ul>
          </Card>

          <button onClick={() => { setDraft(emptySyllabus(subject)); setNotice(null) }} className="btn-ghost w-full !text-[13px]">
            <FolderPlus className="h-4 w-4" /> {stored ? 'Replace with blank structure' : 'Start manual structure'}
          </button>
        </div>

        {/* editor */}
        <div className="lg:col-span-3">
          {notice && (
            <p className={`mb-4 flex items-start gap-2 rounded-xl border p-3.5 text-xs leading-relaxed ${
              notice.kind === 'err' ? 'border-rose-200 bg-rose-50 text-rose-800'
              : notice.kind === 'warn' ? 'border-gold/40 bg-gold-100 text-gold-600'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
              <MessageSquareWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {notice.text}
            </p>
          )}

          {!syllabus ? (
            <EmptyState
              icon={BookOpen}
              title={`No syllabus for ${subject.name}`}
              description="Upload the syllabus PDF, import a JSON structure, or build it manually. Until then, questions for this subject are classified provisionally and flagged for review."
              secondaryAction={<button className="btn-primary" onClick={() => setDraft(emptySyllabus(subject))}>Create blank syllabus</button>}
            />
          ) : (
            <Card className="p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-ivory-200 pb-4">
                <div>
                  <p className="eyebrow text-academic">{syllabus.subjectCode} · Semester {syllabus.semester}</p>
                  <h3 className="text-2xl text-graphite">{syllabus.subject}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={addUnit} className="btn-ghost !py-2 !text-[12px]"><Plus className="h-3.5 w-3.5" /> Unit</button>
                  <button onClick={() => download(`${subject.code || 'syllabus'}-syllabus.json`, syllabusToJson(syllabus), 'application/json')} className="btn-ghost !py-2 !text-[12px]"><Download className="h-3.5 w-3.5" /> Export</button>
                  {dirty && (
                    <>
                      <button onClick={() => setDraft(null)} className="btn-ghost !py-2 !text-[12px]"><RotateCcw className="h-3.5 w-3.5" /> Discard</button>
                      <button onClick={() => setConfirmReclass(true)} className="btn-primary !py-2 !text-[12px]"><Save className="h-3.5 w-3.5" /> Save structure</button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-5">
                {syllabus.units.map((unit, ui) => (
                  <UnitBlock
                    key={ui}
                    unit={unit}
                    counts={questionCounts}
                    dirty={dirty}
                    onRename={(title) => edit((s) => ({ ...s, units: s.units.map((u, i) => (i === ui ? { ...u, title } : u)) }))}
                    onAddChapter={() => addChapter(ui)}
                    onRemoveUnit={() => removeUnit(ui)}
                    onRenameChapter={(ci, name) => edit((s) => ({ ...s, units: s.units.map((u, i) => i === ui ? { ...u, chapters: u.chapters.map((c, j) => (j === ci ? { ...c, name } : c)) } : u) }))}
                    onRemoveChapter={(ci) => removeChapter(ui, ci)}
                    onAddTopic={(ci) => addTopic(ui, ci)}
                    onRenameTopic={(ci, ti, name) => edit((s) => ({ ...s, units: s.units.map((u, i) => i === ui ? { ...u, chapters: u.chapters.map((c, j) => j === ci ? { ...c, topics: c.topics.map((t, k) => (k === ti ? { ...t, name } : t)) } : c) } : u) }))}
                    onRemoveTopic={(ci, ti) => removeTopic(ui, ci, ti)}
                    onAddSubtopic={(ci, ti) => addSubtopic(ui, ci, ti)}
                    onRenameSubtopic={(ci, ti, si, value) => edit((s) => ({ ...s, units: s.units.map((u, i) => i === ui ? { ...u, chapters: u.chapters.map((c, j) => j === ci ? { ...c, topics: c.topics.map((t, k) => k === ti ? { ...t, subTopics: t.subTopics.map((x, y) => (y === si ? value : x)) } : t) } : c) } : u) }))}
                    onRemoveSubtopic={(ci, ti, si) => removeSubtopic(ui, ci, ti, si)}
                  />
                ))}
                {syllabus.units.length === 0 && <p className="py-6 text-center text-sm text-graphite-500">No units yet — add the first unit.</p>}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* JSON modal */}
      <Modal open={jsonOpen} onClose={() => setJsonOpen(false)} title="Syllabus JSON" wide>
        <div className="space-y-4">
          <p className="text-sm text-graphite-600">
            Paste an existing structure to import, or edit and re-import to update. Format:{' '}
            <code className="font-mono text-[11px] text-navy">{`{ units: [{ title, chapters: [{ name, topics: [{ name, subTopics: [] }] }] }] }`}</code>
          </p>
          <textarea
            className="field min-h-[280px] font-mono !text-[12px]"
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            aria-label="Syllabus JSON"
            spellCheck={false}
          />
          <div className="flex flex-wrap justify-between gap-3">
            <button onClick={() => jsonRef.current?.click()} className="btn-ghost !py-2 !text-[13px]"><UploadIcon className="h-4 w-4" /> Import from file instead</button>
            <div className="flex gap-2">
              <button onClick={() => { download(`${subject.code || 'syllabus'}-syllabus.json`, syllabusToJson(syllabus ?? emptySyllabus(subject)), 'application/json'); setJsonOpen(false) }} className="btn-ghost !py-2 !text-[13px]">Download current</button>
              <button
                onClick={() => {
                  const res = importSyllabusJson(jsonText, subject)
                  if (res.syllabus) { setDraft(res.syllabus); setJsonOpen(false); setNotice({ kind: 'ok', text: 'JSON imported into the editor — review and save to apply.' }) }
                  else setNotice({ kind: 'err', text: res.errors.join(' ') })
                }}
                className="btn-primary !py-2 !text-[13px]"
              >
                <CheckCircle2 className="h-4 w-4" /> Import JSON
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* save + reclassify confirmation */}
      <Modal open={confirmReclass} onClose={() => setConfirmReclass(false)} title="Apply syllabus changes">
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-graphite-600">
            Save the edited structure for <strong>{subject.name}</strong>, then re-run keyword
            classification so every question is mapped against the updated syllabus? Questions you
            classified manually are preserved.
          </p>
          <p className="rounded-xl border border-ivory-300 bg-ivory-50 p-3 text-[11px] leading-relaxed text-graphite-500">
            Changing topic names will move questions whose old topic names no longer exist — review
            them afterwards in the question explorer.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => { save(false); setConfirmReclass(false) }} className="btn-ghost !py-2 !text-[13px]">Save only</button>
            <button onClick={() => { save(true); setConfirmReclass(false) }} className="btn-primary !py-2 !text-[13px]">
              <RotateCcw className="h-4 w-4" /> Save & re-classify
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ── Unit block ───────────────────────────────────────────────────────────────

const UnitBlock: React.FC<{
  unit: SyllabusUnit
  counts: Map<string, number>
  dirty: boolean
  onRename: (title: string) => void
  onAddChapter: () => void
  onRemoveUnit: () => void
  onRenameChapter: (ci: number, name: string) => void
  onRemoveChapter: (ci: number) => void
  onAddTopic: (ci: number) => void
  onRenameTopic: (ci: number, ti: number, name: string) => void
  onRemoveTopic: (ci: number, ti: number) => void
  onAddSubtopic: (ci: number, ti: number) => void
  onRenameSubtopic: (ci: number, ti: number, si: number, value: string) => void
  onRemoveSubtopic: (ci: number, ti: number, si: number) => void
}> = ({ unit, counts, dirty, ...on }) => (
  <section className="rounded-xl border border-ivory-300 bg-ivory-50 p-4">
    <div className="flex flex-wrap items-center gap-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy font-mono text-[11px] text-ivory-100">U{unit.unitNumber}</span>
      <input
        className={`field flex-1 !border-transparent !bg-transparent !font-display !text-xl !text-graphite hover:!border-ivory-300 focus:!border-navy focus:!bg-white`}
        value={unit.title}
        onChange={(e) => on.onRename(e.target.value)}
        aria-label={`Unit ${unit.unitNumber} title`}
      />
      <button onClick={on.onAddChapter} className="rounded-lg border border-ivory-300 bg-white px-2 py-1 text-[11px] font-grotesk text-graphite-600 hover:border-graphite-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"><Plus className="inline h-3 w-3" /> chapter</button>
      <button onClick={on.onRemoveUnit} aria-label="Remove unit" className="rounded-lg border border-ivory-300 bg-white p-1.5 text-graphite-500 hover:border-rose-300 hover:text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"><Trash2 className="h-3.5 w-3.5" /></button>
    </div>

    <div className="mt-3 space-y-3 pl-4 sm:pl-11">
      {unit.chapters.map((chapter, ci) => (
        <ChapterBlock
          key={ci}
          chapter={chapter}
          counts={counts}
          onRenameChapter={(name) => on.onRenameChapter(ci, name)}
          onRemoveChapter={() => on.onRemoveChapter(ci)}
          onAddTopic={() => on.onAddTopic(ci)}
          onRenameTopic={(ti, name) => on.onRenameTopic(ci, ti, name)}
          onRemoveTopic={(ti) => on.onRemoveTopic(ci, ti)}
          onAddSubtopic={(ti) => on.onAddSubtopic(ci, ti)}
          onRenameSubtopic={(ti, si, value) => on.onRenameSubtopic(ci, ti, si, value)}
          onRemoveSubtopic={(ti, si) => on.onRemoveSubtopic(ci, ti, si)}
        />
      ))}
      {unit.chapters.length === 0 && <p className="py-2 text-xs text-graphite-400">No chapters — add one to organise topics.</p>}
    </div>
    {dirty && <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-gold-600">unsaved changes</p>}
  </section>
)

const ChapterBlock: React.FC<{
  chapter: SyllabusChapter
  counts: Map<string, number>
  onRenameChapter: (name: string) => void
  onRemoveChapter: () => void
  onAddTopic: () => void
  onRenameTopic: (ti: number, name: string) => void
  onRemoveTopic: (ti: number) => void
  onAddSubtopic: (ti: number) => void
  onRenameSubtopic: (ti: number, si: number, value: string) => void
  onRemoveSubtopic: (ti: number, si: number) => void
}> = ({ chapter, counts, ...on }) => (
  <div className="rounded-lg border border-ivory-200 bg-white p-3">
    <div className="flex items-center gap-2">
      <input
        className="field !border-transparent !bg-transparent !text-sm !font-medium hover:!border-ivory-300 focus:!border-navy"
        value={chapter.name}
        onChange={(e) => on.onRenameChapter(e.target.value)}
        aria-label="Chapter name"
      />
      <button onClick={on.onAddTopic} className="shrink-0 rounded-lg border border-ivory-300 bg-white px-2 py-1 text-[11px] font-grotesk text-graphite-600 hover:border-graphite-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"><Plus className="inline h-3 w-3" /> topic</button>
      <button onClick={on.onRemoveChapter} aria-label="Remove chapter" className="shrink-0 rounded-lg border border-ivory-300 bg-white p-1.5 text-graphite-500 hover:border-rose-300 hover:text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"><Trash2 className="h-3.5 w-3.5" /></button>
    </div>

    <ul className="mt-2 space-y-2">
      {chapter.topics.map((topic, ti) => {
        const count = counts.get(topic.name) ?? 0
        return (
          <li key={ti} className="rounded-lg border border-ivory-200 bg-ivory-50 p-2.5">
            <div className="flex items-center gap-2">
              <input
                className="field !border-transparent !bg-transparent !py-1.5 !text-[13px] hover:!border-ivory-300 focus:!border-navy"
                value={topic.name}
                onChange={(e) => on.onRenameTopic(ti, e.target.value)}
                aria-label="Topic name"
              />
              <Badge tone={count ? 'navy' : 'grey'} title={count ? `${count} questions map to this topic` : 'No questions observed for this topic'}>
                {count} q
              </Badge>
              <button onClick={() => on.onAddSubtopic(ti)} aria-label="Add subtopic" className="shrink-0 rounded-lg border border-ivory-300 bg-white p-1.5 text-graphite-500 hover:border-graphite-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"><Plus className="h-3 w-3" /></button>
              <button onClick={() => on.onRemoveTopic(ti)} aria-label="Remove topic" className="shrink-0 rounded-lg border border-ivory-300 bg-white p-1.5 text-graphite-500 hover:border-rose-300 hover:text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"><Trash2 className="h-3 w-3" /></button>
            </div>
            {topic.subTopics.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5 pl-1">
                {topic.subTopics.map((sub, si) => (
                  <span key={si} className="inline-flex items-center gap-1 rounded-full border border-ivory-300 bg-white py-0.5 pl-2.5 pr-1">
                    <input
                      className="w-[150px] bg-transparent font-mono text-[10px] text-graphite-600 focus:outline-none"
                      value={sub}
                      onChange={(e) => on.onRenameSubtopic(ti, si, e.target.value)}
                      aria-label="Subtopic name"
                    />
                    <button onClick={() => on.onRemoveSubtopic(ti, si)} aria-label="Remove subtopic" className="rounded-full p-0.5 text-graphite-400 hover:text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"><Trash2 className="h-2.5 w-2.5" /></button>
                  </span>
                ))}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  </div>
)
