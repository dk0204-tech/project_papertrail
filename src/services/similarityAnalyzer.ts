import { Question, RepetitionCluster } from '../types'

/**
 * Token-based similarity. Explicitly NOT a semantic/embedding model — the UI
 * and report must describe it as "text similarity (Jaccard on normalised
 * tokens)" so we never imply AI we haven't built.
 */

const NORMALISE_MAP: [RegExp, string][] = [
  [/\bprogram(me|ming)?\b/g, 'program'],
  [/\balgorithm(s)?\b/g, 'algorithm'],
  [/\bexplain\b/g, 'describe'],
  [/\bdescribe\b/g, 'describe'],
  [/\bconstruct\b/g, 'create'],
  [/\bcreate\b/g, 'create'],
  [/\bexample(s)?\b/g, 'example'],
  [/\bwrite\b/g, 'write'],
  [/\bderive\b/g, 'derive'],
  [/\bprove\b/g, 'prove'],
  [/\busing\b/g, 'use'],
  [/\bwith\b/g, 'use'],
  [/\banalyse\b|\banalyze\b/g, 'analyse'],
]

const STOP = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'for', 'on', 'is', 'are',
  'by', 'as', 'at', 'be', 'it', 'its', 'that', 'this', 'from', 'into', 'given',
  'following', 'state', 'list', 'short', 'long', 'answer', 'question',
])

export function normaliseText(text: string): string {
  let t = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
  for (const [re, rep] of NORMALISE_MAP) t = t.replace(re, rep)
  return t.replace(/\s+/g, ' ').trim()
}

export function contentTokens(text: string): Set<string> {
  const norm = normaliseText(text)
  const tokens = new Set<string>()
  for (const w of norm.split(' ')) {
    if (w.length > 2 && !STOP.has(w)) tokens.add(w)
  }
  // also add bigrams for better structural sensitivity
  const words = Array.from(tokens)
  for (let i = 0; i < words.length - 1; i++) tokens.add(`${words[i]}_${words[i + 1]}`)
  return tokens
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  a.forEach((t) => {
    if (b.has(t)) inter++
  })
  return inter / (a.size + b.size - inter)
}

function sharedTerms(a: Set<string>, b: Set<string>, limit = 5): string[] {
  const shared: string[] = []
  a.forEach((t) => {
    if (b.has(t) && !t.includes('_')) shared.push(t)
  })
  return shared.slice(0, limit)
}

function firstDifference(x: string, y: string): string {
  const wx = normaliseText(x).split(' ')
  const wy = normaliseText(y).split(' ')
  for (let i = 0; i < Math.max(wx.length, wy.length); i++) {
    if (wx[i] !== wy[i]) {
      const a = wx.slice(Math.max(0, i - 3), i + 4).join(' ')
      const b = wy.slice(Math.max(0, i - 3), i + 4).join(' ')
      return `"…${a}…" vs "…${b}…"`
    }
  }
  return 'wording matches almost exactly'
}

export interface PairScore {
  a: Question
  b: Question
  score: number
}

/** All pairs above threshold, restricted to same-subject comparisons. */
export function scorePairs(questions: Question[], threshold = 0.55): PairScore[] {
  const bySubject = new Map<string, Question[]>()
  for (const q of questions) {
    const list = bySubject.get(q.subjectId) ?? []
    list.push(q)
    bySubject.set(q.subjectId, list)
  }

  const pairs: PairScore[] = []
  const tokenCache = new Map<string, Set<string>>()
  const tokensOf = (q: Question) => {
    let t = tokenCache.get(q.id)
    if (!t) {
      t = contentTokens(q.text)
      tokenCache.set(q.id, t)
    }
    return t
  }

  for (const list of bySubject.values()) {
    // Bucket by shared first token to keep this O(n·k) rather than O(n²).
    const buckets = new Map<string, Question[]>()
    for (const q of list) {
      for (const t of tokensOf(q)) {
        const bucket = buckets.get(t) ?? []
        bucket.push(q)
        buckets.set(t, bucket)
      }
    }
    const seen = new Set<string>()
    for (const bucket of buckets.values()) {
      if (bucket.length < 2 || bucket.length > 60) continue
      for (let i = 0; i < bucket.length; i++) {
        for (let j = i + 1; j < bucket.length; j++) {
          const a = bucket[i]
          const b = bucket[j]
          const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`
          if (seen.has(key)) continue
          seen.add(key)
          const score = jaccard(tokensOf(a), tokensOf(b))
          if (score >= threshold) pairs.push({ a, b, score })
        }
      }
    }
  }
  return pairs.sort((x, y) => y.score - x.score)
}

/** Greedy clustering of similar pairs into groups. */
export function buildClusters(questions: Question[], threshold = 0.55): RepetitionCluster[] {
  const pairs = scorePairs(questions, threshold)
  const parent = new Map<string, string>()
  const find = (id: string): string => {
    let root = id
    while (parent.get(root) && parent.get(root) !== root) root = parent.get(root)!
    if (!parent.has(id)) parent.set(id, root)
    return root
  }
  const union = (x: string, y: string) => {
    const rx = find(x)
    const ry = find(y)
    if (rx !== ry) parent.set(rx, ry)
  }
  for (const q of questions) parent.set(q.id, q.id)
  for (const p of pairs) union(p.a.id, p.b.id)

  const groups = new Map<string, { questions: Question[]; best: number; terms: Set<string> }>()
  const tokenCache = new Map<string, Set<string>>()
  const tokensOf = (q: Question) => {
    let t = tokenCache.get(q.id)
    if (!t) {
      t = contentTokens(q.text)
      tokenCache.set(q.id, t)
    }
    return t
  }

  for (const p of pairs) {
    const root = find(p.a.id)
    const g = groups.get(root) ?? { questions: [], best: 0, terms: new Set<string>() }
    if (!g.questions.includes(p.a)) g.questions.push(p.a)
    if (!g.questions.includes(p.b)) g.questions.push(p.b)
    g.best = Math.max(g.best, p.score)
    sharedTerms(tokensOf(p.a), tokensOf(p.b)).forEach((t) => g.terms.add(t))
    groups.set(root, g)
  }

  const clusters: RepetitionCluster[] = []
  let n = 0
  for (const [, g] of groups) {
    if (g.questions.length < 2) continue
    n++
    const years = Array.from(new Set(g.questions.map((q) => q.year))).sort()
    const top = g.questions[0]
    const kind: RepetitionCluster['kind'] =
      g.best >= 0.95 ? 'exact' : g.best >= 0.78 ? 'near-identical' : g.best >= 0.62 ? 'similar-structure' : 'same-topic-variant'

    const sorted = [...g.questions].sort((a, b) => a.year - b.year)
    const diff = firstDifference(sorted[0].text, sorted[sorted.length - 1].text)

    clusters.push({
      id: `cluster-${n}`,
      title:
        kind === 'exact'
          ? `Verbatim repeat: "${top.text.slice(0, 64)}${top.text.length > 64 ? '…' : ''}"`
          : `${top.topic} — recurring question structure`,
      topic: top.topic,
      subject: top.subject,
      similarity: Number(g.best.toFixed(2)),
      kind,
      questions: sorted,
      sharedTerms: Array.from(g.terms).slice(0, 6),
      explanation: `Text similarity (Jaccard on normalised tokens) = ${g.best.toFixed(2)} across ${years.join(', ')}. Main wording difference: ${diff}.`,
    })
  }

  return clusters.sort((a, b) => b.similarity - a.similarity)
}
