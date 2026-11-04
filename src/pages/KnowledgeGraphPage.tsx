import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Network, Search } from 'lucide-react'
import { useAnalytics } from '../hooks/useAnalytics'
import { usePaperTrail } from '../store/PaperTrailStore'
import {
  Badge, Card, ConfidenceBadge, DemoBadge, EmptyState, Modal, PageHeader,
  SectionTitle, Stat, TableWrap, Td, Th, truncate,
} from '../components/ui'
import { FilterBar } from '../components/FilterBar'
import { ConceptRecurrence } from '../services/analyticsEngine'
import { Question } from '../types'

// ── Hierarchy model ──────────────────────────────────────────────────────────

type Level = 'Semester' | 'Subject' | 'Unit' | 'Topic'

const LEVELS: Level[] = ['Semester', 'Subject', 'Unit', 'Topic']
const LEVEL_COLORS = ['#172554', '#5478A8', '#B8B5E8', '#C6A76B']
const MAX_NODES = 400

const depthOf = (l: Level): number => LEVELS.indexOf(l) + 1

interface TreeNode {
  id: string
  path: string[]
  label: string
  full: string
  link: string
  count: number
  /** only set on aggregate "+N more" nodes */
  merged?: number
  children: Map<string, TreeNode>
}

interface FlatNode {
  node: TreeNode
  parent: TreeNode
  depth: number
}

const stepsFor = (q: Question, maxDepth: number) =>
  [
    {
      key: `sem-${q.semester}`,
      label: `Sem ${q.semester}`,
      full: `Semester ${q.semester}`,
      link: `/questions?semester=${q.semester}`,
    },
    {
      key: `sub-${q.subjectId}`,
      label: truncate(q.subject, 18),
      full: q.subject,
      link: `/questions?subject=${encodeURIComponent(q.subjectId)}`,
    },
    {
      key: `unit-${q.unit}`,
      label: truncate(q.unit.includes(':') ? q.unit.split(':')[0] : q.unit, 18),
      full: q.unit,
      link: `/questions?unit=${encodeURIComponent(q.unit)}`,
    },
    {
      key: `topic-${q.topic}`,
      label: truncate(q.topic, 18),
      full: q.topic,
      link: `/questions?topic=${encodeURIComponent(q.topic)}`,
    },
  ].slice(0, maxDepth)

function buildTree(questions: Question[], maxDepth: number): TreeNode {
  const root: TreeNode = {
    id: 'root',
    path: [],
    label: 'root',
    full: 'All questions in scope',
    link: '/questions',
    count: 0,
    children: new Map(),
  }
  for (const q of questions) {
    let node = root
    for (const s of stepsFor(q, maxDepth)) {
      let child = node.children.get(s.key)
      if (!child) {
        child = {
          id: `${node.id}/${s.key}`,
          path: [...node.path, s.key],
          label: s.label,
          full: s.full,
          link: s.link,
          count: 0,
          children: new Map(),
        }
        node.children.set(s.key, child)
      }
      child.count++
      node = child
    }
  }
  return root
}

function countNodes(root: TreeNode): number {
  let n = 0
  for (const c of root.children.values()) n += 1 + countNodes(c)
  return n
}

/**
 * Keep the canvas under MAX_NODES by merging the smallest deepest-level
 * entries into a per-parent "+N more" aggregate node (never drops a question).
 */
