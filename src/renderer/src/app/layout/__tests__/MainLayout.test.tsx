/**
 * app/layout/MainLayout.test.tsx
 *
 * MainLayout 마운트 시 모든 watcher hook + UI 자식 컴포넌트 마운트 확인 (smoke).
 * isTerminalOpen 분기 → TerminalBottomPanel + ResizableHandle 노출.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  isTerminalOpen: false,
  panelSize: 30,
  watcherCalls: [] as string[]
}))

vi.mock('@/shared/ui/sidebar', () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

vi.mock('../MainSidebar', () => ({ default: () => <aside data-testid="sidebar" /> }))

vi.mock('@/entities/tab-system', () => ({
  useFocusModeEffects: () => mocks.watcherCalls.push('focus'),
  useSessionPersistence: () => mocks.watcherCalls.push('session'),
  useTabStore: () => null
}))

vi.mock('@/widgets/tab-system', () => ({
  useTabDnd: () => ({ handleDragStart: vi.fn(), handleDragEnd: vi.fn() }),
  FocusedTabOverlay: () => <div data-testid="focused-overlay" />,
  PaneLayout: () => <div data-testid="pane-layout" />
}))

vi.mock('@features/folder/manage-folder', () => ({
  useFolderWatcher: () => mocks.watcherCalls.push('folder')
}))

vi.mock('@features/file-watcher/manage-watchers', () => ({
  useNoteWatcher: () => mocks.watcherCalls.push('note'),
  useCsvWatcher: () => mocks.watcherCalls.push('csv'),
  usePdfWatcher: () => mocks.watcherCalls.push('pdf'),
  useImageWatcher: () => mocks.watcherCalls.push('image')
}))

vi.mock('@entities/canvas', () => ({
  useCanvasWatcher: () => mocks.watcherCalls.push('canvas')
}))

vi.mock('@entities/todo', () => ({
  useTodoWatcher: () => mocks.watcherCalls.push('todo')
}))

vi.mock('@entities/schedule', () => ({
  useScheduleWatcher: () => mocks.watcherCalls.push('schedule')
}))

vi.mock('@entities/recurring-rule', () => ({
  useRecurringRuleWatcher: () => mocks.watcherCalls.push('recurring')
}))

vi.mock('@entities/template', () => ({
  useTemplateWatcher: () => mocks.watcherCalls.push('template')
}))

vi.mock('@entities/tag', () => ({
  useTagWatcher: () => mocks.watcherCalls.push('tag')
}))

vi.mock('@entities/reminder', () => ({
  useReminderChangedWatcher: () => mocks.watcherCalls.push('reminder-changed')
}))

vi.mock('@entities/entity-link', () => ({
  useEntityLinkWatcher: () => mocks.watcherCalls.push('entity-link')
}))

vi.mock('@features/reminder', () => ({
  useReminderWatcher: () => mocks.watcherCalls.push('reminder')
}))

vi.mock('@entities/trash', () => ({
  useTrashWatcher: () => mocks.watcherCalls.push('trash')
}))

vi.mock('@features/embedding-progress', () => ({
  useEmbeddingProgressWatcher: () => mocks.watcherCalls.push('embedding-progress')
}))

vi.mock('@features/mcp-activity', () => ({
  useMcpActivityWatcher: () => mocks.watcherCalls.push('mcp-activity')
}))

vi.mock('@widgets/keyboard-control', () => ({
  usePaneNavigation: () => mocks.watcherCalls.push('pane-nav'),
  useTabNavigation: () => mocks.watcherCalls.push('tab-nav'),
  useSnapshotNavigation: () => mocks.watcherCalls.push('snapshot-nav'),
  PaneNavOverlay: () => <div data-testid="pane-nav-overlay" />,
  TabNavOverlay: () => <div data-testid="tab-nav-overlay" />,
  SnapshotNavOverlay: () => <div data-testid="snapshot-nav-overlay" />
}))

// 경로는 MainLayout.tsx 가 import 한 path 와 동일해야 함 (../providers/...)
// MainLayout.tsx 의 import: `../providers/update-checker`
vi.mock('../../providers/update-checker', () => ({
  UpdateChecker: () => <div data-testid="update-checker" />
}))

vi.mock('@/widgets/timer', () => ({
  TimerAlarmDialog: () => <div data-testid="timer-alarm" />
}))

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DragOverlay: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="drag-overlay">{children}</div>
  ),
  PointerSensor: vi.fn(),
  pointerWithin: vi.fn(),
  useSensor: vi.fn(),
  useSensors: () => []
}))

vi.mock('@/widgets/terminal-panel', () => ({
  TerminalBottomPanel: () => <div data-testid="terminal-bottom-panel" />
}))

vi.mock('@shared/ui/resizable', () => ({
  ResizablePanelGroup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="panel-group">{children}</div>
  ),
  ResizablePanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResizableHandle: () => <div data-testid="resize-handle" />
}))

vi.mock('@features/terminal', () => ({
  useTerminalPanelStore: (
    sel: (s: { isOpen: boolean; panelSize: number; setPanelSize: (n: number) => void }) => unknown
  ) =>
    sel({
      isOpen: mocks.isTerminalOpen,
      panelSize: mocks.panelSize,
      setPanelSize: vi.fn()
    })
}))

vi.mock('@features/terminal/model/use-terminal-session-persistence', () => ({
  useTerminalSessionPersistence: () => mocks.watcherCalls.push('terminal-session')
}))

vi.mock('../model/pane-routes', () => ({
  PANE_ROUTES: []
}))

vi.mock('@/shared/constants/tab-url', () => ({
  TAB_ICON: { todo: () => null }
}))

vi.mock('@shared/constants/entity-icon', () => ({
  ENTITY_ICON: { folder: () => null, note: () => null },
  ENTITY_ICON_COLOR: { folder: '#000', note: '#fff' }
}))

vi.mock('../model/use-tree-to-tab-listener', () => ({
  useTreeToTabListener: () => mocks.watcherCalls.push('tree-to-tab')
}))

vi.mock('../model/use-tree-drag-monitor', () => ({
  useTreeDragMonitor: () => mocks.watcherCalls.push('tree-drag-monitor')
}))

vi.mock('../model/use-history-link-to-tab-listener', () => ({
  useHistoryLinkToTabListener: () => mocks.watcherCalls.push('history-link-to-tab')
}))

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MainLayout from '../MainLayout'

function r(): ReturnType<typeof render> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MainLayout />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  mocks.isTerminalOpen = false
  mocks.panelSize = 30
  mocks.watcherCalls = []
})

describe('MainLayout', () => {
  it('루트 컴포넌트 마운트 → 사이드바 + PaneLayout + Overlay 자식들 노출', () => {
    r()
    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('pane-layout')).toBeInTheDocument()
    expect(screen.getByTestId('update-checker')).toBeInTheDocument()
    expect(screen.getByTestId('timer-alarm')).toBeInTheDocument()
    expect(screen.getByTestId('pane-nav-overlay')).toBeInTheDocument()
    expect(screen.getByTestId('tab-nav-overlay')).toBeInTheDocument()
    expect(screen.getByTestId('snapshot-nav-overlay')).toBeInTheDocument()
    expect(screen.getByTestId('focused-overlay')).toBeInTheDocument()
  })

  it('모든 watcher hook 호출됨 (smoke)', () => {
    r()
    expect(mocks.watcherCalls).toContain('folder')
    expect(mocks.watcherCalls).toContain('todo')
    expect(mocks.watcherCalls).toContain('schedule')
    expect(mocks.watcherCalls).toContain('session')
    expect(mocks.watcherCalls).toContain('terminal-session')
    expect(mocks.watcherCalls).toContain('tree-to-tab')
  })

  it('isTerminalOpen=false → TerminalBottomPanel 미렌더', () => {
    mocks.isTerminalOpen = false
    r()
    expect(screen.queryByTestId('terminal-bottom-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('resize-handle')).not.toBeInTheDocument()
  })

  it('isTerminalOpen=true → TerminalBottomPanel + ResizableHandle 노출', () => {
    mocks.isTerminalOpen = true
    r()
    expect(screen.getByTestId('terminal-bottom-panel')).toBeInTheDocument()
    expect(screen.getByTestId('resize-handle')).toBeInTheDocument()
  })

  it('DragOverlay 렌더 (활성 드래그 없음)', () => {
    r()
    expect(screen.getByTestId('drag-overlay')).toBeInTheDocument()
  })

  it('모든 entity watcher 호출됨 (canvas/note/csv/pdf/image/recurring/tag/reminder-changed)', () => {
    r()
    expect(mocks.watcherCalls).toContain('canvas')
    expect(mocks.watcherCalls).toContain('note')
    expect(mocks.watcherCalls).toContain('csv')
    expect(mocks.watcherCalls).toContain('pdf')
    expect(mocks.watcherCalls).toContain('image')
    expect(mocks.watcherCalls).toContain('recurring')
    expect(mocks.watcherCalls).toContain('tag')
    expect(mocks.watcherCalls).toContain('reminder-changed')
  })

  it('navigation watcher 호출됨 (pane-nav / tab-nav / snapshot-nav)', () => {
    r()
    expect(mocks.watcherCalls).toContain('pane-nav')
    expect(mocks.watcherCalls).toContain('tab-nav')
    expect(mocks.watcherCalls).toContain('snapshot-nav')
  })

  it('focus + entity-link + reminder + trash + template + tree-drag-monitor 호출됨', () => {
    r()
    expect(mocks.watcherCalls).toContain('focus')
    expect(mocks.watcherCalls).toContain('entity-link')
    expect(mocks.watcherCalls).toContain('reminder')
    expect(mocks.watcherCalls).toContain('trash')
    expect(mocks.watcherCalls).toContain('template')
    expect(mocks.watcherCalls).toContain('mcp-activity')
    expect(mocks.watcherCalls).toContain('tree-drag-monitor')
    expect(mocks.watcherCalls).toContain('history-link-to-tab')
  })

  it('isTerminalOpen=true + panelSize 변경 → panel-group 노출', () => {
    mocks.isTerminalOpen = true
    mocks.panelSize = 50
    r()
    expect(screen.getByTestId('panel-group')).toBeInTheDocument()
    expect(screen.getByTestId('terminal-bottom-panel')).toBeInTheDocument()
  })
})
