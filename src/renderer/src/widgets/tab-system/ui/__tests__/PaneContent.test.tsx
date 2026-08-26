/**
 * widgets/tab-system/ui/PaneContent.test.tsx
 *
 * tab null → "탭을 선택하세요" / 매칭 실패 → "페이지를 찾을 수 없습니다"
 * 매칭 성공 → route.component 렌더.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/shared/lib/route-matcher', () => ({
  findMatchingRoute: (routes: Array<{ pattern: string }>, pathname: string) => {
    const r = routes.find((rt) => rt.pattern === pathname)
    if (!r) return null
    return { route: r, params: { x: '1' } }
  }
}))

import { PaneContent } from '../PaneContent'

function Dummy({ tabId }: { tabId: string }): React.JSX.Element {
  return <div data-testid="rendered">{tabId}</div>
}

describe('PaneContent', () => {
  it('tab=null → "탭을 선택하세요"', () => {
    render(<PaneContent tab={null} routes={[]} />)
    expect(screen.getByText('탭을 선택하세요')).toBeInTheDocument()
  })

  it('tab 있고 매칭 실패 → "페이지를 찾을 수 없습니다" + pathname 노출', () => {
    render(
      <PaneContent
        tab={
          {
            id: 't1',
            pathname: '/missing',
            searchParams: {}
          } as unknown as Parameters<typeof PaneContent>[0]['tab']
        }
        routes={[]}
      />
    )
    expect(screen.getByText('페이지를 찾을 수 없습니다')).toBeInTheDocument()
    expect(screen.getByText('/missing')).toBeInTheDocument()
  })

  it('매칭 성공 → route.component 렌더 (Suspense 안에서)', () => {
    render(
      <PaneContent
        tab={
          {
            id: 'tabA',
            pathname: '/yes',
            searchParams: {}
          } as unknown as Parameters<typeof PaneContent>[0]['tab']
        }
        routes={
          [{ pattern: '/yes', component: Dummy }] as unknown as Parameters<
            typeof PaneContent
          >[0]['routes']
        }
      />
    )
    expect(screen.getByTestId('rendered')).toHaveTextContent('tabA')
  })
})

/**
 * M-5 — 탭 격리. 이 기능의 존재 이유가 여기서 검증된다.
 *
 * PaneContent 는 모든 탭 페이지의 단일 렌더 지점이다. 여기 경계가 있으면 FolderPage 처럼
 * TabContainer 를 쓰지 않는 예외까지 자동으로 보호된다.
 */
describe('PaneContent — 렌더 오류 격리 (M-5)', () => {
  const makeTab = (id: string, pathname: string): Parameters<typeof PaneContent>[0]['tab'] =>
    ({ id, pathname, icon: 'note', searchParams: {} }) as unknown as Parameters<
      typeof PaneContent
    >[0]['tab']

  // PageProps.tabId 는 optional 이라 테스트용 컴포넌트 시그니처와 어긋난다.
  // 기존 테스트도 같은 방식으로 캐스팅한다 — 여기서 한 번만 하도록 모아 둔다.
  const makeRoutes = (
    pattern: string,
    component: unknown
  ): Parameters<typeof PaneContent>[0]['routes'] =>
    [{ pattern, component }] as unknown as Parameters<typeof PaneContent>[0]['routes']

  function Boom(): React.JSX.Element {
    throw new Error('탭 렌더 실패')
  }

  let consoleSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('페이지가 렌더 중 throw 해도 앱이 죽지 않고 탭 오류 화면을 보여준다', () => {
    render(<PaneContent tab={makeTab('t1', '/boom')} routes={makeRoutes('/boom', Boom)} />)
    expect(screen.getByText('이 탭을 열지 못했습니다')).toBeInTheDocument()
    expect(screen.getByText(/다른 탭은 그대로 사용할 수 있습니다/)).toBeInTheDocument()
  })

  it('한 탭이 죽어도 다른 pane 의 탭은 정상 렌더된다', () => {
    render(
      <div>
        <PaneContent tab={makeTab('t1', '/boom')} routes={makeRoutes('/boom', Boom)} />
        <PaneContent tab={makeTab('t2', '/ok')} routes={makeRoutes('/ok', Dummy)} />
      </div>
    )
    expect(screen.getByText('이 탭을 열지 못했습니다')).toBeInTheDocument()
    expect(screen.getByTestId('rendered')).toHaveTextContent('t2')
  })

  it('오류 원문을 숨기지 않는다 (사용자가 그대로 전달할 수 있어야 한다)', () => {
    render(<PaneContent tab={makeTab('t1', '/boom')} routes={makeRoutes('/boom', Boom)} />)
    expect(screen.getByText('오류 내용 보기')).toBeInTheDocument()
    expect(screen.getByText(/탭 렌더 실패/)).toBeInTheDocument()
  })
})
