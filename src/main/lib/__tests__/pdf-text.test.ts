import { describe, expect, it, vi, beforeEach } from 'vitest'

// pdfjs-dist 동적 import 를 mock 처리. extractPdfText 가 await import 로 가져오므로
// vi.mock 으로 모듈 자체를 가짜로 대체해 둔다.
const mockGetDocument = vi.fn()

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  getDocument: mockGetDocument
}))

import { extractPdfText, getPdfPageCount } from '../pdf-text'

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
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(doc) })

    const result = await extractPdfText(Buffer.from([0]))
    expect(result.pageCount).toBe(2)
    expect(result.text).toBe('hello world\n\nfoo bar')
    expect(result.truncated).toBe(false)
  })

  it('maxPages 한도 — pageCount > maxPages 면 truncated=true', async () => {
    const doc = makeMockDoc(['page1', 'page2', 'page3'])
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(doc) })

    const result = await extractPdfText(Buffer.from([0]), { maxPages: 1 })
    expect(result.pageCount).toBe(3)
    expect(result.text).toBe('page1')
    expect(result.truncated).toBe(true)
  })

  it('maxChars 한도 — 누적이 한도 도달 시 즉시 중단', async () => {
    const doc = makeMockDoc(['abcdefghij', 'klmnop'])
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(doc) })

    const result = await extractPdfText(Buffer.from([0]), { maxChars: 5 })
    expect(result.text).toBe('abcde')
    expect(result.truncated).toBe(true)
  })

  it('doc.destroy/cleanup 항상 호출', async () => {
    const doc = makeMockDoc(['x'])
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(doc) })

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
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(doc) })

    const result = await extractPdfText(Buffer.from([0]))
    expect(result.text).toBe('hello  world')
  })
})

describe('getPdfPageCount', () => {
  it('numPages 만 반환', async () => {
    const doc = makeMockDoc(['a', 'b', 'c', 'd'])
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(doc) })

    const count = await getPdfPageCount(Buffer.from([0]))
    expect(count).toBe(4)
    expect(doc.destroy).toHaveBeenCalled()
  })
})
