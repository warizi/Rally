/**
 * 남은 IPC handler 파일들의 회귀 테스트 (batch 3).
 *
 * 매우 작은 wrapper 들이라 파일 당 별도 테스트를 만들지 않고 단일 파일에 묶어 처리.
 * 각 파일 별로 register 호출 후 등록 채널 + 1-2개 happy path 검증.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ipcHandlers, getHandler, makeIpcMainMock } from './_ipc-mock'

vi.mock('electron', () => ({
  ...makeIpcMainMock(),
  dialog: {
    showSaveDialog: vi.fn(),
    showOpenDialog: vi.fn()
  }
}))

vi.mock('../../services/backup', () => ({
  backupService: { export: vi.fn(), readManifest: vi.fn(), import: vi.fn() }
}))
vi.mock('../../services/workspace', () => ({
  workspaceService: { getById: vi.fn() }
}))
vi.mock('../../services/canvas-edge', () => ({
  canvasEdgeService: { findByCanvas: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }
}))
vi.mock('../../services/item-tag', () => ({
  itemTagService: {
    getTagsByItem: vi.fn(),
    getItemIdsByTag: vi.fn(),
    attach: vi.fn(),
    detach: vi.fn()
  }
}))
vi.mock('../../services/reminder', () => ({
  reminderService: {
    findByEntity: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    removeByEntity: vi.fn()
  }
}))
vi.mock('../../services/tab-snapshot', () => ({
  tabSnapshotService: {
    getByWorkspaceId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}))
vi.mock('../../services/tag', () => ({
  tagService: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }
}))
vi.mock('../../services/entity-link', () => ({
  entityLinkService: { link: vi.fn(), unlink: vi.fn(), getLinked: vi.fn() }
}))
vi.mock('../../services/note-image', () => ({
  noteImageService: { saveFromPath: vi.fn(), saveFromBuffer: vi.fn(), readImage: vi.fn() }
}))
vi.mock('../../services/recurring-completion', () => ({
  recurringCompletionService: {
    complete: vi.fn(),
    uncomplete: vi.fn(),
    findTodayByWorkspace: vi.fn()
  }
}))
vi.mock('../../services/note-style-template', () => ({
  noteStyleTemplateService: { list: vi.fn(), create: vi.fn(), remove: vi.fn() }
}))
vi.mock('../../services/template', () => ({
  templateService: { list: vi.fn(), create: vi.fn(), delete: vi.fn() }
}))
vi.mock('../../repositories/app-settings', () => ({
  appSettingsRepository: { get: vi.fn(), set: vi.fn() }
}))
vi.mock('../../services/tab-session', () => ({
  tabSessionService: { getByWorkspaceId: vi.fn(), upsert: vi.fn() }
}))
vi.mock('../../services/history', () => ({
  historyService: { fetch: vi.fn() }
}))
vi.mock('../../services/onboarding-sample', () => ({
  onboardingSampleService: { createSampleWorkspace: vi.fn() }
}))

import { registerBackupHandlers } from '../backup'
import { registerCanvasEdgeHandlers } from '../canvas-edge'
import { registerItemTagHandlers } from '../item-tag'
import { registerReminderHandlers } from '../reminder'
import { registerTabSnapshotHandlers } from '../tab-snapshot'
import { registerTagHandlers } from '../tag'
import { registerEntityLinkHandlers } from '../entity-link'
import { registerNoteImageHandlers } from '../note-image'
import { registerRecurringCompletionHandlers } from '../recurring-completion'
import { registerNoteStyleTemplateHandlers } from '../note-style-template'
import { registerTemplateHandlers } from '../template'
import { registerAppSettingsHandlers } from '../app-settings'
import { registerTabSessionHandlers } from '../tab-session'
import { registerHistoryHandlers } from '../history'
import { registerOnboardingHandlers } from '../onboarding'

import { backupService } from '../../services/backup'
import { workspaceService } from '../../services/workspace'
import { canvasEdgeService } from '../../services/canvas-edge'
import { itemTagService } from '../../services/item-tag'
import { reminderService } from '../../services/reminder'
import { tabSnapshotService } from '../../services/tab-snapshot'
import { tagService } from '../../services/tag'
import { entityLinkService } from '../../services/entity-link'
import { noteImageService } from '../../services/note-image'
import { recurringCompletionService } from '../../services/recurring-completion'
import { noteStyleTemplateService } from '../../services/note-style-template'
import { templateService } from '../../services/template'
import { appSettingsRepository } from '../../repositories/app-settings'
import { tabSessionService } from '../../services/tab-session'
import { historyService } from '../../services/history'
import { onboardingSampleService } from '../../services/onboarding-sample'
import { dialog } from 'electron'

beforeEach(() => {
  ipcHandlers.clear()
  vi.clearAllMocks()
  registerBackupHandlers()
  registerCanvasEdgeHandlers()
  registerItemTagHandlers()
  registerReminderHandlers()
  registerTabSnapshotHandlers()
  registerTagHandlers()
  registerEntityLinkHandlers()
  registerNoteImageHandlers()
  registerRecurringCompletionHandlers()
  registerNoteStyleTemplateHandlers()
  registerTemplateHandlers()
  registerAppSettingsHandlers()
  registerTabSessionHandlers()
  registerHistoryHandlers()
  registerOnboardingHandlers()
})

describe('backup IPC handlers', () => {
  it('backup:export → dialog 취소 시 success null', async () => {
    vi.mocked(workspaceService.getById).mockReturnValue({
      id: 'ws-1',
      name: 'W',
      path: '/p',
      createdAt: new Date(),
      updatedAt: new Date()
    })
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: true, filePath: '' })

    const result = await getHandler('backup:export')({}, 'ws-1')
    expect(result).toEqual({ success: true, data: null })
    expect(backupService.export).not.toHaveBeenCalled()
  })

  it('backup:export → 정상 → service.export 호출', async () => {
    vi.mocked(workspaceService.getById).mockReturnValue({
      id: 'ws-1',
      name: 'W',
      path: '/p',
      createdAt: new Date(),
      updatedAt: new Date()
    })
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({
      canceled: false,
      filePath: '/x.zip'
    })
    vi.mocked(backupService.export).mockResolvedValue(undefined as never)

    await getHandler('backup:export')({}, 'ws-1')
    expect(backupService.export).toHaveBeenCalledWith('ws-1', '/x.zip')
  })

  it('backup:selectFile → 취소 시 null', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: true, filePaths: [] })
    const result = await getHandler<string | null>('backup:selectFile')()
    expect(result).toBeNull()
  })

  it('backup:readManifest → 잘못된 형식 → 400 (validateIpc)', () => {
    const result = getHandler<{ success: boolean }>('backup:readManifest')({}, 'not-a-zip-path')
    expect(result).toMatchObject({ success: false })
  })
})

describe('canvas-edge IPC handlers', () => {
  it('4개 채널 등록', () => {
    for (const ch of ['canvasEdge:findByCanvas', 'canvasEdge:create', 'canvasEdge:update', 'canvasEdge:remove']) {
      expect(ipcHandlers.has(ch)).toBe(true)
    }
  })

  it('canvasEdge:create → service 위임', () => {
    getHandler('canvasEdge:create')({}, 'canv-1', { fromNode: 'a', toNode: 'b' })
    expect(canvasEdgeService.create).toHaveBeenCalledWith('canv-1', {
      fromNode: 'a',
      toNode: 'b'
    })
  })

  it('canvasEdge:remove → service 위임', () => {
    getHandler('canvasEdge:remove')({}, 'edge-1')
    expect(canvasEdgeService.remove).toHaveBeenCalledWith('edge-1')
  })
})

describe('item-tag IPC handlers', () => {
  it('attach → service 위임', () => {
    getHandler('itemTag:attach')({}, 'note', 'tag-1', 'n-1')
    expect(itemTagService.attach).toHaveBeenCalledWith('note', 'tag-1', 'n-1')
  })
  it('detach → service 위임', () => {
    getHandler('itemTag:detach')({}, 'note', 'tag-1', 'n-1')
    expect(itemTagService.detach).toHaveBeenCalledWith('note', 'tag-1', 'n-1')
  })
})

describe('reminder IPC handlers', () => {
  it('reminder:set → service.set', () => {
    const data = { entityType: 'todo' as const, entityId: 't-1', offsetMs: 1000 }
    getHandler('reminder:set')({}, data)
    expect(reminderService.set).toHaveBeenCalledWith(data)
  })
  it('reminder:removeByEntity → service 위임', () => {
    getHandler('reminder:removeByEntity')({}, 'todo', 't-1')
    expect(reminderService.removeByEntity).toHaveBeenCalledWith('todo', 't-1')
  })
})

describe('tab-snapshot IPC handlers', () => {
  it('create / update / delete 위임', () => {
    getHandler('tabSnapshot:create')({}, {
      name: 'X',
      workspaceId: 'ws-1',
      tabsJson: '[]',
      panesJson: '[]',
      layoutJson: '{}'
    })
    getHandler('tabSnapshot:update')({}, 'snap-1', { name: 'Y' })
    getHandler('tabSnapshot:delete')({}, 'snap-1')
    expect(tabSnapshotService.create).toHaveBeenCalled()
    expect(tabSnapshotService.update).toHaveBeenCalledWith('snap-1', { name: 'Y' })
    expect(tabSnapshotService.delete).toHaveBeenCalledWith('snap-1')
  })
})

describe('tag IPC handlers', () => {
  it('getAll / create / update / remove 위임', () => {
    getHandler('tag:getAll')({}, 'ws-1')
    getHandler('tag:create')({}, 'ws-1', { name: 'T' })
    getHandler('tag:update')({}, 'tag-1', { name: 'T2' })
    getHandler('tag:remove')({}, 'tag-1')
    expect(tagService.getAll).toHaveBeenCalledWith('ws-1')
    expect(tagService.create).toHaveBeenCalledWith('ws-1', { name: 'T' })
    expect(tagService.update).toHaveBeenCalledWith('tag-1', { name: 'T2' })
    expect(tagService.remove).toHaveBeenCalledWith('tag-1')
  })
})

describe('entity-link IPC handlers', () => {
  it('link / unlink / getLinked 위임', () => {
    getHandler('entityLink:link')({}, 'note', 'n-1', 'todo', 't-1', 'ws-1')
    getHandler('entityLink:unlink')({}, 'note', 'n-1', 'todo', 't-1')
    getHandler('entityLink:getLinked')({}, 'todo', 't-1')
    expect(entityLinkService.link).toHaveBeenCalledWith('note', 'n-1', 'todo', 't-1', 'ws-1')
    expect(entityLinkService.unlink).toHaveBeenCalledWith('note', 'n-1', 'todo', 't-1')
    expect(entityLinkService.getLinked).toHaveBeenCalledWith('todo', 't-1')
  })
})

describe('note-image IPC handlers', () => {
  it('3개 채널 위임', () => {
    getHandler('noteImage:saveFromPath')({}, 'ws-1', '/x.png')
    getHandler('noteImage:saveFromBuffer')({}, 'ws-1', new ArrayBuffer(0), 'png')
    getHandler('noteImage:readImage')({}, 'ws-1', '.images/x.png')
    expect(noteImageService.saveFromPath).toHaveBeenCalled()
    expect(noteImageService.saveFromBuffer).toHaveBeenCalled()
    expect(noteImageService.readImage).toHaveBeenCalled()
  })
})

describe('recurring-completion IPC handlers', () => {
  it('complete → date 를 새 Date 로 wrap', () => {
    const d = new Date()
    getHandler('recurringCompletion:complete')({}, 'rule-1', d)
    expect(recurringCompletionService.complete).toHaveBeenCalledWith('rule-1', expect.any(Date))
  })
  it('uncomplete / findTodayByWorkspace 위임', () => {
    getHandler('recurringCompletion:uncomplete')({}, 'comp-1')
    getHandler('recurringCompletion:findTodayByWorkspace')({}, 'ws-1', new Date())
    expect(recurringCompletionService.uncomplete).toHaveBeenCalledWith('comp-1')
    expect(recurringCompletionService.findTodayByWorkspace).toHaveBeenCalled()
  })
})

describe('note-style-template IPC handlers', () => {
  it('list / create / remove 위임', () => {
    getHandler('noteStyleTemplate:list')()
    getHandler('noteStyleTemplate:create')({}, { name: 'n', settingsJson: '{}' })
    getHandler('noteStyleTemplate:remove')({}, 'tpl-1')
    expect(noteStyleTemplateService.list).toHaveBeenCalled()
    expect(noteStyleTemplateService.create).toHaveBeenCalledWith({ name: 'n', settingsJson: '{}' })
    expect(noteStyleTemplateService.remove).toHaveBeenCalledWith('tpl-1')
  })
})

describe('template IPC handlers', () => {
  it('list / create / delete 위임', () => {
    getHandler('template:list')({}, 'ws-1', 'note')
    getHandler('template:create')({}, {
      workspaceId: 'ws-1',
      title: 't',
      type: 'note',
      jsonData: '{}'
    })
    getHandler('template:delete')({}, 'tpl-1')
    expect(templateService.list).toHaveBeenCalledWith('ws-1', 'note')
    expect(templateService.create).toHaveBeenCalled()
    expect(templateService.delete).toHaveBeenCalledWith('tpl-1')
  })
})

describe('app-settings IPC handlers', () => {
  it('get / set 위임', () => {
    getHandler('settings:get')({}, 'theme')
    getHandler('settings:set')({}, 'theme', 'dark')
    expect(appSettingsRepository.get).toHaveBeenCalledWith('theme')
    expect(appSettingsRepository.set).toHaveBeenCalledWith('theme', 'dark')
  })
})

describe('tab-session IPC handlers', () => {
  it('getByWorkspaceId / upsert 위임', () => {
    getHandler('tabSession:getByWorkspaceId')({}, 'ws-1')
    getHandler('tabSession:upsert')({}, { workspaceId: 'ws-1', tabsJson: '[]' })
    expect(tabSessionService.getByWorkspaceId).toHaveBeenCalledWith('ws-1')
    expect(tabSessionService.upsert).toHaveBeenCalled()
  })
})

describe('history IPC handlers', () => {
  it('fetch → options 없으면 기본 {}', () => {
    vi.mocked(historyService.fetch).mockReturnValue({
      days: [],
      hasMore: false,
      nextDayOffset: 0
    })
    getHandler('history:fetch')({}, 'ws-1')
    expect(historyService.fetch).toHaveBeenCalledWith('ws-1', {})
  })

  it('fetch → options 전달', () => {
    vi.mocked(historyService.fetch).mockReturnValue({
      days: [],
      hasMore: false,
      nextDayOffset: 0
    })
    getHandler('history:fetch')({}, 'ws-1', { dayOffset: 5 })
    expect(historyService.fetch).toHaveBeenCalledWith('ws-1', { dayOffset: 5 })
  })
})

describe('onboarding IPC handlers', () => {
  it('createSampleWorkspace → service 위임', () => {
    getHandler('onboarding:createSampleWorkspace')()
    expect(onboardingSampleService.createSampleWorkspace).toHaveBeenCalled()
  })
})
