import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, Card, Stat, Badge } from '../components/ui'
import { usePaperTrail } from '../store/PaperTrailStore'
import { usePageTransition } from '../components/PageTransition'
import { SemesterNumber } from '../types'
import { ArrowRight, BookOpen, GraduationCap, Layers, Sparkles, Check, ChevronRight } from 'lucide-react'

export const SemestersPage: React.FC = () => {
  const store = usePaperTrail()
  const navigate = useNavigate()
  const { triggerTransition } = usePageTransition()
  const [selectedSem, setSelectedSem] = useState<SemesterNumber>(3)

  const semesters: SemesterNumber[] = [1, 2, 3, 4, 5, 6, 7, 8]

  const getSemStats = (n: SemesterNumber) => {
    const semSubjects = store.subjects.filter((s) => s.semester === n)
    const semPapers = store.papers.filter((p) => p.semester === n)
    const semQuestions = store.questions.filter((q) => q.semester === n)
    const marks = semQuestions.reduce((sum, q) => sum + (q.marks ?? 0), 0)
    return { semSubjects, semPapers, semQuestions, marks }
  }

  const activeStats = getSemStats(selectedSem)

  // Rich metadata for the 8 MIT Manipal Semester Volumes
  const semesterDetails: Record<SemesterNumber, { title: string; subtitle: string; spineColor: string; accentColor: string; description: string }> = {
    1: { title: 'Foundations & Programming', subtitle: 'Mathematics I, PPS & Basic Engineering', spineColor: 'from-amber-900 via-stone-900 to-amber-950', accentColor: '#b45309', description: 'Core introductory engineering coursework establishing programming logic, linear algebra, and calculus.' },
    2: { title: 'Engineering Physics & Design', subtitle: 'Mathematics II, Basic Electronics & Graphics', spineColor: 'from-stone-800 via-zinc-900 to-stone-950', accentColor: '#57534e', description: 'Advanced mathematical methods, fundamental electronic circuits, and computer-aided engineering graphics.' },
    3: { title: 'Core Data Structures', subtitle: 'Data Structures, Discrete Mathematics & Digital Systems', spineColor: 'from-blue-950 via-indigo-950 to-slate-900', accentColor: '#1e3a8a', description: 'Fundamental data organization, algorithmic efficiency, graph theory, and boolean logic design.' },
    4: { title: 'Systems & Networks', subtitle: 'Computer Networks, Operating Systems & Databases', spineColor: 'from-emerald-950 via-teal-950 to-slate-900', accentColor: '#065f46', description: 'Network protocols, kernel concurrency, process management, and relational database architecture.' },
    5: { title: 'Intelligence & Architecture', subtitle: 'Machine Learning, Computer Architecture & Theory', spineColor: 'from-purple-950 via-indigo-950 to-slate-900', accentColor: '#581c87', description: 'Statistical learning models, CPU pipeline organization, and formal automata theory.' },
    6: { title: 'Advanced Systems & AI', subtitle: 'Artificial Intelligence, Cryptography & Cloud', spineColor: 'from-rose-950 via-red-950 to-slate-900', accentColor: '#9f1239', description: 'Search algorithms, cryptographic ciphers, secure protocols, and distributed cloud computing.' },
    7: { title: 'Specialized Electives', subtitle: 'Deep Learning, Big Data & IoT Systems', spineColor: 'from-cyan-950 via-blue-950 to-slate-900', accentColor: '#155e75', description: 'Neural network architectures, large-scale data pipelines, and embedded sensor networks.' },
    8: { title: 'Capstone & Frontier Tech', subtitle: 'Natural Language Processing & Generative AI', spineColor: 'from-amber-950 via-orange-950 to-stone-950', accentColor: '#c2410c', description: 'State-of-the-art transformer models, large language processing, and distributed autonomous systems.' },
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8 space-y-12">
      <PageHeader
        eyebrow="Academic Library"
        title="8-Semester Bookshelf & Archive"
        description="Explore the complete four-year B.Tech journey at MIT Manipal. Select any semester volume from the interactive academic library below to open its curriculum, papers, and analytics."
        demo={store.papers.some((p) => p.demo)}
        actions={
          <button
            onClick={() => {
              store.setFilters({ semester: selectedSem })
              navigate('/dashboard')
            }}
            className="btn-primary"
          >
            Open Semester {selectedSem} in Dashboard <ArrowRight className="h-4 w-4" />
          </button>
        }
      />

      {/* ── Immersive 8-Semester Bookshelf & Archival Display ─────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-ivory-300 bg-gradient-to-br from-stone-900 via-stone-950 to-black p-6 sm:p-10 shadow-lift2 text-ivory-100">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 font-mono text-[10px] tracking-widest uppercase text-amber-300 mb-3 backdrop-blur-md border border-white/10">
                <Sparkles className="h-3 w-3" />
                <span>Working Volumes · MIT Manipal 8-Semester Archive</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-display text-white tracking-tight">The Academic Library Bookshelf</h2>
              <p className="mt-1 text-sm text-ivory-100/70 max-w-2xl">
                Hand-bound archival semester volumes representing the four-year B.Tech curriculum. Click any book to pull it from the shelf and load its complete examination papers and syllabus.
              </p>
            </div>
            <div className="flex items-center gap-3 font-mono text-xs text-ivory-100/60">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Archive Online</span>
              <span>·</span>
              <span>8 Volumes</span>
            </div>
          </div>

          {/* Wooden Shelf & Hardcover Books Grid */}
          <div className="relative pt-6 pb-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-4 sm:gap-6">
              {semesters.map((n) => {
                const st = getSemStats(n)
                const info = semesterDetails[n]
                const active = selectedSem === n
                return (
                  <button
                    key={n}
                    onClick={() => {
                      setSelectedSem(n)
                      store.setFilters({ semester: n })
                      triggerTransition('/dashboard', `Opening Semester 0${n}`)
                    }}
                    className={`group relative flex flex-col justify-between h-[360px] sm:h-[400px] rounded-2xl p-5 text-left transition-all duration-300 transform focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 bg-gradient-to-b ${info.spineColor} border ${
                      active
                        ? 'border-amber-400/80 shadow-2xl scale-[1.04] -translate-y-2 ring-2 ring-amber-400/40'
                        : 'border-white/15 shadow-xl hover:-translate-y-1.5 hover:border-white/40'
                    }`}
                  >
                    {/* Book Spine Edge Highlight */}
                    <div className="absolute left-0 top-0 bottom-0 w-2.5 rounded-l-2xl bg-gradient-to-r from-white/25 to-transparent pointer-events-none" />
                    
                    {/* Top Header */}
                    <div className="flex items-start justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/70">
                        Vol. 0{n}
                      </span>
                      {active ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-black shadow-md">
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                        </span>
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-white/30 group-hover:bg-amber-400 transition-colors" />
                      )}
                    </div>

                    {/* Spine Title (Vertical Typography illusion) */}
                    <div className="my-auto py-6 space-y-3">
                      <span className="block font-display text-4xl sm:text-5xl text-white tracking-tight">
                        {n}
                      </span>
                      <div className="space-y-1">
                        <span className="block font-mono text-[9px] uppercase tracking-[0.16em] text-amber-300">
                          Semester {n}
                        </span>
                        <h3 className="text-sm font-medium text-white/90 line-clamp-2 leading-snug font-serif">
                          {info.title}
                        </h3>
                      </div>
                    </div>

                    {/* Bottom Metadata */}
                    <div className="space-y-2 pt-3 border-t border-white/10 font-mono text-[10px] text-white/70">
                      <div className="flex justify-between">
                        <span>Subjects:</span>
                        <span className="text-white font-bold">{st.semSubjects.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Papers:</span>
                        <span className="text-white font-bold">{st.semPapers.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Questions:</span>
                        <span className="text-white font-bold">{st.semQuestions.length}</span>
                      </div>
                      <div className={`mt-2 py-1.5 rounded-lg text-center font-mono text-[9px] uppercase tracking-wider transition-colors ${
                        active ? 'bg-amber-400 text-black font-bold' : 'bg-white/10 text-white/90 group-hover:bg-amber-400 group-hover:text-black'
                      }`}>
                        {active ? 'Open Semester' : 'Open Volume →'}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Wooden Shelf Base Board */}
            <div className="absolute bottom-0 inset-x-0 h-4 bg-gradient-to-r from-stone-800 via-stone-700 to-stone-900 rounded-b-xl shadow-2xl border-t border-stone-600" />
          </div>
        </div>
      </div>

      {/* Selected Semester Detail Section */}
      <Card className="p-6 md:p-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-ivory-200 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge tone="navy">Semester {selectedSem} Collection</Badge>
              <Badge tone="gold">{activeStats.marks} Total Marks</Badge>
            </div>
            <h3 className="text-3xl text-graphite font-display">Semester {selectedSem}: {semesterDetails[selectedSem].title}</h3>
            <p className="mt-1 text-sm text-graphite-600 max-w-3xl">
              {semesterDetails[selectedSem].description}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                store.setFilters({ semester: selectedSem })
                navigate('/dashboard')
              }}
              className="btn-primary !py-2.5 !text-[13px]"
            >
              Filter Dashboard to Sem {selectedSem} <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                store.setFilters({ semester: selectedSem })
                navigate('/questions')
              }}
              className="btn-ghost !py-2.5 !text-[13px]"
            >
              Explore Sem {selectedSem} Questions
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Subjects" value={activeStats.semSubjects.length} sub="Registered in curriculum" icon={Layers} accent="navy" />
          <Stat label="Examination Papers" value={activeStats.semPapers.length} sub="In local archive" icon={BookOpen} accent="academic" />
          <Stat label="Extracted Questions" value={activeStats.semQuestions.length} sub="Classified by topic" icon={GraduationCap} accent="gold" />
          <Stat label="Total Marks" value={activeStats.marks} sub="Across all papers" icon={Sparkles} accent="lavender" />
        </div>

        <div>
          <h4 className="text-lg text-graphite mb-4 font-display">Subjects in Semester {selectedSem}</h4>
          {activeStats.semSubjects.length === 0 ? (
            <p className="text-sm text-graphite-500">No subjects configured for this semester.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {activeStats.semSubjects.map((s) => {
                const subPapers = activeStats.semPapers.filter((p) => p.subjectId === s.id)
                const subQs = activeStats.semQuestions.filter((q) => q.subjectId === s.id)
                return (
                  <div key={s.id} className="rounded-2xl border border-ivory-300 bg-ivory-50 p-5 space-y-3 hover:shadow-lift transition-shadow">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-[11px] font-semibold text-navy bg-navy/8 px-2 py-0.5 rounded-md">
                        {s.code}
                      </span>
                      <Badge tone={s.courseType === 'Core' ? 'blue' : 'gold'}>{s.courseType}</Badge>
                    </div>
                    <div>
                      <h5 className="text-base text-graphite font-medium">{s.name}</h5>
                      <p className="text-xs text-graphite-500 mt-0.5">{s.department}</p>
                    </div>
                    <div className="pt-3 border-t border-ivory-200 flex items-center justify-between text-xs font-mono text-graphite-600">
                      <span>{subPapers.length} papers</span>
                      <span>{subQs.length} questions</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