function aggregateDeepest(root: TreeNode, maxDepth: number, levelName: string) {
  if (countNodes(root) <= MAX_NODES) return
  const deepest: { node: TreeNode; parent: TreeNode }[] = []
  const walk = (n: TreeNode, depth: number) => {
    for (const c of n.children.values()) {
      if (depth + 1 === maxDepth) deepest.push({ node: c, parent: n })
      else walk(c, depth + 1)
    }
  }
  walk(root, 0)

  const aggs = new Map<string, { agg: TreeNode; parent: TreeNode }>()
  const sorted = [...deepest].sort((a, b) => a.node.count - b.node.count)
  for (const { node, parent } of sorted) {
    if (countNodes(root) <= MAX_NODES) break
    if (parent.children.size <= 1) continue
    let entry = aggs.get(parent.id)
    if (!entry) {
      const agg: TreeNode = {
        id: `${parent.id}/more`,
        path: [...parent.path, 'more'],
        label: '+ more',
        full: `Additional ${levelName.toLowerCase()} entries aggregated to keep the view under ${MAX_NODES} nodes.`,
        link: '/questions',
        count: 0,
        merged: 0,
        children: new Map(),
      }
      parent.children.set('more', agg)
      entry = { agg, parent }
      aggs.set(parent.id, entry)
    }
    parent.children.delete(node.id.slice(parent.id.length + 1))
    entry.agg.count += node.count
    entry.agg.merged = (entry.agg.merged ?? 0) + 1
    entry.agg.label = `+${entry.agg.merged} more`
    entry.agg.full = `${entry.agg.merged} further ${levelName.toLowerCase()} entries aggregated to keep the view under ${MAX_NODES} nodes — lower the hierarchy level or tighten the filters to see them individually.`
  }
}

function flatten(root: TreeNode): FlatNode[] {
  const out: FlatNode[] = []
  const walk = (n: TreeNode, depth: number) => {
    for (const c of n.children.values()) {
      out.push({ node: c, parent: n, depth: depth + 1 })
      walk(c, depth + 1)
    }
  }
  walk(root, 0)
  return out
}

interface Pos {
  x: number
  y: number
  angle: number
}

/** Deterministic radial (tiered) layout — no physics, no randomness. */
function layoutTree(root: TreeNode, w: number, h: number, maxDepth: number): Map<TreeNode, Pos> {
  const positions = new Map<TreeNode, Pos>()
  const weights = new Map<TreeNode, number>()
  const weightOf = (n: TreeNode): number => {
    if (n.children.size === 0) {
      weights.set(n, 1)
      return 1
    }
    let s = 0
    for (const c of n.children.values()) s += weightOf(c)
    weights.set(n, s || 1)
    return s || 1
  }
  weightOf(root)

  const cx = w / 2
  const cy = h / 2
  const R = Math.max(70, Math.min(w, h) / 2 - 58)
  const start = -Math.PI / 2

  const walk = (n: TreeNode, a0: number, a1: number, depth: number) => {
    const mid = (a0 + a1) / 2
    const radius = depth === 0 ? 0 : (depth / maxDepth) * R
    positions.set(n, { x: cx + radius * Math.cos(mid), y: cy + radius * Math.sin(mid), angle: mid })
    const kids = Array.from(n.children.values())
    if (kids.length === 0) return
    const total = kids.reduce((s, k) => s + (weights.get(k) ?? 1), 0) || 1
    let a = a0
    for (const k of kids) {
      const span = (a1 - a0) * ((weights.get(k) ?? 1) / total)
      walk(k, a, a + span, depth + 1)
      a += span
    }
  }
  walk(root, start, start + Math.PI * 2, 0)
  return positions
}

// ── Cross-subject concept keyword list ───────────────────────────────────────
// Mirrors CONCEPT_LEXICON in src/services/analyticsEngine.ts (crossSubjectConcepts)
// so the provenance modal can show the exact questions that produced each row.
const CONCEPT_KEYWORDS: Record<string, string[]> = {
  'Graph traversal': ['graph', 'breadth', 'depth', 'traversal', 'adjacency'],
  'Sorting & ordering': ['sort', 'sorting', 'quicksort', 'mergesort', 'heap'],
  'Probability & statistics': ['probability', 'bayes', 'distribution', 'variance', 'expectation'],
  'Complexity analysis': ['complexity', 'worst-case', 'asymptotic', 'bound'],
  'Optimisation & search': ['optimisation', 'optimization', 'search', 'gradient', 'minimum'],
  'Cryptography & hashing': ['hash', 'cipher', 'encryption', 'rsa', 'signature'],
  'Databases & transactions': ['transaction', 'sql', 'normalization', 'index', 'query'],
  'Networks & protocols': ['protocol', 'routing', 'packet', 'tcp', 'network'],
  'Machine learning models': ['regression', 'classifier', 'training', 'model', 'features'],
  'Memory & caching': ['cache', 'memory', 'paging', 'virtual', 'buffer'],
  'Concurrency & scheduling': ['concurrent', 'deadlock', 'semaphore', 'scheduling', 'process'],
  'Logic & proofs': ['logic', 'proof', 'induction', 'proposition', 'theorem'],
}

