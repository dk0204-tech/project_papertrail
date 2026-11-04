import {
  ChapterAnalytics,
  CoverageRow,
  DatasetOverview,
  Difficulty,
  FilterState,
  Paper,
  Question,
  RepetitionCluster,
  SemesterNumber,
  Subject,
  Syllabus,
  TopicAnalytics,
  TopicTrend,
  TrendPoint,
  UnitAnalytics,
} from '../types'
import { buildClusters } from './similarityAnalyzer'

/**
 * Pure aggregation functions. Every chart number in the UI comes from one of
 * these functions applied to the current (filtered) question set — nothing is
 * hardcoded in components.
 */

// ── Filtering ────────────────────────────────────────────────────────────────

export function applyFilters(questions: Question[], f: FilterState): Question[] {
  return questions.filter((q) => {
    if (f.department !== 'All' && q.department !== f.department) return false
    if (f.programme !== 'All' && q.programme !== f.programme) return false
    if (f.academicYear !== 'All' && q.year !== f.academicYear) return false
    if (f.semester !== 'All' && q.semester !== f.semester) return false
    if (f.subjectId !== 'All' && q.subjectId !== f.subjectId) return false
    if (f.examType !== 'All' && q.examType !== f.examType) return false
    if (f.unit !== 'All' && q.unit !== f.unit) return false
    if (f.chapter !== 'All' && q.chapter !== f.chapter) return false
    if (f.topic !== 'All' && q.topic !== f.topic) return false
    return true
  })
}

export function applyPaperFilters(papers: Paper[], f: FilterState): Paper[] {
  return papers.filter((p) => {
    if (f.department !== 'All' && p.department !== f.department) return false
    if (f.programme !== 'All' && p.programme !== f.programme) return false
    if (f.academicYear !== 'All' && p.year !== f.academicYear) return false
    if (f.semester !== 'All' && p.semester !== f.semester) return false
    if (f.subjectId !== 'All' && p.subjectId !== f.subjectId) return false
    if (f.examType !== 'All' && p.examType !== f.examType) return false
    return true
  })
}

const empty = (): FilterState => ({
  department: 'All', programme: 'All', academicYear: 'All', semester: 'All',
  subjectId: 'All', examType: 'All', unit: 'All', chapter: 'All', topic: 'All',
})

/** Filters restricted to structural dimensions (for cascading dropdowns). */
export function filterWithout(f: FilterState, ...keys: (keyof FilterState)[]): FilterState {
  const next = { ...f }
  for (const k of keys) (next as any)[k] = 'All' as any
  return next
}

export const ALL_FILTERS = empty

// ── Topic analytics ──────────────────────────────────────────────────────────

export function topicAnalytics(questions: Question[], papers: Paper[]): TopicAnalytics[] {
  const scopePapers = new Set(papers.map((p) => p.id))
  const map = new Map<string, {
    topic: string; chapter: string; unit: string; subjectId: string; subject: string
    questions: Question[]; years: Set<number>; paperIds: Set<string>
  }>()

  for (const q of questions) {
    const key = `${q.subjectId}::${q.topic}`
    let e = map.get(key)
    if (!e) {
      e = { topic: q.topic, chapter: q.chapter, unit: q.unit, subjectId: q.subjectId, subject: q.subject, questions: [], years: new Set(), paperIds: new Set() }
      map.set(key, e)
    }
    e.questions.push(q)
    e.years.add(q.year)
    e.paperIds.add(q.paperId)
  }

  const totalScope = scopePapers.size || 1
  const result: TopicAnalytics[] = []
  for (const e of map.values()) {
    const totalQuestions = e.questions.length
    const totalMarks = e.questions.reduce((s, q) => s + (q.marks ?? 0), 0)
    const years = Array.from(e.years).sort((a, b) => a - b)
    const difficultyBreakdown: Record<Difficulty, number> = { Easy: 0, Medium: 0, Hard: 0 }
    const typeBreakdown: Record<string, number> = {}
    for (const q of e.questions) {
      difficultyBreakdown[q.difficulty]++
      typeBreakdown[q.questionType] = (typeBreakdown[q.questionType] ?? 0) + 1
    }
    // consecutive appearances ending at the most recent year in scope
    let consecutive = 0
    if (years.length > 0) {
      const latest = years[years.length - 1]
      for (let y = latest; y > latest - 20; y--) {
        if (e.years.has(y)) consecutive++
        else break
      }
    }
    result.push({
      topic: e.topic,
      chapter: e.chapter,
      unit: e.unit,
      subjectId: e.subjectId,
      subject: e.subject,
      totalQuestions,
      papersContaining: e.paperIds.size,
      yearsRepresented: years.length,
      totalMarks,
      avgMarks: Number((totalMarks / (totalQuestions || 1)).toFixed(1)),
      frequencyPercentage: Number(((e.paperIds.size / totalScope) * 100).toFixed(1)),
      years,
      lastAppearance: years.length ? years[years.length - 1] : null,
      consecutiveAppearances: consecutive,
      difficultyBreakdown,
      typeBreakdown,
    })
  }
  return result.sort((a, b) => b.totalQuestions - a.totalQuestions)
}

