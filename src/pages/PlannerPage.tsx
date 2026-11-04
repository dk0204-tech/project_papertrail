import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarRange, Check, ListChecks, Plus, Trash2, TrendingUp } from 'lucide-react'
import { useAnalytics } from '../hooks/useAnalytics'
import { usePaperTrail, PlannerEntry } from '../store/PaperTrailStore'
import {
  Badge, Card, DemoBadge, EmptyState, PageHeader, Prose, SectionTitle,
} from '../components/ui'

/**
 * Study planner — a personal preparation tracker persisted through the store's
 * savePlanner(). Statuses are exactly the store's three states; "Completed"
 * means the topic is mastered. Historical frequency next to each entry is
 * context from the dataset, never a prediction.
 */

type Status = PlannerEntry['status']
type Priority = PlannerEntry['priority']

const STATUS_OPTIONS: { value: Status; label: string; tone: 'grey' | 'blue' | 'green' }[] = [
  { value: 'Not started', label: 'Not started', tone: 'grey' },
  { value: 'In progress', label: 'In progress', tone: 'blue' },
  { value: 'Completed', label: 'Completed (mastered)', tone: 'green' },
]

const PRIORITY_TONE: Record<Priority, 'red' | 'gold' | 'grey'> = { High: 'red', Medium: 'gold', Low: 'grey' }

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const todayIso = () => new Date().toISOString().slice(0, 10)

