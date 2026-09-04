/**
 * TabHeader — pane 최소 폭에서 제목이 줄바꿈되지 않도록 하는 레이아웃 규칙 고정.
 *
 * 배경 (2026-09 "패인 페이지 넓이 최소 값일 때 헤더 UI 깨짐"): 제목 그룹에 min-w-0 이 없고 h1 에
 * truncate 가 없어 제목+버튼 조합이 좁아지면 제목이 두 줄로 꺾였다. 버튼은 shrink-0 이어야 버튼이 아니라
 * 제목 쪽이 줄어든다.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import TabHeader from '../tab-header'
import { TooltipProvider } from '../tooltip'

vi.mock('@shared/hooks/use-tab-header-collapsed-setting', () => ({
  useTabHeaderCollapsedSetting: () => ({ collapsed: false, setCollapsed: vi.fn() })
}))

function r(ui: React.ReactElement): void {
  render(<TooltipProvider>{ui}</TooltipProvider>)
}

describe('TabHeader — 좁은 폭 레이아웃', () => {
  it('제목은 한 줄 말줄임 + 전체 텍스트를 title 로 제공', () => {
    r(<TabHeader title="아주 긴 페이지 제목입니다" buttons={<button>액션</button>} />)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveClass('truncate')
    expect(h1).toHaveAttribute('title', '아주 긴 페이지 제목입니다')
    // 제목 그룹은 줄어들 수 있어야 truncate 가 동작한다
    expect(h1.parentElement).toHaveClass('min-w-0')
  })

  it('버튼 컨테이너는 shrink-0 — 좁아질 때 버튼이 아니라 제목이 줄어든다', () => {
    r(<TabHeader title="제목" buttons={<button>액션</button>} />)
    const btn = screen.getByRole('button', { name: '액션' })
    expect(btn.parentElement).toHaveClass('shrink-0')
    expect(btn.parentElement).toHaveClass('ml-auto')
  })

  it('editable 모드도 제목 입력 컨테이너 min-w-0 + 버튼 shrink-0', () => {
    r(<TabHeader editable title="제목" buttons={<button>액션</button>} />)
    const input = screen.getByPlaceholderText('제목을 입력해주세요')
    expect(input.parentElement).toHaveClass('min-w-0')
    expect(screen.getByRole('button', { name: '액션' }).parentElement).toHaveClass('shrink-0')
  })
})
