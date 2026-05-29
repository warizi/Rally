/**
 * widgets/skills-manager/ui/SkillCard.test.tsx
 *
 * system/custom badge + applied + actions slot + onClick (Enter/Space).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SkillCard } from '../SkillCard'
import type { SkillItem } from '@entities/skill'

function skill(over: Partial<SkillItem> = {}): SkillItem {
  return {
    id: 's-1',
    name: 'rally-do',
    source: 'system',
    description: '설명',
    ...over
  } as unknown as SkillItem
}

describe('SkillCard', () => {
  it('skill.name 노출 + "기본" 뱃지 (system)', () => {
    render(<SkillCard skill={skill()} applied={false} />)
    expect(screen.getByText('rally-do')).toBeInTheDocument()
    expect(screen.getByText('기본')).toBeInTheDocument()
  })

  it('source=custom → "커스텀" 뱃지', () => {
    render(<SkillCard skill={skill({ source: 'custom' })} applied={false} />)
    expect(screen.getByText('커스텀')).toBeInTheDocument()
  })

  it('applied=true → "✓ 적용됨" 뱃지', () => {
    render(<SkillCard skill={skill()} applied={true} />)
    expect(screen.getByText('✓ 적용됨')).toBeInTheDocument()
  })

  it('description 노출', () => {
    render(<SkillCard skill={skill()} applied={false} />)
    expect(screen.getByText('설명')).toBeInTheDocument()
  })

  it('actions slot 노출', () => {
    render(<SkillCard skill={skill()} applied={false} actions={<button>Action</button>} />)
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
  })

  it('onClick + Enter 키 → onClick 호출', () => {
    const fn = vi.fn()
    render(<SkillCard skill={skill()} applied={false} onClick={fn} />)
    const card = screen.getByRole('button')
    fireEvent.keyDown(card, { key: 'Enter' })
    expect(fn).toHaveBeenCalled()
  })

  it('onClick + Space 키 → onClick 호출', () => {
    const fn = vi.fn()
    render(<SkillCard skill={skill()} applied={false} onClick={fn} />)
    const card = screen.getByRole('button')
    fireEvent.keyDown(card, { key: ' ' })
    expect(fn).toHaveBeenCalled()
  })

  it('onClick 미제공 → role 없음 (일반 div)', () => {
    const { container } = render(<SkillCard skill={skill()} applied={false} />)
    expect(container.querySelector('[role="button"]')).not.toBeInTheDocument()
  })
})
