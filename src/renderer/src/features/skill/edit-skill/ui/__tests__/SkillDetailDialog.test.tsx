/**
 * features/skill/edit-skill/ui/SkillDetailDialog.test.tsx
 *
 * skill=null → null. open=false → null. skill 있음 + open → dialog 렌더.
 * source='system' vs 'user' 분기 — system 은 description 입력 미노출.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

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
})
