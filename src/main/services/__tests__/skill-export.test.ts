/**
 * skillExportService.exportWithDialog 단위 테스트.
 *
 * - dialog 취소 시 null
 * - 정상 → .skill ZIP 생성 + writeFileSync
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { showSaveDialogMock, writeFileSyncMock, getMock } = vi.hoisted(() => ({
  showSaveDialogMock: vi.fn(),
  writeFileSyncMock: vi.fn(),
  getMock: vi.fn()
}))

vi.mock('electron', () => ({
  dialog: { showSaveDialog: showSaveDialogMock }
}))
vi.mock('fs', () => ({
  writeFileSync: writeFileSyncMock
}))
vi.mock('adm-zip', () => {
  return {
    default: class {
      private files: Array<{ name: string; data: Buffer }> = []
      addFile(name: string, data: Buffer): void {
        this.files.push({ name, data })
      }
      toBuffer(): Buffer {
        return Buffer.from('FAKE-ZIP-DATA')
      }
    }
  }
})
vi.mock('../skill', () => ({
  skillService: { get: getMock }
}))

import { skillExportService } from '../skill-export'

beforeEach(() => {
  vi.clearAllMocks()
  getMock.mockReturnValue({ id: 'sk-1', name: 'my-skill', content: '# SKILL\n...' })
})

describe('skillExportService.exportWithDialog', () => {
  it('취소 시 null', async () => {
    showSaveDialogMock.mockResolvedValue({ canceled: true, filePath: undefined })
    const result = await skillExportService.exportWithDialog('sk-1')
    expect(result).toBeNull()
    expect(writeFileSyncMock).not.toHaveBeenCalled()
  })

  it('정상 → ZIP buffer 를 writeFileSync 로 저장', async () => {
    showSaveDialogMock.mockResolvedValue({ canceled: false, filePath: '/tmp/my-skill.skill' })
    const result = await skillExportService.exportWithDialog('sk-1')
    expect(result).toEqual({ path: '/tmp/my-skill.skill' })
    expect(writeFileSyncMock).toHaveBeenCalledWith('/tmp/my-skill.skill', expect.any(Buffer))
  })

  it('dialog title / defaultPath 에 skill name 사용', async () => {
    showSaveDialogMock.mockResolvedValue({ canceled: true, filePath: undefined })
    await skillExportService.exportWithDialog('sk-1')
    expect(showSaveDialogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'my-skill.skill 내보내기',
        defaultPath: 'my-skill.skill'
      })
    )
  })
})
