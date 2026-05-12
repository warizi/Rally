import { noteApi } from './note'
import { csvApi } from './csv'
import { pdfApi } from './pdf'
import { imageApi } from './image'
import { noteImageApi } from './note-image'
import { folderApi } from './folder'
import { templateApi } from './template'
import { canvasApi } from './canvas'
import { canvasNodeApi } from './canvas-node'
import { canvasEdgeApi } from './canvas-edge'
import { todoApi } from './todo'
import { recurringRuleApi } from './recurring-rule'
import { recurringCompletionApi } from './recurring-completion'
import { historyApi } from './history'
import { workspaceApi } from './workspace'
import { tabSessionApi } from './tab-session'
import { tabSnapshotApi } from './tab-snapshot'
import { onboardingApi } from './onboarding'
import { backupApi } from './backup'
import { trashApi } from './trash'
import { scheduleApi } from './schedule'
import { reminderApi } from './reminder'
import { tagApi } from './tag'
import { itemTagApi } from './item-tag'
import { entityLinkApi } from './entity-link'
import { settingsApi } from './settings'
import { appInfoApi } from './app-info'
import { mcpClientApi } from './mcp-client'
import { terminalApi } from './terminal'
import { noteStyleTemplateApi } from './note-style-template'

export { shellApi } from './shell'

export const api = {
  note: noteApi,
  csv: csvApi,
  pdf: pdfApi,
  image: imageApi,
  noteImage: noteImageApi,
  folder: folderApi,
  template: templateApi,
  canvas: canvasApi,
  canvasNode: canvasNodeApi,
  canvasEdge: canvasEdgeApi,
  todo: todoApi,
  recurringRule: recurringRuleApi,
  recurringCompletion: recurringCompletionApi,
  history: historyApi,
  workspace: workspaceApi,
  tabSession: tabSessionApi,
  tabSnapshot: tabSnapshotApi,
  onboarding: onboardingApi,
  backup: backupApi,
  trash: trashApi,
  schedule: scheduleApi,
  reminder: reminderApi,
  tag: tagApi,
  itemTag: itemTagApi,
  entityLink: entityLinkApi,
  settings: settingsApi,
  appInfo: appInfoApi,
  mcpClient: mcpClientApi,
  terminal: terminalApi,
  noteStyleTemplate: noteStyleTemplateApi
}
