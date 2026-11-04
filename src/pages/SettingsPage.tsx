import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Database,
  Download,
  FileText,
  HardDrive,
  Info,
  Lock,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { usePaperTrail } from '../store/PaperTrailStore'
import {
  Badge,
  Card,
  DemoBadge,
  EmptyState,
  Modal,
  PageHeader,
  SectionTitle,
  Stat,
} from '../components/ui'
import { DEMO_DISCLAIMER } from '../data/demoSubjects'
import { download } from '../services/reportExporter'
import {
  clearAllPaperTrailKeys,
  formatBytes,
  localStorageUsageBytes,
} from '../storage/localStorage'
import { clearDocuments, estimateUsage, listDocuments } from '../storage/indexedDB'

/**
 * Settings — preferences plus full transparency about where local data lives.
 * Every destructive action is confirmed, and the storage numbers are read
 * from the browser rather than estimated by us.
 */

/** Mirrors package.json "version" (kept in sync manually — no JSON imports). */
const APP_VERSION = '1.0.0'

const STORAGE_NOTE =
  'Browser storage is readable by anything running on this origin and by anyone with access to this browser profile — it is not encrypted server storage.'

interface StorageInfo {
  localBytes: number
  docCount: number
  docBytes: number
  usage: number | null
  quota: number | null
}

type ConfirmKind = 'reset' | 'uploads' | 'wipe' | null