// ── Chapter / unit analytics ─────────────────────────────────────────────────

export function chapterAnalytics(questions: Question[]): ChapterAnalytics[] {
  const map = new Map<string, ChapterAnalytics & { topicSet: Set<string>; yearSet: Set<number> }>()
  for (const q of questions) {
    const key = `${q.subjectId}::${q.chapter}`
    let e = map.get(key)
    if (!e) {
      e = {
        chapter: q.chapter, unit: q.unit, subjectId: q.subjectId, subject: q.subject,
        questionCount: 0, totalMarks: 0, avgMarks: 0, coveragePercentage: 0,
        topicCount: 0, years: [], topicSet: new Set(), yearSet: new Set(),
      }
      map.set(key, e)
    }
    e.questionCount++
    e.totalMarks += (q.marks ?? 0)
    e.topicSet.add(q.topic)
    e.yearSet.add(q.year)
  }
  const total = questions.length || 1
  const out: ChapterAnalytics[] = []
  for (const e of map.values()) {
    out.push({
      chapter: e.chapter, unit: e.unit, subjectId: e.subjectId, subject: e.subject,
      questionCount: e.questionCount, totalMarks: e.totalMarks,
      avgMarks: Number((e.totalMarks / e.questionCount).toFixed(1)),
      coveragePercentage: Number(((e.questionCount / total) * 100).toFixed(1)),
      topicCount: e.topicSet.size,
      years: Array.from(e.yearSet).sort((a, b) => a - b),
    })
  }
  return out.sort((a, b) => b.questionCount - a.questionCount)
}

export function unitAnalytics(questions: Question[]): UnitAnalytics[] {
  const map = new Map<string, UnitAnalytics & { chapterSet: Set<string> }>()
  for (const q of questions) {
    const key = `${q.subjectId}::${q.unit}`
    let e = map.get(key)
    if (!e) {
      e = { unit: q.unit, subjectId: q.subjectId, subject: q.subject, questionCount: 0, totalMarks: 0, coveragePercentage: 0, chapterCount: 0, chapterSet: new Set() }
      map.set(key, e)
    }
    e.questionCount++
    e.totalMarks += (q.marks ?? 0)
    e.chapterSet.add(q.chapter)
  }
  const total = questions.length || 1
  return Array.from(map.values())
    .map((e) => ({
      unit: e.unit, subjectId: e.subjectId, subject: e.subject,
      questionCount: e.questionCount, totalMarks: e.totalMarks,
      coveragePercentage: Number(((e.questionCount / total) * 100).toFixed(1)),
      chapterCount: e.chapterSet.size,
    }))
    .sort((a, b) => b.totalMarks - a.totalMarks)
}

// ── Marks distribution ───────────────────────────────────────────────────────

