import { useMemo } from 'react'
import { usePaperTrail } from '../store/PaperTrailStore'
import {
  applyFilters,
  applyPaperFilters,
  chapterAnalytics,
  crossSubjectConcepts,
  datasetOverview,
  difficultyOverTime,
  marksByDimension,
  marksHistogram,
  repetitionClusters,
  subjectSummaries,
  syllabusCoverage,
  topicAnalytics,
  topicTrends,
  trendByYear,
  unitAnalytics,
  unitOverTime,
} from '../services/analyticsEngine'
import { FilterState, Paper, Question } from '../types'

/**
 * Single memoised entry point for analytics pages: gives the filtered
 * question/paper sets plus every derived aggregate, all recomputed together
 * whenever the dataset or filters change. Components never compute their own
 * numbers — they render what this hook returns.
 */
export function useAnalytics() {
  const store = usePaperTrail()
  const { papers: allPapers, questions: allQuestions, filters, subjects, syllabi } = store

  const questions: Question[] = useMemo(() => applyFilters(allQuestions, filters), [allQuestions, filters])
  const papers: Paper[] = useMemo(() => applyPaperFilters(allPapers, filters), [allPapers, filters])

  const topics = useMemo(() => topicAnalytics(questions, papers), [questions, papers])
  const chapters = useMemo(() => chapterAnalytics(questions), [questions])
  const units = useMemo(() => unitAnalytics(questions), [questions])
  const trends = useMemo(() => trendByYear(questions), [questions])
  const topicTrendList = useMemo(() => topicTrends(questions, 14), [questions])
  const difficultyTrend = useMemo(() => difficultyOverTime(questions), [questions])
  const unitTrend = useMemo(() => unitOverTime(questions), [questions])
  const clusters = useMemo(() => repetitionClusters(questions, 0.55), [questions])
  const overview = useMemo(() => datasetOverview(papers, questions), [papers, questions])
  const marksByTopic = useMemo(() => marksByDimension(questions, 'topic'), [questions])
  const marksByChapter = useMemo(() => marksByDimension(questions, 'chapter'), [questions])
  const marksByUnit = useMemo(() => marksByDimension(questions, 'unit'), [questions])
  const marksByType = useMemo(() => marksByDimension(questions, 'questionType'), [questions])
  const marksByDifficulty = useMemo(() => marksByDimension(questions, 'difficulty'), [questions])
  const marksBySemester = useMemo(() => marksByDimension(questions.map((q) => ({ ...q, questionType: `Semester ${q.semester}` }) as unknown as Question), 'questionType'), [questions])
  const marksBySubject = useMemo(() => marksByDimension(questions.map((q) => ({ ...q, questionType: q.subject }) as unknown as Question), 'questionType'), [questions])
  const marksHistogramData = useMemo(() => marksHistogram(questions), [questions])
  const concepts = useMemo(() => crossSubjectConcepts(questions), [questions])
  const subjectSummary = useMemo(() => subjectSummaries(subjects, papers, questions), [subjects, papers, questions])

  /** Coverage is computed per selected subject (syllabus is subject-scoped). */
  const coverage = useMemo(() => {
    if (filters.subjectId !== 'All') {
      return syllabusCoverage(questions, syllabi[filters.subjectId] ?? null)
    }
    // aggregate coverage across all in-scope subjects that have a syllabus
    const ids = Array.from(new Set(questions.map((q) => q.subjectId)))
    const rows = ids.flatMap((id) => syllabusCoverage(questions.filter((q) => q.subjectId === id), syllabi[id] ?? null).rows)
    const covered = rows.filter((r) => r.observed).length
    return { rows, covered, total: rows.length, percentage: rows.length ? Number(((covered / rows.length) * 100).toFixed(1)) : 0 }
  }, [questions, filters.subjectId, syllabi])

  const totalMarks = useMemo(() => questions.reduce((s, q) => s + (q.marks ?? 0), 0), [questions])

  const filtersActive = (Object.keys(filters) as (keyof FilterState)[]).some((k) => filters[k] !== 'All')

  return {
    filters,
    filtersActive,
    questions,
    papers,
    subjects,
    overview,
    topics,
    chapters,
    units,
    trends,
    topicTrends: topicTrendList,
    difficultyTrend,
    unitTrend,
    clusters,
    marks: {
      byTopic: marksByTopic,
      byChapter: marksByChapter,
      byUnit: marksByUnit,
      byType: marksByType,
      byDifficulty: marksByDifficulty,
      bySemester: marksBySemester,
      bySubject: marksBySubject,
      histogram: marksHistogramData,
      total: totalMarks,
    },
    coverage,
    concepts,
    subjectSummary,
    store,
  }
}
