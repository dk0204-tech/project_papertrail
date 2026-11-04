import {
  ClassificationSource,
  CognitiveLevel,
  Difficulty,
  Question,
  QuestionType,
  Syllabus,
} from '../types'
import { flattenSyllabus, SyllabusLeaf } from '../data/demoSyllabus'

/**
 * LocalAnalysisEngine's classification core.
 *
 * This is an EXPLAINABLE KEYWORD/TOKEN MATCHER — not an AI model. Every
 * prediction carries the matched keywords and a human-readable reason, and
 * low-confidence results are flagged for manual review rather than silently
 * accepted.
 */

export interface ClassificationResult {
  unit: string
  chapter: string
  topic: string
  subtopic: string
  questionType: QuestionType
  difficulty: Difficulty
  cognitiveLevel: CognitiveLevel
  confidence: number
  matchedKeywords: string[]
  explanation: string
  source: ClassificationSource
  needsReview: boolean
  /** runner-up topics, surfaced in the review UI */
  alternatives: { topic: string; chapter: string; unit: string; score: number }[]
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'for', 'with', 'on', 'is',
  'are', 'by', 'as', 'at', 'be', 'it', 'its', 'that', 'this', 'from', 'into',
  'using', 'use', 'used', 'write', 'explain', 'describe', 'define', 'list',
  'state', 'give', 'show', 'discuss', 'compare', 'derive', 'prove', 'solve',
  'compute', 'find', 'construct', 'implement', 'apply', 'analyse', 'analyze',
  'question', 'following', 'suitable', 'example', 'short', 'long', 'answer',
])

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s+#]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t))
}

function stem(token: string): string {
  // light heuristic stemmer — enough to match plurals/gerunds
  return token
    .replace(/(ies)$/, 'y')
    .replace(/(ing)$/, '')
    .replace(/(ers|er|es|s)$/, '')
    .replace(/(ed)$/, '')
}

export interface SyllabusEntry {
  leaf: SyllabusLeaf
  tokens: Set<string>
  weight: number
}

let entryCache = new WeakMap<Syllabus, SyllabusEntry[]>()

function buildEntries(syllabus: Syllabus): SyllabusEntry[] {
  const cached = entryCache.get(syllabus)
  if (cached) return cached

  const leaves = flattenSyllabus(syllabus)
  const entries: SyllabusEntry[] = leaves.map((leaf) => {
    // Topic and subtopic names are the strongest signal; chapter/unit weaker.
    const strong = tokenize(`${leaf.topic} ${leaf.subtopic}`)
    const weak = tokenize(`${leaf.chapter} ${leaf.unit}`)
    const tokens = new Set([...strong, ...weak].map(stem))
    const weight = strong.length > 0 ? 1 : 0.4
    return { leaf, tokens, weight }
  })
  entryCache.set(syllabus, entries)
  return entries
}

function scoreEntry(entry: SyllabusEntry, query: Set<string>): number {
  let hits = 0
  query.forEach((t) => {
    if (entry.tokens.has(t)) hits++
  })
  if (hits === 0) return 0
  // Recall over the question's content tokens, scaled by entry strength.
  const recall = hits / Math.max(1, Math.min(query.size, 8))
  // A single strong hit on a distinctive topic name should not be drowned out.
  const precisionBoost = Math.min(1, hits / 2.5)
  return Math.min(1, (recall * 0.55 + precisionBoost * 0.45) * entry.weight * 1.35)
}

function classifyType(text: string): QuestionType {
  const t = text.toLowerCase()
  if (/\b(write|implement|program|function|code)\b/.test(t) && /\b(c|c\+\+|python|java|pseudocode)\b/.test(t)) return 'Programming'
  if (/\b(write|implement|program|function|code|algorithm to)\b/.test(t)) return 'Programming'
  if (/\b(derive|derivation|starting from first principles)\b/.test(t)) return 'Derivation'
  if (/\b(prove|proof|show that|correctness)\b/.test(t)) return 'Proof'
  if (/\b(compute|calculate|numerical|worked example|solve a numerical|apply .* data|given data)\b/.test(t)) return 'Numerical'
  if (/\b(compare|contrast|difference between)\b/.test(t)) return 'Theory'
  if (/\b(state|list|mention|define|what is|mention two)\b/.test(t)) return 'Short Answer'
  if (/\b(critically evaluate|in detail|long answer|discuss .* with special reference)\b/.test(t)) return 'Long Answer'
  if (/\b(explain|describe|discuss)\b/.test(t)) return 'Theory'
  if (/\b(apply|scenario|practical problem)\b/.test(t)) return 'Application'
  return 'Theory'
}

function classifyDifficulty(text: string, type: QuestionType): Difficulty {
  const t = text.toLowerCase()
  const hard = /\b(worst-case|analyse|analyze|critically|prove|derive|complexity|efficient|trade-off|large instances|formal)\b/.test(t)
  const easy = /\b(state|list|mention|define|two applications|prerequisites)\b/.test(t)
  if (hard || type === 'Proof' || type === 'Derivation') return 'Hard'
  if (easy || type === 'Short Answer') return 'Easy'
  if (type === 'Long Answer' || type === 'Programming') return 'Medium'
  return 'Medium'
}

