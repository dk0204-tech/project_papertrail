import { Paper, Question, DatasetOverview, TopicAnalytics, ChapterAnalytics, CoverageRow } from '../types'

/**
 * Client-side export utilities. Nothing is sent to a server — files are
 * generated in the browser via Blob + object URLs.
 */

function escapeCsv(value: unknown): string {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(escapeCsv).join(',')]
  for (const row of rows) lines.push(row.map(escapeCsv).join(','))
  return lines.join('\n')
}

export function download(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // revoke after the browser has had a chance to start the download
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function exportQuestionsCsv(questions: Question[]) {
  const headers = [
    'Question ID', 'Question Number', 'Sub-question', 'Text', 'Marks', 'Subject', 'Subject Code',
    'Department', 'Semester', 'Year', 'Exam Type', 'Unit', 'Chapter', 'Topic', 'Subtopic',
    'Type', 'Difficulty', 'Cognitive Level', 'Confidence', 'Classification Source',
    'Needs Review', 'Source Page', 'Demo Data',
  ]
  const rows = questions.map((q) => [
    q.id, q.questionNumber, q.subQuestion ?? '', q.text, q.marks, q.subject, q.subjectCode,
    q.department, q.semester, q.year, q.examType, q.unit, q.chapter, q.topic, q.subtopic,
    q.questionType, q.difficulty, q.cognitiveLevel, q.confidence, q.classificationSource,
    q.needsReview ? 'yes' : 'no', q.sourcePage, q.demo ? 'yes' : 'no',
  ])
  download('papertrail_questions.csv', toCsv(headers, rows), 'text/csv;charset=utf-8')
}

export function exportTopicsCsv(topics: TopicAnalytics[]) {
  const headers = [
    'Topic', 'Subject', 'Unit', 'Chapter', 'Questions', 'Papers Containing', 'Years Represented',
    'Total Marks', 'Avg Marks', 'Recurrence %', 'Last Appearance', 'Consecutive Appearances',
  ]
  const rows = topics.map((t) => [
    t.topic, t.subject, t.unit, t.chapter, t.totalQuestions, t.papersContaining,
    t.yearsRepresented, t.totalMarks, t.avgMarks, t.frequencyPercentage,
    t.lastAppearance ?? '', t.consecutiveAppearances,
  ])
  download('papertrail_topics.csv', toCsv(headers, rows), 'text/csv;charset=utf-8')
}

export function exportChaptersCsv(chapters: ChapterAnalytics[]) {
  const headers = ['Chapter', 'Subject', 'Unit', 'Questions', 'Total Marks', 'Avg Marks', 'Coverage %', 'Topics']
  const rows = chapters.map((c) => [c.chapter, c.subject, c.unit, c.questionCount, c.totalMarks, c.avgMarks, c.coveragePercentage, c.topicCount])
  download('papertrail_chapters.csv', toCsv(headers, rows), 'text/csv;charset=utf-8')
}

export function exportCoverageCsv(rows: CoverageRow[]) {
  const headers = ['Subject', 'Unit', 'Chapter', 'Topic', 'Observed In Uploaded Papers', 'Questions', 'Marks', 'Last Appearance']
  const rowsOut = rows.map((r) => [r.subject, r.unit, r.chapter, r.topic, r.observed ? 'observed' : 'not observed in the uploaded papers', r.questionCount, r.totalMarks, r.lastAppearance ?? ''])
  download('papertrail_coverage.csv', toCsv(headers, rowsOut), 'text/csv;charset=utf-8')
}

export interface ReportPayload {
  generatedAt: string
  overview: DatasetOverview
  disclaimer: string
  filters: Record<string, unknown>
  topics: TopicAnalytics[]
  chapters: ChapterAnalytics[]
  coverage: CoverageRow[]
  limitations: string[]
}

export function exportReportJson(payload: ReportPayload) {
  download('papertrail_report.json', JSON.stringify(payload, null, 2), 'application/json')
}

export function exportPapersCsv(papers: Paper[]) {
  const headers = ['Paper ID', 'Title', 'Subject', 'Code', 'Department', 'Semester', 'Year', 'Exam Type', 'Session', 'Max Marks', 'Questions', 'Status', 'Filename', 'Demo']
  const rows = papers.map((p) => [p.id, p.title, p.subject, p.subjectCode, p.department, p.semester, p.year, p.examType, p.session, p.maxMarks, p.questionCount, p.status, p.filename, p.demo ? 'yes' : 'no'])
  download('papertrail_papers.csv', toCsv(headers, rows), 'text/csv;charset=utf-8')
}

/** Print-friendly report — opens the print dialog (browser can save as PDF). */
export function printReport() {
  window.print()
}
