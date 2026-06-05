import { ipcMain, shell } from 'electron'
import { isAllowedExternalUrl } from '../lib/external-url'
import { registerWorkspaceHandlers } from '../ipc/workspace'
import { registerTabSessionHandlers } from '../ipc/tab-session'
import { registerTabSnapshotHandlers } from '../ipc/tab-snapshot'
import { registerFolderHandlers } from '../ipc/folder'
import { registerNoteHandlers } from '../ipc/note'
import { registerTodoHandlers } from '../ipc/todo'
import { registerCsvFileHandlers } from '../ipc/csv-file'
import { registerPdfFileHandlers } from '../ipc/pdf-file'
import { registerImageFileHandlers } from '../ipc/image-file'
import { registerAppSettingsHandlers } from '../ipc/app-settings'
import { registerScheduleHandlers } from '../ipc/schedule'
import { registerEntityLinkHandlers } from '../ipc/entity-link'
import { registerCanvasHandlers } from '../ipc/canvas'
import { registerCanvasNodeHandlers } from '../ipc/canvas-node'
import { registerCanvasEdgeHandlers } from '../ipc/canvas-edge'
import { registerCanvasGroupHandlers } from '../ipc/canvas-group'
import { registerNoteImageHandlers } from '../ipc/note-image'
import { registerReminderHandlers } from '../ipc/reminder'
import { registerTagHandlers } from '../ipc/tag'
import { registerItemTagHandlers } from '../ipc/item-tag'
import { registerTerminalHandlers } from '../ipc/terminal'
import { registerAppInfoHandlers } from '../ipc/app-info'
import { registerBackupHandlers } from '../ipc/backup'
import { registerRecurringRuleHandlers } from '../ipc/recurring-rule'
import { registerRecurringCompletionHandlers } from '../ipc/recurring-completion'
import { registerTemplateHandlers } from '../ipc/template'
import { registerNoteStyleTemplateHandlers } from '../ipc/note-style-template'
import { registerHistoryHandlers } from '../ipc/history'
import { registerTrashHandlers } from '../ipc/trash'
import { registerOnboardingHandlers } from '../ipc/onboarding'
import { registerSkillHandlers } from '../ipc/skill'

/**
 * 모든 IPC handler 등록을 한곳에서 묶는다. 신규 도메인 IPC 추가 시 이 파일만 수정.
 * shell:openExternal 은 allowlist(isAllowedExternalUrl) 통과 시에만 OS browser 로 연다.
 */
export function registerAllIpcHandlers(): void {
  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    if (isAllowedExternalUrl(url)) {
      await shell.openExternal(url)
    }
  })

  registerWorkspaceHandlers()
  registerTabSessionHandlers()
  registerTabSnapshotHandlers()
  registerFolderHandlers()
  registerNoteHandlers()
  registerTodoHandlers()
  registerCsvFileHandlers()
  registerPdfFileHandlers()
  registerImageFileHandlers()
  registerAppSettingsHandlers()
  registerScheduleHandlers()
  registerEntityLinkHandlers()
  registerCanvasHandlers()
  registerCanvasNodeHandlers()
  registerCanvasEdgeHandlers()
  registerCanvasGroupHandlers()
  registerNoteImageHandlers()
  registerReminderHandlers()
  registerTagHandlers()
  registerItemTagHandlers()
  registerTerminalHandlers()
  registerAppInfoHandlers()
  registerBackupHandlers()
  registerRecurringRuleHandlers()
  registerRecurringCompletionHandlers()
  registerTemplateHandlers()
  registerNoteStyleTemplateHandlers()
  registerHistoryHandlers()
  registerTrashHandlers()
  registerOnboardingHandlers()
  registerSkillHandlers()
}
