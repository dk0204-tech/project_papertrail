import { Paper, Question, Syllabus } from '../types'
import { ClassificationResult } from '../services/topicClassifier'
import { PageText } from '../services/pdfExtraction'

/**
 * The pluggable analysis-engine contract.
 *
 * v1 ships DemoAnalysisEngine (bundled illustrative dataset) and
 * LocalAnalysisEngine (browser-side PDF parsing + heuristic classification).
 * A future AI-backed engine can implement this same interface — including the
 * `explain()` requirement — without any frontend rewrite. Engines must never
 * claim capabilities they do not have: every result is labelled with how it was
 * produced.
 */
export interface QuestionAnalysisEngine {
  readonly id: string
  readonly label: string
  /** Honest one-line description shown in the UI. */
  readonly description: string

  /** Extract raw page text from an uploaded file. */
  extract(file: File, onProgress?: (page: number, total: number) => void): Promise<PageText[]>

  /** Classify a single question against a syllabus. */
  classify(text: string, syllabus: Syllabus | null, context: ClassifyContext): ClassificationResult

  /** Build store-ready questions from an extraction result. */
  buildQuestions(input: BuildInput): Promise<Question[]>
}

export interface ClassifyContext {
  subject: string
  unit?: string
  chapter?: string
  topic?: string
  subtopic?: string
}

export interface BuildInput {
  paper: Paper
  pages: PageText[]
  syllabus: Syllabus | null
  subjectMeta: {
    id: string
    name: string
    code: string
    department: string
    programme: string
    semester: Paper['semester']
  }
}

/**
 * Placeholder for a future server-side or hosted LLM classifier. Not
 * implemented in v1 — declared so the integration surface is explicit.
 */
export interface FutureAIAnalysisEngine extends QuestionAnalysisEngine {
  readonly apiKeyConfigured: boolean
  /** Returns null when no model is available; callers must fall back. */
  classifyWithModel(text: string, syllabus: Syllabus | null): Promise<ClassificationResult | null>
}
