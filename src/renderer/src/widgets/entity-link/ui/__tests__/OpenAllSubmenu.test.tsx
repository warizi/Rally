/**
 * widgets/entity-link/ui/OpenAllSubmenu.test.tsx
 *
 * PanePickerSubmenu onPaneSelect 호출 시 →
 *   각 LinkedEntity 에 대해 toTabOptions → closeTabByPathname + openTab.
 * 마지막에 onDone() 호출.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  openTab: vi.fn(),
  closeTabByPathname: vi.fn()
}))

vi.mock('@/entities/tab-system', () => ({
  useTabStore: (
    selector: (s: {
      openTab: typeof mocks.openTab
      closeTabByPathname: typeof mocks.closeTabByPathname
    }) => unknown
  ) => selector({ openTab: mocks.openTab, closeTabByPathname: mocks.closeTabByPathname })
}))

vi.mock('../PanePickerSubmenu', () => ({
  PanePickerSubmenu: ({
    onPaneSelect,
    children
  }: {
    onPaneSelect: (paneId: string) => void
    children: (props: { onClick: () => void; isOpen: boolean }) => React.ReactNode
  }) => (
    <div>
      <button type="button" data-testid="trigger-pane" onClick={() => onPaneSelect('pane-x')}>
        select
      </button>
      {children({ onClick: () => {}, isOpen: false })}
    </div>
  )
}))

import { OpenAllSubmenu } from '../OpenAllSubmenu'

describe('OpenAllSubmenu', () => {
  it('"모두 열기" 라벨 렌더', () => {
    render(<OpenAllSubmenu linked={[]} onDone={vi.fn()} />)
    expect(screen.getByText('모두 열기')).toBeInTheDocument()
  })

  it('pane 선택 → 모든 linked entity에 대해 openTab + onDone', () => {
    const onDone = vi.fn()
    render(
      <OpenAllSubmenu
        linked={
          [
            { entityType: 'note', entityId: 'n1', title: 'note 1', linkedAt: 0 },
            { entityType: 'csv', entityId: 'c1', title: 'csv 1', linkedAt: 0 }
          ] as unknown as Parameters<typeof OpenAllSubmenu>[0]['linked']
        }
        onDone={onDone}
      />
    )
    fireEvent.click(screen.getByTestId('trigger-pane'))
    expect(mocks.openTab).toHaveBeenCalledTimes(2)
    expect(mocks.openTab).toHaveBeenNthCalledWith(
      1,
      { type: 'note', pathname: '/folder/note/n1', title: 'note 1' },
      'pane-x'
    )
    expect(mocks.closeTabByPathname).toHaveBeenCalledWith('/folder/note/n1')
    expect(onDone).toHaveBeenCalled()
  })

  it('todo type — parentId 참조해 pathname 구성', () => {
    render(
      <OpenAllSubmenu
        linked={
          [
            { entityType: 'todo', entityId: 'sub-1', title: 'Sub', linkedAt: 0 }
          ] as unknown as Parameters<typeof OpenAllSubmenu>[0]['linked']
        }
        todos={
          [
            {
              id: 'sub-1',
              parentId: 'parent-1',
              title: 'Sub',
              isDone: false
            }
          ] as unknown as Parameters<typeof OpenAllSubmenu>[0]['todos']
        }
        onDone={vi.fn()}
      />
    )
    fireEvent.click(screen.getByTestId('trigger-pane'))
    expect(mocks.openTab).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/todo/parent-1' }),
      'pane-x'
    )
  })
})
