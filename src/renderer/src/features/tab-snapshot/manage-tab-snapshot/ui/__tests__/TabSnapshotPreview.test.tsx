/**
 * features/tab-snapshot/manage-tab-snapshot/ui/TabSnapshotPreview.test.tsx
 *
 * layout/panes JSON 파싱 → 재귀 렌더. 잘못된 JSON → null.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TabSnapshotPreview } from '../TabSnapshotPreview'

type SnapArg = Parameters<typeof TabSnapshotPreview>[0]['snapshot']

function makeSnapshot(layout: unknown, panes: unknown, name = 'Snap'): SnapArg {
  return {
    id: 's1',
    name,
    description: null,
    workspaceId: 'ws',
    layoutJson: JSON.stringify(layout),
    panesJson: JSON.stringify(panes),
    tabsJson: '{}',
    createdAt: new Date(0),
    updatedAt: new Date(0)
  } as unknown as SnapArg
}

describe('TabSnapshotPreview', () => {
  it('pane only layout → tabCount 노출', () => {
    const snap = makeSnapshot(
      { id: 'r', type: 'pane', paneId: 'p1' },
      {
        p1: { tabIds: ['t1', 't2'] }
      }
    )
    render(<TabSnapshotPreview snapshot={snap} />)
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Snap')).toBeInTheDocument()
  })

  it('pane 가 panes 에 없어도 0 으로 표시', () => {
    const snap = makeSnapshot({ id: 'r', type: 'pane', paneId: 'p1' }, {})
    render(<TabSnapshotPreview snapshot={snap} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('split (horizontal) → 자식들 모두 렌더', () => {
    const snap = makeSnapshot(
      {
        id: 'r',
        type: 'split',
        direction: 'horizontal',
        sizes: [1, 1],
        children: [
          { id: 'a', type: 'pane', paneId: 'p1' },
          { id: 'b', type: 'pane', paneId: 'p2' }
        ]
      },
      {
        p1: { tabIds: ['t1'] },
        p2: { tabIds: ['t2', 't3', 't4'] }
      }
    )
    render(<TabSnapshotPreview snapshot={snap} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('잘못된 JSON → null', () => {
    const bad = {
      id: 's',
      name: 'x',
      workspaceId: 'ws',
      layoutJson: 'NOT JSON',
      panesJson: '{}',
      tabsJson: '{}',
      activePaneId: 'p1',
      createdAt: 0,
      updatedAt: 0
    } as unknown as Parameters<typeof TabSnapshotPreview>[0]['snapshot']
    const { container } = render(<TabSnapshotPreview snapshot={bad} />)
    expect(container.firstChild).toBeNull()
  })
})
