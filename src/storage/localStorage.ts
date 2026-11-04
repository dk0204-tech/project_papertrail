/**
 * All localStorage keys used by PaperTrail, in one place, plus safe
 * read/write helpers. Storage is used for structured metadata and
 * preferences only — raw PDFs go to IndexedDB.
 *
 * Security: localStorage is readable by any script running on the origin and
 * by anyone with access to the browser profile. Never store credentials or
 * secrets here (this app has none by design).
 */

export const STORAGE_KEYS = {
  userPapers: 'pt_user_papers',
  userQuestions: 'pt_user_questions',
  questionOverrides: 'pt_question_overrides',
  userSyllabi: 'pt_user_syllabi',
  userSubjects: 'pt_user_subjects',
  filters: 'pt_filters',
  planner: 'pt_planner',
  revisionQueue: 'pt_revision_queue',
  bookmarks: 'pt_bookmarks',
  practiceHistory: 'pt_practice_history',
  demoEnabled: 'pt_demo_enabled',
  excludedDemoPapers: 'pt_excluded_demo_papers',
  deletedDemoQuestions: 'pt_deleted_demo_questions',
  prefs: 'pt_prefs',
} as const

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (e) {
    console.warn(`PaperTrail: failed to persist "${key}" (storage quota exceeded?)`, e)
    return false
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

/** Remove every PaperTrail key — used by "Clear all local data". */
export function clearAllPaperTrailKeys(): void {
  try {
    for (const key of Object.values(STORAGE_KEYS)) localStorage.removeItem(key)
    // legacy/auxiliary keys
    for (const k of ['pt_excluded_demo_questions', 'papertrail_questions', 'papertrail_papers', 'papertrail_syllabus']) {
      localStorage.removeItem(k)
    }
  } catch {
    /* ignore */
  }
}

/** Rough storage usage in bytes for the Settings page. */
export function localStorageUsageBytes(): number {
  let total = 0
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      total += key.length + (localStorage.getItem(key)?.length ?? 0)
    }
  } catch {
    /* ignore */
  }
  // JS string = UTF-16 → 2 bytes per code unit
  return total * 2
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
