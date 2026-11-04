import { ExamType, Paper, Question, SemesterNumber, Subject } from '../types'
import { DEMO_SUBJECTS } from './demoSubjects'
import { DEMO_SYLLABI, flattenSyllabus, SyllabusLeaf } from './demoSyllabus'

/**
 * ILLUSTRATIVE DEMO DATA — NOT VERIFIED OFFICIAL EXAM STATISTICS.
 *
 * A deterministic (seeded) generator so the demo dataset is identical on every
 * load without shipping megabytes of literals. Nothing here claims to represent
 * real MIT Manipal examination papers or real examination patterns.
 */

// ── Seeded PRNG ──────────────────────────────────────────────────────────────

function hashSeed(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Rng = () => number
const pick = <T,>(rng: Rng, arr: T[]): T => arr[Math.floor(rng() * arr.length)]
const int = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1))

// ── Papers ───────────────────────────────────────────────────────────────────

const YEARS = [2022, 2023, 2024, 2025, 2026]

const MONTHS: Record<ExamType, string> = {
  Midterm: 'March',
  Endterm: 'May',
  Makeup: 'July',
  Internal: 'October',
  Supplementary: 'December',
}

function buildPaper(subject: Subject, year: number, examType: ExamType, index: number): Paper {
  const rng = mulberry32(hashSeed(`${subject.id}-${year}-${examType}`))
  const session = `${MONTHS[examType]} ${year}`
  const id = `demo-${subject.id}-${year}-${examType.toLowerCase()}`
  return {
    id,
    subjectId: subject.id,
    title: `${subject.name} ${examType} Examination ${year}`,
    subject: subject.name,
    subjectCode: subject.code,
    department: subject.department,
    programme: subject.programme,
    semester: subject.semester,
    year,
    examType,
    session,
    maxMarks: examType === 'Midterm' || examType === 'Internal' ? 50 : 100,
    scheme: subject.scheme,
    filename: `DEMO_${subject.code}_${examType}_${year}.pdf`,
    status: 'Analysis complete',
    questionCount: 0,
    uploadDate: `${year}-${examType === 'Midterm' ? '03-20' : '05-25'}`,
    fileSize: `${(0.4 + rng() * 1.4).toFixed(1)} MB`,
    pageCount: examType === 'Midterm' ? int(rng, 3, 4) : int(rng, 4, 6),
    demo: true,
    extraction: {
      textPages: examType === 'Midterm' ? int(rng, 3, 4) : int(rng, 4, 6),
      scannedPages: 0,
      ocrUsed: false,
      charsExtracted: int(rng, 4200, 9800),
      warnings: [],
    },
  }
}

/**
 * Not every subject has a full 5-year × 2-session history — deliberately, so
 * "missing years / incomplete coverage" analysis has something real to show.
 */
function buildPapersForSubject(subject: Subject): Paper[] {
  const rng = mulberry32(hashSeed(`papers-${subject.id}`))
  const papers: Paper[] = []
  for (const year of YEARS) {
    const hasMid = rng() > 0.25
    const hasEnd = rng() > 0.12
    const hasSupp = rng() > 0.35
    const hasInt = rng() > 0.30
    if (hasEnd) papers.push(buildPaper(subject, year, 'Endterm', papers.length))
    if (hasMid) papers.push(buildPaper(subject, year, 'Midterm', papers.length))
    if (hasSupp) papers.push(buildPaper(subject, year, 'Supplementary', papers.length))
    if (hasInt) papers.push(buildPaper(subject, year, 'Internal', papers.length))
  }
  if (rng() > 0.50) {
    const year = pick(rng, YEARS)
    papers.push(buildPaper(subject, year, 'Makeup', papers.length))
  }
  return papers
}

// ── Question generation ──────────────────────────────────────────────────────

interface Template {
  type: Question['questionType']
  difficulty: Question['difficulty']
  cognitive: Question['cognitiveLevel']
  patterns: string[]
}