export interface MarksBucket {
  label: string
  marks: number
  questions: number
}

export function marksByDimension(questions: Question[], dim: 'topic' | 'chapter' | 'unit' | 'questionType' | 'difficulty'): MarksBucket[] {
  const map = new Map<string, { marks: number; questions: number }>()
  for (const q of questions) {
    const label = q[dim]
    const e = map.get(label) ?? { marks: 0, questions: 0 }
    e.marks += (q.marks ?? 0)
    e.questions++
    map.set(label, e)
  }
  return Array.from(map.entries())
    .map(([label, e]) => ({ label, marks: e.marks, questions: e.questions }))
    .sort((a, b) => b.marks - a.marks)
}

export function marksHistogram(questions: Question[]): MarksBucket[] {
  const buckets = [1, 2, 4, 6, 8, 10, 12, 15, 20]
  const map = new Map<number, { marks: number; questions: number }>()
  for (const q of questions) {
    let b = buckets.find((x) => (q.marks ?? 0) <= x) ?? 25
    const e = map.get(b) ?? { marks: 0, questions: 0 }
    e.marks += (q.marks ?? 0)
    e.questions++
    map.set(b, e)
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([k, v]) => ({ label: k === 25 ? '20+' : `≤ ${k}`, marks: v.marks, questions: v.questions }))
}

// ── Trends ───────────────────────────────────────────────────────────────────

export function yearsInScope(questions: Question[]): number[] {
  return Array.from(new Set(questions.map((q) => q.year))).sort((a, b) => a - b)
}

export function trendByYear(questions: Question[]): TrendPoint[] {
  const years = yearsInScope(questions)
  return years.map((year) => {
    const qs = questions.filter((q) => q.year === year)
    return { year, questions: qs.length, marks: qs.reduce((s, q) => s + (q.marks ?? 0), 0) }
  })
}

export function topicTrends(questions: Question[], limit = 12): TopicTrend[] {
  const topics = topicAnalytics(questions, []).slice(0, limit)
  return topics.map((t) => ({
    topic: t.topic,
    subject: t.subject,
    points: t.years.map((year) => {
      const qs = questions.filter((q) => q.year === year && q.topic === t.topic && q.subjectId === t.subjectId)
      return { year, questions: qs.length, marks: qs.reduce((s, q) => s + (q.marks ?? 0), 0) }
    }),
  }))
}

export function difficultyOverTime(questions: Question[]): { year: number; Easy: number; Medium: number; Hard: number }[] {
  return yearsInScope(questions).map((year) => {
    const qs = questions.filter((q) => q.year === year)
    return {
      year,
      Easy: qs.filter((q) => q.difficulty === 'Easy').length,
      Medium: qs.filter((q) => q.difficulty === 'Medium').length,
      Hard: qs.filter((q) => q.difficulty === 'Hard').length,
    }
  })
}

export function unitOverTime(questions: Question[]): { year: number; [unit: string]: number }[] {
  const units = Array.from(new Set(questions.map((q) => q.unit))).slice(0, 6)
  return yearsInScope(questions).map((year) => {
    const row: { year: number; [unit: string]: number } = { year }
    for (const u of units) row[u] = questions.filter((q) => q.year === year && q.unit === u).length
    return row
  })
}

// ── Repetition ───────────────────────────────────────────────────────────────

export function repetitionClusters(questions: Question[], threshold = 0.55): RepetitionCluster[] {
  return buildClusters(questions, threshold)
}

// ── Syllabus coverage ────────────────────────────────────────────────────────

