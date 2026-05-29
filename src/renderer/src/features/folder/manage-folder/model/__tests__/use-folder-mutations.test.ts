/**
 * features/folder/manage-folder/model/use-folder-mutations.test.ts
 *
 * 8 entity mutation hook 묶음 wrapper. flat 반환에서 모든 키 노출.
 * 각 entity 의 mock 이 동일 mutate/isPending 객체를 반환하므로 단순 forwarding 검증.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  createFolder: vi.fn(),
  rename: vi.fn(),
  remove: vi.fn(),
  updateMeta: vi.fn(),
  dupNote: vi.fn(),
  rmNote: vi.fn(),
  dupCsv: vi.fn(),
  rmCsv: vi.fn(),
  dupPdf: vi.fn(),
  rmPdf: vi.fn(),
  dupImage: vi.fn(),
  rmImage: vi.fn()
}))

vi.mock('@entities/folder', () => ({
  useCreateFolder: () => ({ mutate: mocks.createFolder, isPending: false }),
  useRenameFolder: () => ({ mutate: mocks.rename, isPending: true }),
  useRemoveFolder: () => ({ mutate: mocks.remove, isPending: false }),
  useUpdateFolderMeta: () => ({ mutate: mocks.updateMeta, isPending: false })
}))
vi.mock('@entities/note', () => ({
  useDuplicateNote: () => ({ mutate: mocks.dupNote }),
  useRemoveNote: () => ({ mutate: mocks.rmNote, isPending: true })
}))
vi.mock('@entities/csv-file', () => ({
  useDuplicateCsvFile: () => ({ mutate: mocks.dupCsv }),
  useRemoveCsvFile: () => ({ mutate: mocks.rmCsv, isPending: false })
}))
vi.mock('@entities/pdf-file', () => ({
  useDuplicatePdfFile: () => ({ mutate: mocks.dupPdf }),
  useRemovePdfFile: () => ({ mutate: mocks.rmPdf, isPending: false })
}))
vi.mock('@entities/image-file', () => ({
  useDuplicateImageFile: () => ({ mutate: mocks.dupImage }),
  useRemoveImageFile: () => ({ mutate: mocks.rmImage, isPending: true })
}))

import { useFolderMutations } from '../use-folder-mutations'

describe('useFolderMutations', () => {
  it('모든 mutate 와 isPending 키가 노출됨', () => {
    const { result } = renderHook(() => useFolderMutations())
    const keys = Object.keys(result.current)
    for (const k of [
      'createFolder',
      'isCreatingFolder',
      'rename',
      'isRenaming',
      'remove',
      'isRemoving',
      'updateMeta',
      'isUpdatingMeta',
      'duplicateNote',
      'removeNote',
      'isRemovingNote',
      'duplicateCsvFile',
      'removeCsvFile',
      'isRemovingCsv',
      'duplicatePdfFile',
      'removePdfFile',
      'isRemovingPdf',
      'duplicateImageFile',
      'removeImageFile',
      'isRemovingImage'
    ]) {
      expect(keys).toContain(k)
    }
  })

  it('isPending 값 forwarding — rename/removeNote/removeImage 가 pending', () => {
    const { result } = renderHook(() => useFolderMutations())
    expect(result.current.isCreatingFolder).toBe(false)
    expect(result.current.isRenaming).toBe(true)
    expect(result.current.isRemoving).toBe(false)
    expect(result.current.isUpdatingMeta).toBe(false)
    expect(result.current.isRemovingNote).toBe(true)
    expect(result.current.isRemovingCsv).toBe(false)
    expect(result.current.isRemovingPdf).toBe(false)
    expect(result.current.isRemovingImage).toBe(true)
  })

  it('mutate 함수가 hook 결과 그대로 전달', () => {
    const { result } = renderHook(() => useFolderMutations())
    expect(result.current.createFolder).toBe(mocks.createFolder)
    expect(result.current.rename).toBe(mocks.rename)
    expect(result.current.duplicateNote).toBe(mocks.dupNote)
    expect(result.current.removeImageFile).toBe(mocks.rmImage)
  })
})
