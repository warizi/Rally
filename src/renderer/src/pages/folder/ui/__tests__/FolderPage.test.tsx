/**
 * pages/folder/ui/FolderPage.test.tsx
 *
 * workspaceId 없음 → "워크스페이스를 선택해주세요." / 있음 → FolderTree 렌더.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const mocks = vi.hoisted(() => ({
  workspaceId: null as string | null
}))

vi.mock('@shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (sel: (s: { currentWorkspaceId: string | null }) => unknown) =>
    sel({ currentWorkspaceId: mocks.workspaceId })
}))
vi.mock('@features/folder/manage-folder', () => ({
  FolderTree: ({ workspaceId, tabId }: { workspaceId: string; tabId?: string }) => (
    <div data-testid="folder-tree" data-ws={workspaceId} data-tab={tabId} />
  )
}))

import { FolderPage } from '../FolderPage'

beforeEach(() => {
  mocks.workspaceId = null
})

describe('FolderPage', () => {
  it('workspaceId 없음 → 안내 문구', () => {
    render(<FolderPage />)
    expect(screen.getByText('워크스페이스를 선택해주세요.')).toBeInTheDocument()
  })

  it('workspaceId 있음 → FolderTree 렌더 + workspaceId/tabId 전달', () => {
    mocks.workspaceId = 'ws-1'
    render(<FolderPage tabId="tab-1" />)
    const tree = screen.getByTestId('folder-tree')
    expect(tree).toHaveAttribute('data-ws', 'ws-1')
    expect(tree).toHaveAttribute('data-tab', 'tab-1')
  })

  // FolderTree 가 full-height 가상화 scroll 컨테이너를 소유하는 의도된 예외(AGENTS.md 참고).
  // TabContainer(scrollable=false 포함)로 감싸면 scroll target 이 바뀌어 가상화/DnD 가 깨지므로
  // 예외를 회귀로 잠근다. wrap 을 추가하려면 이 테스트와 문서/주석을 먼저 갱신해야 한다.
  it('의도된 예외: TabContainer 로 감싸지 않는다 (import/JSX 사용 금지)', () => {
    // happy-dom 환경은 file:// import.meta.url 을 보장하지 않으므로 repo root 기준 경로 사용.
    const src = readFileSync(
      resolve(process.cwd(), 'src/renderer/src/pages/folder/ui/FolderPage.tsx'),
      'utf-8'
    )
    // 주석의 "TabContainer" 언급이 아니라 실제 사용(import / JSX)만 차단한다.
    expect(src).not.toMatch(/from\s+['"]@shared\/ui\/tab-container['"]/)
    expect(src).not.toMatch(/<TabContainer[\s/>]/)
  })
})