export function syllabusCoverage(
  questions: Question[],
  syllabus: Syllabus | null,
): { rows: CoverageRow[]; covered: number; total: number; percentage: number } {
  if (!syllabus) return { rows: [], covered: 0, total: 0, percentage: 0 }
  const rows: CoverageRow[] = []
  const byTopic = new Map<string, Question[]>()
  for (const q of questions) {
    const list = byTopic.get(q.topic) ?? []
    list.push(q)
    byTopic.set(q.topic, list)
  }
  for (const unit of syllabus.units) {
    const unitLabel = `Unit ${unit.unitNumber}: ${unit.title}`
    for (const chapter of unit.chapters) {
      for (const topic of chapter.topics) {
        const qs = byTopic.get(topic.name) ?? []
        rows.push({
          unit: unitLabel,
          chapter: chapter.name,
          topic: topic.name,
          observed: qs.length > 0,
          questionCount: qs.length,
           totalMarks: qs.reduce((s, q) => s + (q.marks ?? 0), 0),
          lastAppearance: qs.length ? Math.max(...qs.map((q) => q.year)) : null,
          subject: syllabus.subject,
        })
      }
    }
  }
  const covered = rows.filter((r) => r.observed).length
  return { rows, covered, total: rows.length, percentage: rows.length ? Number(((covered / rows.length) * 100).toFixed(1)) : 0 }
}

// ── Dataset overview ─────────────────────────────────────────────────────────

export function datasetOverview(papers: Paper[], questions: Question[]): DatasetOverview {
  const years = Array.from(new Set(papers.map((p) => p.year))).sort((a, b) => a - b)
  const missingYears: number[] = []
  if (years.length > 1) {
    for (let y = years[0]; y <= years[years.length - 1]; y++) if (!years.includes(y)) missingYears.push(y)
  }
  const conf = questions.length
    ? questions.reduce((s, q) => s + q.confidence, 0) / questions.length
    : 0
  return {
    totalPapers: papers.length,
    totalQuestions: questions.length,
    totalSubjects: new Set(papers.map((p) => p.subjectId)).size,
    departments: new Set(papers.map((p) => p.department)).size,
    semestersRepresented: new Set(papers.map((p) => p.semester)).size,
    yearsRepresented: years,
    missingYears,
    demoPapers: papers.filter((p) => p.demo).length,
    userPapers: papers.filter((p) => !p.demo).length,
    needsReviewCount: questions.filter((q) => q.needsReview && !q.confirmed).length,
    avgConfidence: Number(conf.toFixed(2)),
    lowConfidenceCount: questions.filter((q) => q.confidence < 0.5).length,
    extractionWarnings: papers.reduce((n, p) => n + (p.extraction?.warnings.length ?? 0), 0),
    ocrPapers: papers.filter((p) => p.extraction?.ocrUsed).length,
  }
}

// ── Cross-subject concept recurrence ────────────────────────────────────────

export interface ConceptRecurrence {
  concept: string
  subjects: string[]
  questionCount: number
  semesters: number[]
}

const CONCEPT_LEXICON: { concept: string; keywords: string[] }[] = [
  { concept: 'Graph traversal', keywords: ['graph', 'breadth', 'depth', 'traversal', 'adjacency'] },
  { concept: 'Sorting & ordering', keywords: ['sort', 'sorting', 'quicksort', 'mergesort', 'heap'] },
  { concept: 'Probability & statistics', keywords: ['probability', 'bayes', 'distribution', 'variance', 'expectation'] },
  { concept: 'Complexity analysis', keywords: ['complexity', 'worst-case', 'asymptotic', 'bound'] },
  { concept: 'Optimisation & search', keywords: ['optimisation', 'optimization', 'search', 'gradient', 'minimum'] },
  { concept: 'Cryptography & hashing', keywords: ['hash', 'cipher', 'encryption', 'rsa', 'signature'] },
  { concept: 'Databases & transactions', keywords: ['transaction', 'sql', 'normalization', 'index', 'query'] },
  { concept: 'Networks & protocols', keywords: ['protocol', 'routing', 'packet', 'tcp', 'network'] },
  { concept: 'Machine learning models', keywords: ['regression', 'classifier', 'training', 'model', 'features'] },
  { concept: 'Memory & caching', keywords: ['cache', 'memory', 'paging', 'virtual', 'buffer'] },
  { concept: 'Concurrency & scheduling', keywords: ['concurrent', 'deadlock', 'semaphore', 'scheduling', 'process'] },
  { concept: 'Logic & proofs', keywords: ['logic', 'proof', 'induction', 'proposition', 'theorem'] },
]