// ── Page ─────────────────────────────────────────────────────────────────────

export const KnowledgeGraphPage: React.FC = () => {
  const { questions, papers, concepts, filtersActive, store } = useAnalytics()

  const [level, setLevel] = useState<Level>('Topic')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [conceptSel, setConceptSel] = useState<ConceptRecurrence | null>(null)
  const [size, setSize] = useState({ w: 900, h: 560 })

  const wrapRef = useRef<HTMLDivElement>(null)

  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const hasDemo = useMemo(() => questions.some((q) => q.demo), [questions])
  const maxDepth = depthOf(level)

  const tree = useMemo(() => {
    const root = buildTree(questions, maxDepth)
    aggregateDeepest(root, maxDepth, level)
    return root
  }, [questions, maxDepth, level])

  const flat = useMemo(() => flatten(tree), [tree])

  const positions = useMemo(() => layoutTree(tree, size.w, size.h, maxDepth), [tree, size, maxDepth])

  const maxCount = useMemo(() => (flat.length ? Math.max(...flat.map((f) => f.node.count)) : 1), [flat])
  const dense = flat.length > 150
  const radiusOf = (count: number) => {
    const t = maxCount > 0 ? Math.sqrt(count / maxCount) : 1
    return dense ? 3.5 + 8 * t : 5 + 13 * t
  }

  const selected = useMemo(() => flat.find((f) => f.node.id === selectedId) ?? null, [flat, selectedId])

  const focusId = hoverId ?? selectedId
  const connectedIds = useMemo(() => {
    const set = new Set<string>()
    if (!focusId) return set
    set.add(focusId)
    const f = flat.find((x) => x.node.id === focusId)
    if (f) {
      set.add(f.parent.id)
      for (const key of f.node.children.keys()) set.add(`${f.node.id}/${key}`)
    }
    return set
  }, [flat, focusId])

  const matches = useMemo(() => {
    const s = query.trim().toLowerCase()
    if (!s) return []
    return flat
      .filter(
        (f) =>
          f.node.full.toLowerCase().includes(s) ||
          f.node.label.toLowerCase().includes(s) ||
          f.node.path.join(' ').toLowerCase().includes(s),
      )
      .slice(0, 8)
  }, [flat, query])

  const nodeQuestions = useMemo(() => {
    if (!selected) return []
    const path = selected.node.path
    return questions
      .filter((q) => {
        const qp = stepsFor(q, maxDepth).map((s) => s.key)
        return path.every((k, i) => qp[i] === k)
      })
      .sort((a, b) => b.year - a.year || (b.marks ?? 0) - (a.marks ?? 0))
  }, [questions, selected, maxDepth])

  const connected = useMemo(() => {
    if (!selected) return []
    const out: { node: TreeNode; depth: number; kind: string }[] = []
    if (selected.parent.path.length > 0) {
      out.push({ node: selected.parent, depth: selected.depth - 1, kind: 'Parent' })
    }
    for (const c of selected.node.children.values()) {
      out.push({ node: c, depth: selected.depth + 1, kind: 'Child' })
    }
    return out
  }, [selected])

  const siblings = useMemo(() => {
    if (!selected || selected.node.children.size > 0) return []
    return flat
      .filter((f) => f.parent.id === selected.parent.id && f.node.id !== selected.node.id)
      .slice(0, 14)
  }, [flat, selected])

  const focusNode = (id: string) => {
    setSelectedId(id)
    setQuery('')
  }

  // Responsive canvas
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = (w: number, h: number) =>
      setSize((prev) =>
        Math.abs(prev.w - w) > 1 || Math.abs(prev.h - h) > 1 ? { w, h } : prev,
      )
    update(el.clientWidth, el.clientHeight)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      update(r.width, r.height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const conceptQuestions = useMemo(() => {
    if (!conceptSel) return []
    const kws = CONCEPT_KEYWORDS[conceptSel.concept] ?? []
    return questions
      .filter((q) => {
        const t = `${q.text} ${q.topic} ${q.subtopic}`.toLowerCase()
        return kws.some((k) => t.includes(k))
      })
      .sort((a, b) => b.year - a.year)
  }, [conceptSel, questions])

  const levelName = LEVELS[maxDepth - 1]

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Analytics · Knowledge graph"
          title="Academic knowledge graph"
          description="Semester → subject → unit → topic structure derived from the uploaded questions."
        />
        <EmptyState
          icon={Network}
          title="No questions match the current filters"
          description={
            filtersActive
              ? 'The active filters exclude every question in the dataset. Clear some filters, or upload papers for this scope.'
              : 'There are no questions in the dataset yet. Upload question papers or enable the illustrative demo dataset in Settings.'
          }
          action={{ label: 'Upload papers', to: '/upload' }}
          secondaryAction={
            filtersActive ? (
              <button className="btn-ghost" onClick={store.resetFilters}>
                Clear filters
              </button>
            ) : undefined
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Analytics · Knowledge graph"
        title="Academic knowledge graph"
        description="An interactive map of the syllabus structure behind the papers in scope — semester to subject to unit to topic, sized by how many questions sit under each node."
        demo={hasDemo}
        actions={
          <>
            <Link to="/analytics/topics" className="btn-ghost !py-2.5 !text-[13px]">
              Topic frequency
            </Link>
            <Link to="/questions" className="btn-primary !py-2.5 !text-[13px]">
              Open question explorer
            </Link>
          </>
        }
      />

      <FilterBar />

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Nodes in view" value={flat.length} sub={`hierarchy level: ${levelName}`} icon={Network} />
        <Stat
          label="Relationships"
          value={flat.length}
          sub="parent → child links from syllabus classification"
          icon={Search}
          accent="academic"
        />
        <Stat
          label="Questions mapped"
          value={questions.length}
          sub={`${papers.length} papers in scope`}
          icon={Network}
          accent="gold"
        />
        <Stat
          label="Levels shown"
          value={maxDepth}
          sub={LEVELS.slice(0, maxDepth).join(' → ')}
          icon={Network}
          accent="lavender"
        />
      </div>

      <SectionTitle
        kicker="Structure"
        title="Semester → subject → unit → topic"
        description="Relationships are derived from the syllabus classification of the uploaded questions. Select a node to inspect its connections and the questions behind it."
        right={hasDemo ? <DemoBadge /> : undefined}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Canvas */}
        <Card className="p-5 md:p-6 xl:col-span-2">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">
                Level
              </span>
              {LEVELS.map((l) => (
                <button
                  key={l}
                  onClick={() => {
                    setLevel(l)
                    setSelectedId(null)
                  }}
                  aria-pressed={level === l}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-grotesk font-medium transition-all ${
                    level === l
                      ? 'border-navy bg-navy text-ivory-100'
                      : 'border-ivory-300 bg-white text-graphite-600 hover:border-graphite-400'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            <div className="relative md:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Focus a node…"
                aria-label="Search graph nodes"
                className="field pl-9"
              />
              {query.trim() !== '' && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-ivory-300 bg-white shadow-lift2">
                  {matches.length === 0 ? (
                    <p className="px-3 py-2.5 text-xs text-graphite-500">No node matches that search.</p>
                  ) : (
                    matches.map((m) => (
                      <button
                        key={m.node.id}
                        onClick={() => focusNode(m.node.id)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-ivory-100 focus:outline-none focus-visible:bg-ivory-100"
                      >
                        <span className="truncate text-graphite-700">{m.node.full}</span>
                        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-graphite-400">
                          {LEVELS[m.depth - 1]} · {m.node.count}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {LEVELS.slice(0, maxDepth).map((l, i) => (
              <span
                key={l}
                className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500"
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: LEVEL_COLORS[i] }}
                />
                {l}
              </span>
            ))}
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-400">
              node size = question count · line = syllabus hierarchy
            </span>
          </div>

          <div ref={wrapRef} className="relative h-[440px] w-full overflow-hidden rounded-xl border border-ivory-200 bg-ivory-50 sm:h-[560px]">
            <svg
              viewBox={`0 0 ${size.w} ${size.h}`}
              width="100%"
              height="100%"
              role="group"
              aria-label="Academic knowledge graph: semester to subject to unit to topic"
              className="select-none"
            >
              {/* edges */}
              <g>
                {flat.map((f) => {
                  const from = positions.get(f.parent)
                  const to = positions.get(f.node)
                  if (!from || !to) return null
                  const active = connectedIds.has(f.node.id) && connectedIds.has(f.parent.id)
                  return (
                    <line
                      key={`e-${f.node.id}`}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={active ? '#172554' : '#D4CFC3'}
                      strokeWidth={active ? 1.8 : 1}
                      style={{ transition: reduceMotion ? 'none' : 'stroke 0.25s ease, stroke-width 0.25s ease' }}
                    />
                  )
                })}
              </g>

              {/* nodes */}
              <g>
                {flat.map((f) => {
                  const pos = positions.get(f.node)
                  if (!pos) return null
                  const r = radiusOf(f.node.count)
                  const isSel = f.node.id === selectedId
                  const isHov = f.node.id === hoverId
                  const inFocus = connectedIds.size === 0 || connectedIds.has(f.node.id)
                  const cos = Math.cos(pos.angle)
                  const sin = Math.sin(pos.angle)
                  const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle'
                  const labelX = anchor === 'middle' ? 0 : anchor === 'start' ? r + 6 : -(r + 6)
                  const labelY = anchor === 'middle' ? (sin > 0 ? r + 14 : -r - 7) : 3
                  const showLabel =
                    flat.length <= 120 || f.depth === 1 || isSel || isHov || f.node.merged !== undefined
                  return (
                    <g
                      key={f.node.id}
                      transform={`translate(${pos.x},${pos.y})`}
                      tabIndex={0}
                      role="button"
                      aria-label={`${f.node.full}, ${LEVELS[Math.min(f.depth, 4) - 1]}, ${f.node.count} questions`}
                      onMouseEnter={() => setHoverId(f.node.id)}
                      onMouseLeave={() => setHoverId(null)}
                      onClick={() => setSelectedId(f.node.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedId(f.node.id)
                        }
                      }}
                      className="group cursor-pointer focus:outline-none"
                      style={{
                        opacity: inFocus ? 1 : 0.4,
                        transition: reduceMotion ? 'none' : 'opacity 0.3s ease',
                      }}
                    >
                      <title>{`${f.node.full} — ${f.node.count} questions`}</title>
                      <circle
                        r={r + 5}
                        fill="none"
                        stroke="#172554"
                        strokeWidth={1.2}
                        strokeDasharray="3 3"
                        opacity={isSel ? 1 : 0}
                        className="pointer-events-none transition-opacity duration-200 group-hover:opacity-60 group-focus-visible:opacity-100"
                      />
                      <circle
                        r={r}
                        fill={f.node.merged !== undefined ? '#EDEAE3' : LEVEL_COLORS[Math.min(f.depth, 4) - 1]}
                        stroke="#FFFFFF"
                        strokeWidth={1.5}
                        className="pointer-events-none"
                      />
                      {showLabel && (
                        <text
                          x={labelX}
                          y={labelY}
                          textAnchor={anchor}
                          fontSize={10}
                          fontFamily="IBM Plex Mono"
                          fill={isSel || isHov ? '#172554' : '#5A5B5F'}
                          className="pointer-events-none"
                        >
                          {f.node.label}
                        </text>
                      )}
                    </g>
                  )
                })}
              </g>
            </svg>
          </div>

          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">
            Relationships are derived from syllabus classification of uploaded questions · {flat.length} nodes
            {flat.length >= MAX_NODES ? ` (capped at ${MAX_NODES})` : ''}
          </p>
        </Card>

        {/* Inspector */}
        <Card className="p-5 md:p-6">
          <p className="eyebrow text-graphite-500">Node inspector</p>
          {!selected ? (
            <div className="mt-4">
              <h3 className="text-xl text-graphite">Nothing selected</h3>
              <p className="mt-2 text-sm leading-relaxed text-graphite-600">
                Click — or tab to and press Enter — any node to see its connected nodes and the exact questions
                behind it. Hover a node to highlight its relationships.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-5">
              <div>
                <h3 className="text-xl leading-snug text-graphite">{selected.node.full}</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone="navy">{LEVELS[Math.min(selected.depth, 4) - 1]}</Badge>
                  <Badge tone="blue">{selected.node.count} questions</Badge>
                  {selected.node.merged !== undefined && <Badge tone="grey">aggregated</Badge>}
                </div>
              </div>

              <div>
                <p className="label">
                  Connected nodes ({connected.length})
                </p>
                {connected.length === 0 ? (
                  <p className="text-xs text-graphite-500">Root of the graph — no parent or children.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {connected.map((c) => (
                      <button
                        key={c.node.id}
                        onClick={() => focusNode(c.node.id)}
                        title={`${c.node.full} · ${c.node.count} questions`}
                        className="chip border border-ivory-300 bg-ivory-50 text-graphite-600 transition-colors hover:border-navy hover:text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
                      >
                        <span className="font-mono text-[9px] uppercase tracking-wide text-graphite-400">
                          {c.kind}
                        </span>
                        {truncate(c.node.label, 20)}
                      </button>
                    ))}
                  </div>
                )}
                {siblings.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {siblings.map((s) => (
                      <button
                        key={s.node.id}
                        onClick={() => focusNode(s.node.id)}
                        title={`${s.node.full} · ${s.node.count} questions`}
                        className="chip border border-ivory-200 bg-white text-graphite-500 transition-colors hover:border-navy hover:text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
                      >
                        {truncate(s.node.label, 18)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="label !mb-0">Supporting questions ({nodeQuestions.length})</p>
                  <Link
                    to={selected.node.link}
                    className="inline-flex items-center gap-1 text-xs font-grotesk font-medium text-navy hover:underline"
                  >
                    Open in explorer
                  </Link>
                </div>
                <ul className="mt-2 max-h-[300px] space-y-2 overflow-y-auto pr-1">
                  {nodeQuestions.slice(0, 10).map((q) => {
                    const paper = papers.find((p) => p.id === q.paperId)
                    return (
                      <li key={q.id} className="rounded-xl border border-ivory-200 bg-ivory-50 p-3">
                        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-graphite-500">
                          <span className="text-navy">{q.questionNumber}</span>
                          <span>· {q.year}</span>
                          <span>· {q.marks} marks</span>
                          <span>· p.{q.sourcePage}</span>
                        </div>
                        <p className="mt-1 text-sm leading-snug text-graphite-700">{truncate(q.text, 140)}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <ConfidenceBadge value={q.confidence} needsReview={q.needsReview} />
                          <span className="font-mono text-[10px] text-graphite-400">
                            {paper?.filename ?? 'source unavailable'}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                  {nodeQuestions.length === 0 && (
                    <li className="rounded-xl border border-ivory-200 bg-ivory-50 p-3 text-sm text-graphite-500">
                      Not observed in the uploaded papers for this node in the current scope.
                    </li>
                  )}
                </ul>
                {nodeQuestions.length > 10 && (
                  <p className="mt-2 font-mono text-[11px] text-graphite-400">
                    …and {nodeQuestions.length - 10} more in the question explorer.
                  </p>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Cross-subject concept recurrence */}
      <SectionTitle
        kicker="Cross-subject"
        title="Cross-subject concept recurrence"
        description="Concepts whose keywords appear in questions from two or more subjects in the current scope. Select a row for the exact supporting questions."
        right={hasDemo ? <DemoBadge /> : undefined}
      />

      {concepts.length === 0 ? (
        <EmptyState
          icon={Network}
          title="No cross-subject concepts observed"
          description={
            filtersActive
              ? 'Not observed in the uploaded papers within the current filters — no keyword concept appears in questions from two or more subjects in this scope.'
              : 'Not observed in the uploaded papers — no keyword concept appears in questions from two or more subjects yet.'
          }
          action={{ label: 'Open question explorer', to: '/questions' }}
          secondaryAction={
            filtersActive ? (
              <button className="btn-ghost" onClick={store.resetFilters}>
                Clear filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <Card className="p-5 md:p-6">
          <TableWrap>
            <thead>
              <tr>
                <Th>Concept</Th>
                <Th>Subjects</Th>
                <Th className="text-right">Questions</Th>
                <Th>Semesters</Th>
                <Th className="text-right">Provenance</Th>
              </tr>
            </thead>
            <tbody>
              {concepts.map((c) => (
                <tr
                  key={c.concept}
                  tabIndex={0}
                  onClick={() => setConceptSel(c)}
                  onKeyDown={(e) => e.key === 'Enter' && setConceptSel(c)}
                  aria-label={`Open the questions behind ${c.concept}`}
                  className="cursor-pointer transition-colors hover:bg-ivory-50 focus:outline-none focus-visible:bg-ivory-100"
                >
                  <Td>
                    <span className="font-medium text-graphite">{c.concept}</span>
                  </Td>
                  <Td>
                    <span className="flex flex-wrap gap-1.5">
                      {c.subjects.map((s) => (
                        <Badge key={s} tone="blue">
                          {s}
                        </Badge>
                      ))}
                    </span>
                  </Td>
                  <Td className="text-right font-mono text-graphite">{c.questionCount}</Td>
                  <Td>
                    <span className="flex flex-wrap gap-1.5">
                      {c.semesters.map((s) => (
                        <Badge key={s} tone="grey">
                          Sem {s}
                        </Badge>
                      ))}
                    </span>
                  </Td>
                  <Td className="text-right">
                    <span className="font-mono text-[11px] text-navy">View questions →</span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <p className="mt-4 max-w-prose2 text-xs leading-relaxed text-graphite-500">
            Links here are keyword co-occurrence across subjects: a concept is listed when the same keywords
            appear in questions from two or more subjects. That is a text-matching observation about the
            uploaded papers, not a semantic claim that the subjects teach the same idea.
          </p>
        </Card>
      )}

      {/* Concept provenance modal */}
      <Modal
        open={!!conceptSel}
        onClose={() => setConceptSel(null)}
        title={conceptSel ? `${conceptSel.concept} — supporting questions` : ''}
        wide
      >
        {conceptSel && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="navy">{conceptSel.questionCount} questions</Badge>
              <Badge tone="lavender">{conceptSel.subjects.length} subjects</Badge>
              <Badge tone="grey">Sem {conceptSel.semesters.join(', ')}</Badge>
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-400">
              Matched on keywords: {(CONCEPT_KEYWORDS[conceptSel.concept] ?? []).join(' · ')}
            </p>
            {conceptQuestions.length === 0 ? (
              <p className="rounded-xl border border-ivory-200 bg-ivory-50 p-4 text-sm text-graphite-600">
                Not observed in the uploaded papers for the current scope.
              </p>
            ) : (
              <ul className="space-y-3">
                {conceptQuestions.slice(0, 20).map((q) => {
                  const paper = papers.find((p) => p.id === q.paperId)
                  return (
                    <li key={q.id} className="rounded-xl border border-ivory-200 bg-ivory-50 p-4">
                      <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-graphite-500">
                        <span className="text-navy">
                          {q.questionNumber}
                          {q.subQuestion ? `(${q.subQuestion})` : ''}
                        </span>
                        <span>· {q.year} · {q.examType}</span>
                        <span>· {q.marks} marks</span>
                        <span>· p.{q.sourcePage}</span>
                        <span>· {q.subject}</span>
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-graphite-700">{q.text}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <ConfidenceBadge value={q.confidence} needsReview={q.needsReview} />
                        <span className="font-mono text-[10px] text-graphite-400">
                          {paper?.filename ?? 'source unavailable'}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            {conceptQuestions.length > 20 && (
              <p className="font-mono text-[11px] text-graphite-400">
                …and {conceptQuestions.length - 20} more in the question explorer.
              </p>
            )}
            <div className="flex justify-end">
              <Link to="/questions" className="btn-ghost !py-2.5 !text-[13px]">
                Open question explorer
              </Link>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
