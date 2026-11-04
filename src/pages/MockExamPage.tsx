import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, FileText, Pause, Play, Plus, RefreshCw, Settings2 } from 'lucide-react'
import { usePaperTrail } from '../store/PaperTrailStore'
import { Difficulty, Question, QuestionType } from '../types'
import { Badge, Card, EmptyState, PageHeader, Prose, SectionTitle, Stat, TableWrap, Td, Th } from '../components/ui'
import { STORAGE_KEYS, readJson, writeJson } from '../storage/localStorage'

/**
 * Mock examination — assemble a paper from the questions already in the
 * dataset (uploaded or demo), sit it with a countdown, then read a
 * self-assessed summary. Nothing is graded: PaperTrail stores question
 * papers, not answers.
 */

type Phase = 'builder' | 'exam' | 'summary'

const TARGET_OPTIONS = [40, 60, 100]
const TYPE_ORDER: QuestionType[] = [
  'Short Answer', 'Theory', 'Numerical', 'Programming', 'Application', 'Derivation', 'Proof', 'Long Answer',
]
const SECTION_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export const MockExamPage: React.FC = () => {
  const store = usePaperTrail()

  // ── Builder state ────────────────────────────────────────────────────────
  const [subjectId, setSubjectId] = useState('All')
  const [units, setUnits] = useState<string[]>([])
  const [targetMarks, setTargetMarks] = useState(40)
  const [types, setTypes] = useState<QuestionType[]>([])
  const [difficulty, setDifficulty] = useState<'All' | Difficulty>('All')
  const [excludeUsed, setExcludeUsed] = useState(false)
  const [durationMinutes, setDurationMinutes] = useState('60')

  // ── Exam state ───────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('builder')
  const [paper, setPaper] = useState<Question[]>([])
  const [attempted, setAttempted] = useState<string[]>([])
  const [remaining, setRemaining] = useState(0)
  const [running, setRunning] = useState(false)
  const [timeUp, setTimeUp] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const questionPool = store.questions
  const usedHistory = useMemo<string[]>(() => readJson<string[]>(STORAGE_KEYS.practiceHistory, []), [])

  const unitOptions = useMemo(() => {
    const pool = subjectId === 'All' ? questionPool : questionPool.filter((q) => q.subjectId === subjectId)
    return Array.from(new Set(pool.map((q) => q.unit))).sort()
  }, [questionPool, subjectId])

  const typeOptions = useMemo(() => {
    const pool = subjectId === 'All' ? questionPool : questionPool.filter((q) => q.subjectId === subjectId)
    const present = new Set(pool.map((q) => q.questionType))
    return TYPE_ORDER.filter((t) => present.has(t))
  }, [questionPool, subjectId])

  const candidates = useMemo(() => {
    const excluded = excludeUsed ? new Set(usedHistory) : null
    return questionPool.filter((q) => {
      if (subjectId !== 'All' && q.subjectId !== subjectId) return false
      if (units.length > 0 && !units.includes(q.unit)) return false
      if (types.length > 0 && !types.includes(q.questionType)) return false
      if (difficulty !== 'All' && q.difficulty !== difficulty) return false
      if (excluded && excluded.has(q.id)) return false
      return true
    })
  }, [questionPool, subjectId, units, types, difficulty, excludeUsed, usedHistory])

  const selectedTotal = paper.reduce((s, q) => s + (q.marks ?? 0), 0)
  const attemptedMarks = paper.filter((q) => attempted.includes(q.id)).reduce((s, q) => s + (q.marks ?? 0), 0)
  const durationSec = Math.max(5, Math.min(300, Number(durationMinutes) || 60)) * 60

  // ── Greedy paper builder ─────────────────────────────────────────────────
  const generate = () => {
    // Small targets start from the light questions; larger targets anchor on
    // the heavy ones. Either way the total approaches — never exceeds — target.
    const preferLight = targetMarks <= 40
    const ordered = [...candidates].sort((a, b) => (preferLight ? (a.marks ?? 0) - (b.marks ?? 0) : (b.marks ?? 0) - (a.marks ?? 0)))
    const lightCap = targetMarks > 20 ? Math.ceil(targetMarks * 0.4) : targetMarks
    let light = 0
    let total = 0
    const picked: Question[] = []
    for (const q of ordered) {
      const qm = q.marks ?? 0
      if (total >= targetMarks) break
      if (total + qm > targetMarks) continue
      if (qm <= 3 && light + qm > lightCap) continue
      picked.push(q)
      total += qm
      if (qm <= 3) light += qm
    }
    if (picked.length === 0) return
    setPaper(picked)
    setAttempted([])
    setTimeUp(false)
    setElapsed(0)
    setRemaining(durationSec)
    setRunning(true)
    setPhase('exam')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const sections = useMemo(() => {
    const map = new Map<QuestionType, Question[]>()
    for (const q of paper) {
      const list = map.get(q.questionType) ?? []
      list.push(q)
      map.set(q.questionType, list)
    }
    return TYPE_ORDER.filter((t) => map.has(t)).map((type) => ({ type, questions: map.get(type)! }))
  }, [paper])

  // ── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'exam' || !running) return
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => window.clearInterval(id)
  }, [phase, running])

  useEffect(() => {
    if (phase !== 'exam' || !running) return
    const id = window.setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000)
    return () => window.clearInterval(id)
  }, [phase, running])

  useEffect(() => {
    if (phase === 'exam' && remaining === 0 && running) {
      setRunning(false)
      setTimeUp(true)
    }
  }, [remaining, phase, running])

  const toggleAttempted = (id: string) => {
    setAttempted((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))
  }

  const submit = () => {
    setRunning(false)
    // Remember what was used so "exclude previously used" works next time.
    const merged = Array.from(new Set([...usedHistory, ...paper.map((q) => q.id)]))
    writeJson(STORAGE_KEYS.practiceHistory, merged)
    setPhase('summary')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const backToBuilder = (reset: boolean) => {
    setRunning(false)
    setPhase('builder')
    if (reset) {
      setPaper([])
      setSubjectId('All')
      setUnits([])
      setTypes([])
      setDifficulty('All')
      setTargetMarks(40)
      setExcludeUsed(false)
      setDurationMinutes('60')
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleUnit = (u: string) => setUnits((prev) => (prev.includes(u) ? prev.filter((x) => x !== u) : [...prev, u]))
  const toggleType = (t: QuestionType) => setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))

  const summaryByType = useMemo(() => {
    return sections.map((s) => {
      const marks = s.questions.reduce((n, q) => n + (q.marks ?? 0), 0)
      const att = s.questions.filter((q) => attempted.includes(q.id)).reduce((n, q) => n + (q.marks ?? 0), 0)
      return { type: s.type, questions: s.questions.length, marks, attemptedMarks: att }
    })
  }, [sections, attempted])

  // ── Empty dataset ────────────────────────────────────────────────────────
  if (questionPool.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
        <PageHeader eyebrow="Study" title="Mock examination" description="Assemble a mock paper from the questions already in your archive, sit it under a timer, then check yourself." />
        <EmptyState
          icon={ClipboardList}
          title="No questions to build from"
          description="The mock builder draws from papers you have uploaded (or the bundled illustrative demo dataset). Upload question papers in the Upload view, or turn the demo dataset back on in Settings."
          action={{ label: 'Upload papers', to: '/upload' }}
          secondaryAction={<Link to="/settings" className="btn-ghost">Settings</Link>}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Study"
        title="Mock examination"
        description="Pick a subject, a target and a duration — PaperTrail assembles a paper from the questions in your archive. Self-graded: it never evaluates your answers."
        actions={
          <>
            <Link to="/practice" className="btn-ghost !py-2.5 !text-[13px]">Practice mode</Link>
            <Link to="/report" className="btn-primary !py-2.5 !text-[13px]">Consolidated report</Link>
          </>
        }
      />

      {/* ── BUILDER ───────────────────────────────────────────────────────── */}
      {phase === 'builder' && (
        <Card className="p-5 md:p-6">
          <SectionTitle
            kicker="Builder"
            title="Compose your paper"
            description="Selection is greedy: it approaches your target marks without ever going over."
          />

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="label">Subject</span>
              <select
                className="field"
                value={subjectId}
                onChange={(e) => { setSubjectId(e.target.value); setUnits([]); setTypes([]) }}
              >
                <option value="All">All subjects</option>
                {store.subjects.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
              </select>
            </label>

            <div>
              <span className="label">Target total marks</span>
              <div className="flex gap-2" role="group" aria-label="Target total marks">
                {TARGET_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTargetMarks(t)}
                    aria-pressed={targetMarks === t}
                    className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-grotesk font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 ${
                      targetMarks === t ? 'border-navy bg-navy text-ivory-100' : 'border-ivory-300 bg-white text-graphite-600 hover:border-graphite-400'
                    }`}
                  >
                    {t} marks
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <span className="label">Units (none selected = all units)</span>
              <div className="flex flex-wrap gap-1.5">
                {unitOptions.length === 0 && <span className="text-xs text-graphite-500">No units available for this subject.</span>}
                {unitOptions.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => toggleUnit(u)}
                    aria-pressed={units.includes(u)}
                    title={u}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-grotesk font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 ${
                      units.includes(u) ? 'border-navy bg-navy text-ivory-100' : 'border-ivory-300 bg-white text-graphite-600 hover:border-graphite-400'
                    }`}
                  >
                    {u.split(':')[0]}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <span className="label">Question types (none selected = all types)</span>
              <div className="flex flex-wrap gap-1.5">
                {typeOptions.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleType(t)}
                    aria-pressed={types.includes(t)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-grotesk font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 ${
                      types.includes(t) ? 'border-navy bg-navy text-ivory-100' : 'border-ivory-300 bg-white text-graphite-600 hover:border-graphite-400'
                    }`}
                  >
                    {t}
                  </button>
                ))}
                {typeOptions.length === 0 && <span className="text-xs text-graphite-500">No types available.</span>}
              </div>
            </div>

            <label className="block">
              <span className="label">Difficulty</span>
              <select className="field" value={difficulty} onChange={(e) => setDifficulty(e.target.value as 'All' | Difficulty)}>
                <option value="All">Any difficulty</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </label>

            <label className="block">
              <span className="label">Exam duration (minutes)</span>
              <input
                type="number"
                min={5}
                max={300}
                className="field"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              />
            </label>

            <label className="flex items-start gap-2.5 md:col-span-2">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-ivory-400 text-navy focus:ring-navy/30"
                checked={excludeUsed}
                onChange={(e) => setExcludeUsed(e.target.checked)}
              />
              <span className="text-sm text-graphite-600">
                Exclude questions already used in previous mocks
                <span className="ml-2 font-mono text-[10px] uppercase tracking-wide text-graphite-400">
                  {usedHistory.length} remembered · stored in this browser
                </span>
              </span>
            </label>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <p className="font-mono text-[11px] text-graphite-500">
                {candidates.length} candidate question{candidates.length === 1 ? '' : 's'} · target {targetMarks} marks
              </p>
              <Badge tone={candidates.length ? 'blue' : 'red'}>{candidates.length ? 'ready' : 'no candidates'}</Badge>
            </div>
            <button className="btn-primary" onClick={generate} disabled={candidates.length === 0}>
              <ClipboardList className="h-4 w-4" /> Generate paper
            </button>
          </div>

          {candidates.length === 0 && (
            <p className="mt-3 rounded-xl border border-gold/40 bg-gold-100 px-4 py-3 text-xs text-graphite-600">
              No questions match this selection. Try a different subject, clear unit/type filters, or switch off
              "exclude previously used".
            </p>
          )}
        </Card>
      )}

      {/* ── EXAM ──────────────────────────────────────────────────────────── */}
      {phase === 'exam' && (
        <div className="space-y-4">
          <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ivory-300 bg-white px-4 py-3 shadow-lift">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">Running total</span>
              <Badge tone="navy">{selectedTotal} / {targetMarks} marks</Badge>
              <Badge tone={attemptedMarks ? 'green' : 'grey'}>{attemptedMarks} attempted</Badge>
              <span
                aria-live="polite"
                className={`rounded-lg border px-3 py-1.5 font-mono text-sm ${
                  remaining <= 300 ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-ivory-300 bg-ivory-50 text-graphite-700'
                }`}
              >
                {timeUp ? "Time's up" : fmt(remaining)}
                {remaining <= 300 && !timeUp && <span className="ml-2 text-[10px] uppercase tracking-wide">5-minute warning</span>}
              </span>
              <button
                onClick={() => setRunning((r) => !r)}
                disabled={timeUp}
                aria-label={running ? 'Pause timer' : 'Resume timer'}
                className="rounded-lg border border-ivory-300 bg-white p-2 text-graphite-600 hover:border-graphite-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 disabled:opacity-50"
              >
                {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <span className="font-mono text-[11px] text-graphite-400" aria-live="polite">elapsed {fmt(elapsed)}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost !px-4 !py-2 !text-[13px]" onClick={() => backToBuilder(false)}>
                <Settings2 className="h-4 w-4" /> Edit selection
              </button>
              <button className="btn-primary !px-4 !py-2 !text-[13px]" onClick={submit}>
                Submit paper
              </button>
            </div>
          </div>

          {/* Printable paper */}
          <Card className="p-6 md:p-10">
            <header className="border-b border-ivory-300 pb-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-academic">PaperTrail · Mock examination</p>
              <h2 className="mt-2 text-2xl text-graphite md:text-3xl">
                {subjectId === 'All'
                  ? 'Mixed-subject mock paper'
                  : `${store.subjectById(subjectId)?.name ?? 'Mock paper'}`}
              </h2>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] uppercase tracking-wide text-graphite-500">
                <span>Target marks: {targetMarks}</span>
                <span>Selected: {selectedTotal}</span>
                <span>Duration: {durationMinutes} minutes</span>
                <span>Questions: {paper.length}</span>
                <span>Date: {new Date().toLocaleDateString()}</span>
              </div>
            </header>

            <div className="mt-6 space-y-8">
              {sections.map((section, si) => (
                <section key={section.type}>
                  <div className="mb-3 flex items-baseline gap-3">
                    <h3 className="text-lg text-graphite">
                      Section {SECTION_LETTERS[si]} — {section.type}
                    </h3>
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-400">
                       {section.questions.reduce((n, q) => n + (q.marks ?? 0), 0)} marks
                    </span>
                  </div>
                  <ol className="space-y-4">
                    {section.questions.map((q) => {
                      const n = paper.indexOf(q) + 1
                      return (
                        <li key={q.id} className="grid grid-cols-[2.25rem_minmax(0,1fr)_3rem] items-start gap-3">
                          <span className="pt-0.5 font-mono text-sm text-navy">{n}.</span>
                          <div className="min-w-0">
                            <p className="text-sm leading-relaxed text-graphite">{q.text}</p>
                            <div className="no-print mt-1.5 flex flex-wrap items-center gap-3">
                              <label className="inline-flex cursor-pointer items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-graphite-500">
                                <input
                                  type="checkbox"
                                  className="h-3.5 w-3.5 rounded border-ivory-400 text-navy focus:ring-navy/30"
                                  checked={attempted.includes(q.id)}
                                  onChange={() => toggleAttempted(q.id)}
                                  aria-label={`Mark question ${n} as attempted`}
                                />
                                attempted
                              </label>
                              <span className="font-mono text-[10px] uppercase tracking-wide text-graphite-400">
                                {q.topic} · {q.difficulty}
                              </span>
                            </div>
                          </div>
                          <span className="pt-0.5 text-right font-mono text-sm text-graphite-600">[{q.marks}]</span>
                        </li>
                      )
                    })}
                  </ol>
                </section>
              ))}
            </div>

            <footer className="mt-8 border-t border-ivory-300 pt-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-400">
                Total selected marks: {selectedTotal} · Self-graded — PaperTrail does not evaluate answers.
              </p>
            </footer>
          </Card>
        </div>
      )}

      {/* ── SUMMARY ───────────────────────────────────────────────────────── */}
      {phase === 'summary' && (
        <div className="space-y-4">
          <Card className="p-5 md:p-6">
            <SectionTitle
              kicker="Submission"
              title="Paper submitted"
              description="Self-graded — PaperTrail does not evaluate answers. Use this breakdown to plan your own review."
            />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Marks attempted" value={`${attemptedMarks} / ${selectedTotal}`} accent="academic" />
              <Stat label="Questions" value={paper.length} />
              <Stat label="Time used" value={fmt(elapsed)} accent="gold" sub={`of ${durationMinutes} minutes`} />
              <Stat label="Target was" value={targetMarks} accent="lavender" sub={selectedTotal === targetMarks ? 'exactly met' : `${selectedTotal - targetMarks > 0 ? '+' : ''}${selectedTotal - targetMarks} vs target`} />
            </div>

            <div className="mt-5">
              <p className="eyebrow text-graphite-500">Breakdown by type</p>
              <TableWrap className="mt-3">
                <thead>
                  <tr>
                    <Th>Type</Th>
                    <Th className="text-right">Questions</Th>
                    <Th className="text-right">Marks in paper</Th>
                    <Th className="text-right">Attempted marks</Th>
                  </tr>
                </thead>
                <tbody>
                  {summaryByType.map((s) => (
                    <tr key={s.type}>
                      <Td className="font-medium text-graphite">{s.type}</Td>
                      <Td className="text-right font-mono">{s.questions}</Td>
                      <Td className="text-right font-mono">{s.marks}</Td>
                      <Td className="text-right font-mono text-navy">{s.attemptedMarks}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button className="btn-primary" onClick={() => backToBuilder(false)}>
                <RefreshCw className="h-4 w-4" /> New paper
              </button>
              <button className="btn-ghost" onClick={() => backToBuilder(false)}>
                <Settings2 className="h-4 w-4" /> Edit selection
              </button>
              <button className="btn-ghost" onClick={() => backToBuilder(true)}>Reset builder</button>
            </div>
          </Card>

          <Card className="p-5 md:p-6">
            <p className="eyebrow text-graphite-500">Question list · topic, difficulty & source</p>
            <ul className="mt-3 space-y-2">
              {paper.map((q, i) => (
                <li key={q.id} className="rounded-xl border border-ivory-200 bg-ivory-50 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-mono text-sm text-navy">{i + 1}.</span>{' '}
                      <span className="text-sm text-graphite-700">{q.text}</span>
                    </div>
                    <Badge tone={attempted.includes(q.id) ? 'green' : 'grey'}>
                      {attempted.includes(q.id) ? 'attempted' : 'not marked'}
                    </Badge>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-wide text-graphite-500">
                    <span>{q.topic}</span>
                    <span>{q.difficulty}</span>
                    <span>{q.marks} marks</span>
                    <span>{q.year} · {q.examType} · p.{q.sourcePage}</span>
                    <span className="text-graphite-400">{q.subjectCode}</span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <div className="rounded-xl border border-ivory-300 bg-ivory-50 px-4 py-3">
            <Prose>
              PaperTrail does not store answers or model solutions — mark your own script against the source papers.
              The questions used in this mock were remembered locally so future papers can avoid repeats.
            </Prose>
          </div>
        </div>
      )}

      {/* Empty builder note */}
      {phase === 'builder' && questionPool.length > 0 && candidates.length === 0 && (
        <p className="mt-4 flex items-center gap-2 text-xs text-graphite-500">
          <FileText className="h-3.5 w-3.5" /> The builder only uses questions already extracted from your uploaded or demo papers.
        </p>
      )}

      {phase === 'builder' && (
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="btn-ghost !py-2.5 !text-[13px]" onClick={() => setPaper([])} disabled={paper.length === 0}>
            <Plus className="h-4 w-4" /> Clear current selection
          </button>
          {paper.length > 0 && (
            <button
              className="btn-primary !py-2.5 !text-[13px]"
              onClick={() => { setPhase('exam'); setRunning(!timeUp); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            >
              Resume exam ({selectedTotal} marks selected)
            </button>
          )}
        </div>
      )}
    </div>
  )
}
