import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_FILTERS,
  FilterState,
  Paper,
  Question,
  SemesterNumber,
  Subject,
  Syllabus,
} from '../types'
import { buildDemoDataset } from '../data/demoDataset'
import { DEMO_SYLLABI } from '../data/demoSyllabus'
import { DEMO_SUBJECTS } from '../data/demoSubjects'
import { classifyQuestion, applyClassification } from '../services/topicClassifier'
import { deleteDocument } from '../storage/indexedDB'

const K = {
  userPapers: 'pt_user_papers',
  userQuestions: 'pt_user_questions',
  overrides: 'pt_question_overrides',
  userSyllabi: 'pt_user_syllabi',
  userSubjects: 'pt_user_subjects',
  filters: 'pt_filters',
  planner: 'pt_planner',
  demo: 'pt_demo_enabled',
  confirmed: 'pt_confirmed_ids',
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn('PaperTrail: could not persist to localStorage (quota?)', e)
  }
}

export interface PlannerEntry {
  id: string
  subjectId: string
  topic: string
  priority: 'High' | 'Medium' | 'Low'
  status: 'Not started' | 'In progress' | 'Completed'
  targetDate?: string
  checklist: { id: string; label: string; done: boolean }[]
  updatedAt: string
}

export type UploadPhase =
  | { status: 'idle' }
  | { status: 'reading'; page: number; total: number }
  | { status: 'parsing' }
  | { status: 'classifying'; done: number; total: number }
  | { status: 'done'; paperId: string; questionCount: number; warnings: string[] }
  | { status: 'error'; message: string }

interface Store {
  subjects: Subject[]
  papers: Paper[]
  questions: Question[]
  syllabi: Record<string, Syllabus>
  filters: FilterState
  demoEnabled: boolean
  planner: PlannerEntry[]

  setFilters: (f: Partial<FilterState>) => void
  resetFilters: () => void
  toggleDemo: (on: boolean) => void

  addUploadedPaper: (paper: Paper, questions: Question[]) => void
  removePaper: (paperId: string) => void
  updatePaper: (paper: Paper) => void
  updateQuestion: (q: Question) => void
  bulkUpdateQuestions: (qs: Question[]) => void
  deleteQuestion: (id: string) => void
  addManualQuestion: (q: Question) => void
  reclassifyAll: (subjectId?: string) => void

  setSyllabus: (subjectId: string, syllabus: Syllabus) => void
  removeSyllabus: (subjectId: string) => void
  upsertSubject: (subject: Subject) => void

  savePlanner: (entries: PlannerEntry[]) => void
  resetDemoData: () => void

  syllabusFor: (subjectId: string) => Syllabus | null
  subjectById: (id: string) => Subject | undefined
}

const Ctx = createContext<Store | null>(null)

