/**
 * PDF 본문 → 텍스트 추출. MCP `read` 응답에서 LLM 에게 PDF 콘텐츠를 전달할 때 사용.
 *
 * pdfjs-dist 는 ESM-only 이므로 lazy 동적 import 로 로드한다. 첫 호출 시점에만 모듈을
 * 로드해 cold start 영향을 최소화. 메인 프로세스(Node) 환경 전용 — worker 없이 같은
 * 스레드에서 실행.
 */

type PdfjsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs')

let pdfjsPromise: Promise<PdfjsModule> | null = null

async function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs')
  }
  return pdfjsPromise
}

export interface PdfTextResult {
  pageCount: number
  text: string
  /** 추출이 maxPages/maxChars 한도에 걸려 잘렸으면 true. */
  truncated: boolean
}

function toUint8Copy(data: Buffer | Uint8Array): Uint8Array {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data)
  const copy = new Uint8Array(buf.byteLength)
  copy.set(buf)
  return copy
}

/** 페이지 수만 빠르게 조회 (텍스트 미추출). */
export async function getPdfPageCount(data: Buffer | Uint8Array): Promise<number> {
  const { getDocument } = await loadPdfjs()
  const loadingTask = getDocument({
    data: toUint8Copy(data),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false
  })
  const doc = await loadingTask.promise
  try {
    return doc.numPages
  } finally {
    await doc.cleanup()
    await doc.destroy()
  }
}

/**
 * PDF 바이너리에서 페이지 수와 평문 텍스트를 추출한다.
 * - `maxPages` (기본 10): 추출 페이지 수 상한. 초과 페이지는 잘림 처리.
 * - `maxChars` (기본 200_000): 누적 텍스트 길이 상한. 도달하면 즉시 중단.
 */
export async function extractPdfText(
  data: Buffer | Uint8Array,
  options: { maxPages?: number; maxChars?: number } = {}
): Promise<PdfTextResult> {
  const maxPages = Math.max(1, options.maxPages ?? 10)
  const maxChars = Math.max(1, options.maxChars ?? 200_000)

  const { getDocument } = await loadPdfjs()
  const loadingTask = getDocument({
    data: toUint8Copy(data),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false
  })
  const doc = await loadingTask.promise

  const pageCount = doc.numPages
  const limit = Math.min(pageCount, maxPages)
  let text = ''
  let truncated = pageCount > limit

  try {
    for (let i = 1; i <= limit; i++) {
      const page = await doc.getPage(i)
      try {
        const content = await page.getTextContent()
        const pageText = content.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
        const remaining = maxChars - text.length
        if (pageText.length >= remaining) {
          text += pageText.slice(0, remaining)
          truncated = true
          break
        }
        text += pageText
        if (i < limit) text += '\n\n'
      } finally {
        page.cleanup()
      }
    }
  } finally {
    await doc.cleanup()
    await doc.destroy()
  }

  return { pageCount, text: text.trim(), truncated }
}
