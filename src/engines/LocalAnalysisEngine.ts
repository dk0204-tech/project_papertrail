import { QuestionAnalysisEngine, BuildInput, ClassifyContext } from './QuestionAnalysisEngine'
import { extractPdfText, PageText } from '../services/pdfExtraction'
import { classifyQuestion, ClassificationResult } from '../services/topicClassifier'
import { parseQuestionsFromPages, materializeQuestions } from '../services/questionParser'
import { Question } from '../types'

/**
 * LocalAnalysisEngine — the v1 production engine.
 *
 * Runs entirely in the browser: PDF.js for text extraction, heuristic
 * structure parsing, explainable syllabus-keyword classification. No network
 * calls, no uploaded files, no API keys.
 */
export const LocalAnalysisEngine: QuestionAnalysisEngine = {
  id: 'local-heuristic',
  label: 'Local heuristic engine',
  description:
    'Extracts text with PDF.js, parses question numbering with layout heuristics, and classifies against your syllabus using explainable keyword matching. Runs entirely in your browser — no AI model is involved.',

  async extract(file: File, onProgress?: (page: number, total: number) => void): Promise<PageText[]> {
    const result = await extractPdfText(file, onProgress)
    return result.pages
  },

  classify(text: string, syllabus, context: ClassifyContext): ClassificationResult {
    return classifyQuestion(text, syllabus, {
      subject: context.subject,
      unit: context.unit ?? 'Unassigned',
      chapter: context.chapter ?? 'Unassigned',
      topic: context.topic ?? 'Unclassified',
      subtopic: context.subtopic ?? '',
    })
  },

  async buildQuestions(input: BuildInput): Promise<Question[]> {
    const { questions, warnings } = parseQuestionsFromPages(input.pages)
    const materialized = materializeQuestions(questions, input.paper, input.subjectMeta as any, input.syllabus)
    if (warnings.length > 0 && input.paper.extraction) {
      input.paper.extraction = { ...input.paper.extraction, warnings: [...input.paper.extraction.warnings, ...warnings] }
    }
    return materialized
  },
}
