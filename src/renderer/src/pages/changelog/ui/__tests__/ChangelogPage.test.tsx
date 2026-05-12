/**
 * ChangelogPage 렌더 회귀 테스트.
 *
 * P2-6 — entities/changelog 이전 후 페이지가 정상 렌더되는지 확인.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TestProviders } from '@/test/providers'
import { ChangelogPage } from '../ChangelogPage'
import { CHANGELOG } from '@entities/changelog'

describe('ChangelogPage', () => {
  it('타이틀 + 설명 헤더 렌더', () => {
    render(<ChangelogPage />, { wrapper: TestProviders })
    expect(screen.getByText('업데이트 내역')).toBeInTheDocument()
    expect(screen.getByText(/Rally의 새로운 기능/)).toBeInTheDocument()
  })

  it('모든 CHANGELOG entry 의 버전 텍스트가 렌더', () => {
    render(<ChangelogPage />, { wrapper: TestProviders })
    for (const entry of CHANGELOG) {
      expect(screen.getByText(`v${entry.version}`)).toBeInTheDocument()
    }
  })

  it('변경사항 타입 라벨 (새 기능 / 개선 / 수정) 이 존재한다', () => {
    render(<ChangelogPage />, { wrapper: TestProviders })
    // 데이터에 포함된 타입만 검사
    const usedTypes = new Set(CHANGELOG.flatMap((e) => e.changes.map((c) => c.type)))
    if (usedTypes.has('feature')) expect(screen.getAllByText('새 기능').length).toBeGreaterThan(0)
    if (usedTypes.has('improvement')) expect(screen.getAllByText('개선').length).toBeGreaterThan(0)
    if (usedTypes.has('fix')) expect(screen.getAllByText('수정').length).toBeGreaterThan(0)
  })
})
