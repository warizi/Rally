/**
 * widgets/tab-system/ui/PaneContent.test.tsx
 *
 * tab null → "탭을 선택하세요" / 매칭 실패 → "페이지를 찾을 수 없습니다"
 * 매칭 성공 → route.component 렌더.
 */
import { describe, it, expect, vi } from 'vitest'
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
