import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Braces, Check, Database, FileText, Lock, Server, ShieldAlert, Sparkles, X,
} from 'lucide-react'
import { usePaperTrail } from '../store/PaperTrailStore'
import { datasetOverview } from '../services/analyticsEngine'
import { DEMO_DISCLAIMER } from '../data/demoSubjects'
import { Badge, Card, DemoBadge, PageHeader, Prose, Reveal, SectionTitle, Stat } from '../components/ui'

/**
 * About — the honest product page: what PaperTrail is, how processing works,
 * what it deliberately does not do, and where the data lives.
 */

const PIPELINE: { step: string; title: string; body: string; limit: string }[] = [
  {
    step: '01',
    title: 'PDF.js extraction',
    body: 'Page text is read in your browser with PDF.js. Nothing is uploaded to a server.',
    limit: 'Scanned pages yield little text; OCR (Tesseract) is attempted best-effort and its confidence is reported, never hidden.',
  },
  {
    step: '02',
    title: 'Structure parsing',
    body: 'Layout heuristics find question numbers, sub-parts and trailing marks such as "[4]".',
    limit: 'Multi-column or unusually formatted papers can interleave line order — warnings are attached to the paper.',
  },
  {
    step: '03',
    title: 'Syllabus classification',
    body: 'Each question is matched against your syllabus with explainable keyword scoring.',
    limit: 'This is keyword matching, not an AI model. Confidence reflects keyword overlap and can be corrected by hand.',
  },
  {
    step: '04',
    title: 'Aggregation',
    body: 'Questions are grouped by subject, unit, chapter and topic, then rolled up per paper.',
    limit: 'Everything is scoped to what you uploaded — absence in the data means "not observed", never "never asked".',
  },
  {
    step: '05',
    title: 'Analytics',
    body: 'Frequency, marks, trends, repetition and coverage are computed on the fly in the browser.',
    limit: 'Figures describe past papers only. Nothing here predicts future examinations.',
  },
]

const STACK: { group: string; items: string[] }[] = [
  { group: 'Framework', items: ['React 18', 'TypeScript', 'Vite (SPA)'] },
  { group: 'Styling', items: ['Tailwind CSS', 'Design tokens (ivory / navy / gold)', 'Framer Motion'] },
  { group: 'Visualisation', items: ['Recharts', 'Custom SVG / CSS diagrams'] },
  { group: 'Documents', items: ['PDF.js', 'Tesseract.js (best-effort OCR)'] },
  { group: 'Storage', items: ['localStorage (metadata & preferences)', 'IndexedDB (raw PDFs)'] },
  { group: 'Icons & routing', items: ['lucide-react', 'React Router'] },
]

const NOT_LIST: { text: string; icon: typeof X }[] = [
  { text: 'Not an AI model — classification is explainable keyword matching with a confidence score you can audit.', icon: X },
  { text: 'Not official MIT Manipal data — demo subjects, papers and syllabi are fictional illustrations.', icon: X },
  { text: 'Not a prediction engine — analytics describe papers that already exist, never future questions.', icon: X },
  { text: 'No backend — there is no API, no database and no telemetry endpoint.', icon: X },
  { text: 'No accounts — there is no sign-up, login or server-side profile.', icon: X },
]