const TEMPLATES: Template[] = [
  {
    type: 'Theory',
    difficulty: 'Easy',
    cognitive: 'Recall',
    patterns: [
      'Define {topic} and list its key characteristics.',
      'What is {subtopic}? State its significance in the context of {chapter}.',
      'Explain the basic idea behind {topic} with a short example.',
    ],
  },
  {
    type: 'Theory',
    difficulty: 'Medium',
    cognitive: 'Understanding',
    patterns: [
      'Explain {subtopic} in detail and discuss how it supports {topic}.',
      'Compare the role of {subtopic} with other techniques used for {topic}.',
      'Describe the working of {subtopic} and outline the steps involved in {topic}.',
    ],
  },
  {
    type: 'Numerical',
    difficulty: 'Medium',
    cognitive: 'Application',
    patterns: [
      'A system processes records using {subtopic}. Compute the resulting output and show all steps involved in {topic}.',
      'Given suitable data, apply {subtopic} to solve an instance of {topic}. Verify your answer.',
      'Work out a numerical example for {subtopic} within {topic}, justifying each intermediate step.',
    ],
  },
  {
    type: 'Numerical',
    difficulty: 'Hard',
    cognitive: 'Analysis',
    patterns: [
      'Analyse the behaviour of {subtopic} under worst-case conditions for {topic} and derive the resulting bound.',
      'Construct a complete example where {subtopic} must be applied to {topic}, then analyse why the naive approach fails.',
    ],
  },
  {
    type: 'Programming',
    difficulty: 'Medium',
    cognitive: 'Application',
    patterns: [
      'Write a program to implement {subtopic} for {topic}. Include test cases.',
      'Implement {subtopic} in C/C++ and demonstrate its use on {topic} with sample input.',
    ],
  },
  {
    type: 'Programming',
    difficulty: 'Hard',
    cognitive: 'Analysis',
    patterns: [
      'Design an efficient program that applies {subtopic} to handle large instances of {topic}; analyse its complexity.',
    ],
  },
  {
    type: 'Derivation',
    difficulty: 'Hard',
    cognitive: 'Analysis',
    patterns: [
      'Derive the expression governing {subtopic} as used in {topic}, stating every assumption.',
      'Starting from first principles, derive the result for {subtopic} in {topic}.',
    ],
  },
  {
    type: 'Short Answer',
    difficulty: 'Easy',
    cognitive: 'Recall',
    patterns: [
      'State two applications of {subtopic} in {topic}.',
      'List the prerequisites of {subtopic} used across {topic}.',
      'Mention one advantage and one limitation of {subtopic}.',
    ],
  },
  {
    type: 'Long Answer',
    difficulty: 'Hard',
    cognitive: 'Analysis',
    patterns: [
      'Critically evaluate {subtopic} within {topic}. Discuss limitations, alternatives and a worked example.',
      'Discuss {topic} with special reference to {subtopic}, covering design decisions and trade-offs.',
    ],
  },
  {
    type: 'Application',
    difficulty: 'Medium',
    cognitive: 'Application',
    patterns: [
      'Apply {subtopic} to the following scenario drawn from {chapter} and justify your solution.',
      'Using {topic}, solve a practical problem that requires {subtopic}.',
    ],
  },
  {
    type: 'Proof',
    difficulty: 'Hard',
    cognitive: 'Analysis',
    patterns: [
      'Prove that {subtopic} holds under the stated conditions of {topic}.',
      'Give a formal proof of correctness for {subtopic} used in {topic}.',
    ],
  },
]

const MARKS_BY_TYPE: Record<Question['questionType'], number[]> = {
  Theory: [4, 5, 6, 8],
  Numerical: [6, 8, 10, 12],
  Programming: [8, 10, 12, 15],
  Derivation: [8, 10, 12],
  Proof: [8, 10],
  Application: [6, 8, 10],
  'Short Answer': [2, 3, 4],
  'Long Answer': [10, 12, 15],
}

