/**
 * PDF 본문 → 텍스트 추출. MCP `read` 응답에서 LLM 에게 PDF 콘텐츠를 전달할 때 사용.
 *
 * 내부적으로 `unpdf` 를 사용. unpdf 는 pdfjs-dist 위에 worker-less wrapper 를 씌워
 * Node / Bun / Edge 어디서든 동일하게 동작하므로, Electron 메인 프로세스 번들에서
 * worker 모듈을 resolve 하지 못해 실패하는 문제(pdfjs-dist 직접 사용 시 발생)가 없다.
 */

import { getDocumentProxy, renderPageAsImage, createIsomorphicCanvasFactory } from 'unpdf'

export interface PdfTextResult {
  pageCount: number
  text: string
  /** 추출이 maxPages/maxChars 한도에 걸려 잘렸으면 true. */
  truncated: boolean
}

export interface PdfPageImage {
  page: number
  /** base64 (PNG). */
  data: string
  mimeType: 'image/png'
}

export interface PdfPageImagesResult {
  pageCount: number
  images: PdfPageImage[]
  /** pageCount > maxImages 로 일부 페이지가 제외됐으면 true. */
  truncated: boolean
}

function toUint8Copy(data: Buffer | Uint8Array): Uint8Array {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data)
  const copy = new Uint8Array(buf.byteLength)
  copy.set(buf)
  return copy
}

/**
 * PDF 첫 N 페이지를 PNG 이미지로 렌더해 base64 배열로 돌려준다.
 * 텍스트 layer 가 없는 스캔본 / 표·차트 위주 PDF 를 MCP image content block 으로
 * LLM 에 보여주는 용도. 응답이 매우 무거우므로 `maxImages` 기본값을 보수적으로 둔다.
 *
 * - `maxImages` (기본 3): 렌더할 최대 페이지 수.
 * - `scale` (기본 1.5): pdfjs viewport 배율. 1.0 은 화면 보기 기본, 1.5~2.0 이 OCR/판독에 적당.
 */
export async function renderPdfPagesAsImages(
  data: Buffer | Uint8Array,
  options: { maxImages?: number; scale?: number } = {}
): Promise<PdfPageImagesResult> {
  const maxImages = Math.max(1, options.maxImages ?? 3)
  const scale = Math.max(0.1, options.scale ?? 1.5)

  // Node 환경에서는 canvasImport 를 명시해야 unpdf 가 @napi-rs/canvas 를 로드한다.
  // (isomorphic factory 가 isBrowser=false 분기에서 canvasImport 없으면 throw)
  const canvasImport = (): Promise<typeof import('@napi-rs/canvas')> =>
    import('@napi-rs/canvas')

  // 중요: doc 생성 시 CanvasFactory 를 함께 주입해야 page.render() 가 unpdf 의
  // NodeCanvasFactory 를 쓴다. 안 주면 pdfjs 의 기본 NodeCanvasFactory(unpdf 가
  // 의도적으로 throw 하도록 패치한 것)로 떨어져 "@napi-rs/canvas is not available"
  // 에러가 난다.
  const CanvasFactory = await createIsomorphicCanvasFactory(canvasImport)
  const doc = await getDocumentProxy(toUint8Copy(data), {
    CanvasFactory
  } as unknown as Parameters<typeof getDocumentProxy>[1])
  const pageCount = doc.numPages
  const limit = Math.min(pageCount, maxImages)
  const images: PdfPageImage[] = []

  try {
    for (let i = 1; i <= limit; i++) {
      const buf = await renderPageAsImage(doc, i, { scale, canvasImport })
      images.push({
        page: i,
        data: Buffer.from(buf).toString('base64'),
        mimeType: 'image/png'
      })
    }
  } finally {
    await doc.cleanup()
    await doc.destroy()
  }

  return { pageCount, images, truncated: pageCount > limit }
}

/** 페이지 수만 빠르게 조회 (텍스트 미추출). */
export async function getPdfPageCount(data: Buffer | Uint8Array): Promise<number> {
  const doc = await getDocumentProxy(toUint8Copy(data))
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

  const doc = await getDocumentProxy(toUint8Copy(data))
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
