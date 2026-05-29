/**
 * features/folder/manage-folder/ui/FolderTreeDialogs.test.tsx
 *
 * 8개 dialog (folder create/rename/color/delete + note/csv/pdf/image delete) 의 props 매핑.
 * createTarget 있으면 FolderNameDialog 가 createFolder 호출.
 * 삭제 onSuccess → closeTabByPathname.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  closeTabByPathname: vi.fn(),
  dialogSubmits: {} as Record<string, ((name?: string) => void) | (() => void)>
}))

vi.mock('@/entities/tab-system', () => ({
  useTabStore: (sel: (s: { closeTabByPathname: typeof mocks.closeTabByPathname }) => unknown) =>
    sel({ closeTabByPathname: mocks.closeTabByPathname })
}))

vi.mock('../FolderColorDialog', () => ({
  FolderColorDialog: ({
    open,
    onSubmit
  }: {
    open: boolean
    onSubmit: (color: string | null) => void
  }) => {
    if (open) {
      mocks.dialogSubmits['color'] = (() => onSubmit('#ff0000')) as () => void
    }
    return open ? <div data-testid="color-dialog" /> : null
  }
}))

vi.mock('../FolderNameDialog', () => ({
  FolderNameDialog: ({
    open,
    title,
    onSubmit
  }: {
    open: boolean
    title: string
    onSubmit: (name: string) => void
  }) => {
    if (open) {
      mocks.dialogSubmits[title] = ((n?: string) => onSubmit(n ?? 'new-name')) as (
        n?: string
      ) => void
    }
    return open ? <div data-testid={`name-dialog-${title}`} /> : null
  }
}))

vi.mock('../DeleteFolderDialog', () => ({
  DeleteFolderDialog: ({
    open,
    folderName,
    onConfirm
  }: {
    open: boolean
    folderName: string
    onConfirm: () => void
  }) => {
    if (open) {
      mocks.dialogSubmits[`delete-${folderName}`] = onConfirm
    }
    return open ? <div data-testid={`delete-dialog-${folderName}`} /> : null
  }
}))

vi.mock('../../model/folder-tree-helpers', () => ({
  findFolderNode: () => ({ children: [] }),
  collectDescendantPathnames: () => ['/folder/note/child-1', '/folder/csv/child-2']
}))

import { FolderTreeDialogs } from '../FolderTreeDialogs'

const baseMutations = {
  createFolder: vi.fn(),
  isCreatingFolder: false,
  rename: vi.fn(),
  isRenaming: false,
  updateMeta: vi.fn(),
  isUpdatingMeta: false,
  remove: vi.fn(),
  isRemoving: false,
  removeNote: vi.fn(),
  isRemovingNote: false,
  removeCsvFile: vi.fn(),
  isRemovingCsv: false,
  removePdfFile: vi.fn(),
  isRemovingPdf: false,
  removeImageFile: vi.fn(),
  isRemovingImage: false
}

const baseDialogState = {
  createTarget: null,
  setCreateTarget: vi.fn(),
  renameTarget: null,
  setRenameTarget: vi.fn(),
  colorTarget: null,
  setColorTarget: vi.fn(),
  deleteTarget: null,
  setDeleteTarget: vi.fn(),
  noteDeleteTarget: null,
  setNoteDeleteTarget: vi.fn(),
  csvDeleteTarget: null,
  setCsvDeleteTarget: vi.fn(),
  pdfDeleteTarget: null,
  setPdfDeleteTarget: vi.fn(),
  imageDeleteTarget: null,
  setImageDeleteTarget: vi.fn()
} as unknown as Parameters<typeof FolderTreeDialogs>[0]['dialogState']

beforeEach(() => {
  Object.values(baseMutations).forEach(
    (m) => typeof m === 'function' && (m as ReturnType<typeof vi.fn>).mockReset?.()
  )
  Object.values(baseDialogState).forEach(
    (v) => typeof v === 'function' && (v as ReturnType<typeof vi.fn>).mockReset?.()
  )
  mocks.closeTabByPathname.mockReset()
  mocks.dialogSubmits = {}
})

describe('FolderTreeDialogs', () => {
  it('모든 target null → 모든 dialog 미렌더', () => {
    render(
      <FolderTreeDialogs
        workspaceId="ws"
        tree={[]}
        dialogState={baseDialogState}
        mutations={baseMutations}
      />
    )
    expect(screen.queryByTestId(/dialog/)).not.toBeInTheDocument()
  })

  it('createTarget 있음 → "폴더 생성" 다이얼로그 노출', () => {
    const ds = {
      ...baseDialogState,
      createTarget: { parentFolderId: 'p1' }
    } as unknown as Parameters<typeof FolderTreeDialogs>[0]['dialogState']
    render(
      <FolderTreeDialogs workspaceId="ws" tree={[]} dialogState={ds} mutations={baseMutations} />
    )
    expect(screen.getByTestId('name-dialog-폴더 생성')).toBeInTheDocument()
  })

  it('createTarget 있음 + onSubmit → createFolder 호출 + onSuccess → setCreateTarget(null)', () => {
    const setCreateTarget = vi.fn()
    const ds = {
      ...baseDialogState,
      createTarget: { parentFolderId: 'p1' },
      setCreateTarget
    } as unknown as Parameters<typeof FolderTreeDialogs>[0]['dialogState']
    const mutations = {
      ...baseMutations,
      createFolder: vi.fn((_arg, opts) => opts.onSuccess())
    }
    render(<FolderTreeDialogs workspaceId="ws" tree={[]} dialogState={ds} mutations={mutations} />)
    ;(mocks.dialogSubmits['폴더 생성'] as (n: string) => void)('My Folder')
    expect(mutations.createFolder).toHaveBeenCalledWith(
      { workspaceId: 'ws', parentFolderId: 'p1', name: 'My Folder' },
      expect.any(Object)
    )
    expect(setCreateTarget).toHaveBeenCalledWith(null)
  })

  it('colorTarget 있음 + onSubmit → updateMeta', () => {
    const ds = {
      ...baseDialogState,
      colorTarget: { id: 'f1', color: null }
    } as unknown as Parameters<typeof FolderTreeDialogs>[0]['dialogState']
    const mutations = {
      ...baseMutations,
      updateMeta: vi.fn((_arg, opts) => opts.onSuccess())
    }
    render(<FolderTreeDialogs workspaceId="ws" tree={[]} dialogState={ds} mutations={mutations} />)
    ;(mocks.dialogSubmits['color'] as () => void)()
    expect(mutations.updateMeta).toHaveBeenCalledWith(
      { workspaceId: 'ws', folderId: 'f1', data: { color: '#ff0000' } },
      expect.any(Object)
    )
  })

  it('deleteTarget(폴더) 있음 + onConfirm → remove + onSuccess → closeTabByPathname × 자손', () => {
    const ds = {
      ...baseDialogState,
      deleteTarget: { id: 'f1', name: 'Folder X' }
    } as unknown as Parameters<typeof FolderTreeDialogs>[0]['dialogState']
    const mutations = {
      ...baseMutations,
      remove: vi.fn((_arg, opts) => opts.onSuccess())
    }
    render(<FolderTreeDialogs workspaceId="ws" tree={[]} dialogState={ds} mutations={mutations} />)
    ;(mocks.dialogSubmits['delete-Folder X'] as () => void)()
    expect(mocks.closeTabByPathname).toHaveBeenCalledWith('/folder/note/child-1')
    expect(mocks.closeTabByPathname).toHaveBeenCalledWith('/folder/csv/child-2')
  })

  it('noteDeleteTarget 있음 + onConfirm → removeNote + closeTab', () => {
    const ds = {
      ...baseDialogState,
      noteDeleteTarget: { id: 'n1', name: 'Note A' }
    } as unknown as Parameters<typeof FolderTreeDialogs>[0]['dialogState']
    const mutations = {
      ...baseMutations,
      removeNote: vi.fn((_arg, opts) => opts.onSuccess())
    }
    render(<FolderTreeDialogs workspaceId="ws" tree={[]} dialogState={ds} mutations={mutations} />)
    ;(mocks.dialogSubmits['delete-Note A'] as () => void)()
    expect(mutations.removeNote).toHaveBeenCalledWith(
      { workspaceId: 'ws', noteId: 'n1' },
      expect.any(Object)
    )
    expect(mocks.closeTabByPathname).toHaveBeenCalledWith('/folder/note/n1')
  })

  it('csvDeleteTarget → removeCsvFile + closeTab', () => {
    const ds = {
      ...baseDialogState,
      csvDeleteTarget: { id: 'c1', name: 'CSV A' }
    } as unknown as Parameters<typeof FolderTreeDialogs>[0]['dialogState']
    const mutations = {
      ...baseMutations,
      removeCsvFile: vi.fn((_arg, opts) => opts.onSuccess())
    }
    render(<FolderTreeDialogs workspaceId="ws" tree={[]} dialogState={ds} mutations={mutations} />)
    ;(mocks.dialogSubmits['delete-CSV A'] as () => void)()
    expect(mocks.closeTabByPathname).toHaveBeenCalledWith('/folder/csv/c1')
  })

  it('pdfDeleteTarget → removePdfFile + closeTab', () => {
    const ds = {
      ...baseDialogState,
      pdfDeleteTarget: { id: 'p1', name: 'PDF A' }
    } as unknown as Parameters<typeof FolderTreeDialogs>[0]['dialogState']
    const mutations = {
      ...baseMutations,
      removePdfFile: vi.fn((_arg, opts) => opts.onSuccess())
    }
    render(<FolderTreeDialogs workspaceId="ws" tree={[]} dialogState={ds} mutations={mutations} />)
    ;(mocks.dialogSubmits['delete-PDF A'] as () => void)()
    expect(mocks.closeTabByPathname).toHaveBeenCalledWith('/folder/pdf/p1')
  })

  it('imageDeleteTarget → removeImageFile + closeTab', () => {
    const ds = {
      ...baseDialogState,
      imageDeleteTarget: { id: 'i1', name: 'IMG A' }
    } as unknown as Parameters<typeof FolderTreeDialogs>[0]['dialogState']
    const mutations = {
      ...baseMutations,
      removeImageFile: vi.fn((_arg, opts) => opts.onSuccess())
    }
    render(<FolderTreeDialogs workspaceId="ws" tree={[]} dialogState={ds} mutations={mutations} />)
    ;(mocks.dialogSubmits['delete-IMG A'] as () => void)()
    expect(mocks.closeTabByPathname).toHaveBeenCalledWith('/folder/image/i1')
  })

  it('renameTarget → rename 호출', () => {
    const ds = {
      ...baseDialogState,
      renameTarget: { id: 'f1', name: '원본' }
    } as unknown as Parameters<typeof FolderTreeDialogs>[0]['dialogState']
    const mutations = {
      ...baseMutations,
      rename: vi.fn((_arg, opts) => opts.onSuccess())
    }
    render(<FolderTreeDialogs workspaceId="ws" tree={[]} dialogState={ds} mutations={mutations} />)
    ;(mocks.dialogSubmits['이름 변경'] as (n: string) => void)('변경됨')
    expect(mutations.rename).toHaveBeenCalledWith(
      { workspaceId: 'ws', folderId: 'f1', newName: '변경됨' },
      expect.any(Object)
    )
  })
})