function classifyCognitive(text: string, difficulty: Difficulty): CognitiveLevel {
  const t = text.toLowerCase()
  if (/\b(prove|derive|critically|analyse|analyze|why the naive|trade-off)\b/.test(t)) return 'Analysis'
  if (/\b(apply|implement|compute|solve|construct|apply .* scenario)\b/.test(t)) return 'Application'
  if (/\b(explain|describe|discuss|compare|how|working of)\b/.test(t)) return 'Understanding'
  if (difficulty === 'Easy') return 'Recall'
  return 'Understanding'
}

export function classifyQuestion(
  text: string,
  syllabus: Syllabus | null,
  fallback: { subject: string; unit: string; chapter: string; topic: string; subtopic: string },
): ClassificationResult {
  const questionType = classifyType(text)
  const difficulty = classifyDifficulty(text, questionType)
  const cognitiveLevel = classifyCognitive(text, difficulty)

  if (!syllabus || syllabus.units.length === 0) {
    return {
      unit: fallback.unit,
      chapter: fallback.chapter,
      topic: fallback.topic,
      subtopic: fallback.subtopic,
      questionType,
      difficulty,
      cognitiveLevel,
      confidence: 0.2,
      matchedKeywords: [],
      explanation:
        'No syllabus provided for this subject — provisional classification based on subject-level defaults. Provide a syllabus to improve accuracy.',
      source: 'keyword-provisional',
      needsReview: true,
      alternatives: [],
    }
  }

  const entries = buildEntries(syllabus)
  const queryTokens = new Set(tokenize(text).map(stem))
  const scored = entries
    .map((e) => ({ entry: e, score: scoreEntry(e, queryTokens) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0 || entries.length === 0) {
    const first = entries[0]
    return {
      unit: first ? `Unit ${first.leaf.unit.split(':')[0].replace('Unit ', '')}: ${first.leaf.unit.split(': ').slice(1).join(': ')}` : fallback.unit || 'Unit 1: Unassigned',
      chapter: first?.leaf.chapter || fallback.chapter || 'Unassigned',
      topic: first?.leaf.topic || fallback.topic || 'Unclassified',
      subtopic: first?.leaf.subtopic || fallback.subtopic || '',
      questionType,
      difficulty,
      cognitiveLevel,
      confidence: 0.15,
      matchedKeywords: [],
      explanation:
        'No syllabus keyword matched this question text or syllabus is empty. Please classify manually.',
      source: 'keyword-provisional',
      needsReview: true,
      alternatives: [],
    }
  }

  const best = scored[0]
  const leaf = best.entry.leaf
  const matched = tokenize(text)
    .map(stem)
    .filter((t) => best.entry.tokens.has(t))
  const uniqueMatched = Array.from(new Set(matched)).slice(0, 6)

  // Confidence: absolute score, tempered by how clearly it beat the runner-up.
  const runnerUp = scored[1]?.score ?? 0
  const margin = best.score - runnerUp
  let confidence = Math.min(0.99, 0.35 + best.score * 0.55 + Math.min(0.15, margin * 0.5))
  if (confidence < 0.35) confidence = 0.35

  const alternatives = scored.slice(1, 4).map((s) => ({
    topic: s.entry.leaf.topic,
    chapter: s.entry.leaf.chapter,
    unit: s.entry.leaf.unit,
    score: Number(s.score.toFixed(2)),
  }))

  const needsReview = confidence < 0.62 || runnerUp > best.score * 0.85

  const reason = needsReview
    ? `Matched syllabus keywords ${uniqueMatched.map((k) => `"${k}"`).join(', ')} but a competing topic scored nearly as well — please confirm.`
    : `Matched syllabus keywords ${uniqueMatched.map((k) => `"${k}"`).join(', ')} under ${leaf.topic}.`

  return {
    unit: leaf.unit,
    chapter: leaf.chapter,
    topic: leaf.topic,
    subtopic: leaf.subtopic,
    questionType,
    difficulty,
    cognitiveLevel,
    confidence: Number(confidence.toFixed(2)),
    matchedKeywords: uniqueMatched,
    explanation: reason,
    source: 'syllabus-match',
    needsReview,
    alternatives,
  }
}

/** Re-classify after the syllabus or question text changes. */
export function applyClassification(
  q: Question,
  syllabus: Syllabus | null,
  opts: { keepManual?: boolean } = {},
): Question {
  if (opts.keepManual && q.classificationSource === 'manual') return q
  const result = classifyQuestion(q.text, syllabus, {
    subject: q.subject,
    unit: q.unit,
    chapter: q.chapter,
    topic: q.topic,
    subtopic: q.subtopic,
  })
  return {
    ...q,
    unit: result.unit,
    chapter: result.chapter,
    topic: result.topic,
    subtopic: result.subtopic,
    questionType: result.questionType,
    difficulty: result.difficulty,
    cognitiveLevel: result.cognitiveLevel,
    confidence: result.confidence,
    classificationSource: result.source,
    matchedKeywords: result.matchedKeywords,
    explanation: result.explanation,
    needsReview: result.needsReview && !q.confirmed,
  }
}
