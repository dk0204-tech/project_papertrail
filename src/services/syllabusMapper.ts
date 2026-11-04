import { Syllabus, SyllabusUnit, Subject, SemesterNumber } from '../types'
import { extractPdfText } from './pdfExtraction'

/**
 * Syllabus ingestion: JSON import, PDF text import, and manual entry.
 *
 * PDF syllabi are parsed with conservative heuristics; anything ambiguous is
 * returned as `warnings` for the user to fix manually rather than guessed at.
 */

export interface SyllabusJsonImport {
  subject?: string
  subjectCode?: string
  units: {
    unitNumber?: number
    title: string
    chapters: { name: string; topics: { name: string; subTopics?: string[] }[] }[]
  }[]
}

export interface ImportResult {
  syllabus: Syllabus | null
  errors: string[]
  warnings: string[]
}

export function importSyllabusJson(
  raw: string,
  subject: Subject,
  provenance: Syllabus['provenance'] = 'user-upload',
): ImportResult {
  const errors: string[] = []
  const warnings: string[] = []
  let data: SyllabusJsonImport
  try {
    data = JSON.parse(raw)
  } catch (e) {
    return { syllabus: null, errors: [`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`], warnings }
  }

  if (!data || !Array.isArray(data.units) || data.units.length === 0) {
    return { syllabus: null, errors: ['JSON must contain a non-empty "units" array.'], warnings }
  }

  const units: SyllabusUnit[] = data.units.map((u, i) => {
    if (!u.title) warnings.push(`Unit ${i + 1} is missing a title; using "Unit ${i + 1}".`)
    if (!Array.isArray(u.chapters)) errors.push(`Unit "${u.title ?? i + 1}" has no chapters array.`)
    return {
      unitNumber: u.unitNumber ?? i + 1,
      title: u.title ?? `Unit ${i + 1}`,
      chapters: (Array.isArray(u.chapters) ? u.chapters : []).map((ch) => ({
        name: ch.name ?? 'Untitled chapter',
        topics: (ch.topics ?? []).map((t) => ({
          name: t.name ?? 'Untitled topic',
          subTopics: t.subTopics ?? [],
        })),
      })),
    }
  })

  if (errors.length > 0) return { syllabus: null, errors, warnings }

  return {
    syllabus: {
      subjectId: subject.id,
      subject: subject.name,
      subjectCode: subject.code,
      department: subject.department,
      programme: subject.programme,
      semester: subject.semester as SemesterNumber,
      provenance,
      units,
    },
    errors,
    warnings,
  }
}

/**
 * Conservative PDF syllabus parser. Recognises lines such as:
 *   "Unit 1: Fundamentals" / "UNIT II — Digital Logic"
 *   "1.1 Topic Name" / "Chapter 3: Sorting"
 *   indented topic / subtopic lines
 */
export async function importSyllabusPdf(
  file: File,
  subject: Subject,
): Promise<ImportResult> {
  const warnings: string[] = []
  const errors: string[] = []

  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    return { syllabus: null, errors: ['Syllabus upload must be a PDF file.'], warnings }
  }
  if (file.size > 20 * 1024 * 1024) {
    return { syllabus: null, errors: ['Syllabus PDF exceeds the 20 MB limit.'], warnings }
  }

  const result = await extractPdfText(file)
  if (result.totalChars < 100) {
    return {
      syllabus: null,
      errors: [
        'Almost no selectable text was found in this PDF — it appears to be scanned. ' +
          'Use manual entry or JSON import instead (OCR of syllabus documents is not reliable enough to auto-structure).',
      ],
      warnings: result.warnings,
    }
  }

  const lines = result.pages.flatMap((p) => p.text.split(/\r?\n/)).map((l) => l.trim()).filter(Boolean)

  const unitRe = /^(?:unit|module|section)\s*([ivxlc]+|\d+)\s*[:.\-–—)]*\s*(.*)$/i
  const topicRe = /^(\d+\.\d+(?:\.\d+)?)\s+(.+)$/
  const chapterRe = /^(?:chapter\s*\d*|chapter\s*\d*\s*[:.\-–—]|\d+\.\d+)\s*[:.\-–—]?\s*(.+)$/i

  const units: SyllabusUnit[] = []
  let currentUnit: SyllabusUnit | null = null
  let currentChapter: { name: string; topics: { name: string; subTopics: string[] }[] } | null = null

  const romanToNum = (r: string): number => {
    const map: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8 }
    return map[r.toLowerCase()] ?? units.length + 1
  }

  for (const line of lines) {
    const u = line.match(unitRe)
    if (u) {
      currentUnit = { unitNumber: romanToNum(u[1]), title: u[2]?.trim() || `Unit ${romanToNum(u[1])}`, chapters: [] }
      units.push(currentUnit)
      currentChapter = null
      continue
    }
    if (!currentUnit) continue

    const t = line.match(topicRe)
    if (t) {
      // "1.2 Topic" style — treat as chapter if it has no third level
      const parts = t[1].split('.').length
      if (parts === 2) {
        currentChapter = { name: t[2].trim(), topics: [] }
        currentUnit.chapters.push(currentChapter)
      } else if (currentChapter) {
        currentChapter.topics.push({ name: t[2].trim(), subTopics: [] })
      } else {
        currentChapter = { name: t[2].trim(), topics: [] }
        currentUnit.chapters.push(currentChapter)
      }
      continue
    }
    const c = line.match(chapterRe)
    if (c && !c[1].includes(':')) {
      currentChapter = { name: c[1].trim(), topics: [] }
      currentUnit.chapters.push(currentChapter)
      continue
    }
    // indented/plain lines become topics of the current chapter
    if (currentUnit && currentChapter && line.length > 3 && line.length < 90 && !/^\d+\s*$/.test(line)) {
      if (currentChapter.topics.length < 40) currentChapter.topics.push({ name: line, subTopics: [] })
    }
  }

  if (units.length === 0) {
    errors.push('No "Unit …" headings were recognised in the syllabus text. Please use manual entry or JSON import.')
    return { syllabus: null, errors, warnings }
  }
  if (units.every((u) => u.chapters.length === 0)) {
    warnings.push('Units were found but no chapters — please review and add chapters manually.')
  }

  return {
    syllabus: {
      subjectId: subject.id,
      subject: subject.name,
      subjectCode: subject.code,
      department: subject.department,
      programme: subject.programme,
      semester: subject.semester,
      provenance: 'user-upload',
      units,
    },
    errors,
    warnings,
  }
}

export function emptySyllabus(subject: Subject): Syllabus {
  return {
    subjectId: subject.id,
    subject: subject.name,
    subjectCode: subject.code,
    department: subject.department,
    programme: subject.programme,
    semester: subject.semester,
    provenance: 'user-manual',
    units: [{ unitNumber: 1, title: 'Unit 1', chapters: [] }],
  }
}

export function syllabusToJson(syllabus: Syllabus): string {
  return JSON.stringify(
    {
      subject: syllabus.subject,
      subjectCode: syllabus.subjectCode,
      units: syllabus.units.map((u) => ({
        unitNumber: u.unitNumber,
        title: u.title,
        chapters: u.chapters.map((c) => ({
          name: c.name,
          topics: c.topics.map((t) => ({ name: t.name, subTopics: t.subTopics })),
        })),
      })),
    },
    null,
    2,
  )
}
