/**
 * preload bridge 타입 계약 — 조립(assembly) 전용.
 *
 * 도메인별 API/DTO 타입은 `./types/*` 에 응집되어 있다. 이 파일은 도메인 타입을 모아
 * `Window.api` 표면(interface API)으로 조립하고 global 을 augmentation 한다.
 * 런타임 `apis/index.ts` 의 네임스페이스와 이 선언의 key 일치는
 * `__tests__/api-contract-drift.test.ts` 가 회귀로 보장한다.
 */
import { ElectronAPI } from '@electron-toolkit/preload'
import type { NoteAPI } from './types/note'
import type { CsvAPI } from './types/csv'
import type { PdfAPI } from './types/pdf'
import type { ImageAPI } from './types/image'
import type { NoteImageAPI } from './types/note-image'
import type { FolderAPI } from './types/folder'
import type { TabSessionAPI, TabSnapshotAPI } from './types/tab'
import type { WorkspaceAPI } from './types/workspace'
import type { TodoAPI } from './types/todo'
import type { SettingsAPI } from './types/settings'
import type { ScheduleAPI } from './types/schedule'
import type { EntityLinkAPI } from './types/entity-link'
import type { CanvasAPI, CanvasNodeAPI, CanvasEdgeAPI, CanvasGroupAPI } from './types/canvas'
import type { ReminderAPI } from './types/reminder'
import type { TagAPI, ItemTagAPI } from './types/tag'
import type { BackupAPI } from './types/backup'
import type { AppInfoAPI, McpClientAPI } from './types/app-info'
import type { TerminalAPI } from './types/terminal'
import type { RecurringRuleAPI, RecurringCompletionAPI } from './types/recurring'
import type { TemplateAPI } from './types/template'
import type { HistoryAPI } from './types/history'
import type { TrashAPI } from './types/trash'
import type { OnboardingAPI } from './types/onboarding'
import type { NoteStyleTemplateAPI } from './types/note-style-template'
import type { SkillAPI } from './types/skill'
import type { SearchAPI } from './types/search'
import type { EmbeddingAPI } from './types/embedding'
import type { McpActivityAPI } from './types/mcp-activity'
import type { ShellAPI } from './types/shell'

interface API {
  note: NoteAPI
  csv: CsvAPI
  pdf: PdfAPI
  image: ImageAPI
  noteImage: NoteImageAPI
  folder: FolderAPI
  tabSession: TabSessionAPI
  tabSnapshot: TabSnapshotAPI
  workspace: WorkspaceAPI
  todo: TodoAPI
  settings: SettingsAPI
  schedule: ScheduleAPI
  entityLink: EntityLinkAPI
  canvas: CanvasAPI
  canvasNode: CanvasNodeAPI
  canvasEdge: CanvasEdgeAPI
  canvasGroup: CanvasGroupAPI
  reminder: ReminderAPI
  tag: TagAPI
  itemTag: ItemTagAPI
  backup: BackupAPI
  appInfo: AppInfoAPI
  mcpClient: McpClientAPI
  terminal: TerminalAPI
  recurringRule: RecurringRuleAPI
  recurringCompletion: RecurringCompletionAPI
  template: TemplateAPI
  history: HistoryAPI
  trash: TrashAPI
  onboarding: OnboardingAPI
  noteStyleTemplate: NoteStyleTemplateAPI
  skill: SkillAPI
  search: SearchAPI
  embedding: EmbeddingAPI
  mcpActivity: McpActivityAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
    shell: ShellAPI
  }
}
