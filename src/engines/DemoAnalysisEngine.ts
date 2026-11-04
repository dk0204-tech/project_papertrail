import { QuestionAnalysisEngine } from './QuestionAnalysisEngine'
import { buildDemoDataset } from '../data/demoDataset'
import { classifyQuestion } from '../services/topicClassifier'
import { DEMO_SYLLABI } from '../data/demoSyllabus'

/**
 * DemoAnalysisEngine — serves the bundled illustrative dataset so the product
 * can be explored before any paper is uploaded. Every object it returns is
 * flagged `demo: true` and carries the ILLUSTRATIVE DEMO DATA disclaimer.
 */
export const DemoAnalysisEngine: QuestionAnalysisEngine = {
  id: 'demo-illustrative',
  label: 'Illustrative demo dataset',
  description:
    'Bundled fictional papers across all 8 semesters, generated deterministically to demonstrate the analytics. Not real MIT Manipal examination data.',

  async extract(): Promise<never> {
    throw new Error('The demo engine does not extract documents — upload a paper to use the local engine.')
  },

  classify(text, syllabus, context) {
    return classifyQuestion(text, syllabus, {
      subject: context.subject,
      unit: context.unit ?? 'Unassigned',
      chapter: context.chapter ?? 'Unassigned',
      topic: context.topic ?? 'Unclassified',
      subtopic: context.subtopic ?? '',
    })
  },

  async buildQuestions() {
    return buildDemoDataset().questions
  },
}

export function demoSyllabusFor(subjectId: string) {
  return DEMO_SYLLABI[subjectId] ?? null
}
