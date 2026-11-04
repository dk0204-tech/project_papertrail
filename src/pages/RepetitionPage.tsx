import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CopyCheck, GitCompare, Scale, ShieldQuestion } from 'lucide-react'
import { useAnalytics } from '../hooks/useAnalytics'
import { usePaperTrail } from '../store/PaperTrailStore'
import {
  Badge, Card, ConfidenceBadge, DemoBadge, EmptyState, Modal, PageHeader,
  Prose, SectionTitle, Stat, truncate,
} from '../components/ui'
import { FilterBar } from '../components/FilterBar'
import { repetitionClusters } from '../services/analyticsEngine'
import { download, toCsv } from '../services/reportExporter'
import { Question, RepetitionCluster } from '../types'

type Tone = React.ComponentProps<typeof Badge>['tone']

const KIND: Record<RepetitionCluster['kind'], { tone: Tone; label: string }> = {
  exact: { tone: 'red', label: 'Exact repeat' },
  'near-identical': { tone: 'gold', label: 'Near-identical' },
  'similar-structure': { tone: 'blue', label: 'Similar structure' },
  'same-topic-variant': { tone: 'lavender', label: 'Same-topic variant' },
}

const DEFAULT_THRESHOLD = 0.55

/** First wording difference, extracted from the cluster's explanation string. */
function firstDifference(explanation: string): string {
  const marker = 'Main wording difference:'
  const i = explanation.indexOf(marker)
  return i >= 0 ? explanation.slice(i + marker.length).trim() : explanation
}

const STEPS: { title: string; body: React.ReactNode }[] = [
  {
    title: '1 · Normalise',
    body: (
      <>
        Lower-case the wording, strip punctuation, and fold common variants together
        (<span className="font-mono text-[11px]">programme / programming → program</span>,{' '}
        <span className="font-mono text-[11px]">explain → describe</span>,{' '}
        <span className="font-mono text-[11px]">with → use</span>) so a spelling difference does not hide a match.
      </>
    ),
  },
  {
    title: '2 · Tokenise',
    body: (
      <>
        Keep content words longer than two characters, drop everyday stopwords (the, of, and…), and add
        neighbouring word pairs (bigrams) so word order contributes a little to the score.
      </>
    ),
  },
  {
    title: '3 · Score — text similarity (Jaccard on normalised tokens)',
    body: (
      <>
        For each pair of questions in the same subject: shared tokens ÷ total distinct tokens, giving a
        number from <span className="font-mono text-[11px]">0</span> (nothing in common) to{' '}
        <span className="font-mono text-[11px]">1</span> (identical wording). This is explainable string
        matching — you can read the exact tokens behind every score.
      </>
    ),
  },
  {
    title: '4 · Cluster greedily',
    body: (
      <>
        Pairs scoring at or above the threshold are merged into groups (each group keeps its best pair as
        the cluster score). Clusters are sorted highest similarity first.
      </>
    ),
  },
]

/**
 * Question similarity & repetition — explainable text matching (Jaccard on
 * normalised tokens). Deliberately not described as semantic/ML/AI: the score
 * is deterministic and every cluster shows the shared terms behind it.
 */
