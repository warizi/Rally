/**
 * registerAllRoutes / registerMcpRoutes 회귀 테스트.
 *
 * 19개 sub-register 함수가 모두 router 와 함께 호출되는지 검증.
 * 누락 시 채널 등록이 되지 않아 클라이언트 호출이 404 가 되므로 회귀 차단.
 */
import { describe, it, expect, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  items: vi.fn(),
  browse: vi.fn(),
  read: vi.fn(),
  manageItems: vi.fn(),
  content: vi.fn(),
  folder: vi.fn(),
  canvas: vi.fn(),
  todo: vi.fn(),
  link: vi.fn(),
  schedule: vi.fn(),
  reminder: vi.fn(),
  recurring: vi.fn(),
  template: vi.fn(),
  tag: vi.fn(),
  history: vi.fn(),
  tasks: vi.fn(),
  file: vi.fn(),
  workspace: vi.fn(),
  trash: vi.fn()
}))

vi.mock('../routes/mcp/items', () => ({ registerMcpItemRoutes: mocks.items }))
vi.mock('../routes/mcp/browse', () => ({ registerMcpBrowseRoutes: mocks.browse }))
vi.mock('../routes/mcp/read', () => ({ registerMcpReadRoutes: mocks.read }))
vi.mock('../routes/mcp/manage-items', () => ({ registerMcpManageItemsRoutes: mocks.manageItems }))
vi.mock('../routes/mcp/content', () => ({ registerMcpContentRoutes: mocks.content }))
vi.mock('../routes/mcp/folders', () => ({ registerMcpFolderRoutes: mocks.folder }))
vi.mock('../routes/mcp/canvases', () => ({ registerMcpCanvasRoutes: mocks.canvas }))
vi.mock('../routes/mcp/todos', () => ({ registerMcpTodoRoutes: mocks.todo }))
vi.mock('../routes/mcp/links', () => ({ registerMcpLinkRoutes: mocks.link }))
vi.mock('../routes/mcp/schedules', () => ({ registerMcpScheduleRoutes: mocks.schedule }))
vi.mock('../routes/mcp/reminders', () => ({ registerMcpReminderRoutes: mocks.reminder }))
vi.mock('../routes/mcp/recurring', () => ({ registerMcpRecurringRoutes: mocks.recurring }))
vi.mock('../routes/mcp/templates', () => ({ registerMcpTemplateRoutes: mocks.template }))
vi.mock('../routes/mcp/tags', () => ({ registerMcpTagRoutes: mocks.tag }))
vi.mock('../routes/mcp/history', () => ({ registerMcpHistoryRoutes: mocks.history }))
vi.mock('../routes/mcp/tasks', () => ({ registerMcpTasksRoutes: mocks.tasks }))
vi.mock('../routes/mcp/files', () => ({ registerMcpFileRoutes: mocks.file }))
vi.mock('../routes/mcp/workspace', () => ({ registerMcpWorkspaceRoutes: mocks.workspace }))
vi.mock('../routes/mcp/trash', () => ({ registerMcpTrashRoutes: mocks.trash }))

import { registerAllRoutes } from '../routes'

describe('mcp-api route registration', () => {
  it('registerAllRoutes → 19개 sub-register 모두 호출', () => {
    const fakeRouter = {} as Parameters<typeof registerAllRoutes>[0]
    registerAllRoutes(fakeRouter)

    for (const [name, fn] of Object.entries(mocks)) {
      expect(fn, `register ${name} routes should be called`).toHaveBeenCalledWith(fakeRouter)
    }
  })
})
