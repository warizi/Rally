/**
 * widgets/onboarding/ui/WelcomeSlides.test.tsx
 *
 * index 0/1/2 분기로 다른 슬라이드 렌더.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WelcomeSlide } from '../WelcomeSlides'

describe('WelcomeSlide', () => {
  it('index=0 → Rally 가치 슬라이드', () => {
    render(<WelcomeSlide index={0} />)
    expect(screen.getByText(/Rally — 노트, 표, 캔버스, 할 일을 한 곳에서/)).toBeInTheDocument()
  })

  it('index=1 → 핵심 기능 4가지 슬라이드', () => {
    render(<WelcomeSlide index={1} />)
    expect(screen.getByText('핵심 기능 4가지')).toBeInTheDocument()
  })

  it('index=2 → Claude AI 슬라이드', () => {
    render(<WelcomeSlide index={2} />)
    expect(screen.getByText(/Claude와 함께 쓰면 더 강력합니다/)).toBeInTheDocument()
  })

  it('index>2 → 기본 AI 슬라이드 (fallback)', () => {
    render(<WelcomeSlide index={99} />)
    expect(screen.getByText(/Claude와 함께/)).toBeInTheDocument()
  })
})
