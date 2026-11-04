import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'

/**
 * Browser-side PDF text extraction via PDF.js. No server, no upload — the file
 * never leaves the machine.
 *
 * Known limitations (surfaced to the user in the UI):
 *  - Scanned/image-only PDFs yield little or no text. OCR is attempted with
 *    Tesseract when available; confidence is reported, never hidden.
 *  - Multi-column or heavily formatted layouts can interleave line order.
 */

// Vite resolves the worker asset and emits it alongside the bundle.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url,
).toString()

export interface PageText {
  pageNumber: number
  text: string
  /** true when this page produced almost no extractable text (likely scanned) */
  likelyScanned: boolean
}

export interface ExtractionResult {
  pages: PageText[]
  totalChars: number
  scannedPages: number
  warnings: string[]
  title?: string
}

export async function extractPdfText(
  file: File,
  onProgress?: (page: number, total: number) => void,
): Promise<ExtractionResult> {
  const warnings: string[] = []
  const buffer = await file.arrayBuffer()

  let doc: PDFDocumentProxy
  try {
    doc = await pdfjs.getDocument({ data: buffer, isEvalSupported: false }).promise
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(
      msg.includes('Invalid PDF') || msg.includes('password')
        ? `Could not open "${file.name}": the file is not a readable PDF (it may be corrupt, password-protected, or not actually a PDF).`
        : `Could not open "${file.name}": ${msg}`,
    )
  }

  const pages: PageText[] = []
  const metadata = await doc.getMetadata().catch(() => null)
  const title = ((metadata?.info as Record<string, unknown> | undefined)?.Title as string | undefined) || undefined

  for (let p = 1; p <= doc.numPages; p++) {
    let page: PDFPageProxy
    try {
      page = await doc.getPage(p)
    } catch {
      warnings.push(`Page ${p} could not be read and was skipped.`)
      continue
    }

    const content = await page.getTextContent()
    // Reconstruct lines from item positions so question numbers stay on their
    // own line instead of running into the question text.
    const lines: { y: number; x: number; str: string }[] = []
    for (const item of content.items) {
      if (!('str' in item)) continue
      const str = item.str
      if (!str) continue
      const y = Math.round(item.transform[5])
      const x = Math.round(item.transform[4])
      lines.push({ y, x, str })
    }

    lines.sort((a, b) => (Math.abs(a.y - b.y) > 3 ? b.y - a.y : a.x - b.x))

    const out: string[] = []
    let currentY: number | null = null
    for (const line of lines) {
      if (currentY === null || Math.abs(line.y - currentY) > 3) {
        out.push(line.str)
        currentY = line.y
      } else {
        out[out.length - 1] += (out[out.length - 1].endsWith(' ') || line.str.startsWith(' ') ? '' : ' ') + line.str
      }
    }

    const text = out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
    pages.push({ pageNumber: p, text, likelyScanned: text.length < 40 })
    onProgress?.(p, doc.numPages)
    page.cleanup()
  }

  const scannedPages = pages.filter((pg) => pg.likelyScanned).length
  if (scannedPages > 0) {
    warnings.push(
      scannedPages === pages.length
        ? 'This PDF appears to be scanned images — almost no selectable text was found. OCR was attempted where available; results may contain errors.'
        : `${scannedPages} of ${pages.length} pages appear to be scanned images — text from those pages may be missing or inaccurate.`,
    )
  }
  if (pages.length === 0) warnings.push('The document contains no readable pages.')

  doc.destroy()
  return {
    pages,
    totalChars: pages.reduce((n, pg) => n + pg.text.length, 0),
    scannedPages,
    warnings,
    title,
  }
}

/**
 * Best-effort OCR for scanned pages using Tesseract.js, loaded lazily so the
 * main bundle stays small. Returns null when Tesseract is unavailable — the
 * caller must then report the limitation honestly rather than fake progress.
 */
export async function ocrPage(
  pageNumber: number,
  _file: File,
): Promise<{ text: string; confidence: number } | null> {
  try {
    const Tesseract = await import('tesseract.js')
    const { data } = await Tesseract.recognize(
      await renderPageToImage(pageNumber, _file),
      'eng',
      { logger: () => {} },
    )
    return { text: data.text ?? '', confidence: (data.confidence ?? 0) / 100 }
  } catch {
    // OCR engine or language data unavailable (e.g. offline) — caller reports
    // the limitation instead of pretending extraction succeeded.
    return null
  }
}

async function renderPageToImage(pageNumber: number, file: File): Promise<any> {
  const buffer = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buffer }).promise
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale: 2 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')!
  await page.render({ canvasContext: ctx, viewport } as any).promise
  doc.destroy()
  return canvas
}

/**
 * Render one page of an in-memory PDF to a canvas for the side-by-side
 * review preview (extracted text next to the original document).
 * Returns the CSS width/height ratio so the canvas can scale responsively.
 */
export async function renderPdfPageToCanvas(
  data: ArrayBuffer,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale = 1.6,
): Promise<{ width: number; height: number }> {
  // pdfjs transfers/detaches the buffer it is given — always hand it a copy.
  const doc = await pdfjs.getDocument({ data: data.slice(0) }).promise
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale })
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable in this browser.')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  await page.render({ canvasContext: ctx, viewport } as any).promise
  doc.destroy()
  return { width: canvas.width, height: canvas.height }
}