export const PlannerPage: React.FC = () => {
  const { topics } = useAnalytics()
  const store = usePaperTrail()
  const planner = store.planner

  const [showAdd, setShowAdd] = useState(false)
  const [draftSubject, setDraftSubject] = useState('')
  const [draftTopic, setDraftTopic] = useState('')
  const [draftPriority, setDraftPriority] = useState<Priority>('Medium')
  const [draftDate, setDraftDate] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editSubject, setEditSubject] = useState('')
  const [editTopic, setEditTopic] = useState('')
  const [checkDraft, setCheckDraft] = useState<Record<string, string>>({})

  const subjectsById = useMemo(() => new Map(store.subjects.map((s) => [s.id, s])), [store.subjects])
  const activeSubjectId = draftSubject || store.subjects[0]?.id || ''

  const syllabusTopics = useMemo(() => {
    const syllabus = store.syllabusFor(activeSubjectId)
    if (!syllabus) return []
    const names: string[] = []
    for (const unit of syllabus.units) {
      for (const chapter of unit.chapters) {
        for (const topic of chapter.topics) {
          if (!names.includes(topic.name)) names.push(topic.name)
        }
      }
    }
    return names.sort((a, b) => a.localeCompare(b))
  }, [store, activeSubjectId])

  const persist = (next: PlannerEntry[]) => store.savePlanner(next)

  const addEntry = () => {
    const topic = draftTopic.trim()
    if (!topic || !activeSubjectId) return
    const entry: PlannerEntry = {
      id: uid(),
      subjectId: activeSubjectId,
      topic,
      priority: draftPriority,
      status: 'Not started',
      targetDate: draftDate || undefined,
      checklist: [],
      updatedAt: new Date().toISOString(),
    }
    persist([entry, ...planner])
    setDraftTopic('')
    setDraftDate('')
    setDraftPriority('Medium')
    setShowAdd(false)
  }

  const update = (id: string, patch: Partial<PlannerEntry>) => {
    persist(planner.map((e) => (e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e)))
  }

  const remove = (id: string) => persist(planner.filter((e) => e.id !== id))

  const addChecklistItem = (id: string) => {
    const label = (checkDraft[id] ?? '').trim()
    if (!label) return
    const entry = planner.find((e) => e.id === id)
    if (!entry) return
    update(id, { checklist: [...entry.checklist, { id: uid(), label, done: false }] })
    setCheckDraft((c) => ({ ...c, [id]: '' }))
  }

  const toggleChecklist = (id: string, itemId: string) => {
    const entry = planner.find((e) => e.id === id)
    if (!entry) return
    update(id, { checklist: entry.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c)) })
  }

  const removeChecklistItem = (id: string, itemId: string) => {
    const entry = planner.find((e) => e.id === id)
    if (!entry) return
    update(id, { checklist: entry.checklist.filter((c) => c.id !== itemId) })
  }

  const saveEdit = (id: string) => {
    const topic = editTopic.trim()
    if (!topic || !editSubject) return
    update(id, { subjectId: editSubject, topic })
    setEditingId(null)
  }

  // ── Progress summary ──────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const c: Record<Status, number> = { 'Not started': 0, 'In progress': 0, Completed: 0 }
    for (const e of planner) c[e.status]++
    return c
  }, [planner])

  const overallPct = planner.length ? Math.round((counts.Completed / planner.length) * 100) : 0

  const checklistTotal = useMemo(() => planner.reduce((s, e) => s + e.checklist.length, 0), [planner])
  const checklistDone = useMemo(() => planner.reduce((s, e) => s + e.checklist.filter((c) => c.done).length, 0), [planner])

  const perSubject = useMemo(() => {
    const map = new Map<string, { total: number; completed: number }>()
    for (const e of planner) {
      const v = map.get(e.subjectId) ?? { total: 0, completed: 0 }
      v.total++
      if (e.status === 'Completed') v.completed++
      map.set(e.subjectId, v)
    }
    return Array.from(map, ([subjectId, v]) => ({
      subjectId,
      name: subjectsById.get(subjectId)?.name ?? subjectId,
      ...v,
      pct: Math.round((v.completed / (v.total || 1)) * 100),
    })).sort((a, b) => b.total - a.total)
  }, [planner, subjectsById])

  const overdue = useMemo(() => {
    const today = todayIso()
    return planner.filter((e) => e.targetDate && e.targetDate < today && e.status !== 'Completed')
  }, [planner])

  /** Historical context for one planner topic — from the dataset, not a forecast. */
  const historyFor = (entry: PlannerEntry) =>
    topics.find((t) => t.subjectId === entry.subjectId && t.topic === entry.topic) ??
    topics.find((t) => t.topic === entry.topic) ??
    null

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Study"
        title="Study planner"
        description="Track the topics you intend to master. Statuses: Not started → In progress → Completed (mastered). Everything is saved in your browser as you go."
        actions={
          <>
            <Link to="/practice" className="btn-ghost !py-2.5 !text-[13px]">Practice mode</Link>
            <button className="btn-primary !py-2.5 !text-[13px]" onClick={() => setShowAdd((v) => !v)}>
              <Plus className="h-4 w-4" /> Add topic
            </button>
          </>
        }
      />

      {/* Add topic flow */}
      {showAdd && (
        <Card className="no-print mb-6 p-5 md:p-6">
          <SectionTitle kicker="New entry" title="Add a topic to the planner" />
          <div className="grid gap-4 md:grid-cols-4">
            <label className="block">
              <span className="label">Subject</span>
              <select className="field" value={activeSubjectId} onChange={(e) => setDraftSubject(e.target.value)}>
                {store.subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.code} · {s.name}</option>
                ))}
                {store.subjects.length === 0 && <option value="">No subjects available</option>}
              </select>
            </label>
            <label className="block">
              <span className="label">Topic</span>
              <input
                className="field"
                list="planner-topic-options"
                value={draftTopic}
                onChange={(e) => setDraftTopic(e.target.value)}
                placeholder={syllabusTopics.length ? 'Pick from syllabus or type your own' : 'Type a topic'}
                aria-label="Topic name"
              />
              <datalist id="planner-topic-options">
                {syllabusTopics.map((t) => <option key={t} value={t} />)}
              </datalist>
            </label>
            <div>
              <span className="label">Priority</span>
              <div className="flex gap-1.5" role="group" aria-label="Priority">
                {(['High', 'Medium', 'Low'] as Priority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setDraftPriority(p)}
                    aria-pressed={draftPriority === p}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-grotesk font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 ${
                      draftPriority === p ? 'border-navy bg-navy text-ivory-100' : 'border-ivory-300 bg-white text-graphite-600 hover:border-graphite-400'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="label">Target date (optional)</span>
              <input type="date" className="field" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} />
            </label>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button className="btn-primary !py-2.5 !text-[13px]" onClick={addEntry} disabled={!draftTopic.trim() || !activeSubjectId}>
              Add to planner
            </button>
            <button className="btn-ghost !py-2.5 !text-[13px]" onClick={() => setShowAdd(false)}>Cancel</button>
            {syllabusTopics.length > 0 && (
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-400">
                {syllabusTopics.length} syllabus topics available for this subject
              </span>
            )}
          </div>
        </Card>
      )}

      {/* Progress summary */}
      {planner.length > 0 && (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="p-5 md:p-6 xl:col-span-2">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow text-graphite-500">Overall progress</p>
                <p className="mt-2 font-display text-4xl leading-none text-navy">{overallPct}%</p>
                <p className="mt-2 text-xs text-graphite-500">
                  {counts.Completed} of {planner.length} topics completed (mastered)
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="grey">Not started · {counts['Not started']}</Badge>
                <Badge tone="blue">In progress · {counts['In progress']}</Badge>
                <Badge tone="green">Completed · {counts.Completed}</Badge>
              </div>
            </div>
            <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-ivory-200" role="img" aria-label={`${overallPct}% of planner topics completed`}>
              <div className="bg-navy transition-all duration-500" style={{ width: `${overallPct}%` }} />
            </div>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">Checklist items</p>
                <p className="font-mono text-[11px] text-graphite-500">{checklistDone} / {checklistTotal} done</p>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-ivory-200">
                <div
                  className="bg-gold transition-all duration-500"
                  style={{ width: `${checklistTotal ? (checklistDone / checklistTotal) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">Per-subject progress</p>
              {perSubject.map((s) => (
                <div key={s.subjectId}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                    <span className="truncate text-graphite-700">{s.name}</span>
                    <span className="shrink-0 font-mono text-graphite-500">{s.completed}/{s.total} · {s.pct}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-ivory-200">
                    <div className="h-full rounded-full bg-academic" style={{ width: `${s.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 md:p-6">
            <p className="eyebrow text-graphite-500">Overdue targets</p>
            {overdue.length === 0 ? (
              <p className="mt-3 text-sm text-graphite-600">
                Nothing overdue — every target date is either in the future or the topic is already completed.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {overdue.map((e) => (
                  <li key={e.id} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5">
                    <p className="text-sm font-medium text-graphite">{e.topic}</p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-rose-700">
                      Target {e.targetDate} · {e.status}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <div className="rule mt-5 pt-4">
              <Prose>
                Historical frequency below is context from your dataset, not a prediction of what will be asked.
              </Prose>
            </div>
            {store.demoEnabled && <DemoBadge className="mt-4" />}
          </Card>
        </div>
      )}

      {/* Entries */}
      <div className="mt-8">
        <SectionTitle
          kicker="Topics"
          title={planner.length ? `${planner.length} topic${planner.length === 1 ? '' : 's'} in the planner` : 'Your planner'}
          description="Change status, priority and target dates inline. Checklist progress drives each entry's bar."
        />

        {planner.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title="No topics planned yet"
            description="Add the topics you want to prepare — pick them from a subject's syllabus or type your own. Your progress is saved in this browser."
            action={{ label: 'Browse topic analytics', to: '/analytics/topics' }}
            secondaryAction={
              <button className="btn-primary" onClick={() => setShowAdd(true)}>
                <Plus className="h-4 w-4" /> Add your first topic
              </button>
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {planner.map((entry) => {
              const subject = subjectsById.get(entry.subjectId)
              const done = entry.checklist.filter((c) => c.done).length
              const total = entry.checklist.length
              const pctValue = total ? Math.round((done / total) * 100) : entry.status === 'Completed' ? 100 : 0
              const isOverdue = !!entry.targetDate && entry.targetDate < todayIso() && entry.status !== 'Completed'
              const history = historyFor(entry)
              const editing = editingId === entry.id

              return (
                <Card key={entry.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {editing ? (
                        <div className="space-y-2">
                          <select
                            className="field !py-2 text-xs"
                            value={editSubject}
                            aria-label="Edit subject"
                            onChange={(e) => setEditSubject(e.target.value)}
                          >
                            {store.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                          <input
                            className="field !py-2 text-xs"
                            value={editTopic}
                            aria-label="Edit topic"
                            onChange={(e) => setEditTopic(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <button className="btn-primary !px-3 !py-1.5 !text-xs" onClick={() => saveEdit(entry.id)}>Save</button>
                            <button className="btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => setEditingId(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="eyebrow text-graphite-500">{subject?.name ?? 'Unknown subject'}</p>
                          <h3 className="mt-1.5 text-xl leading-snug text-graphite">{entry.topic}</h3>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge tone={PRIORITY_TONE[entry.priority]}>{entry.priority} priority</Badge>
                            {entry.targetDate && (
                              <Badge tone={isOverdue ? 'red' : 'lavender'}>
                                {isOverdue ? 'Overdue · ' : 'Target · '}{entry.targetDate}
                              </Badge>
                            )}
                            {history && (
                              <Badge tone="blue" title="Share of papers in scope containing this topic">
                                {history.frequencyPercentage}% of papers
                              </Badge>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    {!editing && (
                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={() => { setEditingId(entry.id); setEditSubject(entry.subjectId); setEditTopic(entry.topic) }}
                          aria-label={`Edit ${entry.topic}`}
                          className="rounded-lg border border-ivory-300 px-2.5 py-1.5 text-[11px] font-grotesk text-graphite-600 hover:border-graphite-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => remove(entry.id)}
                          aria-label={`Delete ${entry.topic}`}
                          className="rounded-lg border border-ivory-300 p-1.5 text-graphite-500 hover:border-rose-300 hover:text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {!editing && (
                    <>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="label">Status</span>
                          <select
                            className="field !py-2 text-xs"
                            value={entry.status}
                            aria-label={`Status for ${entry.topic}`}
                            onChange={(e) => update(entry.id, { status: e.target.value as Status })}
                          >
                            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </label>
                        <label className="block">
                          <span className="label">Target date</span>
                          <input
                            type="date"
                            className="field !py-2 text-xs"
                            value={entry.targetDate ?? ''}
                            aria-label={`Target date for ${entry.topic}`}
                            onChange={(e) => update(entry.id, { targetDate: e.target.value || undefined })}
                          />
                        </label>
                      </div>

                      <div className="mt-4">
                        <div className="mb-1.5 flex items-center justify-between">
                          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">Checklist</p>
                          <p className="font-mono text-[11px] text-graphite-500">{done}/{total} · {pctValue}%</p>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-ivory-200" role="img" aria-label={`${pctValue}% checklist complete`}>
                          <div className="h-full rounded-full bg-navy transition-all duration-500" style={{ width: `${pctValue}%` }} />
                        </div>

                        <ul className="mt-3 space-y-1.5">
                          {entry.checklist.map((c) => (
                            <li key={c.id} className="flex items-center gap-2 rounded-lg border border-ivory-200 bg-ivory-50 px-3 py-2">
                              <button
                                onClick={() => toggleChecklist(entry.id, c.id)}
                                aria-pressed={c.done}
                                aria-label={`${c.done ? 'Uncheck' : 'Check'} ${c.label}`}
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 ${
                                  c.done ? 'border-navy bg-navy text-ivory-100' : 'border-ivory-400 bg-white'
                                }`}
                              >
                                {c.done && <Check className="h-3 w-3" />}
                              </button>
                              <span className={`flex-1 text-xs ${c.done ? 'text-graphite-400 line-through' : 'text-graphite-700'}`}>{c.label}</span>
                              <button
                                onClick={() => removeChecklistItem(entry.id, c.id)}
                                aria-label={`Remove checklist item ${c.label}`}
                                className="text-graphite-400 hover:text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </li>
                          ))}
                        </ul>

                        <div className="mt-2 flex gap-2">
                          <input
                            className="field !py-2 text-xs"
                            placeholder="Add a checklist step…"
                            aria-label={`Add checklist item to ${entry.topic}`}
                            value={checkDraft[entry.id] ?? ''}
                            onChange={(e) => setCheckDraft((c) => ({ ...c, [entry.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && addChecklistItem(entry.id)}
                          />
                          <button
                            className="btn-ghost !px-3 !py-2 !text-xs"
                            onClick={() => addChecklistItem(entry.id)}
                            aria-label="Add checklist item"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {history ? (
                        <div className="mt-4 rounded-xl border border-ivory-200 bg-ivory-50 px-3.5 py-3">
                          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">
                            <TrendingUp className="h-3 w-3" /> Historical context
                          </p>
                          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-graphite-600">
                            <span><span className="font-mono text-navy">{history.totalQuestions}</span> questions</span>
                            <span><span className="font-mono text-navy">{history.frequencyPercentage}%</span> of papers in scope</span>
                            <span>last appearance <span className="font-mono text-navy">{history.lastAppearance ?? '—'}</span></span>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-4 rounded-xl border border-ivory-200 bg-ivory-50 px-3.5 py-3 text-xs text-graphite-500">
                          No matching questions for this topic in the current dataset — so there is no historical frequency
                          to report yet.
                        </p>
                      )}
                    </>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {planner.length > 0 && (
        <div className="mt-8 rounded-xl border border-ivory-300 bg-ivory-50 px-4 py-3">
          <p className="flex items-center gap-2 text-xs font-medium text-graphite-600">
            <ListChecks className="h-3.5 w-3.5 text-academic" /> Reminder
          </p>
          <p className="mt-1 text-xs leading-relaxed text-graphite-600">
            Historical frequency is context from your dataset, not a prediction of what will be asked. Plan from the
            syllabus and your own gaps, not from a promise about future papers.
          </p>
        </div>
      )}
    </div>
  )
}
