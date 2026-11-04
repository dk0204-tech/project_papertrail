import { ExamType, Paper, Question, SemesterNumber, Subject } from '../types'
import { classifyQuestion } from './topicClassifier'
import { PageText } from './pdfExtraction'

/**
 * Heuristic question-structure parser.
 *
 * Recognises the numbering conventions used in Indian university question
 * papers:
 *   1.  Q1.  1)  (1)  1) a)  Q1(a)  1. [4]  1. (4 marks)
 * and preserves the hierarchy: question → subquestion.
 *
 * Anything it cannot parse confidently is either dropped with a warning or
 * flagged for review — never silently invented.
 */

export interface ParsedQuestion {
  questionNumber: string
  subQuestion?: string
  text: string
  marks: number | null
  pageNumber: number
}

const Q_START =
  /^\s*(?:Q(?:uestion)?\s*)?(\d{1,2})\s*[\.\)\:\-]\s*(?:\[\s*(\d{1,2})\s*(?:marks?)?\s*\]|\((\d{1,2})\s*(?:marks?|m)?\))?/i

const SUB_START = /^\s*(?:\(([a-j])\)|([a-j])[\.\)])\s*(?:\[\s*(\d{1,2})\s*\]|\((\d{1,2})\s*(?:marks?|m)?\))?/i

const TRAILING_MARKS =
  /\s*(?:\[|\()\s*(\d{1,2})\s*(?:marks?|m)?\s*(?:\]|\))\s*$/i

const MARKS_ONLY_LINE = /^\s*(?:\[|\()\s*(\d{1,2})\s*(?:marks?|m)?\s*(?:\]|\))\s*$/i

const NOISE_LINES = [
  /^\s*(manipal institute of technology|mit manipal|department of)/i,
  /^\s*(page\s*\d+|p\.\s*\d+)/i,
  /^\s*(time\s*(?:duration)?\s*:|total\s*(?:marks|pages)\s*:)/i,
  /^\s*(signature|invigilator|roll\s*no)/i,
  /^\s*\d+\s*\/\s*\d+\s*$/,
]

function isNoise(line: string): boolean {
  return NOISE_LINES.some((re) => re.test(line))
}

function looksLikeNewQuestion(line: string): boolean {
  return Q_START.test(line) && /^\s*(?:Q(?:uestion)?\s*)?\d{1,2}[\.\)\:\-]/.test(line)
}

/**
 * Extract questions from per-page extracted text.
 * Returns parsed questions plus human-readable warnings.
 */
