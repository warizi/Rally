export interface RecurringCompletionItem {
  id: string
  ruleId: string | null
  ruleTitle: string
  workspaceId: string
  completedDate: string
  completedAt: Date
  createdAt: Date
}
