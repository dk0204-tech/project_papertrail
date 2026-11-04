import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Bookmark, BookmarkCheck, CheckCircle2, EyeOff, Pause, Play,
  RotateCcw, SkipForward, Timer, Trash2, XCircle,
} from 'lucide-react'
import { useAnalytics } from '../hooks/useAnalytics'
import { Question } from '../types'
import { Badge, Card, EmptyState, PageHeader, Prose, SectionTitle, Stat } from '../components/ui'
import { STORAGE_KEYS, readJson, writeJson } from '../storage/localStorage'

/**
 * Practice mode — work through real questions one at a time, self-assess, and
 * keep a local revision queue. PaperTrail stores question papers, not answers:
 * nothing here is graded by the app.
 */

type Result = 'Confident' | 'Needs revision' | "Didn't know"
type Phase = 'setup' | 'session' | 'summary'

const RESULT_TONE: Record<Result, 'green' | 'gold' | 'red'> = {
  Confident: 'green',
  'Needs revision': 'gold',
  "Didn't know": 'red',
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

const Select: React.FC<{
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}> = ({ label, value, onChange, options }) => (
  <label className="block">
    <span className="label">{label}</span>
    <select className="field !py-2.5 text-xs" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </label>
)

export const PracticePage: React.FC = () => {
  const { questions: scopedQuestions, store } = useAnalytics()
  const storeQuestions = store.questions

  // ── Setup ────────────────────────────────────────────────────────────────
  const [subject, setSubject] = useState('All')
  const [unit, setUnit] = useState('All')
  const [topic, setTopic] = useState('All')
  const [difficulty, setDifficulty] = useState('All')
  const [qType, setQType] = useState('All')
  const [year, setYear] = useState('All')
  const [marksMin, setMarksMin] = useState('')
  const [marksMax, setMarksMax] = useState('')
  const [count, setCount] = useState('10')
  const [timerMinutes, setTimerMinutes] = useState('0')

  // ── Session ──────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('setup')
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [results, setResults] = useState<Record<string, Result>>({})
  const [remaining, setRemaining] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [timeUp, setTimeUp] = useState(false)

  // ── Local persisted lists (ids only, hydrated from the store) ────────────
  const [revisionIds, setRevisionIds] = useState<string[]>(() => readJson<string[]>(STORAGE_KEYS.revisionQueue, []))
  const [bookmarkIds, setBookmarkIds] = useState<string[]>(() => readJson<string[]>(STORAGE_KEYS.bookmarks, []))

  useEffect(() => { writeJson(STORAGE_KEYS.revisionQueue, revisionIds) }, [revisionIds])
  useEffect(() => { writeJson(STORAGE_KEYS.bookmarks, bookmarkIds) }, [bookmarkIds])

  // ── Filter options (scoped by the global filters) ────────────────────────
  const options = useMemo(() => {
    const uniq = (key: 'unit' | 'topic') => Array.from(new Set(scopedQuestions.map((q) => q[key]))).sort()
    return {
      subjects: Array.from(new Map(scopedQuestions.map((q) => [q.subjectId, q.subject])).entries()).sort((a, b) => a[1].localeCompare(b[1])),
      units: uniq('unit'),
      topics: uniq('topic'),
      difficulties: ['Easy', 'Medium', 'Hard'],
      types: Array.from(new Set(scopedQuestions.map((q) => q.questionType))).sort(),
      years: Array.from(new Set(scopedQuestions.map((q) => q.year))).sort((a, b) => b - a),
    }
  }, [scopedQuestions])

  const filtered = useMemo(() => {
    const min = marksMin === '' ? null : Number(marksMin)
    const max = marksMax === '' ? null : Number(marksMax)
    return scopedQuestions.filter((q) => {
      if (subject !== 'All' && q.subjectId !== subject) return false
      if (unit !== 'All' && q.unit !== unit) return false
      if (topic !== 'All' && q.topic !== topic) return false
      if (difficulty !== 'All' && q.difficulty !== difficulty) return false
      if (qType !== 'All' && q.questionType !== qType) return false
      if (year !== 'All' && q.year !== Number(year)) return false
      if (min !== null && (q.marks ?? 0) < min) return false
      if (max !== null && (q.marks ?? 0) > max) return false
      return true
    })
  }, [scopedQuestions, subject, unit, topic, difficulty, qType, year, marksMin, marksMax])

  // ── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'session' || !running) return
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => window.clearInterval(id)
  }, [phase, running])

  useEffect(() => {
    if (phase !== 'session' || !running || timerMinutes === '0') return
    const id = window.setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000)
    return () => window.clearInterval(id)
  }, [phase, running, timerMinutes])

  useEffect(() => {
    if (phase === 'session' && remaining === 0 && timerMinutes !== '0') {
      setRunning(false)
      setTimeUp(true)
    }
  }, [remaining, phase, timerMinutes])

  const current = sessionQuestions[index]
  const totalSeconds = Number(timerMinutes) * 60

  const startSession = () => {
    const picked = shuffle(filtered).slice(0, Math.max(1, Math.min(100, Number(count) || 10)))
    if (picked.length === 0) return
    setSessionQuestions(picked)
    setIndex(0)
    setAnswers({})
    setResults({})
    setElapsed(0)
    setTimeUp(false)
    setRemaining(Number(timerMinutes) * 60)
    setRunning(true)
    setPhase('session')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const finish = () => {
    setRunning(false)
    setPhase('summary')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const advance = () => {
    if (index + 1 >= sessionQuestions.length) finish()
    else setIndex((i) => i + 1)
  }

  const assess = (result: Result) => {
    if (!current) return
    setResults((r) => ({ ...r, [current.id]: result }))
    if (result === 'Needs revision') {
      setRevisionIds((ids) => (ids.includes(current.id) ? ids : [...ids, current.id]))
    }
    advance()
  }

  const toggleBookmark = (id: string) => {
    setBookmarkIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }

  const removeRevision = (id: string) => setRevisionIds((ids) => ids.filter((x) => x !== id))
  const removeBookmark = (id: string) => setBookmarkIds((ids) => ids.filter((x) => x !== id))

  const hydrate = (ids: string[]) =>
    ids.map((id) => storeQuestions.find((q) => q.id === id)).filter((q): q is Question => !!q)

  const revisionList = hydrate(revisionIds)
  const bookmarkList = hydrate(bookmarkIds)

  // ── Summary aggregates ───────────────────────────────────────────────────
  const summary = useMemo(() => {
    const counts: Record<Result, number> = { Confident: 0, 'Needs revision': 0, "Didn't know": 0 }
    for (const r of Object.values(results)) counts[r]++
    const topicsTouched = new Set(sessionQuestions.map((q) => q.topic))
    const needsRevision = sessionQuestions.filter((q) => results[q.id] === 'Needs revision')
    return { counts, topicsTouched: topicsTouched.size, needsRevision, answered: Object.keys(results).length }
  }, [results, sessionQuestions])

  // ── Revision queue side panel ────────────────────────────────────────────
  const QueuePanel = (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="eyebrow text-graphite-500">Revision queue</p>
          <Badge tone={revisionList.length ? 'gold' : 'grey'}>{revisionList.length}</Badge>
        </div>
        <p className="mt-2 text-xs text-graphite-500">
          Questions you marked "Needs revision" during practice. Stored in this browser only.
        </p>
        {revisionList.length === 0 ? (
          <p className="mt-3 rounded-xl border border-ivory-200 bg-ivory-50 px-3.5 py-3 text-xs text-graphite-500">
            Empty — self-assess a question as "Needs revision" and it lands here.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {revisionList.map((q) => (
              <li key={q.id} className="rounded-xl border border-ivory-200 bg-ivory-50 px-3.5 py-3">
                <p className="line-clamp-2 text-xs leading-relaxed text-graphite-700">{q.text}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-graphite-500">
                  <span className="text-navy">{q.year}</span>
                  <span>· {q.examType}</span>
                  <span>· {q.marks} marks</span>
                  <span className="truncate text-graphite-400">{q.topic}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Link to="/questions" className="inline-flex items-center gap-1 text-[11px] font-grotesk font-medium text-navy hover:underline">
                    Open in explorer <ArrowRight className="h-3 w-3" />
                  </Link>
                  <button
                    onClick={() => removeRevision(q.id)}
                    aria-label="Remove from revision queue"
                    className="ml-auto inline-flex items-center gap-1 rounded-full border border-ivory-300 bg-white px-2 py-1 text-[10px] font-grotesk text-graphite-500 hover:border-rose-300 hover:text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="eyebrow text-graphite-500">Bookmarks</p>
          <Badge tone="blue">{bookmarkList.length}</Badge>
        </div>
        {bookmarkList.length === 0 ? (
          <p className="mt-3 rounded-xl border border-ivory-200 bg-ivory-50 px-3.5 py-3 text-xs text-graphite-500">
            No bookmarks yet — use the bookmark button while practising.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {bookmarkList.map((q) => (
              <li key={q.id} className="rounded-xl border border-ivory-200 bg-ivory-50 px-3.5 py-3">
                <p className="line-clamp-2 text-xs leading-relaxed text-graphite-700">{q.text}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-graphite-500">
                  <span className="text-navy">{q.year}</span> · {q.marks} marks · <span className="truncate">{q.topic}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Link to="/questions" className="inline-flex items-center gap-1 text-[11px] font-grotesk font-medium text-navy hover:underline">
                    Open in explorer <ArrowRight className="h-3 w-3" />
                  </Link>
                  <button
                    onClick={() => removeBookmark(q.id)}
                    aria-label="Remove bookmark"
                    className="ml-auto inline-flex items-center gap-1 rounded-full border border-ivory-300 bg-white px-2 py-1 text-[10px] font-grotesk text-graphite-500 hover:border-rose-300 hover:text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Study"
        title="Practice mode"
        description="Work through real questions from the papers in scope, one at a time, and grade yourself honestly. PaperTrail stores question papers, not model answers."
        actions={
          <>
            <Link to="/mock-exam" className="btn-ghost !py-2.5 !text-[13px]">Mock exam</Link>
            <Link to="/planner" className="btn-primary !py-2.5 !text-[13px]">Study planner</Link>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          {/* ── SETUP ─────────────────────────────────────────────────────── */}
          {phase === 'setup' && (
            <Card className="p-5 md:p-6">
              <SectionTitle
                kicker="Setup"
                title="Configure a practice session"
                description="Filters below apply only to this session — the global filter bar still applies on top."
              />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Select
                  label="Subject"
                  value={subject}
                  onChange={setSubject}
                  options={[{ value: 'All', label: 'All subjects' }, ...options.subjects.map(([id, name]) => ({ value: id, label: name }))]}
                />
                <Select label="Unit" value={unit} onChange={setUnit} options={[{ value: 'All', label: 'All units' }, ...options.units.map((u) => ({ value: u, label: u }))]} />
                <Select label="Topic" value={topic} onChange={setTopic} options={[{ value: 'All', label: 'All topics' }, ...options.topics.map((t) => ({ value: t, label: t }))]} />
                <Select label="Difficulty" value={difficulty} onChange={setDifficulty} options={[{ value: 'All', label: 'Any difficulty' }, ...options.difficulties.map((d) => ({ value: d, label: d }))]} />
                <Select label="Question type" value={qType} onChange={setQType} options={[{ value: 'All', label: 'Any type' }, ...options.types.map((t) => ({ value: t, label: t }))]} />
                <Select label="Year" value={year} onChange={setYear} options={[{ value: 'All', label: 'Any year' }, ...options.years.map((y) => ({ value: String(y), label: String(y) }))]} />
                <label className="block">
                  <span className="label">Marks ≥</span>
                  <input type="number" min={0} className="field !py-2.5 text-xs" value={marksMin} onChange={(e) => setMarksMin(e.target.value)} placeholder="0" />
                </label>
                <label className="block">
                  <span className="label">Marks ≤</span>
                  <input type="number" min={0} className="field !py-2.5 text-xs" value={marksMax} onChange={(e) => setMarksMax(e.target.value)} placeholder="20" />
                </label>
                <Select
                  label="Questions"
                  value={count}
                  onChange={setCount}
                  options={['5', '10', '15', '20', '30'].map((n) => ({ value: n, label: `${n} questions` }))}
                />
                <Select
                  label="Timer (0 = untimed)"
                  value={timerMinutes}
                  onChange={setTimerMinutes}
                  options={['0', '10', '20', '30', '45', '60'].map((m) => ({ value: m, label: m === '0' ? 'Untimed' : `${m} minutes` }))}
                />
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p className="font-mono text-[11px] text-graphite-500">
                  {filtered.length} question{filtered.length === 1 ? '' : 's'} match your filters
                </p>
                <button className="btn-primary" onClick={startSession} disabled={filtered.length === 0}>
                  <Timer className="h-4 w-4" /> Start session
                </button>
              </div>
              {filtered.length === 0 && (
                <p className="mt-3 rounded-xl border border-gold/40 bg-gold-100 px-4 py-3 text-xs text-graphite-600">
                  No questions match these filters. Widen the marks range or clear a filter — or upload more papers.
                </p>
              )}
            </Card>
          )}

          {/* ── SESSION ───────────────────────────────────────────────────── */}
          {phase === 'session' && current && (
            <Card className="p-5 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite-500">
                    Question {index + 1} / {sessionQuestions.length}
                  </span>
                  <Badge tone="navy">{current.marks} marks</Badge>
                  <Badge tone="grey">{current.difficulty}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  {timerMinutes !== '0' && (
                    <span
                      aria-live="polite"
                      className={`rounded-lg border px-3 py-1.5 font-mono text-sm ${
                        remaining <= 300 ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-ivory-300 bg-ivory-50 text-graphite-700'
                      }`}
                    >
                      {timeUp ? "Time's up" : fmt(remaining)}
                    </span>
                  )}
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
              </div>

              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-ivory-200" role="progressbar" aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={sessionQuestions.length} aria-label="Session progress">
                <div className="h-full rounded-full bg-navy transition-all duration-500" style={{ width: `${((index + 1) / sessionQuestions.length) * 100}%` }} />
              </div>

              <div className="mt-5 rounded-xl border border-ivory-200 bg-ivory-50 p-5">
                <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-graphite-500">
                  <span className="text-navy">{current.questionNumber}{current.subQuestion ? `(${current.subQuestion})` : ''}</span>
                  <span>· {current.year} {current.examType}</span>
                  <span>· page {current.sourcePage}</span>
                  <span>· {current.subjectCode}</span>
                  <span>· {current.topic}</span>
                </div>
                <p className="mt-3 text-base leading-relaxed text-graphite">{current.text}</p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  className="btn-ghost !cursor-not-allowed !px-4 !py-2 !text-[13px] opacity-60"
                  disabled
                  aria-disabled="true"
                  title="PaperTrail does not store model answers."
                >
                  <EyeOff className="h-4 w-4" /> Reveal sample answer
                </button>
                <p className="max-w-prose2 text-xs leading-relaxed text-graphite-500">
                  PaperTrail stores question papers, not model answers. Write your answer on paper, then self-assess.
                </p>
              </div>

              <label className="mt-4 block">
                <span className="label">Your answer notes (kept only in this page — not saved)</span>
                <textarea
                  className="field min-h-[140px] text-sm"
                  value={answers[current.id] ?? ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [current.id]: e.target.value }))}
                  placeholder="Draft your answer here, or on paper…"
                />
              </label>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => toggleBookmark(current.id)}
                  aria-pressed={bookmarkIds.includes(current.id)}
                  className="btn-ghost !px-4 !py-2.5 !text-[13px]"
                >
                  {bookmarkIds.includes(current.id) ? <BookmarkCheck className="h-4 w-4 text-navy" /> : <Bookmark className="h-4 w-4" />}
                  {bookmarkIds.includes(current.id) ? 'Bookmarked' : 'Bookmark'}
                </button>
                <div className="ml-auto flex flex-wrap gap-2">
                  <button onClick={() => advance()} className="btn-ghost !px-4 !py-2.5 !text-[13px]">
                    <SkipForward className="h-4 w-4" /> Skip
                  </button>
                  <button onClick={() => assess('Confident')} className="btn-primary !bg-emerald-700 !px-4 !py-2.5 !text-[13px]">
                    <CheckCircle2 className="h-4 w-4" /> Confident
                  </button>
                  <button onClick={() => assess('Needs revision')} className="btn-primary !bg-gold-600 !px-4 !py-2.5 !text-[13px]">
                    <RotateCcw className="h-4 w-4" /> Needs revision
                  </button>
                  <button onClick={() => assess("Didn't know")} className="btn-primary !bg-rose-700 !px-4 !py-2.5 !text-[13px]">
                    <XCircle className="h-4 w-4" /> Didn't know
                  </button>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <button onClick={finish} className="text-xs font-grotesk font-medium text-graphite-500 underline underline-offset-2 hover:text-graphite focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40">
                  End session & see summary
                </button>
                {timeUp && <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-rose-700">Timer finished — keep going or end the session</span>}
              </div>
            </Card>
          )}

          {/* ── SUMMARY ───────────────────────────────────────────────────── */}
          {phase === 'summary' && (
            <div className="space-y-4">
              <Card className="p-5 md:p-6">
                <SectionTitle
                  kicker="Session summary"
                  title="How did that go?"
                  description="Self-graded — PaperTrail does not evaluate answers. Only your own judgement is recorded here."
                />
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Stat label="Questions seen" value={sessionQuestions.length} />
                  <Stat label="Self-assessed" value={summary.answered} accent="academic" />
                  <Stat label="Topics touched" value={summary.topicsTouched} accent="lavender" />
                  <Stat label="Time used" value={fmt(elapsed)} accent="gold" />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-700">Confident</p>
                    <p className="mt-1 font-display text-3xl text-emerald-700">{summary.counts.Confident}</p>
                  </div>
                  <div className="rounded-xl border border-gold/40 bg-gold-100 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold-600">Needs revision</p>
                    <p className="mt-1 font-display text-3xl text-gold-600">{summary.counts['Needs revision']}</p>
                  </div>
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-rose-700">Didn't know</p>
                    <p className="mt-1 font-display text-3xl text-rose-700">{summary.counts["Didn't know"]}</p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button className="btn-primary" onClick={startSession}>Practice another set</button>
                  <button className="btn-ghost" onClick={() => setPhase('setup')}>Change filters</button>
                </div>
              </Card>

              {summary.needsRevision.length > 0 && (
                <Card className="p-5 md:p-6">
                  <p className="eyebrow text-graphite-500">Needs revision ({summary.needsRevision.length})</p>
                  <ul className="mt-3 space-y-2">
                    {summary.needsRevision.map((q) => (
                      <li key={q.id} className="rounded-xl border border-ivory-200 bg-ivory-50 px-4 py-3">
                        <p className="text-sm leading-relaxed text-graphite-700">{q.text}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-graphite-500">
                          <span className="text-navy">{q.year}</span> · {q.examType} · {q.marks} marks · {q.topic}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-graphite-500">
                    These were also added to your revision queue on the right.
                  </p>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* ── SIDE PANEL ──────────────────────────────────────────────────── */}
        <aside aria-label="Revision queue and bookmarks">{QueuePanel}</aside>
      </div>

      {scopedQuestions.length === 0 && (
        <div className="mt-8">
          <EmptyState
            icon={Timer}
            title="No questions to practise"
            description="Practice mode draws from the questions in your dataset. Upload papers, or enable the illustrative demo dataset in Settings."
            action={{ label: 'Upload papers', to: '/upload' }}
          />
        </div>
      )}

      <div className="mt-8 rounded-xl border border-ivory-300 bg-ivory-50 px-4 py-3">
        <Prose>
          Practice sessions are never uploaded anywhere: your answers stay in this page's state (reload clears them),
          while the revision queue and bookmarks persist in this browser's localStorage.
        </Prose>
      </div>
    </div>
  )
}
