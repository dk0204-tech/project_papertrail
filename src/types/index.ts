// ─────────────────────────────────────────────────────────────────────────────
// PaperTrail — Academic data model
// Hierarchy: MIT Manipal → Programme → Department → Semester 1–8 → Subject
//            → Examination → Question Paper → Question
//            Syllabus: Subject → Unit → Chapter → Topic → Subtopic
// ─────────────────────────────────────────────────────────────────────────────

export type SemesterNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export type ExamType = 'Midterm' | 'Endterm' | 'Makeup' | 'Internal' | 'Supplementary'

export type CourseType = 'Core' | 'Elective' | 'Laboratory' | 'Humanities' | 'Project'

export type QuestionType =
  | 'Theory'
  | 'Numerical'
  | 'Programming'
  | 'Derivation'
  | 'Proof'
  | 'Application'
  | 'Short Answer'
  | 'Long Answer'

export type Difficulty = 'Easy' | 'Medium' | 'Hard'

export type CognitiveLevel = 'Recall' | 'Understanding' | 'Application' | 'Analysis'

export type PaperStatus =
  | 'Uploaded'
  | 'Extracting text'
  | 'Parsing questions'
  | 'Mapping topics'
  | 'Needs review'
  | 'Analysis complete'
  | 'Processing failed'

/** How a question's classification was produced — surfaced honestly in the UI. */
export type ClassificationSource = 'syllabus-match' | 'keyword-provisional' | 'manual'

// ── Academic structure ───────────────────────────────────────────────────────

export interface Subject {
  id: string
  name: string
  code: string
  department: string
  programme: string
  semester: SemesterNumber
  courseType: CourseType
  credits?: number
  /** Illustrative only — not an official MIT Manipal scheme reference. */
  scheme: string
}

export interface Paper {
  id: string
  subjectId: string
  title: string
  subject: string
  subjectCode: string
  department: string
  programme: string
  semester: SemesterNumber
  year: number
  examType: ExamType
  session: string
  maxMarks: number
  scheme: string
  filename: string
  status: PaperStatus
  questionCount: number
  uploadDate: string
  fileSize: string
  pageCount?: number
  /** true for bundled illustrative demo papers */
  demo: boolean
  /** extraction diagnostics — honest reporting of what actually happened */
  extraction?: ExtractionDiagnostics
}

export interface ExtractionDiagnostics {
  textPages: number
  scannedPages: number
  ocrUsed: boolean
  ocrConfidence?: number
  charsExtracted: number
  warnings: string[]
}

export interface Question {
  id: string
  paperId: string
  subjectId: string
  subject: string
  subjectCode: string
  department: string
  programme: string
  semester: SemesterNumber
  year: number
  examType: ExamType
  questionNumber: string
  subQuestion?: string
  text: string
  marks: number | null
  // syllabus classification
  unit: string
  chapter: string
  topic: string
  subtopic: string
  questionType: QuestionType
  difficulty: Difficulty
  cognitiveLevel: CognitiveLevel
  /** 0–1 explainable heuristic score */
  confidence: number
  classificationSource: ClassificationSource
  matchedKeywords: string[]
  explanation: string
  needsReview: boolean
  confirmed: boolean
  sourcePage: number
  demo: boolean
}

// ── Syllabus ─────────────────────────────────────────────────────────────────

export interface SyllabusTopic {
  name: string
  subTopics: string[]
}

export interface SyllabusChapter {
  name: string
  topics: SyllabusTopic[]
}

export interface SyllabusUnit {
  unitNumber: number
  title: string
  chapters: SyllabusChapter[]
}

export interface Syllabus {
  subjectId: string
  subject: string
  subjectCode: string
  department: string
  programme: string
  semester: SemesterNumber
  /** where the structure came from — never claim official provenance */
  provenance: 'demo-illustrative' | 'user-upload' | 'user-manual'
  units: SyllabusUnit[]
}

// ── Global filters ───────────────────────────────────────────────────────────

export interface FilterState {
  department: string | 'All'
  programme: string | 'All'
  academicYear: number | 'All'
  semester: SemesterNumber | 'All'
  subjectId: string | 'All'
  examType: ExamType | 'All'
  unit: string | 'All'
  chapter: string | 'All'
  topic: string | 'All'
}

export const DEFAULT_FILTERS: FilterState = {
  department: 'All',
  programme: 'All',
  academicYear: 'All',
  semester: 'All',
  subjectId: 'All',
  examType: 'All',
  unit: 'All',
  chapter: 'All',
  topic: 'All',
}

// ── Analytics result shapes ──────────────────────────────────────────────────

export interface TopicAnalytics {
  topic: string
  chapter: string
  unit: string
  subjectId: string
  subject: string
  totalQuestions: number
  papersContaining: number
  yearsRepresented: number
  totalMarks: number
  avgMarks: number
  /** % of in-scope papers containing this topic */
  frequencyPercentage: number
  years: number[]
  lastAppearance: number | null
  consecutiveAppearances: number
  difficultyBreakdown: Record<Difficulty, number>
  typeBreakdown: Record<string, number>
}

export interface ChapterAnalytics {
  chapter: string
  unit: string
  subjectId: string
  subject: string
  questionCount: number
  totalMarks: number
  avgMarks: number
  coveragePercentage: number
  topicCount: number
  years: number[]
}

export interface UnitAnalytics {
  unit: string
  subjectId: string
  subject: string
  questionCount: number
  totalMarks: number
  coveragePercentage: number
  chapterCount: number
}

export interface TrendPoint {
  year: number
  questions: number
  marks: number
}

export interface TopicTrend {
  topic: string
  subject: string
  points: TrendPoint[]
}

export interface RepetitionCluster {
  id: string
  title: string
  topic: string
  subject: string
  similarity: number
  kind: 'exact' | 'near-identical' | 'similar-structure' | 'same-topic-variant'
  questions: Question[]
  /** top shared tokens that drove the score — explainable, not black-box */
  sharedTerms: string[]
  explanation: string
}

export interface CoverageRow {
  unit: string
  chapter: string
  topic: string
  observed: boolean
  questionCount: number
  totalMarks: number
  lastAppearance: number | null
  subject: string
}

export interface DatasetOverview {
  totalPapers: number
  totalQuestions: number
  totalSubjects: number
  departments: number
  semestersRepresented: number
  yearsRepresented: number[]
  missingYears: number[]
  demoPapers: number
  userPapers: number
  needsReviewCount: number
  avgConfidence: number
  lowConfidenceCount: number
  extractionWarnings: number
  ocrPapers: number
}

export interface FilterOption {
  label: string
  value: string
}

export interface PYQResearchRecord {
  id: string
  subjectId: string
  subjectName: string
  subjectCode: string | null
  programme: string
  department: string
  semester: number
  regulation: string | null
  academicYear: string | null
  examType: string | null
  originalFileName: string
  originalSourceUrl: string
  sourceTitle: string
  sourceType: string
  verificationStatus: 'verified' | 'needs_review' | 'unverified'
  pageCount: number | null
  fileHash: string
}
