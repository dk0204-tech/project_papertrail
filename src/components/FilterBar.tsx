import React, { useMemo } from 'react'
import { X, SlidersHorizontal } from 'lucide-react'
import { usePaperTrail } from '../store/PaperTrailStore'
import { useAnalytics } from '../hooks/useAnalytics'
import { DEFAULT_FILTERS, ExamType, FilterState, SemesterNumber } from '../types'

/**
 * The global, cascading filter bar. Every analytics surface renders this; the
 * store's setFilters() resets dependent dimensions automatically, so the
 * dropdowns always show only options that exist within the current scope.
 */

const semesters: SemesterNumber[] = [1, 2, 3, 4, 5, 6, 7, 8]
const examTypes: ExamType[] = ['Midterm', 'Endterm', 'Makeup', 'Internal', 'Supplementary']

function useOptions() {
  const { questions, papers, subjects, filters } = useAnalytics()
  const store = usePaperTrail()

  return useMemo(() => {
    const departments = Array.from(new Set(store.subjects.map((s) => s.department))).sort()
    const programmes = Array.from(new Set(store.subjects.map((s) => s.programme))).sort()
    const years = Array.from(new Set(papers.map((p) => p.year))).sort((a, b) => b - a)

    // Scope options to what's actually available given the other filters
    const subjectScope = subjects.filter((s) => {
      if (filters.department !== 'All' && s.department !== filters.department) return false
      if (filters.programme !== 'All' && s.programme !== filters.programme) return false
      if (filters.semester !== 'All' && s.semester !== filters.semester) return false
      return true
    })

    const units = Array.from(new Set(questions.map((q) => q.unit))).sort()
    const chapters = Array.from(new Set(questions.filter((q) => filters.unit === 'All' || q.unit === filters.unit).map((q) => q.chapter))).sort()
    const topics = Array.from(
      new Set(
        questions
          .filter((q) => (filters.unit === 'All' || q.unit === filters.unit) && (filters.chapter === 'All' || q.chapter === filters.chapter))
          .map((q) => q.topic),
      ),
    ).sort()

    return { departments, programmes, years, subjectScope, units, chapters, topics }
  }, [questions, papers, subjects, filters, store.subjects])
}

const Select: React.FC<{
  label: string
  value: string | number
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  active?: boolean
}> = ({ label, value, onChange, options, active }) => (
  <label className="flex min-w-0 flex-col gap-1">
    <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-graphite-600">{label}</span>
    <select
      value={String(value)}
      onChange={(e) => onChange(e.target.value)}
      className={`field cursor-pointer truncate py-2 text-[13px] ${active ? 'border-navy/40 bg-white font-medium text-navy' : ''}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
)

export const FilterBar: React.FC<{ className?: string; compact?: boolean }> = ({ className = '', compact }) => {
  const { filters, setFilters, resetFilters } = usePaperTrail()
  const opts = useOptions()
  const activeCount = (Object.keys(DEFAULT_FILTERS) as (keyof FilterState)[]).filter((k) => filters[k] !== 'All').length

  const num = (v: string): number | 'All' => (v === 'All' ? 'All' : Number(v))

  return (
    <div className={`card no-print p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-graphite-700">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="font-mono text-[11px] uppercase tracking-[0.16em]">
            Global filters{activeCount > 0 ? ` · ${activeCount} active` : ''}
          </span>
        </div>
        {activeCount > 0 && (
          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-1 rounded-full border border-ivory-300 bg-ivory-50 px-2.5 py-1 text-[11px] font-grotesk font-medium text-graphite-700 hover:border-graphite-400 hover:text-graphite focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
          >
            <X className="h-3 w-3" /> Clear all
          </button>
        )}
      </div>

      <div className={`grid gap-2.5 ${compact ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6' : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5'}`}>
        <Select
          label="Department"
          value={filters.department}
          onChange={(v) => setFilters({ department: v as FilterState['department'] })}
          active={filters.department !== 'All'}
          options={[{ value: 'All', label: 'All departments' }, ...opts.departments.map((d) => ({ value: d, label: d }))]}
        />
        <Select
          label="Programme"
          value={filters.programme}
          onChange={(v) => setFilters({ programme: v as FilterState['programme'] })}
          active={filters.programme !== 'All'}
          options={[{ value: 'All', label: 'All programmes' }, ...opts.programmes.map((d) => ({ value: d, label: d }))]}
        />
        <Select
          label="Semester"
          value={filters.semester}
          onChange={(v) => setFilters({ semester: num(v) as FilterState['semester'] })}
          active={filters.semester !== 'All'}
          options={[{ value: 'All', label: 'All semesters (1–8)' }, ...semesters.map((s) => ({ value: String(s), label: `Semester ${s}` }))]}
        />
        <Select
          label="Subject"
          value={filters.subjectId}
          onChange={(v) => setFilters({ subjectId: v })}
          active={filters.subjectId !== 'All'}
          options={[
            { value: 'All', label: 'All subjects' },
            ...opts.subjectScope.map((s) => ({ value: s.id, label: `${s.code} · ${s.name}` })),
          ]}
        />
        <Select
          label="Exam type"
          value={filters.examType}
          onChange={(v) => setFilters({ examType: v as FilterState['examType'] })}
          active={filters.examType !== 'All'}
          options={[{ value: 'All', label: 'All exam types' }, ...examTypes.map((t) => ({ value: t, label: t }))]}
        />
        <Select
          label="Academic year"
          value={filters.academicYear}
          onChange={(v) => setFilters({ academicYear: num(v) as FilterState['academicYear'] })}
          active={filters.academicYear !== 'All'}
          options={[{ value: 'All', label: 'All years' }, ...opts.years.map((y) => ({ value: String(y), label: String(y) }))]}
        />
        {!compact && (
          <>
            <Select
              label="Unit"
              value={filters.unit}
              onChange={(v) => setFilters({ unit: v })}
              active={filters.unit !== 'All'}
              options={[{ value: 'All', label: 'All units' }, ...opts.units.map((u) => ({ value: u, label: u }))]}
            />
            <Select
              label="Chapter"
              value={filters.chapter}
              onChange={(v) => setFilters({ chapter: v })}
              active={filters.chapter !== 'All'}
              options={[{ value: 'All', label: 'All chapters' }, ...opts.chapters.map((c) => ({ value: c, label: c }))]}
            />
            <Select
              label="Topic"
              value={filters.topic}
              onChange={(v) => setFilters({ topic: v })}
              active={filters.topic !== 'All'}
              options={[{ value: 'All', label: 'All topics' }, ...opts.topics.map((t) => ({ value: t, label: t }))]}
            />
          </>
        )}
      </div>
    </div>
  )
}