export const AboutPage: React.FC = () => {
  const store = usePaperTrail()
  const overview = useMemo(() => datasetOverview(store.papers, store.questions), [store.papers, store.questions])

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="About"
        title="Every question tells a story."
        description="Four years of examinations. Eight semesters. One intelligence platform."
        demo={store.demoEnabled && overview.demoPapers > 0}
        actions={
          <>
            <Link to="/report" className="btn-ghost !py-2.5 !text-[13px]">Read the report</Link>
            <Link to="/upload" className="btn-primary !py-2.5 !text-[13px]">Upload a paper</Link>
          </>
        }
      />

      {/* Live stats from the current dataset */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Papers in dataset" value={overview.totalPapers} sub={`${overview.demoPapers} demo · ${overview.userPapers} uploaded`} icon={FileText} />
        <Stat label="Questions extracted" value={overview.totalQuestions} accent="academic" sub="Across every paper in scope" />
        <Stat label="Subjects" value={overview.totalSubjects} accent="lavender" sub={`${overview.departments} departments`} />
        <Stat label="Academic years" value={overview.yearsRepresented.length} accent="gold" sub={overview.yearsRepresented.length ? `${overview.yearsRepresented[0]}–${overview.yearsRepresented[overview.yearsRepresented.length - 1]}` : 'none yet'} />
      </div>

      {/* ── What it is ─────────────────────────────────────────────────────── */}
      <Reveal className="mt-14">
        <SectionTitle kicker="01 — What it is" title="A research instrument for examination papers" />
        <div className="grid gap-6 md:grid-cols-2">
          <Prose className="!text-sm !leading-relaxed">
            <p>
              PaperTrail turns years of question papers into structured, inspectable academic intelligence. You feed it
              PDFs; it reads them in your browser, pulls out individual questions, maps each one onto a syllabus, and
              then shows you what actually recurs — by topic, by chapter, by marks, by year.
            </p>
            <p className="mt-4">
              The emphasis is on <em>traceability</em>. Every statistic can be opened up to reveal the exact questions
              and the exact source pages behind it. Nothing is a black box: classifications carry their reasoning,
              similarity scores carry their shared terms, and limitations are stated in the same breath as the numbers.
            </p>
            <p className="mt-4">
              It is built for students who want to prepare with evidence rather than hearsay — and for anyone curious
              about what a repository of past papers actually says when you interrogate it honestly.
            </p>
          </Prose>
          <Card className="p-6">
            <p className="eyebrow text-academic">In one line</p>
            <p className="mt-3 font-display text-2xl leading-snug text-graphite">
              Upload papers → extract questions → classify against a syllabus → see what recurs, with proof for every
              number.
            </p>
            <div className="rule mt-5 flex flex-wrap gap-2 pt-4">
              <Badge tone="navy">Frontend only</Badge>
              <Badge tone="blue">Explainable</Badge>
              <Badge tone="gold">Demo-aware</Badge>
              <Badge tone="lavender">Printable reports</Badge>
            </div>
          </Card>
        </div>
      </Reveal>

      {/* ── Pipeline ───────────────────────────────────────────────────────── */}
      <Reveal className="mt-14">
        <SectionTitle
          kicker="02 — How processing works"
          title="Five steps, every one of them honest about its limits"
          description="The live pipeline below reflects the current dataset on this device."
        />
        <Card className="p-5 md:p-6">
          <ol className="grid gap-3 lg:grid-cols-5">
            {PIPELINE.map((p, i) => (
              <li key={p.step} className="relative">
                <div className="flex h-full flex-col rounded-xl border border-ivory-300 bg-ivory-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-academic">{p.step}</span>
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-academic opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-academic" />
                    </span>
                  </div>
                  <h3 className="mt-2 text-base leading-snug text-graphite">{p.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-graphite-600">{p.body}</p>
                  <p className="mt-2 border-t border-ivory-300 pt-2 text-[11px] leading-snug text-graphite-500">
                    <span className="font-mono text-[9.5px] uppercase tracking-wide text-gold-600">Limit · </span>
                    {p.limit}
                  </p>
                  {i < PIPELINE.length - 1 && (
                    <ArrowRight className="absolute -right-2.5 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-graphite-400 lg:block" aria-hidden />
                  )}
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-ivory-300 pt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-500">
            <span>in: {overview.totalPapers} papers</span>
            <span>out: {overview.totalQuestions} questions</span>
            <span>{overview.extractionWarnings} extraction warnings</span>
            <span>{overview.ocrPapers} papers OCR'd</span>
            <span className="text-navy">avg confidence {Math.round(overview.avgConfidence * 100)}%</span>
          </div>
        </Card>
      </Reveal>

      {/* ── What it is not ─────────────────────────────────────────────────── */}
      <Reveal className="mt-14">
        <SectionTitle kicker="03 — What it is NOT" title="Five things we will never claim" />
        <Card className="p-5 md:p-6">
          <ul className="space-y-3">
            {NOT_LIST.map((n) => (
              <li key={n.text} className="flex items-start gap-3 text-sm leading-relaxed text-graphite-600">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-700">
                  <n.icon className="h-3 w-3" aria-hidden />
                </span>
                <span>{n.text}</span>
              </li>
            ))}
          </ul>
        </Card>
      </Reveal>

      {/* ── Engine architecture ────────────────────────────────────────────── */}
      <Reveal className="mt-14">
        <SectionTitle
          kicker="04 — Engine architecture"
          title="One contract, three engines"
          description="Analysis is pluggable behind a single TypeScript interface, so capabilities can grow without rewriting the frontend."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <p className="eyebrow text-graphite-500">LocalAnalysisEngine</p>
              <Badge tone="green">v1 default</Badge>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-graphite-600">
              Runs entirely in the browser: PDF.js extraction, heuristic structure parsing, explainable syllabus-keyword
              classification. No network calls, no API keys, no AI model.
            </p>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-400">id · local-heuristic</p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <p className="eyebrow text-graphite-500">DemoAnalysisEngine</p>
              <Badge tone="gold">Illustrative</Badge>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-graphite-600">
              Serves the bundled fictional dataset so the product can be explored before any upload. Every object it
              returns is flagged <code className="font-mono text-[11px]">demo: true</code> and carries the demo
              disclaimer.
            </p>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-400">id · demo-illustrative</p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <p className="eyebrow text-graphite-500">FutureAIAnalysisEngine</p>
              <Badge tone="grey">Not implemented</Badge>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-graphite-600">
              A declared-but-empty slot for a future hosted classifier: <em>"Not implemented in v1 — declared so the
              integration surface is explicit."</em> It must return <code className="font-mono text-[11px]">null</code>{' '}
              when no model is available so callers fall back honestly.
            </p>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-400">id · reserved</p>
          </Card>
        </div>
        <Card className="mt-4 p-5">
          <p className="eyebrow text-graphite-500">The contract — QuestionAnalysisEngine</p>
          <blockquote className="mt-3 border-l-2 border-academic pl-4 text-sm italic leading-relaxed text-graphite-600">
            "The pluggable analysis-engine contract. … A future AI-backed engine can implement this same interface —
            including the explain requirement — without any frontend rewrite. Engines must never claim capabilities they
            do not have: every result is labelled with how it was produced."
          </blockquote>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-400">
            src/engines/QuestionAnalysisEngine.ts
          </p>
        </Card>
      </Reveal>

      {/* ── Data honesty ───────────────────────────────────────────────────── */}
      <Reveal className="mt-14">
        <SectionTitle kicker="05 — Data honesty" title="Demo data is labelled everywhere it appears" />
        <Card className="border-gold/40 bg-gold-100 p-5 md:p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-gold-600">{DEMO_DISCLAIMER}</p>
          <Prose className="mt-3">
            <p>
              The bundled subjects, syllabi, papers and questions are fictional examples generated to demonstrate the
              analytics. They are not verified MIT Manipal examination records and must never be quoted as such. You can
              disable demo data entirely in Settings; uploaded papers are always kept separate from demo papers in every
              table and export.
            </p>
            <p className="mt-3">
              When a syllabus topic does not appear in the papers you have, the UI says{" "}
              <strong className="font-medium text-graphite">"not observed in the uploaded papers"</strong> — never
              "never asked at MIT Manipal". That distinction is deliberate and non-negotiable.
            </p>
          </Prose>
          <div className="mt-4"><DemoBadge /></div>
        </Card>
      </Reveal>

      {/* ── Privacy ────────────────────────────────────────────────────────── */}
      <Reveal className="mt-14">
        <SectionTitle kicker="06 — Privacy" title="Your papers never leave this browser" />
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <Lock className="h-4 w-4 text-navy" />
            <h3 className="mt-3 text-base text-graphite">No transmission</h3>
            <p className="mt-2 text-sm leading-relaxed text-graphite-600">
              Extraction, classification and analytics all run locally. There is no upload endpoint, no analytics
              beacon and no third-party script that receives your documents.
            </p>
          </Card>
          <Card className="p-5">
            <Database className="h-4 w-4 text-academic" />
            <h3 className="mt-3 text-base text-graphite">Where data lives</h3>
            <p className="mt-2 text-sm leading-relaxed text-graphite-600">
              Metadata, filters, planner entries and preferences go to <code className="font-mono text-[11px]">localStorage</code>;
              raw PDFs go to <code className="font-mono text-[11px]">IndexedDB</code> because they often exceed the
              ~5 MB localStorage quota. Settings offers a one-click wipe of both.
            </p>
          </Card>
          <Card className="p-5">
            <ShieldAlert className="h-4 w-4 text-gold-600" />
            <h3 className="mt-3 text-base text-graphite">Browser-profile caveat</h3>
            <p className="mt-2 text-sm leading-relaxed text-graphite-600">
              Local storage is not encrypted server-side — anyone with access to your browser profile can read it.
              Never store credentials here (this app has none by design).
            </p>
          </Card>
        </div>
      </Reveal>

      {/* ── Technology stack ───────────────────────────────────────────────── */}
      <Reveal className="mt-14">
        <SectionTitle kicker="07 — Technology stack" title="Built from boring, dependable parts" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STACK.map((g) => (
            <Card key={g.group} className="p-5">
              <p className="eyebrow text-graphite-500">{g.group}</p>
              <ul className="mt-3 space-y-1.5">
                {g.items.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-graphite-600">
                    <Check className="h-3.5 w-3.5 shrink-0 text-academic" aria-hidden /> {item}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </Reveal>

      {/* ── Deployment ─────────────────────────────────────────────────────── */}
      <Reveal className="mt-14">
        <SectionTitle kicker="08 — Deployment" title="A static bundle, nothing to configure" />
        <Card className="p-5 md:p-6">
          <div className="grid gap-5 md:grid-cols-3">
            <div>
              <Braces className="h-4 w-4 text-navy" />
              <h3 className="mt-3 text-base text-graphite">Vite SPA</h3>
              <p className="mt-2 text-sm leading-relaxed text-graphite-600">
                <code className="font-mono text-[11px]">npm run build</code> emits static files into{' '}
                <code className="font-mono text-[11px]">dist/</code>. Client-side routing means the host must rewrite
                unknown paths to <code className="font-mono text-[11px]">index.html</code>.
              </p>
            </div>
            <div>
              <Server className="h-4 w-4 text-academic" />
              <h3 className="mt-3 text-base text-graphite">Vercel (or any static host)</h3>
              <p className="mt-2 text-sm leading-relaxed text-graphite-600">
                Deploy as a static site — no functions, no serverless endpoints, no database. The same bundle runs from
                a plain file server or <code className="font-mono text-[11px]">npm run preview</code>.
              </p>
            </div>
            <div>
              <Sparkles className="h-4 w-4 text-gold-600" />
              <h3 className="mt-3 text-base text-graphite">Zero environment variables</h3>
              <p className="mt-2 text-sm leading-relaxed text-graphite-600">
                No API keys, no secrets and no build-time configuration. That is a direct consequence of having no
                backend: what you build is exactly what runs.
              </p>
            </div>
          </div>
        </Card>
      </Reveal>

      {/* ── Security ───────────────────────────────────────────────────────── */}
      <Reveal className="mt-14">
        <SectionTitle kicker="09 — Security notes" title="Treating PDFs as untrusted input" />
        <Card className="p-5 md:p-6">
          <ul className="space-y-3">
            {[
              'Uploaded PDFs are untrusted input. They are parsed with PDF.js in a sandboxed rendering context — the app never executes scripts embedded in a document.',
              'No file content is sent anywhere: parsing happens in memory, and the raw file is written only to your own IndexedDB store.',
              'Size limits apply (for example, syllabus PDFs are capped at 20 MB) so a hostile or malformed file cannot exhaust the tab.',
              'localStorage is readable by any script on this origin — the app stores no credentials, tokens or secrets, by design.',
              'Exports (CSV/JSON) are generated client-side from data you already have; nothing is transmitted when you download a report.',
            ].map((t) => (
              <li key={t} className="flex gap-3 text-sm leading-relaxed text-graphite-600">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-navy" aria-hidden />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Card>
      </Reveal>

      {/* ── Known limitations ──────────────────────────────────────────────── */}
      <Reveal className="mt-14">
        <SectionTitle
          kicker="10 — Known limitations"
          title="What still goes wrong, stated plainly"
        />
        <Card className="p-5 md:p-6">
          <ul className="grid gap-3 md:grid-cols-2">
            {[
              'Scanned PDFs depend on best-effort OCR — accuracy varies with scan quality and the confidence is reported rather than smoothed over.',
              'Multi-column or heavily formatted layouts can interleave line order, producing extraction warnings on the affected paper.',
              'Difficulty and topic labels come from a keyword heuristic; confidence scores are explainable but imperfect, and every question can be corrected by hand.',
              'Demo data is fictional: subjects, papers and syllabi illustrate the product and are not verified institutional records.',
              'Coverage only reflects subjects that have a syllabus loaded; without one, classification is provisional and marked as such.',
              'Aggregates are recomputed in the browser, so very large archives may take a moment to process on slower devices.',
            ].map((t) => (
              <li key={t} className="flex gap-3 rounded-xl border border-ivory-200 bg-ivory-50 px-4 py-3 text-sm leading-relaxed text-graphite-600">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Card>
      </Reveal>

      <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-ivory-300 pt-6">
        <div>
          <p className="eyebrow text-academic">Ready to interrogate your papers?</p>
          <p className="mt-2 max-w-prose2 text-sm text-graphite-600">
            Upload a question paper and watch it become structured, inspectable analytics — with every number traceable
            back to its source page.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/upload" className="btn-primary">Upload papers <ArrowRight className="h-4 w-4" /></Link>
          <Link to="/report" className="btn-ghost">See a sample report</Link>
        </div>
      </div>
    </div>
  )
}