export function crossSubjectConcepts(questions: Question[], limit = 10): ConceptRecurrence[] {
  const out: ConceptRecurrence[] = []
  for (const { concept, keywords } of CONCEPT_LEXICON) {
    const matches = questions.filter((q) => {
      const t = q.text.toLowerCase() + ' ' + q.topic.toLowerCase() + ' ' + q.subtopic.toLowerCase()
      return keywords.some((k) => t.includes(k))
    })
    const subjects = Array.from(new Set(matches.map((q) => q.subject)))
    if (subjects.length >= 2) {
      out.push({
        concept,
        subjects,
        questionCount: matches.length,
        semesters: Array.from(new Set(matches.map((q) => q.semester))).sort(),
      })
    }
  }
  return out.sort((a, b) => b.subjects.length - a.subjects.length || b.questionCount - a.questionCount).slice(0, limit)
}

// ── Drill-down helpers ───────────────────────────────────────────────────────

export interface SemesterSummary {
  semester: SemesterNumber
  subjects: number
  papers: number
  questions: number
  marks: number
}

/** Per-semester rollup (optionally restricted to a paper set). */
export function semesterAnalytics(questions: Question[], papers?: Paper[]): SemesterSummary[] {
  const map = new Map<number, SemesterSummary>()
  for (let n = 1; n <= 8; n++) map.set(n, { semester: n as SemesterNumber, subjects: 0, papers: 0, questions: 0, marks: 0 })

  for (const q of questions) {
    const e = map.get(q.semester)
    if (!e) continue
    e.questions++
    e.marks += (q.marks ?? 0)
  }
  const subjectSets = new Map<number, Set<string>>()
  const paperSets = new Map<number, Set<string>>()
  for (const q of questions) {
    if (!subjectSets.has(q.semester)) subjectSets.set(q.semester, new Set())
    subjectSets.get(q.semester)!.add(q.subjectId)
    if (!paperSets.has(q.semester)) paperSets.set(q.semester, new Set())
    paperSets.get(q.semester)!.add(q.paperId)
  }
  if (papers) {
    for (const p of papers) {
      const e = map.get(p.semester)
      if (e) {
        e.papers++
        if (!paperSets.has(p.semester)) paperSets.set(p.semester, new Set())
        paperSets.get(p.semester)!.add(p.id)
      }
    }
  } else {
    for (const [sem, set] of paperSets) {
      const e = map.get(sem)
      if (e) e.papers = set.size
    }
  }
  for (const [sem, set] of subjectSets) {
    const e = map.get(sem)
    if (e) e.subjects = set.size
  }
  return Array.from(map.values())
}


export function distinctValues(questions: Question[], key: 'unit' | 'chapter' | 'topic'): string[] {
  return Array.from(new Set(questions.map((q) => q[key]))).sort()
}

export function questionsForTopic(questions: Question[], subjectId: string, topic: string): Question[] {
  return questions.filter((q) => q.subjectId === subjectId && q.topic === topic).sort((a, b) => b.year - a.year)
}

export interface SubjectSummary {
  subject: Subject
  papers: number
  questions: number
  marks: number
  years: number[]
  lastYear: number | null
}

export function subjectSummaries(subjects: Subject[], papers: Paper[], questions: Question[]): SubjectSummary[] {
  return subjects.map((s) => {
    const ps = papers.filter((p) => p.subjectId === s.id)
    const qs = questions.filter((q) => q.subjectId === s.id)
    const years = Array.from(new Set(ps.map((p) => p.year))).sort((a, b) => a - b)
    return {
      subject: s,
      papers: ps.length,
      questions: qs.length,
      marks: qs.reduce((n, q) => n + (q.marks ?? 0), 0),
      years,
      lastYear: years.length ? years[years.length - 1] : null,
    }
  })
}
