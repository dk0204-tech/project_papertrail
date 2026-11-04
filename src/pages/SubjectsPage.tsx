import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { ArrowUpRight, BookOpen, Database, Plus, Search, Sparkles, Layers } from 'lucide-react'
import { useAnalytics } from '../hooks/useAnalytics'
import {
  Badge,
  Card,
  ChartCard,
  DemoBadge,
  EmptyState,
  Modal,
  PageHeader,
  SectionTitle,
  Stat,
} from '../components/ui'
import { SubjectSummary } from '../services/analyticsEngine'
import { DEPARTMENTS, DEMO_DISCLAIMER, DEMO_SUBJECTS, PROGRAMMES } from '../data/demoSubjects'
import { CourseType, SemesterNumber, Subject } from '../types'

/**
 * Subject explorer — one card per subject in scope, with a drill-down modal
 * showing that subject's year-wise questions, unit split and top topics.
 * Classification provenance (syllabus vs. provisional) is surfaced per card.
 */

const COURSE_TYPES: CourseType[] = ['Core', 'Elective', 'Laboratory', 'Humanities', 'Project']
const SEMESTERS: SemesterNumber[] = [1, 2, 3, 4, 5, 6, 7, 8]

const chipClass = (active: boolean) =>
  `rounded-full border px-3.5 py-1.5 text-xs font-grotesk font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 ${
    active ? 'border-navy bg-navy text-ivory-100' : 'border-ivory-300 bg-white text-graphite-600 hover:border-graphite-400'
  }`

const DEMO_IDS = new Set(DEMO_SUBJECTS.map((s) => s.id))

interface AddForm {
  name: string
  code: string
  department: string
  programme: string
  semester: number
  courseType: CourseType
  credits: string
}

const EMPTY_FORM: AddForm = {
  name: '',
  code: '',
  department: DEPARTMENTS[0],
  programme: PROGRAMMES[0],
  semester: 1,
  courseType: 'Core',
  credits: '',
}