export function PaperTrailProvider({ children }: { children: React.ReactNode }) {
  const demo = useMemo(() => buildDemoDataset(), [])

  const [userSubjects, setUserSubjects] = useState<Subject[]>(() => load(K.userSubjects, []))
  const [userPapers, setUserPapers] = useState<Paper[]>(() => load(K.userPapers, []))
  const [userQuestions, setUserQuestions] = useState<Question[]>(() => load(K.userQuestions, []))
  const [overrides, setOverrides] = useState<Record<string, Partial<Question>>>(() => load(K.overrides, {}))
  const [userSyllabi, setUserSyllabi] = useState<Record<string, Syllabus>>(() => load(K.userSyllabi, {}))

  const [demoEnabled, setDemoEnabled] = useState<boolean>(() => load(K.demo, true))
  const [filters, setFiltersState] = useState<FilterState>(() => load(K.filters, DEFAULT_FILTERS))
  const [planner, setPlanner] = useState<PlannerEntry[]>(() => load(K.planner, []))

  const subjects = useMemo(() => {
    const map = new Map<string, Subject>()
    for (const s of DEMO_SUBJECTS) map.set(s.id, s)
    for (const s of userSubjects) map.set(s.id, s)
    return Array.from(map.values())
  }, [userSubjects])

  const papers = useMemo(() => {
    return [...userPapers, ...demo.papers]
  }, [userPapers, demo.papers])

  const questions = useMemo(() => {
    const raw = [...userQuestions, ...demo.questions]
    return raw.map((q) => {
      const o = overrides[q.id]
      return o ? ({ ...q, ...o } as Question) : q
    })
  }, [userQuestions, demo.questions, overrides])

  const syllabi = useMemo(() => {
    return { ...DEMO_SYLLABI, ...userSyllabi }
  }, [userSyllabi])

  const setFilters = useCallback((f: Partial<FilterState>) => {
    setFiltersState((prev) => {
      const next = { ...prev, ...f }
      save(K.filters, next)
      return next
    })
  }, [])

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS)
    save(K.filters, DEFAULT_FILTERS)
  }, [])

  const toggleDemo = useCallback((on: boolean) => {
    setDemoEnabled(on)
    save(K.demo, on)
  }, [])

  const persistOverrides = useCallback((next: Record<string, Partial<Question>>) => {
    setOverrides(next)
    save(K.overrides, next)
  }, [])

  const addUploadedPaper = useCallback((paper: Paper, qs: Question[]) => {
    setUserPapers((prev) => {
      const next = [paper, ...prev.filter((p) => p.id !== paper.id)]
      save(K.userPapers, next)
      return next
    })
    setUserQuestions((prev) => {
      const next = [...prev.filter((q) => q.paperId !== paper.id), ...qs]
      save(K.userQuestions, next)
      return next
    })
  }, [])

  const removePaper = useCallback((paperId: string) => {
    setUserPapers((prev) => {
      const next = prev.filter((p) => p.id !== paperId)
      save(K.userPapers, next)
      return next
    })
    setUserQuestions((prev) => {
      const next = prev.filter((q) => q.paperId !== paperId)
      save(K.userQuestions, next)
      return next
    })
    // Also delete stored PDF blob from IndexedDB if present
    deleteDocument(paperId).catch(() => {})

    const excluded = load<string[]>('pt_excluded_demo_papers', [])
    if (!excluded.includes(paperId)) {
      const next = [...excluded, paperId]
      save('pt_excluded_demo_papers', next)
      setDemoPapersExcluded(next)
    }
  }, [])

  const [demoPapersExcluded, setDemoPapersExcluded] = useState<string[]>(() => load<string[]>('pt_excluded_demo_papers', []))
  const [demoQuestionsDeleted, setDemoQuestionsDeleted] = useState<string[]>(() => load<string[]>('pt_deleted_demo_questions', []))

  const papersFinal = useMemo(
    () => (demoEnabled ? papers.filter((p) => !demoPapersExcluded.includes(p.id)) : papers),
    [papers, demoEnabled, demoPapersExcluded],
  )
  const questionsFinal = useMemo(
    () =>
      demoEnabled
        ? questions.filter(
            (q) => !demoPapersExcluded.includes(q.paperId) && !demoQuestionsDeleted.includes(q.id),
          )
        : questions,
    [questions, demoEnabled, demoPapersExcluded, demoQuestionsDeleted],
  )

  const updatePaper = useCallback((paper: Paper) => {
    if (paper.demo) return
    setUserPapers((prev) => {
      const next = prev.map((p) => (p.id === paper.id ? paper : p))
      save(K.userPapers, next)
      return next
    })
  }, [])

  const updateQuestion = useCallback((q: Question) => {
    if (q.demo) {
      const { id, ...rest } = q
      const next = { ...overrides, [id]: rest }
      persistOverrides(next)
    } else {
      setUserQuestions((prev) => {
        const next = prev.map((x) => (x.id === q.id ? q : x))
        save(K.userQuestions, next)
        return next
      })
    }
  }, [overrides, persistOverrides])

  const bulkUpdateQuestions = useCallback((qs: Question[]) => {
    const demoUpdates: Record<string, Partial<Question>> = {}
    const userUpdates = new Map<string, Question>()
    for (const q of qs) {
      if (q.demo) {
        const { id, ...rest } = q
        demoUpdates[id] = rest
      } else userUpdates.set(q.id, q)
    }
    if (Object.keys(demoUpdates).length > 0) persistOverrides({ ...overrides, ...demoUpdates })
    if (userUpdates.size > 0) {
      setUserQuestions((prev) => {
        const next = prev.map((x) => (userUpdates.has(x.id) ? userUpdates.get(x.id)! : x))
        save(K.userQuestions, next)
        return next
      })
    }
  }, [overrides, persistOverrides])

  const deleteQuestion = useCallback((id: string) => {
    const target = questionsFinal.find((q) => q.id === id)
    if (!target) return
    if (target.demo) {
      const next = [...demoQuestionsDeleted, id]
      save('pt_deleted_demo_questions', next)
      setDemoQuestionsDeleted(next)
    } else {
      setUserQuestions((prev) => {
        const next = prev.filter((q) => q.id !== id)
        save(K.userQuestions, next)
        return next
      })
    }
  }, [questionsFinal, demoQuestionsDeleted])

  const addManualQuestion = useCallback((q: Question) => {
    setUserQuestions((prev) => {
      const next = [q, ...prev]
      save(K.userQuestions, next)
      return next
    })
  }, [])

  const reclassifyAll = useCallback((subjectId?: string) => {
    if (!subjectId || subjectId === 'All') {
      const demoUpdates: Record<string, Partial<Question>> = {}
      for (const q of questionsFinal) {
        if (!q.demo) continue
        const { id, ...rest } = applyClassification(q, syllabi[q.subjectId] ?? null)
        demoUpdates[id] = rest
      }
      if (Object.keys(demoUpdates).length) persistOverrides({ ...overrides, ...demoUpdates })
      setUserQuestions((prev) => {
        const next = prev.map((q) => applyClassification(q, syllabi[q.subjectId] ?? null))
        save(K.userQuestions, next)
        return next
      })
    } else {
      const demoUpdates: Record<string, Partial<Question>> = {}
      for (const q of questionsFinal) {
        if (!q.demo || q.subjectId !== subjectId) continue
        const { id, ...rest } = applyClassification(q, syllabi[q.subjectId] ?? null)
        demoUpdates[id] = rest
      }
      if (Object.keys(demoUpdates).length) persistOverrides({ ...overrides, ...demoUpdates })
      setUserQuestions((prev) => {
        const next = prev.map((q) => (q.subjectId === subjectId ? applyClassification(q, syllabi[q.subjectId] ?? null) : q))
        save(K.userQuestions, next)
        return next
      })
    }
  }, [questionsFinal, syllabi, overrides, persistOverrides])

  const setSyllabus = useCallback((subjectId: string, s: Syllabus) => {
    setUserSyllabi((prev) => {
      const next = { ...prev, [subjectId]: s }
      save(K.userSyllabi, next)
      return next
    })
  }, [])

  const removeSyllabus = useCallback((subjectId: string) => {
    setUserSyllabi((prev) => {
      const next = { ...prev }
      delete next[subjectId]
      save(K.userSyllabi, next)
      return next
    })
  }, [])

  const upsertSubject = useCallback((sub: Subject) => {
    setUserSubjects((prev) => {
      const next = [sub, ...prev.filter((s) => s.id !== sub.id)]
      save(K.userSubjects, next)
      return next
    })
  }, [])

  const savePlanner = useCallback((entries: PlannerEntry[]) => {
    setPlanner(entries)
    save(K.planner, entries)
  }, [])

  const resetDemoData = useCallback(() => {
    localStorage.removeItem('pt_excluded_demo_papers')
    localStorage.removeItem('pt_deleted_demo_questions')
    localStorage.removeItem(K.overrides)
    setDemoPapersExcluded([])
    setDemoQuestionsDeleted([])
    setOverrides({})
  }, [])

  const syllabusFor = useCallback((subjectId: string): Syllabus | null => {
    return syllabi[subjectId] ?? null
  }, [syllabi])

  const subjectById = useCallback((id: string): Subject | undefined => {
    return subjects.find((s) => s.id === id)
  }, [subjects])

  const value = useMemo<Store>(
    () => ({
      subjects,
      papers: papersFinal,
      questions: questionsFinal,
      syllabi,
      filters,
      demoEnabled,
      planner,
      setFilters,
      resetFilters,
      toggleDemo,
      addUploadedPaper,
      removePaper,
      updatePaper,
      updateQuestion,
      bulkUpdateQuestions,
      deleteQuestion,
      addManualQuestion,
      reclassifyAll,
      setSyllabus,
      removeSyllabus,
      upsertSubject,
      savePlanner,
      resetDemoData,
      syllabusFor,
      subjectById,
    }),
    [
      subjects,
      papersFinal,
      questionsFinal,
      syllabi,
      filters,
      demoEnabled,
      planner,
      setFilters,
      resetFilters,
      toggleDemo,
      addUploadedPaper,
      removePaper,
      updatePaper,
      updateQuestion,
      bulkUpdateQuestions,
      deleteQuestion,
      addManualQuestion,
      reclassifyAll,
      setSyllabus,
      removeSyllabus,
      upsertSubject,
      savePlanner,
      resetDemoData,
      syllabusFor,
      subjectById,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePaperTrail() {
  const c = useContext(Ctx)
  if (!c) throw new Error('usePaperTrail must be used within a PaperTrailProvider')
  return c
}
