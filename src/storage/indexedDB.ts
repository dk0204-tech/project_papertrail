/**
 * IndexedDB helper for storing raw uploaded PDFs locally.
 *
 * Why IndexedDB: PDFs are binary and often exceed the ~5MB localStorage
 * quota. The files stay on-device — nothing is transmitted anywhere.
 *
 * Security note: browser storage (localStorage/IndexedDB) is NOT encrypted
 * server-side storage. Anyone with access to the browser profile can read it.
 * The Settings page exposes a one-click wipe for exactly this reason.
 */

const DB_NAME = 'papertrail'
const DB_VERSION = 1
const STORE = 'documents'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Could not open local document store.'))
  })
  return dbPromise
}

export interface StoredDocument {
  id: string
  name: string
  size: number
  type: string
  addedAt: number
  blob: Blob
}

export async function putDocument(doc: StoredDocument): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(doc)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getDocument(id: string): Promise<StoredDocument | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve((req.result as StoredDocument) ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function listDocuments(): Promise<StoredDocument[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve((req.result as StoredDocument[]) ?? [])
    req.onerror = () => reject(req.error)
  })
}

export async function clearDocuments(): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Best-effort byte usage report for the Settings page. */
export async function estimateUsage(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null
  try {
    const e = await navigator.storage.estimate()
    return { usage: e.usage ?? 0, quota: e.quota ?? 0 }
  } catch {
    return null
  }
}