export const SubjectsPage: React.FC = () => {
  const { subjectSummary, questions, filtersActive, store } = useAnalytics()

  const [search, setSearch] = useState('')
  const [semFilter, setSemFilter] = useState<SemesterNumber | 'All'>('All')
  const [deptFilter, setDeptFilter] = useState<string>('All')
  const [selected, setSelected] = useState<SubjectSummary | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState<AddForm>(EMPTY_FORM)
  const [error, setError] = useState('')

  const departments = useMemo(() => {
    const set = new Set<string>([...DEPARTMENTS, ...subjectSummary.map((s) => s.subject.department)])
    return Array.from(set).sort()
  }, [subjectSummary])

  const programmes = useMemo(() => {
    const set = new Set<string>([...PROGRAMMES, ...subjectSummary.map((s) => s.subject.programme)])
    return Array.from(set).sort()
  }, [subjectSummary])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return subjectSummary.filter((row) => {
      if (semFilter !== 'All' && row.subject.semester !== semFilter) return false
      if (deptFilter !== 'All' && row.subject.department !== deptFilter) return false
      if (s && !`${row.subject.name} ${row.subject.code}`.toLowerCase().includes(s)) return false
      return true
    })
  }, [subjectSummary, search, semFilter, deptFilter])

  const hasDemo = subjectSummary.some((s) => DEMO_IDS.has(s.subject.id))

  // ── Drill-down data for the selected subject ──────────────────────────────
  const detail = useMemo(() => {
    if (!selected) return null
    const qs = questions.filter((q) => q.subjectId === selected.subject.id)
    const years = Array.from(new Set(qs.map((q) => q.year))).sort((a, b) => a - b)
    const byYear = years.map((y) => ({ year: y, questions: qs.filter((q) => q.year === y).length }))

    const unitMap = new Map<string, number>()
    for (const q of qs) unitMap.set(q.unit, (unitMap.get(q.unit) ?? 0) + 1)
    const units = Array.from(unitMap.entries())
      .map(([unit, count]) => ({ unit, count }))
      .sort((a, b) => b.count - a.count)

    const topicMap = new Map<string, { count: number; chapter: string }>()
    for (const q of qs) {
      const e = topicMap.get(q.topic) ?? { count: 0, chapter: q.chapter }
      e.count++
      topicMap.set(q.topic, e)
    }
    const topTopics = Array.from(topicMap.entries())
      .map(([topic, e]) => ({ topic, count: e.count, chapter: e.chapter }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const marks = qs.reduce((n, q) => n + (q.marks ?? 0), 0)
    return { qs, byYear, units, topTopics, marks, syllabus: store.syllabusFor(selected.subject.id) }
  }, [selected, questions, store])

  const submitAdd = () => {
    const name = form.name.trim()
    const code = form.code.trim()
    if (!name || !code) {
      setError('Subject name and code are both required.')
      return
    }
    const subject: Subject = {
      id: `user-${code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`,
      name,
      code,
      department: form.department.trim() || DEPARTMENTS[0],
      programme: form.programme.trim() || PROGRAMMES[0],
      semester: form.semester as SemesterNumber,
      courseType: form.courseType,
      credits: form.credits ? Number(form.credits) : undefined,
      scheme: 'User-defined (local entry)',
    }
    store.upsertSubject(subject)
    setForm(EMPTY_FORM)
    setError('')
    setAddOpen(false)
  }

  // ── Empty dataset ─────────────────────────────────────────────────────────
  if (subjectSummary.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Academics"
          title="Subject explorer"
          description="Every subject in scope with its papers, questions and classification provenance."
          actions={
            <button className="btn-primary !py-2.5 !text-[13px]" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Add subject
            </button>
          }
        />
        <EmptyState
          icon={Database}
          title="No subjects yet"
          description="Subjects appear here once papers are uploaded or the illustrative demo dataset is enabled in Settings."
          action={{ label: 'Upload papers', to: '/upload' }}
          secondaryAction={
            <Link to="/settings" className="btn-ghost">
              Open settings
            </Link>
          }
        />
        <AddSubjectModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          form={form}
          setForm={setForm}
          error={error}
          onSubmit={submitAdd}
          departments={departments}
          programmes={programmes}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Academics"
        title="Subject explorer"
        description="One card per subject: papers, questions, marks and whether its classification rests on a mapped syllabus or provisional keyword matching."
        demo={hasDemo}
        actions={
          <button className="btn-primary !py-2.5 !text-[13px]" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Add subject
          </button>
        }
      />

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Subjects in scope" value={filtered.length} sub={`${subjectSummary.length} in the dataset`} icon={Database} />
        <Stat
          label="Subjects with papers"
          value={subjectSummary.filter((s) => s.papers > 0).length}
          sub="At least one paper parsed"
          icon={BookOpen}
          accent="academic"
        />
        <Stat
          label="Syllabus mapped"
          value={subjectSummary.filter((s) => store.syllabusFor(s.subject.id)).length}
          sub="Remaining are provisional"
          icon={Layers}
          accent="lavender"
        />
        <Stat
          label="Questions"
          value={subjectSummary.reduce((n, s) => n + s.questions, 0)}
          sub="Across all subjects in scope"
          icon={Sparkles}
          accent="gold"
        />
      </div>
      {hasDemo && (
        <div className="mt-4">
          <DemoBadge />
        </div>
      )}

      {/* ── Search + chips ────────────────────────────────────────────────── */}
      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="w-full lg:max-w-sm">
          <label className="label" htmlFor="subject-search">
            Search subjects
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" aria-hidden />
            <input
              id="subject-search"
              className="field pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or course code…"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setSemFilter('All')} aria-pressed={semFilter === 'All'} className={chipClass(semFilter === 'All')}>
            All semesters
          </button>
          {SEMESTERS.map((n) => (
            <button
              key={n}
              onClick={() => setSemFilter(semFilter === n ? 'All' : n)}
              aria-pressed={semFilter === n}
              className={chipClass(semFilter === n)}
            >
              Sem {n}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <button onClick={() => setDeptFilter('All')} aria-pressed={deptFilter === 'All'} className={chipClass(deptFilter === 'All')}>
          All departments
        </button>
        {departments.map((d) => (
          <button
            key={d}
            onClick={() => setDeptFilter(deptFilter === d ? 'All' : d)}
            aria-pressed={deptFilter === d}
            className={chipClass(deptFilter === d)}
            title={d}
          >
            {d.length > 34 ? `${d.slice(0, 33)}…` : d}
          </button>
        ))}
      </div>

      {/* ── Grid ──────────────────────────────────────────────────────────── */}
      <SectionTitle
        kicker="Catalogue"
        title={`${filtered.length} subject${filtered.length === 1 ? '' : 's'}`}
        description="Select a card for year-wise questions, unit breakdown and top topics."
        right={
          filtersActive ? (
            <button className="btn-ghost !py-2.5 !text-[13px]" onClick={store.resetFilters}>
              Clear filters
            </button>
          ) : undefined
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No subjects match"
          description="No subject matches the current search and chips. Clear them to see the full catalogue."
          action={{ label: 'Upload papers', to: '/upload' }}
          secondaryAction={
            <button
              className="btn-ghost"
              onClick={() => {
                setSearch('')
                setSemFilter('All')
                setDeptFilter('All')
              }}
            >
              Clear search & chips
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((row) => {
            const s = row.subject
            const syllabus = store.syllabusFor(s.id)
            const demo = DEMO_IDS.has(s.id)
            return (
              <Card
                as="article"
                key={s.id}
                className="group flex cursor-pointer flex-col p-5 transition-shadow hover:shadow-lift2 focus-within:shadow-lift2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-xl leading-tight text-graphite">{s.name}</h3>
                    <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite-500">
                      {s.code}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Badge tone="navy">Semester {s.semester}</Badge>
                    {demo && (
                      <Badge tone="grey" title={DEMO_DISCLAIMER}>
                        demo
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge tone="blue">{s.courseType}</Badge>
                  {typeof s.credits === 'number' && <Badge tone="lavender">{s.credits} credits</Badge>}
                  {syllabus ? (
                    <Badge tone="green" title="Questions are matched against a mapped syllabus">
                      Syllabus mapped
                    </Badge>
                  ) : (
                    <Badge tone="gold" title="No syllabus mapped — classifications are provisional keyword matches">
                      No syllabus — provisional classification
                    </Badge>
                  )}
                </div>

                <p className="mt-3 text-xs text-graphite-500">{s.department}</p>

                <dl className="mt-4 grid grid-cols-4 gap-2 border-t border-ivory-200 pt-3">
                  <div>
                    <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-graphite-500">Papers</dt>
                    <dd className="font-display text-xl leading-none text-navy">{row.papers}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-graphite-500">Questions</dt>
                    <dd className="font-display text-xl leading-none text-navy">{row.questions}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-graphite-500">Marks</dt>
                    <dd className="font-display text-xl leading-none text-academic">{row.marks}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-graphite-500">Last year</dt>
                    <dd className="font-display text-xl leading-none text-gold-600">{row.lastYear ?? '—'}</dd>
                  </div>
                </dl>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <Link
                    to={`/analytics/topics?subject=${encodeURIComponent(s.id)}`}
                    className="inline-flex items-center gap-1 text-xs font-grotesk font-medium text-navy hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 rounded"
                    aria-label={`Open topic analytics for ${s.name}`}
                  >
                    Topic analytics <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                  <button
                    className="rounded-lg border border-ivory-300 bg-white px-3 py-1.5 text-xs font-grotesk font-medium text-graphite-700 transition-colors hover:border-graphite-400 hover:text-graphite focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
                    onClick={() => setSelected(row)}
                    aria-label={`Open details for ${s.name}`}
                  >
                    Details
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Subject detail modal ──────────────────────────────────────────── */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.subject.name ?? ''} wide>
        {selected && detail && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="navy">{selected.subject.code}</Badge>
              <Badge tone="grey">Semester {selected.subject.semester}</Badge>
              <Badge tone="blue">{selected.subject.courseType}</Badge>
              <Badge tone="lavender">{selected.subject.department}</Badge>
              {DEMO_IDS.has(selected.subject.id) && <Badge tone="gold">demo subject</Badge>}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Papers" value={selected.papers} />
              <Stat label="Questions" value={selected.questions} accent="academic" />
              <Stat label="Total marks" value={selected.marks} accent="gold" />
              <Stat label="Last paper" value={selected.lastYear ?? '—'} accent="lavender" />
            </div>

            <div className="rounded-xl border border-ivory-200 bg-ivory-50 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">Classification provenance</p>
              <p className="mt-1.5 text-sm text-graphite-700">
                {detail.syllabus
                  ? `Mapped syllabus (${detail.syllabus.provenance === 'demo-illustrative' ? 'illustrative demo structure' : detail.syllabus.provenance === 'user-upload' ? 'uploaded by you' : 'entered manually'}) — questions are matched against its units, chapters and topics.`
                  : 'No syllabus mapped for this subject — every classification is a provisional keyword match and may be wrong. Add a syllabus to make it explainable.'}
              </p>
            </div>

            <ChartCard
              title="Questions per year"
              description="Occurrences inside the current filter scope — an observation, not a prediction."
              right={selected.questions > 0 ? <DemoBadge /> : undefined}
            >
              {detail.byYear.length === 0 ? (
                <p className="py-8 text-center text-sm text-graphite-500">No questions for this subject in scope.</p>
              ) : (
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={detail.byYear} margin={{ left: -18, right: 12, top: 8, bottom: 0 }}>
                      <CartesianGrid stroke="#E2DED4" vertical={false} />
                      <XAxis dataKey="year" stroke="#9A9B9F" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
                      <YAxis stroke="#9A9B9F" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: '1px solid #E2DED4', fontSize: 12 }}
                        formatter={(v: number) => [`${v} questions`, 'Questions']}
                        labelFormatter={(l) => `Year ${l}`}
                      />
                      <Bar dataKey="questions" fill="#172554" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h4 className="mb-3 text-lg text-graphite">Unit breakdown</h4>
                {detail.units.length === 0 ? (
                  <p className="text-sm text-graphite-500">No questions in scope.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {detail.units.map((u) => {
                      const max = detail.units[0].count || 1
                      return (
                        <li key={u.unit}>
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="truncate text-sm text-graphite-700" title={u.unit}>
                              {u.unit}
                            </span>
                            <span className="font-mono text-[11px] text-graphite-500">{u.count}</span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ivory-200">
                            <div
                              className="h-full rounded-full bg-academic"
                              style={{ width: `${Math.max(4, (u.count / max) * 100)}%` }}
                              aria-hidden
                            />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              <div>
                <h4 className="mb-3 text-lg text-graphite">Top topics</h4>
                {detail.topTopics.length === 0 ? (
                  <p className="text-sm text-graphite-500">No questions in scope.</p>
                ) : (
                  <ol className="space-y-2.5">
                    {detail.topTopics.map((t, i) => (
                      <li key={t.topic} className="flex items-start gap-3 rounded-xl border border-ivory-200 bg-ivory-50 px-3.5 py-2.5">
                        <span className="font-mono text-[11px] text-graphite-400">{String(i + 1).padStart(2, '0')}</span>
                        <span className="min-w-0">
                          <span className="block text-sm text-graphite-700">{t.topic}</span>
                          <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">
                            {t.chapter} · {t.count} question{t.count === 1 ? '' : 's'}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link to={`/analytics/topics?subject=${encodeURIComponent(selected.subject.id)}`} className="btn-primary !py-2.5 !text-[13px]">
                Topic analytics
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link to="/questions" className="btn-ghost !py-2.5 !text-[13px]">
                View questions
              </Link>
              <Link to="/syllabus" className="btn-ghost !py-2.5 !text-[13px]">
                Open syllabus
              </Link>
            </div>
          </div>
        )}
      </Modal>

      <AddSubjectModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        form={form}
        setForm={setForm}
        error={error}
        onSubmit={submitAdd}
        departments={departments}
        programmes={programmes}
      />
    </div>
  )
}

// ── Add subject modal (shared by both early-return branches) ────────────────

const AddSubjectModal: React.FC<{
  open: boolean
  onClose: () => void
  form: AddForm
  setForm: (f: AddForm) => void
  error: string
  onSubmit: () => void
  departments: string[]
  programmes: string[]
}> = ({ open, onClose, form, setForm, error, onSubmit, departments, programmes }) => (
  <Modal open={open} onClose={onClose} title="Add subject">
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <p className="text-sm leading-relaxed text-graphite-600">
        Adds a subject to your local catalogue so uploaded papers can be mapped to it. Nothing leaves
        this device.
      </p>

      <div>
        <label className="label" htmlFor="subj-name">
          Subject name *
        </label>
        <input
          id="subj-name"
          className="field"
          value={form.name}
          required
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Operating Systems"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="subj-code">
            Course code *
          </label>
          <input
            id="subj-code"
            className="field"
            value={form.code}
            required
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="e.g. CSE2003"
          />
        </div>
        <div>
          <label className="label" htmlFor="subj-credits">
            Credits
          </label>
          <input
            id="subj-credits"
            type="number"
            min={0}
            max={20}
            className="field"
            value={form.credits}
            onChange={(e) => setForm({ ...form, credits: e.target.value })}
            placeholder="4"
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="subj-dept">
          Department
        </label>
        <input
          id="subj-dept"
          className="field"
          list="pt-departments"
          value={form.department}
          onChange={(e) => setForm({ ...form, department: e.target.value })}
        />
        <datalist id="pt-departments">
          {departments.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
      </div>

      <div>
        <label className="label" htmlFor="subj-programme">
          Programme
        </label>
        <input
          id="subj-programme"
          className="field"
          list="pt-programmes"
          value={form.programme}
          onChange={(e) => setForm({ ...form, programme: e.target.value })}
        />
        <datalist id="pt-programmes">
          {programmes.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="subj-sem">
            Semester
          </label>
          <select
            id="subj-sem"
            className="field cursor-pointer"
            value={String(form.semester)}
            onChange={(e) => setForm({ ...form, semester: Number(e.target.value) })}
          >
            {SEMESTERS.map((n) => (
              <option key={n} value={n}>
                Semester {n}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="subj-type">
            Course type
          </label>
          <select
            id="subj-type"
            className="field cursor-pointer"
            value={form.courseType}
            onChange={(e) => setForm({ ...form, courseType: e.target.value as CourseType })}
          >
            {COURSE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" className="btn-ghost !py-2.5 !text-[13px]" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn-primary !py-2.5 !text-[13px]">
          <Plus className="h-4 w-4" aria-hidden />
          Add subject
        </button>
      </div>
    </form>
  </Modal>
)
