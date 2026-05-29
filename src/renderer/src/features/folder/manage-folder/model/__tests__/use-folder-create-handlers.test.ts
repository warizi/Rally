/**
 * features/folder/manage-folder/model/use-folder-create-handlers.test.ts
 *
 * 6개 create/import 핸들러 — mutation 호출 + 성공 시 openRightTab. import 들은
 * file dialog → import × N → 마지막 만 탭 오픈하는 패턴.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  createNote: vi.fn(),
  importNote: vi.fn(),
  createCsv: vi.fn(),
  importCsv: vi.fn(),
  importPdf: vi.fn(),
  importImage: vi.fn(),
  openRightTab: vi.fn(),
  noteSelect: vi.fn(),
  csvSelect: vi.fn(),
  pdfSelect: vi.fn(),
  imageSelect: vi.fn()
}))

vi.mock('@entities/note', () => ({
  useCreateNote: () => ({ mutate: mocks.createNote }),
  useImportNote: () => ({ mutateAsync: mocks.importNote })
}))
vi.mock('@entities/csv-file', () => ({
  useCreateCsvFile: () => ({ mutate: mocks.createCsv }),
  useImportCsvFile: () => ({ mutateAsync: mocks.importCsv })
}))
vi.mock('@entities/pdf-file', () => ({ useImportPdfFile: () => ({ mutate: mocks.importPdf }) }))
vi.mock('@entities/image-file', () => ({
  useImportImageFile: () => ({ mutateAsync: mocks.importImage })
}))
vi.mock('@/entities/tab-system', () => ({
  useTabStore: (sel: (s: { openRightTab: typeof mocks.openRightTab }) => unknown) =>
    sel({ openRightTab: mocks.openRightTab })
}))

import { useFolderCreateHandlers } from '../use-folder-create-handlers'

beforeEach(() => {
  Object.values(mocks).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockClear())
  ;(window as unknown as Record<string, unknown>).api = {
    note: { selectFile: mocks.noteSelect },
    csv: { selectFile: mocks.csvSelect },
    pdf: { selectFile: mocks.pdfSelect },
    image: { selectFile: mocks.imageSelect }
  }
})

function build(): ReturnType<typeof useFolderCreateHandlers> {
  const { result } = renderHook(() =>
    useFolderCreateHandlers({ workspaceId: 'ws-1', sourcePaneId: 'main' })
  )
  return result.current
}

describe('handleCreateNote', () => {
  it('createNote 호출 + 성공 콜백 시 openRightTab', () => {
    mocks.createNote.mockImplementation((_args, opts: { onSuccess: (note: unknown) => void }) => {
      opts.onSuccess({ id: 'n-1', title: 'newnote' })
    })
    const h = build()
    h.handleCreateNote('f-1')
    expect(mocks.createNote).toHaveBeenCalledWith(
      { workspaceId: 'ws-1', folderId: 'f-1', name: '새로운 노트' },
      expect.any(Object)
    )
    expect(mocks.openRightTab).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'note', pathname: '/folder/note/n-1' }),
      'main'
    )
  })

  it('createNote 콜백이 undefined 반환 → openRightTab 호출 안 함', () => {
    mocks.createNote.mockImplementation((_args, opts: { onSuccess: (note: unknown) => void }) => {
      opts.onSuccess(undefined)
    })
    const h = build()
    h.handleCreateNote(null)
    expect(mocks.openRightTab).not.toHaveBeenCalled()
  })
})

describe('handleCreateCsv', () => {
  it('createCsvFile 호출 + 성공 시 openRightTab', () => {
    mocks.createCsv.mockImplementation((_args, opts: { onSuccess: (csv: unknown) => void }) => {
      opts.onSuccess({ id: 'c-1', title: 't.csv' })
    })
    const h = build()
    h.handleCreateCsv('f-1')
    expect(mocks.createCsv).toHaveBeenCalled()
    expect(mocks.openRightTab).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/folder/csv/c-1' }),
      'main'
    )
  })
})

describe('handleImportNote', () => {
  it('파일 선택 안 함 → import 호출 안 함', async () => {
    mocks.noteSelect.mockResolvedValue([])
    const h = build()
    await act(async () => {
      await h.handleImportNote('f-1')
    })
    expect(mocks.importNote).not.toHaveBeenCalled()
  })

  it('여러 파일 → import × N + 마지막 결과로 openRightTab', async () => {
    mocks.noteSelect.mockResolvedValue(['/a.md', '/b.md', '/c.md'])
    let counter = 0
    mocks.importNote.mockImplementation(async () => ({
      id: `n-${++counter}`,
      title: `note${counter}`
    }))
    const h = build()
    await act(async () => {
      await h.handleImportNote('f-1')
    })
    expect(mocks.importNote).toHaveBeenCalledTimes(3)
    expect(mocks.openRightTab).toHaveBeenCalledTimes(1)
    expect(mocks.openRightTab).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/folder/note/n-3' }),
      'main'
    )
  })

  it('selectFile null 반환 → import 호출 안 함', async () => {
    mocks.noteSelect.mockResolvedValue(null)
    const h = build()
    await act(async () => {
      await h.handleImportNote('f-1')
    })
    expect(mocks.importNote).not.toHaveBeenCalled()
  })
})

describe('handleImportCsv', () => {
  it('여러 파일 → import × N + 마지막 결과로 openRightTab', async () => {
    mocks.csvSelect.mockResolvedValue(['/a.csv', '/b.csv'])
    let counter = 0
    mocks.importCsv.mockImplementation(async () => ({
      id: `c-${++counter}`,
      title: `csv${counter}`
    }))
    const h = build()
    await act(async () => {
      await h.handleImportCsv(null)
    })
    expect(mocks.importCsv).toHaveBeenCalledTimes(2)
    expect(mocks.openRightTab).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/folder/csv/c-2' }),
      'main'
    )
  })
})

describe('handleImportPdf', () => {
  it('단일 파일 선택 → import + 성공 시 openRightTab', async () => {
    mocks.pdfSelect.mockResolvedValue('/x.pdf')
    mocks.importPdf.mockImplementation((_args, opts: { onSuccess: (pdf: unknown) => void }) => {
      opts.onSuccess({ id: 'p-1', title: 't.pdf' })
    })
    const h = build()
    await act(async () => {
      await h.handleImportPdf(null)
    })
    expect(mocks.importPdf).toHaveBeenCalled()
    expect(mocks.openRightTab).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/folder/pdf/p-1', type: 'pdf' }),
      'main'
    )
  })

  it('파일 선택 취소 (null) → import 호출 안 함', async () => {
    mocks.pdfSelect.mockResolvedValue(null)
    const h = build()
    await act(async () => {
      await h.handleImportPdf(null)
    })
    expect(mocks.importPdf).not.toHaveBeenCalled()
  })
})

describe('handleImportImage', () => {
  it('여러 이미지 → import × N + 마지막 만 탭 오픈', async () => {
    mocks.imageSelect.mockResolvedValue(['/1.png', '/2.png'])
    let counter = 0
    mocks.importImage.mockImplementation(async () => ({
      id: `i-${++counter}`,
      title: `img${counter}`
    }))
    const h = build()
    await act(async () => {
      await h.handleImportImage('f-1')
    })
    expect(mocks.importImage).toHaveBeenCalledTimes(2)
    expect(mocks.openRightTab).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/folder/image/i-2', type: 'image' }),
      'main'
    )
  })
})