export const RepetitionPage: React.FC = () => {
  const { questions, papers, filtersActive, store } = useAnalytics()
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD)
  const [selected, setSelected] = useState<RepetitionCluster | null>(null)

  const clusters = useMemo(
    () => repetitionClusters(questions, threshold),
    [questions, threshold],
  )

  const exactCount = useMemo(() => clusters.filter((c) => c.kind === 'exact').length, [clusters])
  const involved = useMemo(() => {
    const ids = new Set<string>()
    for (const c of clusters) for (const q of c.questions) ids.add(q.id)
    return ids.size
  }, [clusters])
  const topSimilarity = clusters.length ? Math.max(...clusters.map((c) => c.similarity)) : 0
  const hasDemo = useMemo(() => questions.some((q) => q.demo), [questions])

  const exportClustersCsv = () => {
    const headers = [
      'Cluster', 'Kind', 'Text similarity', 'Subject', 'Topic', 'Years',
      'Questions', 'Shared terms', 'Explanation',
    ]
    const rows = clusters.map((c) => [
      c.id,
      c.kind,
      c.similarity,
      c.subject,
      c.topic,
      Array.from(new Set(c.questions.map((q) => q.year))).sort().join(' '),
      c.questions.length,
      c.sharedTerms.join(' | '),
      c.explanation,
    ])
    download('papertrail_repetition.csv', toCsv(headers, rows), 'text/csv;charset=utf-8')
  }

  if (questions.length < 2) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Analytics · Repetition"
          title="Question similarity & repetition"
          description="How wording repeats across the papers in scope."
        />
        <EmptyState
          icon={CopyCheck}
          title="Similarity needs at least two questions"
          description={
            questions.length === 0
              ? filtersActive
                ? 'The active filters exclude every question in the dataset. Clear some filters, or upload papers for this scope.'
                : 'There are no questions in the dataset yet. Upload question papers or enable the illustrative demo dataset in Settings.'
              : 'Text similarity compares question wording across papers — with only one question in scope there is nothing to compare yet. Upload more papers, or clear filters to widen the scope.'
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
        eyebrow="Analytics · Repetition"
        title="Question similarity & repetition"
        description="Repeat and near-repeat questions surfaced by text similarity (Jaccard on normalised tokens). Every cluster shows the exact questions and the shared words behind the score."
        demo={hasDemo}
        actions={
          <>
            <button
              className="btn-ghost !py-2.5 !text-[13px]"
              onClick={exportClustersCsv}
              disabled={clusters.length === 0}
              aria-label="Export the repetition clusters as CSV"
            >
              Export clusters CSV
            </button>
            <Link to="/analytics/trends" className="btn-ghost !py-2.5 !text-[13px]">
              Historical trends
            </Link>
            <Link to="/questions" className="btn-primary !py-2.5 !text-[13px]">
              Open question explorer
            </Link>
          </>
        }
      />

      <FilterBar />

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Clusters found"
          value={clusters.length}
          sub={`at similarity ≥ ${threshold.toFixed(2)}`}
          icon={GitCompare}
        />
        <Stat
          label="Exact repeats"
          value={exactCount}
          sub="kind = exact (≥ 0.95 identical wording)"
          icon={CopyCheck}
          accent="gold"
        />
        <Stat
          label="Questions involved"
          value={involved}
          sub={`of ${questions.length} questions in scope`}
          icon={ShieldQuestion}
          accent="academic"
        />
        <Stat
          label="Highest similarity"
          value={clusters.length ? `${Math.round(topSimilarity * 100)}%` : '—'}
          sub={clusters.length ? 'best pair in the top cluster' : 'Not observed in the uploaded papers'}
          icon={Scale}
          accent="lavender"
        />
      </div>

      {/* Method explainer */}
      <SectionTitle
        kicker="Method"
        title="How the similarity score is computed"
        description="Deterministic, inspectable text matching — not a semantic model."
      />
      <Card className="p-5 md:p-6">
        <ol className="space-y-4">
          {STEPS.map((s) => (
            <li key={s.title}>
              <h4 className="text-base text-graphite">{s.title}</h4>
              <Prose className="mt-1">{s.body}</Prose>
            </li>
          ))}
        </ol>

        <div className="mt-5 rounded-xl border border-ivory-300 bg-ivory-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label htmlFor="similarity-threshold" className="label !mb-0">
              Repetition threshold
            </label>
            <span className="font-mono text-sm text-navy" aria-hidden>
              {threshold.toFixed(2)}
            </span>
          </div>
          <input
            id="similarity-threshold"
            type="range"
            min={0.4}
            max={0.9}
            step={0.01}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            aria-describedby="similarity-threshold-help"
            className="mt-3 w-full cursor-pointer accent-navy"
          />
          <p id="similarity-threshold-help" className="mt-2 text-xs leading-relaxed text-graphite-500">
            Pairs scoring at or above this value are grouped. The app default is{' '}
            <span className="font-mono text-[11px]">{DEFAULT_THRESHOLD.toFixed(2)}</span> — lower it to catch
            looser repeats, raise it to keep only near-verbatim ones. Current scope:{' '}
            <span className="font-mono text-[11px]">{clusters.length}</span>{' '}
            {clusters.length === 1 ? 'cluster' : 'clusters'}.
          </p>
        </div>

        <div className="mt-5 rounded-xl border border-lavender/60 bg-lavender-100 p-4">
          <p className="label !mb-1 text-navy-600">What the scores mean</p>
          <Prose className="!text-navy-600">
            <span className="font-mono text-[11px]">≥ 0.95</span> verbatim repeat ·{' '}
            <span className="font-mono text-[11px]">≥ 0.78</span> near-identical ·{' '}
            <span className="font-mono text-[11px]">≥ 0.62</span> similar structure ·{' '}
            <span className="font-mono text-[11px]">threshold – 0.62</span> same-topic variant. This is
            explainable text matching, not a semantic, machine-learning or AI model: a reworded question that
            means the same thing can still score low, and shared technical jargon can score high. Nothing here
            is inferred beyond the words on the page.
          </Prose>
        </div>
      </Card>

      {/* Clusters */}
      <SectionTitle
        kicker="Results"
        title={clusters.length === 0 ? 'No matching pairs' : `${clusters.length} repetition ${clusters.length === 1 ? 'cluster' : 'clusters'}`}
        description="Select a cluster to compare its questions side by side, wording difference by wording difference."
        right={
          <>
            <button className="btn-ghost !py-2.5 !text-[13px]" onClick={exportClustersCsv} disabled={clusters.length === 0}>
              Export CSV
            </button>
            {hasDemo && <DemoBadge />}
          </>
        }
      />

      {clusters.length === 0 ? (
        <Card className="p-6">
          <p className="text-sm leading-relaxed text-graphite-600">
            Nothing at or above{' '}
            <span className="font-mono text-[12px] text-navy">{threshold.toFixed(2)}</span> — repeated wording
            is not observed in the uploaded papers at this threshold.{' '}
            {questions.length >= 2 &&
              'Lower the threshold with the slider above to widen the net, or upload more papers to compare against.'}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clusters.map((c) => {
            const years = Array.from(new Set(c.questions.map((q) => q.year))).sort()
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c)}
                aria-label={`Open side-by-side comparison for ${c.title}`}
                className="card group cursor-pointer p-5 text-left transition-shadow duration-300 hover:shadow-lift2 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <Badge tone={KIND[c.kind].tone}>{KIND[c.kind].label}</Badge>
                  <span className="shrink-0 font-mono text-sm text-navy">
                    {Math.round(c.similarity * 100)}%
                  </span>
                </div>
                <h3 className="mt-3 text-lg leading-snug text-graphite">{truncate(c.title, 92)}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">
                  <span>{c.subject}</span>
                  <span aria-hidden>·</span>
                  <span>{years.join(', ')}</span>
                  <span aria-hidden>·</span>
                  <span>
                    {c.questions.length} {c.questions.length === 1 ? 'question' : 'questions'}
                  </span>
                </div>
                {c.sharedTerms.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.sharedTerms.map((t) => (
                      <Badge key={t} tone="grey" title="Shared token that contributed to the score">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-xs leading-relaxed text-graphite-500">{truncate(c.explanation, 170)}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-grotesk font-medium text-navy opacity-80 transition-opacity group-hover:opacity-100">
                  Compare side by side
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Side-by-side comparison modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Comparison — ${KIND[selected.kind].label}` : ''}
        wide
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={KIND[selected.kind].tone}>{KIND[selected.kind].label}</Badge>
              <Badge tone="navy" title="Text similarity (Jaccard on normalised tokens)">
                {Math.round(selected.similarity * 100)}% text similarity
              </Badge>
              <Badge tone="grey">{selected.subject}</Badge>
              <Badge tone="blue">{selected.topic}</Badge>
              <Badge tone="lavender">
                {selected.questions.length} {selected.questions.length === 1 ? 'variant' : 'variants'}
              </Badge>
            </div>

            <div className="rounded-xl border border-ivory-300 bg-ivory-50 p-4">
              <p className="label !mb-1">First wording difference</p>
              <p className="text-sm leading-relaxed text-graphite-700">{firstDifference(selected.explanation)}</p>
              <p className="mt-2 text-xs leading-relaxed text-graphite-500">{selected.explanation}</p>
            </div>

            <div
              className={`grid gap-4 ${
                selected.questions.length <= 2
                  ? 'sm:grid-cols-2'
                  : selected.questions.length === 3
                    ? 'sm:grid-cols-2 lg:grid-cols-3'
                    : 'sm:grid-cols-2'
              }`}
            >
              {selected.questions.map((q, i) => {
                const paper = papers.find((p) => p.id === q.paperId)
                return (
                  <div key={q.id} className="rounded-xl border border-ivory-300 bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">
                        Variant {i + 1} · {q.questionNumber}
                        {q.subQuestion ? `(${q.subQuestion})` : ''}
                      </span>
                      <span className="font-mono text-[11px] text-navy">{q.year}</span>
                    </div>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-graphite-500">
                      {q.examType} · {q.marks} marks · p.{q.sourcePage}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-graphite-700">{q.text}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ivory-200 pt-3">
                      <ConfidenceBadge value={q.confidence} needsReview={q.needsReview} />
                      <span className="font-mono text-[10px] text-graphite-400">
                        {paper?.filename ?? 'source unavailable'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-400">
                Text similarity (Jaccard on normalised tokens) — explainable text matching, not a semantic model
              </p>
              <Link
                to={`/questions?topic=${encodeURIComponent(selected.topic)}`}
                className="btn-ghost !py-2.5 !text-[13px]"
              >
                Open in explorer
              </Link>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
