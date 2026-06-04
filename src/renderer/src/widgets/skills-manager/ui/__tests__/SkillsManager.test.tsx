/**
 * widgets/skills-manager/ui/SkillsManager.test.tsx
 *
 * isLoading → 안내문. error → 빨강 에러. 정상 → system / custom 섹션 + 카운트.
 * SkillCard 클릭 → setSelected → SkillDetailDialog open.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

interface FakeSkill {
  id: string
  name: string
  source: 'system' | 'custom'
}

const mocks = vi.hoisted(() => ({
  skills: [] as FakeSkill[],
  status: [] as Array<{ name: string; applied: { claude: boolean; codex: boolean } }>,
  skillsLoading: false,
  skillsError: null as Error | null,
  statusLoading: false,
  statusError: null as Error | null
}))

vi.mock('@entities/skill', () => ({
  useSkills: () => ({
    data: mocks.skills,
    isLoading: mocks.skillsLoading,
    error: mocks.skillsError
  }),
  useSkillStatus: () => ({
    data: mocks.status,
    isLoading: mocks.statusLoading,
    error: mocks.statusError
  })
}))

vi.mock('@shared/ui/onboarding-tip', () => ({
  OnboardingTipIcon: () => <div data-testid="tip" />
}))

vi.mock('@features/skill', () => ({
  ApplyToggleButton: () => <button data-testid="apply" />,
  ExportSkillButton: () => <button data-testid="export" />,
  RegisterSkillDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="register-dialog" /> : null,
  RemoveSkillButton: () => <button data-testid="remove" />,
  SkillDetailDialog: ({ skill }: { skill: FakeSkill | null }) =>
    skill ? <div data-testid="detail-dialog">{skill.name}</div> : null
}))

vi.mock('../SkillCard', () => ({
  SkillCard: ({ skill, onClick }: { skill: FakeSkill; onClick: () => void }) => (
    <button data-testid={`skill-${skill.id}`} onClick={onClick}>
      {skill.name}
    </button>
  )
}))

import { SkillsManager } from '../SkillsManager'

beforeEach(() => {
  mocks.skills = []
  mocks.status = []
  mocks.skillsLoading = false
  mocks.skillsError = null
  mocks.statusLoading = false
  mocks.statusError = null
})

describe('SkillsManager', () => {
  it('isLoading=true → 안내문', () => {
    mocks.skillsLoading = true
    render(<SkillsManager />)
    expect(screen.getByText(/Skill 목록을 불러오는 중/)).toBeInTheDocument()
  })

  it('error 있음 → 에러 메시지', () => {
    mocks.skillsError = new Error('failed')
    render(<SkillsManager />)
    expect(screen.getByText(/Skill 목록을 불러오지 못했습니다.*failed/)).toBeInTheDocument()
  })

  it('빈 skills → "전체 0개 · 적용됨 0"', () => {
    render(<SkillsManager />)
    expect(screen.getByText(/전체 0개 · 적용됨 0/)).toBeInTheDocument()
  })

  it('system 섹션 노출 (system skills 있음)', () => {
    mocks.skills = [
      { id: 's1', name: 'todo-skill', source: 'system' },
      { id: 's2', name: 'note-skill', source: 'system' }
    ]
    render(<SkillsManager />)
    expect(screen.getByText('기본 (2)')).toBeInTheDocument()
    expect(screen.getByTestId('skill-s1')).toBeInTheDocument()
    expect(screen.getByTestId('skill-s2')).toBeInTheDocument()
  })

  it('custom 섹션 노출', () => {
    mocks.skills = [{ id: 'c1', name: 'my-custom', source: 'custom' }]
    render(<SkillsManager />)
    expect(screen.getByText('커스텀 (1)')).toBeInTheDocument()
    expect(screen.getByTestId('skill-c1')).toBeInTheDocument()
  })

  it('applied 카운트 반영', () => {
    mocks.skills = [
      { id: 's1', name: 'a', source: 'system' },
      { id: 's2', name: 'b', source: 'system' }
    ]
    mocks.status = [
      { name: 'a', applied: { claude: true, codex: false } },
      { name: 'b', applied: { claude: false, codex: false } }
    ]
    render(<SkillsManager />)
    expect(screen.getByText(/적용됨 1/)).toBeInTheDocument()
  })

  it('target=codex → codex 적용 카운트 반영', () => {
    mocks.skills = [
      { id: 's1', name: 'a', source: 'system' },
      { id: 's2', name: 'b', source: 'system' }
    ]
    mocks.status = [
      { name: 'a', applied: { claude: false, codex: true } },
      { name: 'b', applied: { claude: true, codex: false } }
    ]
    render(<SkillsManager target="codex" />)
    expect(screen.getByText(/적용됨 1/)).toBeInTheDocument()
  })

  it('SkillCard 클릭 → SkillDetailDialog 노출', () => {
    mocks.skills = [{ id: 's1', name: 'detail-skill', source: 'system' }]
    render(<SkillsManager />)
    fireEvent.click(screen.getByTestId('skill-s1'))
    expect(screen.getByTestId('detail-dialog')).toHaveTextContent('detail-skill')
  })
})
