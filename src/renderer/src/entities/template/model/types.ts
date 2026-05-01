export type TemplateType = 'note' | 'csv'

export interface Template {
  id: string
  workspaceId: string
  title: string
  type: TemplateType
  jsonData: string
  createdAt: Date
}
