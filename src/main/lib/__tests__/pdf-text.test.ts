import { describe, expect, it, vi, beforeEach } from 'vitest'

// unpdf 의 getDocumentProxy / renderPageAsImage 를 mock 처리. 실제 PDF 파싱 없이 흉내냄.
// vi.mock 은 파일 상단으로 hoist 되므로 mock 함수는 vi.hoisted 로 함께 끌어올려야 함.
const { mockGetDocumentProxy, mockRenderPageAsImage, mockCreateIsomorphicCanvasFactory } =
  vi.hoisted(() => ({
    mockGetDocumentProxy: vi.fn(),
    mockRenderPageAsImage: vi.fn(),
    mockCreateIsomorphicCanvasFactory: vi.fn(async () => class FakeFactory {})
  }))

vi.mock('unpdf', () => ({
  getDocumentProxy: mockGetDocumentProxy,
  renderPageAsImage: mockRenderPageAsImage,
  createIsomorphicCanvasFactory: mockCreateIsomorphicCanvasFactory
}))

import { extractPdfText, getPdfPageCount, renderPdfPagesAsImages } from '../pdf-text'

interface MockPage {
  getTextContent: () => Promise<{ items: Array<{ str: string } | object> }>
  cleanup: () => void
}

function makeMockDoc(pages: string[]): {
  numPages: number
  getPage: (n: number) => Promise<MockPage>
  cleanup: () => Promise<void>
  destroy: () => Promise<void>
} {
  return {
    numPages: pages.length,
    getPage: vi.fn(async (n: number): Promise<MockPage> => {
      const text = pages[n - 1] ?? ''
      return {
        getTextContent: vi.fn(async () => ({
          items: text.split(' ').map((str) => ({ str }))
        })),
        cleanup: vi.fn()
      }
    }),
    cleanup: vi.fn(async () => undefined),
    destroy: vi.fn(async () => undefined)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('extractPdfText', () => {
  it('정상 — 모든 페이지 텍스트 누적, truncated=false', async () => {
    const doc = makeMockDoc(['hello world', 'foo bar'])
    mockGetDocumentProxy.mockResolvedValue(doc)

    const result = await extractPdfText(Buffer.from([0]))
    expect(result.pageCount).toBe(2)
    expect(result.text).toBe('hello world\n\nfoo bar')
    expect(result.truncated).toBe(false)
  })

  it('maxPages 한도 — pageCount > maxPages 면 truncated=true', async () => {
    const doc = makeMockDoc(['page1', 'page2', 'page3'])
    mockGetDocumentProxy.mockResolvedValue(doc)

    const result = await extractPdfText(Buffer.from([0]), { maxPages: 1 })
    expect(result.pageCount).toBe(3)
    expect(result.text).toBe('page1')
    expect(result.truncated).toBe(true)
  })

  it('maxChars 한도 — 누적이 한도 도달 시 즉시 중단', async () => {
    const doc = makeMockDoc(['abcdefghij', 'klmnop'])
    mockGetDocumentProxy.mockResolvedValue(doc)

    const result = await extractPdfText(Buffer.from([0]), { maxChars: 5 })
    expect(result.text).toBe('abcde')
    expect(result.truncated).toBe(true)
  })

  it('doc.destroy/cleanup 항상 호출', async () => {
    const doc = makeMockDoc(['x'])
    mockGetDocumentProxy.mockResolvedValue(doc)

    await extractPdfText(Buffer.from([0]))
    expect(doc.cleanup).toHaveBeenCalled()
    expect(doc.destroy).toHaveBeenCalled()
  })

  it('TextMarkedContent (str 없음) 항목 무시', async () => {
    const doc = {
      numPages: 1,
      getPage: vi.fn(async () => ({
        getTextContent: vi.fn(async () => ({
          items: [{ str: 'hello' }, { type: 'beginMarkedContent' }, { str: 'world' }]
        })),
        cleanup: vi.fn()
      })),
      cleanup: vi.fn(async () => undefined),
      destroy: vi.fn(async () => undefined)
    }
    mockGetDocumentProxy.mockResolvedValue(doc)

    const result = await extractPdfText(Buffer.from([0]))
    expect(result.text).toBe('hello  world')
  })
})

describe('getPdfPageCount', () => {
  it('numPages 만 반환', async () => {
    const doc = makeMockDoc(['a', 'b', 'c', 'd'])
    mockGetDocumentProxy.mockResolvedValue(doc)

    const count = await getPdfPageCount(Buffer.from([0]))
    expect(count).toBe(4)
    expect(doc.destroy).toHaveBeenCalled()
  })
})

describe('renderPdfPagesAsImages', () => {
  it('정상 — 페이지 N개 PNG base64 배열 반환', async () => {
    const doc = makeMockDoc(['p1', 'p2'])
    mockGetDocumentProxy.mockResolvedValue(doc)
    mockRenderPageAsImage.mockImplementation(async (_doc: unknown, n: number) => {
      const buf = Buffer.from(`png-page-${n}`)
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    })

    const result = await renderPdfPagesAsImages(Buffer.from([0]))
    expect(result.pageCount).toBe(2)
    expect(result.images).toHaveLength(2)
    expect(result.images[0]).toEqual({
      page: 1,
      data: Buffer.from('png-page-1').toString('base64'),
      mimeType: 'image/png'
    })
    expect(result.truncated).toBe(false)
  })

  it('maxImages 초과 → truncated=true, 첫 N장만 렌더', async () => {
    const doc = makeMockDoc(['p1', 'p2', 'p3', 'p4', 'p5'])
    mockGetDocumentProxy.mockResolvedValue(doc)
    mockRenderPageAsImage.mockImplementation(async (_doc: unknown, n: number) => {
      const buf = Buffer.from(`x${n}`)
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    })

    const result = await renderPdfPagesAsImages(Buffer.from([0]), { maxImages: 2 })
    expect(result.pageCount).toBe(5)
    expect(result.images).toHaveLength(2)
    expect(result.images.map((i) => i.page)).toEqual([1, 2])
    expect(result.truncated).toBe(true)
  })

  it('scale 옵션 → renderPageAsImage 에 그대로 전달, canvasImport 함수 포함', async () => {
    const doc = makeMockDoc(['p1'])
    mockGetDocumentProxy.mockResolvedValue(doc)
    mockRenderPageAsImage.mockResolvedValue(new ArrayBuffer(4))

    await renderPdfPagesAsImages(Buffer.from([0]), { scale: 2.5 })
    expect(mockRenderPageAsImage).toHaveBeenCalledWith(
      doc,
      1,
      expect.objectContaining({ scale: 2.5, canvasImport: expect.any(Function) })
    )
  })

  it('doc.destroy/cleanup 항상 호출 (렌더 실패 시에도)', async () => {
    const doc = makeMockDoc(['p1'])
    mockGetDocumentProxy.mockResolvedValue(doc)
    mockRenderPageAsImage.mockRejectedValue(new Error('render fail'))

    await expect(renderPdfPagesAsImages(Buffer.from([0]))).rejects.toThrow('render fail')
    expect(doc.cleanup).toHaveBeenCalled()
    expect(doc.destroy).toHaveBeenCalled()
  })
})
