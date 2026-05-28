import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TabContextMenu } from '../TabContextMenu'
import { useTabStore } from '@/entities/tab-system'

const MAIN_PANE = 'main'

beforeEach(() => {
  useTabStore.getState().reset()
})

function openMenuForActiveTab(): string {
  const tabId = useTabStore.getState().openTab({ type: 'todo', pathname: '/todo', title: '할일' })
  const tab = useTabStore.getState().tabs[tabId]

  render(
    <TabContextMenu tab={tab} paneId={MAIN_PANE}>
      <div data-testid="trigger">trigger</div>
    </TabContextMenu>
  )
  fireEvent.contextMenu(screen.getByTestId('trigger'))
  return tabId
}

describe('TabContextMenu — 화면 전체보기', () => {
  it('focus 상태가 아니면 "화면 전체보기" 항목을 보여준다', () => {
    openMenuForActiveTab()
    expect(screen.getByText('화면 전체보기')).toBeInTheDocument()
    expect(screen.queryByText('화면 전체보기 해제')).not.toBeInTheDocument()
  })

  it('"화면 전체보기" 클릭 시 enterFocusMode 가 호출되어 스택 top 으로 push 된다', () => {
    const tabId = openMenuForActiveTab()
    fireEvent.click(screen.getByText('화면 전체보기'))
    expect(useTabStore.getState().focusedTabIds).toEqual([tabId])
  })

  it('이미 focus 중인 탭이면 "화면 전체보기 해제" 항목을 보여준다', () => {
    const tabId = useTabStore.getState().openTab({ type: 'todo', pathname: '/todo', title: '할일' })
    useTabStore.getState().enterFocusMode(tabId)

    const tab = useTabStore.getState().tabs[tabId]
    render(
      <TabContextMenu tab={tab} paneId={MAIN_PANE}>
        <div data-testid="trigger">trigger</div>
      </TabContextMenu>
    )
    fireEvent.contextMenu(screen.getByTestId('trigger'))

    expect(screen.getByText('화면 전체보기 해제')).toBeInTheDocument()
    expect(screen.queryByText('화면 전체보기')).not.toBeInTheDocument()
  })

  it('"화면 전체보기 해제" 클릭 시 스택 top 이 pop 되어 빈 배열이 된다', () => {
    const tabId = useTabStore.getState().openTab({ type: 'todo', pathname: '/todo', title: '할일' })
    useTabStore.getState().enterFocusMode(tabId)

    const tab = useTabStore.getState().tabs[tabId]
    render(
      <TabContextMenu tab={tab} paneId={MAIN_PANE}>
        <div data-testid="trigger">trigger</div>
      </TabContextMenu>
    )
    fireEvent.contextMenu(screen.getByTestId('trigger'))
    fireEvent.click(screen.getByText('화면 전체보기 해제'))

    expect(useTabStore.getState().focusedTabIds).toEqual([])
  })
})
