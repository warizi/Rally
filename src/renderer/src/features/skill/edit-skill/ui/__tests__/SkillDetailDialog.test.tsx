/**
 * features/skill/edit-skill/ui/SkillDetailDialog.test.tsx
 *
 * skill=null → null. open=false → null. skill 있음 + open → dialog 렌더.
 * source='system' vs 'user' 분기 — system 은 description 입력 미노출.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@entities/skill', () => ({
  useUpdateSkill: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useResetSystemSkill: () => ({ mutateAsync: vi.fn(), isPending: false }),
  ToolMultiSelect: () => <div data-testid="tool-select" />
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}))

import { SkillDetailDialog } from '../SkillDetailDialog'

const systemSkill = {
  id: 's1',
  name: 'sys-skill',
  source: 'system',
  description: 'sys desc',
  content: '# content',
  mcpTools: [],
  triggers: []
} as unknown as Parameters<typeof SkillDetailDialog>[0]['skill']

const userSkill = {
  id: 's2',
  name: 'user-skill',
  source: 'user',
  description: 'user desc',
  content: '# user content',
  mcpTools: ['tool1'],
  triggers: ['trigger1']
} as unknown as Parameters<typeof SkillDetailDialog>[0]['skill']

describe('SkillDetailDialog', () => {
  it('skill=null → null', () => {
    const { container } = render(
      <SkillDetailDialog skill={null} open={true} onOpenChange={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('open=false → null', () => {
    const { container } = render(
      <SkillDetailDialog skill={systemSkill} open={false} onOpenChange={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('system skill + open → dialog 렌더 + 시스템 표시', () => {
    render(<SkillDetailDialog skill={systemSkill} open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText(/sys-skill/)).toBeInTheDocument()
  })

  it('user skill + open → dialog 렌더 + 사용자 표시', () => {
    render(<SkillDetailDialog skill={userSkill} open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText(/user-skill/)).toBeInTheDocument()
  })

  it('content textarea 노출 (form 필드)', () => {
    render(<SkillDetailDialog skill={userSkill} open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByDisplayValue('# user content')).toBeInTheDocument()
  })

  it('user skill → description input 노출 (system 만 숨김)', () => {
    render(<SkillDetailDialog skill={userSkill} open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByDisplayValue('user desc')).toBeInTheDocument()
  })

  it('system skill → description input 미노출', () => {
    render(<SkillDetailDialog skill={systemSkill} open={true} onOpenChange={vi.fn()} />)
    expect(screen.queryByDisplayValue('sys desc')).toBeNull()
  })

  it('system skill + hasOverride → "기본값으로 복원" 버튼 노출', () => {
    const overrideSkill = { ...systemSkill, hasOverride: true } as unknown as Parameters<
      typeof SkillDetailDialog
    >[0]['skill']
    render(<SkillDetailDialog skill={overrideSkill} open={true} onOpenChange={vi.fn()} />)
    // 버튼 노출 — 텍스트가 description 과 button 양쪽에 나옴.
    expect(
      screen.getAllByText(/기본값으로 복원/).some((el) => el.tagName.toLowerCase() === 'button')
    ).toBe(true)
  })

  it('system skill + hasOverride=false → 복원 버튼 미노출', () => {
    render(<SkillDetailDialog skill={systemSkill} open={true} onOpenChange={vi.fn()} />)
    // button 형태로는 없어야 한다.
    const buttons = screen.queryAllByRole('button', { name: /기본값으로 복원/ })
    expect(buttons).toEqual([])
  })

  it('취소 클릭 → onOpenChange(false)', () => {
    const onOpenChange = vi.fn()
    render(<SkillDetailDialog skill={userSkill} open={true} onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByRole('button', { name: /취소/ }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('user skill → ToolMultiSelect 노출 (mcpTools 필드)', () => {
    render(<SkillDetailDialog skill={userSkill} open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByTestId('tool-select')).toBeInTheDocument()
  })

  it('system skill → ToolMultiSelect + trigger 키워드 input 미노출', () => {
    render(<SkillDetailDialog skill={systemSkill} open={true} onOpenChange={vi.fn()} />)
    expect(screen.queryByTestId('tool-select')).toBeNull()
    expect(screen.queryByPlaceholderText(/할일/)).toBeNull()
  })

  it('user skill → 트리거 키워드 input 노출 (CSV 형식)', () => {
    render(<SkillDetailDialog skill={userSkill} open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByDisplayValue('trigger1')).toBeInTheDocument()
  })

  it('저장 버튼 노출 + 저장 텍스트', () => {
    render(<SkillDetailDialog skill={userSkill} open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /^저장$/ })).toBeInTheDocument()
  })

  it('system skill → Badge "기본" + system DialogDescription 노출', () => {
    render(<SkillDetailDialog skill={systemSkill} open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText('기본')).toBeInTheDocument()
    expect(screen.getAllByText(/SKILL.md 본문/).length).toBeGreaterThan(0)
  })
})