function formatQuestion(
  pattern: string,
  leaf: SyllabusLeaf,
  chapter: string,
): string {
  return pattern
    .split('{topic}').join(leaf.topic.toLowerCase())
    .split('{subtopic}').join(leaf.subtopic || leaf.topic)
    .split('{chapter}').join(chapter)
}

function buildQuestionsForPaper(
  paper: Paper,
  subject: Subject,
  leaves: SyllabusLeaf[],
  chapterOf: Map<string, string>,
): Question[] {
  const rng = mulberry32(hashSeed(`q-${paper.id}`))
  const count = paper.examType === 'Midterm' ? int(rng, 6, 8) : int(rng, 9, 12)
  const questions: Question[] = []
  const used = new Set<number>()

  // Weight topics: some syllabus topics recur far more often than others —
  // this is what makes frequency analysis meaningful in demo mode.
  const weights = leaves.map((_, i) => {
    const r = mulberry32(hashSeed(`w-${paper.subjectId}-${i}`))()
    return 0.25 + r * r * 3
  })
  const weightedPool: number[] = []
  leaves.forEach((_, i) => {
    const n = Math.max(1, Math.round(weights[i] * 4))
    for (let k = 0; k < n; k++) weightedPool.push(i)
  })

  for (let n = 1; n <= count; n++) {
    let leafIdx = pick(rng, weightedPool)
    let guard = 0
    while (used.has(leafIdx) && guard++ < 12) leafIdx = pick(rng, weightedPool)
    used.add(leafIdx)
    const leaf = leaves[leafIdx]
    const template = pick(rng, TEMPLATES)
    const text = formatQuestion(pick(rng, template.patterns), leaf, chapterOf.get(leaf.topic) ?? leaf.chapter)

    // Occasionally produce an exact repeat of an earlier question (real papers
    // do repeat questions verbatim across sections/years).
    const text2 = rng() > 0.94 && questions.length > 1
      ? pick(rng, questions).text
      : text

    const marks = pick(rng, MARKS_BY_TYPE[template.type])

    questions.push({
      id: `${paper.id}-q${n}`,
      paperId: paper.id,
      subjectId: subject.id,
      subject: subject.name,
      subjectCode: subject.code,
      department: subject.department,
      programme: subject.programme,
      semester: subject.semester as SemesterNumber,
      year: paper.year,
      examType: paper.examType,
      questionNumber: `Q${n}`,
      subQuestion: rng() > 0.55 ? pick(rng, ['a', 'b', 'c']) : undefined,
      text: text2,
      marks,
      unit: leaf.unit,
      chapter: leaf.chapter,
      topic: leaf.topic,
      subtopic: leaf.subtopic,
      questionType: template.type,
      difficulty: template.difficulty,
      cognitiveLevel: template.cognitive,
      confidence: 0,
      classificationSource: 'syllabus-match',
      matchedKeywords: [],
      explanation: '',
      needsReview: false,
      confirmed: true,
      sourcePage: int(rng, 1, paper.pageCount ?? 4),
      demo: true,
    })
  }

  return questions
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface DemoDataset {
  subjects: Subject[]
  papers: Paper[]
  questions: Question[]
}

let cached: DemoDataset | null = null

export function buildDemoDataset(): DemoDataset {
  if (cached) return cached

  const papers: Paper[] = []
  const questions: Question[] = []

  for (const subject of DEMO_SUBJECTS) {
    const syllabus = DEMO_SYLLABI[subject.id]
    if (!syllabus) continue
    const leaves = flattenSyllabus(syllabus)
    const chapterOf = new Map<string, string>()
    leaves.forEach((l) => chapterOf.set(l.topic, l.chapter))

    const subjectPapers = buildPapersForSubject(subject)
    for (const paper of subjectPapers) {
      const qs = buildQuestionsForPaper(paper, subject, leaves, chapterOf)
      paper.questionCount = qs.length
      papers.push(paper)
      questions.push(...qs)
    }
  }

  cached = { subjects: DEMO_SUBJECTS, papers, questions }
  return cached
}