export const SettingsPage: React.FC = () => {
  const store = usePaperTrail()
  const { demoEnabled, toggleDemo, resetDemoData, papers, questions, planner, syllabi, filters } = store

  const [info, setInfo] = useState<StorageInfo | null>(null)
  const [confirm, setConfirm] = useState<ConfirmKind>(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState('')

  const refreshStorage = useCallback(async () => {
    const localBytes = localStorageUsageBytes()
    let docCount = 0
    let docBytes = 0
    try {
      const docs = await listDocuments()
      docCount = docs.length
      docBytes = docs.reduce((n, d) => n + (d.size || 0), 0)
    } catch {
      /* IndexedDB unavailable — reported as zeros below */
    }
    const est = await estimateUsage()
    setInfo({
      localBytes,
      docCount,
      docBytes,
      usage: est?.usage ?? null,
      quota: est?.quota ?? null,
    })
  }, [])

  useEffect(() => {
    refreshStorage()
  }, [refreshStorage])

  const exportJson = () => {
    const payload = {
      app: 'PaperTrail',
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      disclaimer: DEMO_DISCLAIMER,
      note: 'Everything below was read from this browser\u2019s local storage. Demo entries are fictional, illustrative data.',
      demoEnabled,
      filters,
      papers,
      questions,
      planner,
      syllabi,
    }
    download('papertrail_local_data.json', JSON.stringify(payload, null, 2), 'application/json')
    setFlash('Exported papertrail_local_data.json')
  }

  const deleteUploads = async () => {
    setBusy(true)
    try {
      for (const p of store.papers.filter((p) => !p.demo)) store.removePaper(p.id)
      for (const q of store.questions.filter((q) => !q.demo)) store.deleteQuestion(q.id)
      try {
        await clearDocuments()
      } catch {
        /* IndexedDB unavailable */
      }
      setFlash('Deleted uploaded papers, their questions and the stored PDF files.')
    } finally {
      setBusy(false)
      setConfirm(null)
      refreshStorage()
    }
  }

  const wipeAll = async () => {
    setBusy(true)
    try {
      clearAllPaperTrailKeys()
      try {
        await clearDocuments()
      } catch {
        /* IndexedDB unavailable */
      }
      // full reload so the provider re-reads the now-empty storage
      window.location.reload()
    } catch {
      setBusy(false)
      setConfirm(null)
    }
  }

  const resetAll = () => {
    resetDemoData()
    setConfirm(null)
    setFlash('Local data reset — the illustrative demo dataset is back to its bundled state.')
    refreshStorage()
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Settings"
        title="Preferences & local data"
        description="PaperTrail runs entirely in your browser. This page shows what is stored, where it lives, and how to export or erase it."
        actions={
          <Link to="/about" className="btn-ghost !py-2.5 !text-[13px]">
            About this build
          </Link>
        }
      />

      {flash && (
        <div
          role="status"
          className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          {flash}
        </div>
      )}

      {/* ── Demo data ─────────────────────────────────────────────────────── */}
      <SectionTitle
        kicker="Illustrative data"
        title="Demo dataset"
        description="Bundled fictional subjects and papers used to demonstrate the platform."
      />
      <Card className="p-5 md:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-xl text-graphite">Illustrative demo data</h3>
              <Badge tone="gold">fictional</Badge>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-graphite-600">
              The demo dataset is <span className="font-medium text-graphite">fictional</span> — invented subject names,
              codes, papers and questions generated by a seeded script. It exists only to show how PaperTrail behaves
              with data in it. It is not an official curriculum and not a record of any real examination.
            </p>
            <div className="mt-4">
              <DemoBadge />
            </div>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-gold-600">
              {DEMO_DISCLAIMER}
            </p>
          </div>

          <div className="flex shrink-0 flex-col gap-3">
            <button
              role="switch"
              aria-checked={demoEnabled}
              aria-label="Show illustrative demo data"
              onClick={() => toggleDemo(!demoEnabled)}
              className="inline-flex items-center gap-3 rounded-xl border border-ivory-300 bg-white px-4 py-3 text-sm font-grotesk font-medium text-graphite transition-colors hover:border-graphite-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
            >
              <span
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
                  demoEnabled ? 'bg-navy' : 'bg-ivory-400'
                }`}
                aria-hidden
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                    demoEnabled ? 'left-[18px]' : 'left-0.5'
                  }`}
                />
              </span>
              {demoEnabled ? 'Demo data: on' : 'Demo data: off'}
            </button>
            <button className="btn-ghost !py-2.5 !text-[13px]" onClick={() => setConfirm('reset')}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Reset all local data
            </button>
          </div>
        </div>
      </Card>

      {/* ── Storage ───────────────────────────────────────────────────────── */}
      <div className="mt-10">
        <SectionTitle
          kicker="Storage"
          title="Where your data lives"
          description="Numbers below are read from the browser itself on every visit."
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="localStorage"
            value={info ? formatBytes(info.localBytes) : '…'}
            sub="Metadata, filters, planner, syllabi"
            icon={HardDrive}
          />
          <Stat
            label="IndexedDB documents"
            value={info ? info.docCount : '…'}
            sub={info ? `${formatBytes(info.docBytes)} of stored PDFs` : 'Reading…'}
            icon={FileText}
            accent="academic"
          />
          <Stat
            label="Origin usage"
            value={info && info.usage !== null ? formatBytes(info.usage) : '—'}
            sub={info && info.quota !== null ? `of ~${formatBytes(info.quota)} quota` : 'Estimate unavailable in this browser'}
            icon={Database}
            accent="gold"
          />
          <Stat
            label="Stored records"
            value={`${papers.length}/${questions.length}`}
            sub="Papers / questions in the store"
            icon={Upload}
            accent="lavender"
          />
        </div>

        <Card className="mt-4 border-gold/40 bg-gold-100 p-5">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" aria-hidden />
            <p className="text-sm leading-relaxed text-gold-600">
              <span className="font-medium">{STORAGE_NOTE}</span> There is no server-side encryption here because there
              is no server — treat this browser profile as you would any file on disk.
            </p>
          </div>
        </Card>
      </div>

      {/* ── Data management ───────────────────────────────────────────────── */}
      <div className="mt-10">
        <SectionTitle
          kicker="Data management"
          title="Export, delete, erase"
          description="Exports are generated in the browser. Deletions are permanent and local."
        />
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="flex flex-col p-5">
            <Download className="h-5 w-5 text-navy" aria-hidden />
            <h3 className="mt-3 text-lg text-graphite">Export all local data</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-graphite-600">
              One JSON file containing papers, questions, planner entries, syllabi and your active filters — useful as a
              backup or for inspection.
            </p>
            <button className="btn-primary mt-4 !py-2.5 !text-[13px]" onClick={exportJson}>
              <Download className="h-4 w-4" aria-hidden />
              Export JSON
            </button>
          </Card>

          <Card className="flex flex-col p-5">
            <Trash2 className="h-5 w-5 text-academic" aria-hidden />
            <h3 className="mt-3 text-lg text-graphite">Delete uploaded documents</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-graphite-600">
              Removes every paper you uploaded, the questions extracted from it, and the stored PDF files in IndexedDB.
              The bundled demo dataset is untouched.
            </p>
            <button
              className="btn-ghost mt-4 !py-2.5 !text-[13px]"
              onClick={() => setConfirm('uploads')}
              disabled={busy || (papers.filter((p) => !p.demo).length === 0 && questions.filter((q) => !q.demo).length === 0)}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete uploads
            </button>
          </Card>

          <Card className="flex flex-col p-5">
            <ShieldCheck className="h-5 w-5 text-rose-700" aria-hidden />
            <h3 className="mt-3 text-lg text-graphite">Clear all local data</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-graphite-600">
              Wipes every PaperTrail key in localStorage and every document in IndexedDB, then reloads. Filters, planner,
              syllabi, uploads and demo customisations all go.
            </p>
            <button
              className="btn-ghost mt-4 !py-2.5 !text-[13px] !border-rose-200 text-rose-700 hover:!border-rose-400"
              onClick={() => setConfirm('wipe')}
              disabled={busy}
            >
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Clear everything
            </button>
          </Card>
        </div>
      </div>

      {/* ── Privacy & security ────────────────────────────────────────────── */}
      <div className="mt-10">
        <SectionTitle
          kicker="Privacy & security"
          title="What this app does and does not do"
          description="Informational — there is nothing to configure here."
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-navy" aria-hidden />
              <h3 className="text-lg text-graphite">On-device by design</h3>
            </div>
            <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-graphite-600">
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-navy" aria-hidden />
                No accounts, no sign-in, no session — there is no identity to steal.
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-navy" aria-hidden />
                No server and no API keys: nothing in this app can call out on your behalf.
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-navy" aria-hidden />
                Files never leave the device — PDFs are parsed in the browser and their text stays here.
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-navy" aria-hidden />
                All processing runs in-browser: extraction, question parsing, classification and every chart.
              </li>
            </ul>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-academic" aria-hidden />
              <h3 className="text-lg text-graphite">What is stored, and where</h3>
            </div>
            <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-graphite-600">
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-academic" aria-hidden />
                <span>
                  <span className="font-medium text-graphite">localStorage</span> — papers, questions, syllabi, subjects,
                  planner entries, filters and preferences, as JSON.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-academic" aria-hidden />
                <span>
                  <span className="font-medium text-graphite">IndexedDB</span> — the raw PDF files you uploaded, as binary
                  blobs (they exceed the localStorage quota).
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-academic" aria-hidden />
                <span>
                  <span className="font-medium text-graphite">Neither</span> is encrypted. Clearing your browser data for
                  this origin removes everything PaperTrail knows about you.
                </span>
              </li>
            </ul>
            <p className="mt-4 rounded-xl border border-ivory-200 bg-ivory-50 px-3.5 py-3 text-[13px] leading-relaxed text-graphite-600">
              {STORAGE_NOTE}
            </p>
          </Card>
        </div>
      </div>

      {/* ── About this build ──────────────────────────────────────────────── */}
      <div className="mt-10">
        <SectionTitle kicker="About" title="About this build" />
        <Card className="p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <Sparkles className="h-4 w-4 text-gold-600" aria-hidden />
            <h3 className="text-xl text-graphite">PaperTrail {APP_VERSION}</h3>
            <Badge tone="navy">frontend-only</Badge>
            <Badge tone="blue">React 18 · TypeScript · Vite · Tailwind</Badge>
          </div>

          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <div>
              <p className="eyebrow text-graphite-500">The analysis engine</p>
              <p className="mt-2 text-sm leading-relaxed text-graphite-600">
                Classification runs on a <span className="font-medium text-graphite">local heuristic engine</span>:
                explainable keyword matching between question text and your syllabus structure. Every assignment ships
                with the matched keywords and a confidence score so you can see exactly why it was made — and correct it.
              </p>
              <p className="mt-3 rounded-xl border border-ivory-200 bg-ivory-50 px-3.5 py-3 text-sm leading-relaxed text-graphite-600">
                It is <span className="font-medium text-graphite">explicitly not an AI model</span>. There is no neural
                network, no large language model, no training and no cloud inference anywhere in this build. When no
                syllabus is mapped, classifications are marked provisional rather than dressed up as certainty.
              </p>
            </div>

            <div>
              <p className="eyebrow text-graphite-500">Build details</p>
              <dl className="mt-2 space-y-2 text-sm">
                <div className="flex justify-between gap-3 border-b border-ivory-200 pb-2">
                  <dt className="text-graphite-600">Version</dt>
                  <dd className="font-mono text-[12px] text-graphite">{APP_VERSION}</dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-ivory-200 pb-2">
                  <dt className="text-graphite-600">Rendering</dt>
                  <dd className="font-mono text-[12px] text-graphite">client-side only</dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-ivory-200 pb-2">
                  <dt className="text-graphite-600">Network calls</dt>
                  <dd className="font-mono text-[12px] text-graphite">none</dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-ivory-200 pb-2">
                  <dt className="text-graphite-600">Accounts</dt>
                  <dd className="font-mono text-[12px] text-graphite">none</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-graphite-600">Demo dataset</dt>
                  <dd className="font-mono text-[12px] text-gold-600">illustrative only</dd>
                </div>
              </dl>
              <p className="mt-3 flex items-start gap-2 text-[13px] leading-relaxed text-graphite-500">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                Demo statistics are fictional and do not represent real examination records.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/about" className="btn-ghost !py-2.5 !text-[13px]">
              Read the full about page
            </Link>
            <Link to="/archive" className="btn-ghost !py-2.5 !text-[13px]">
              Open the archive
            </Link>
          </div>
        </Card>
      </div>

      {/* ── Confirmation modals ───────────────────────────────────────────── */}
      <Modal
        open={confirm === 'reset'}
        onClose={() => setConfirm(null)}
        title="Reset all local data?"
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-graphite-600">
            This restores the bundled illustrative demo dataset to its original state: uploaded papers and their
            questions are removed, question edits are discarded, and deleted demo papers come back. Your syllabi,
            subjects, planner and filters are kept.
          </p>
          <div className="rounded-xl border border-gold/40 bg-gold-100 px-4 py-3 text-xs text-gold-600">
            {DEMO_DISCLAIMER}
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <button className="btn-ghost !py-2.5 !text-[13px]" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button className="btn-primary !py-2.5 !text-[13px]" onClick={resetAll}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Reset local data
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={confirm === 'uploads'} onClose={() => setConfirm(null)} title="Delete uploaded documents?">
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-graphite-600">
            Every paper you uploaded ({papers.filter((p) => !p.demo).length}), the questions extracted from them (
            {questions.filter((q) => !q.demo).length}) and the PDF files stored in IndexedDB will be deleted. This
            cannot be undone. The illustrative demo dataset is not affected.
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <button className="btn-ghost !py-2.5 !text-[13px]" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              className="btn-primary !py-2.5 !text-[13px] !bg-rose-700 hover:!bg-rose-800"
              onClick={deleteUploads}
              disabled={busy}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              {busy ? 'Deleting…' : 'Delete uploads'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={confirm === 'wipe'} onClose={() => setConfirm(null)} title="Clear all local data?">
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-graphite-600">
            This erases every PaperTrail key in localStorage and every document in IndexedDB, then reloads the page.
            Uploaded papers, questions, syllabi, subjects, planner entries, filters and preferences are all removed.
            There is no undo and no copy anywhere else — export first if you want to keep anything.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge tone="red">papers</Badge>
            <Badge tone="red">questions</Badge>
            <Badge tone="red">syllabi</Badge>
            <Badge tone="red">planner</Badge>
            <Badge tone="red">stored PDFs</Badge>
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <button className="btn-ghost !py-2.5 !text-[13px]" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              className="btn-primary !py-2.5 !text-[13px] !bg-rose-700 hover:!bg-rose-800"
              onClick={wipeAll}
              disabled={busy}
            >
              <ShieldCheck className="h-4 w-4" aria-hidden />
              {busy ? 'Clearing…' : 'Clear everything'}
            </button>
          </div>
        </div>
      </Modal>

      {papers.length === 0 && questions.length === 0 && !demoEnabled && (
        <div className="mt-10">
          <EmptyState
            icon={Database}
            title="The dataset is empty"
            description="Demo data is off and nothing has been uploaded. Upload a question paper, or switch the illustrative demo dataset back on above."
            action={{ label: 'Upload papers', to: '/upload' }}
          />
        </div>
      )}
    </div>
  )
}