export function parseQuestionsFromPages(
  pages: PageText[],
): { questions: ParsedQuestion[]; warnings: string[] } {
  const warnings: string[] = []
  const results: ParsedQuestion[] = []

  // Join pages but remember where each page starts so sourcePage is accurate.
  const segments: { page: number; lines: string[] }[] = pages
    .filter((p) => p.text.length > 0)
    .map((p) => ({ page: p.pageNumber, lines: p.text.split(/\r?\n/) }))

  if (segments.length === 0) {
    warnings.push('No extractable text was found in this document.')
    return { questions: [], warnings }
  }

  let current: ParsedQuestion | null = null
  let currentSub: string | null = null
  let buffer: string[] = []
  let sawAnyNumbering = false

  const flush = () => {
    if (current) {
      const text = buffer.join(' ').replace(/\s+/g, ' ').trim()
      if (text.length > 0) {
        current.text = text
        results.push(current)
      }
    }
    current = null
    currentSub = null
    buffer = []
  }

  for (const seg of segments) {
    for (const rawLine of seg.lines) {
      const line = rawLine.trim()
      if (!line) continue
      if (isNoise(line)) continue

      const qMatch = line.match(Q_START)
      if (qMatch && looksLikeNewQuestion(line)) {
        sawAnyNumbering = true
        flush()
        const num = qMatch[1]
        const marks = qMatch[2] ?? qMatch[3] ?? null
        let rest = line.replace(Q_START, '').trim()
        // "1. a) text" — subquestion on the same line
        const inlineSub = rest.match(SUB_START)
        if (inlineSub) {
          currentSub = inlineSub[1] ?? inlineSub[2] ?? null
          rest = rest.replace(SUB_START, '').trim()
          const inlineMarks = inlineSub[3] ?? inlineSub[4]
          current = {
            questionNumber: `Q${num}`,
            subQuestion: currentSub ?? undefined,
            text: '',
            marks: inlineMarks ? Number(inlineMarks) : marks ? Number(marks) : null,
            pageNumber: seg.page,
          }
        } else {
          current = {
            questionNumber: `Q${num}`,
            text: '',
            marks: marks ? Number(marks) : null,
            pageNumber: seg.page,
          }
        }
        if (rest) buffer.push(rest)
        continue
      }

      if (!current) continue

      const sMatch = line.match(SUB_START)
      if (sMatch) {
        sawAnyNumbering = true
        // Flush the parent question text accumulated so far as its own entry
        // when it already has content (parent question without subquestions).
        if (buffer.length > 0 && !current.subQuestion) {
          const parentText = buffer.join(' ').replace(/\s+/g, ' ').trim()
          if (parentText.length > 10) {
            results.push({ ...current, text: parentText })
          }
        }
        const inlineMarks = sMatch[3] ?? sMatch[4]
        current = {
          questionNumber: current.questionNumber,
          subQuestion: sMatch[1] ?? sMatch[2],
          text: '',
          marks: inlineMarks ? Number(inlineMarks) : current.marks,
          pageNumber: seg.page,
        }
        buffer = []
        const rest = line.replace(SUB_START, '').trim()
        if (rest) buffer.push(rest)
        continue
      }

      const marksOnly = line.match(MARKS_ONLY_LINE)
      if (marksOnly && current && current.marks === null && buffer.length > 0) {
        current.marks = Number(marksOnly[1])
        continue
      }

      buffer.push(line)
    }
    // Page boundary: don't flush — questions may span pages.
  }
  flush()

  if (results.length === 0) {
    warnings.push(
      sawAnyNumbering
        ? 'Question numbering was detected but could not be parsed into complete questions.'
        : 'No question numbering (e.g. "1." or "Q1)") was detected in the extracted text. The document may be scanned or use an unsupported layout — questions can be added manually in the review step.',
    )
  }

  // Second pass: pull marks out of trailing "[8]" / "(8 marks)" patterns.
  for (const q of results) {
    if (q.marks === null) {
      const m = q.text.match(TRAILING_MARKS)
      if (m) {
        q.marks = Number(m[1])
        q.text = q.text.replace(TRAILING_MARKS, '').trim()
      }
    }
    // Trim trailing section markers like "SECTION A" bleeding into text.
    q.text = q.text.replace(/\s*SECTION\s+[A-D]\s*$/i, '').trim()
    if (q.text.length < 8) q.text = q.text + ' …'
  }

  return { questions: results, warnings }
}

/** Attach classification + paper metadata to produce store-ready questions. */
export function materializeQuestions(
  parsed: ParsedQuestion[],
  paper: Paper,
  subject: Subject,
  syllabus: import('../types').Syllabus | null,
): Question[] {
  return parsed.map((p, i) => {
    const cls = classifyQuestion(p.text, syllabus, {
      subject: subject.name,
      unit: 'Unassigned',
      chapter: 'Unassigned',
      topic: 'Unclassified',
      subtopic: '',
    })
    return {
      id: `${paper.id}-p${i + 1}`,
      paperId: paper.id,
      subjectId: subject.id,
      subject: subject.name,
      subjectCode: subject.code,
      department: subject.department,
      programme: subject.programme,
      semester: subject.semester as SemesterNumber,
      year: paper.year,
      examType: paper.examType as ExamType,
      questionNumber: p.questionNumber,
      subQuestion: p.subQuestion,
      text: p.text,
      marks: p.marks ?? null,
      unit: cls.unit,
      chapter: cls.chapter,
      topic: cls.topic,
      subtopic: cls.subtopic,
      questionType: cls.questionType,
      difficulty: cls.difficulty,
      cognitiveLevel: cls.cognitiveLevel,
      confidence: cls.confidence,
      classificationSource: cls.source,
      matchedKeywords: cls.matchedKeywords,
      explanation: cls.explanation,
      needsReview: cls.needsReview || p.marks === null,
      confirmed: false,
      sourcePage: p.pageNumber,
      demo: paper.demo,
    }
  })
}
