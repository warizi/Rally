/**
 * widgets/settings/ui/AISettings.test.tsx
 *
 * MCP 클라이언트 등록 UI — 미등록/등록됨/outdated/지원안함 상태, register/unregister
 * 호출, manual section 토글, command/skill 파일 expand.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  unregister: vi.fn(),
  getStatus: vi.fn(),
  getMcpServerPath: vi.fn(),
  getCommandFiles: vi.fn(),
  getSkillFiles: vi.fn(),
  markChecklistStep: vi.fn(),
  writeText: vi.fn()
}))

vi.mock('@shared/store/onboarding', () => ({
  useOnboardingStore: Object.assign(() => ({ tipsSeen: {}, markTipSeen: vi.fn() }), {
    getState: () => ({
      markChecklistStep: mocks.markChecklistStep
    })
  })
}))

vi.mock('@shared/ui/onboarding-tip', () => ({
  OnboardingTipIcon: () => null
}))

vi.mock('@widgets/skills-manager', () => ({
  SkillsManager: () => <div data-testid="skills-manager" />
}))

vi.mock('@shared/lib/logger', () => ({
  toLogError: () => () => {}
}))

import { AISettings } from '../AISettings'

function makeStatus(
  desktop: Partial<{
    supported: boolean
    configExists: boolean
    registered: boolean
    outdated: boolean
  }> = {},
  code: Partial<{
    supported: boolean
    configExists: boolean
    registered: boolean
    outdated: boolean
  }> = {}
): unknown {
  return {
    success: true,
    data: {
      status: {
        claudeDesktop: {
          configPath: '/desktop/path',
          supported: desktop.supported ?? true,
          configExists: desktop.configExists ?? false,
          registered: desktop.registered ?? false,
          outdated: desktop.outdated ?? false
        },
        claudeCode: {
          configPath: '/code/path',
          supported: code.supported ?? true,
          configExists: code.configExists ?? false,
          registered: code.registered ?? false,
          outdated: code.outdated ?? false
        }
      },
      serverKey: 'rally',
      serverConfig: { command: 'node', args: ['/server'] }
    }
  }
}

beforeEach(() => {
  mocks.register.mockResolvedValue({ success: true })
  mocks.unregister.mockResolvedValue({ success: true })
  mocks.getStatus.mockResolvedValue(makeStatus())
  mocks.getMcpServerPath.mockResolvedValue({ success: true, data: '/server' })
  mocks.getCommandFiles.mockResolvedValue({ success: true, data: [] })
  mocks.getSkillFiles.mockResolvedValue({ success: true, data: [] })
  mocks.markChecklistStep.mockResolvedValue(undefined)
  mocks.writeText.mockResolvedValue(undefined)

  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: mocks.writeText, readText: vi.fn() },
    configurable: true,
    writable: true
  })
  ;(window as unknown as Record<string, unknown>).api = {
    mcpClient: {
      getStatus: mocks.getStatus,
      register: mocks.register,
      unregister: mocks.unregister
    },
    appInfo: {
      getMcpServerPath: mocks.getMcpServerPath,
      getCommandFiles: mocks.getCommandFiles,
      getSkillFiles: mocks.getSkillFiles
    }
  }
})

describe('AISettings — smoke', () => {
  it('SkillsManager 마운트', async () => {
    render(<AISettings />)
    // mount 시 비동기 IPC effect(상태 갱신)가 act 밖에서 settle 되지 않도록 대기.
    await waitFor(() => expect(screen.getByTestId('skills-manager')).toBeInTheDocument())
  })

  it('두 클라이언트 라벨 노출', async () => {
    render(<AISettings />)
    await waitFor(() => expect(screen.getByText('Claude Desktop')).toBeInTheDocument())
    expect(screen.getByText(/Claude Code/)).toBeInTheDocument()
  })
})

describe('AISettings — MCP 클라이언트 카드', () => {
  it('미등록 → 자동 등록 버튼', async () => {
    render(<AISettings />)
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: '자동 등록' }).length).toBe(2)
    })
  })

  // P-1: 신규 등록은 고지·동의를 거친다. 클릭만으로 등록되면 안 된다.
  it('자동 등록 클릭 → 곧바로 등록되지 않고 고지 다이얼로그가 뜬다', async () => {
    render(<AISettings />)
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: '자동 등록' }).length).toBe(2)
    })
    fireEvent.click(screen.getAllByRole('button', { name: '자동 등록' })[0])

    await waitFor(() => {
      expect(screen.getByText(/이 워크스페이스를 연결할까요\?/)).toBeInTheDocument()
    })
    expect(mocks.register).not.toHaveBeenCalled()
  })

  it('고지 다이얼로그에서 확인 → register 호출', async () => {
    render(<AISettings />)
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: '자동 등록' }).length).toBe(2)
    })
    fireEvent.click(screen.getAllByRole('button', { name: '자동 등록' })[0])
    await waitFor(() => {
      expect(screen.getByText(/이 워크스페이스를 연결할까요\?/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /확인했습니다, 연결/ }))
    await waitFor(() => {
      expect(mocks.register).toHaveBeenCalled()
    })
  })

  it('고지 다이얼로그에서 취소 → register 미호출', async () => {
    render(<AISettings />)
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: '자동 등록' }).length).toBe(2)
    })
    fireEvent.click(screen.getAllByRole('button', { name: '자동 등록' })[0])
    await waitFor(() => {
      expect(screen.getByText(/이 워크스페이스를 연결할까요\?/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(mocks.register).not.toHaveBeenCalled()
  })

  // 갱신(재등록)은 이미 동의한 연동의 유지 — 다시 묻지 않는다.
  it('outdated 갱신 클릭 → 고지 없이 바로 register', async () => {
    mocks.getStatus.mockResolvedValue(
      makeStatus({ registered: true, outdated: true }, { registered: true, outdated: true })
    )
    render(<AISettings />)
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: '갱신' }).length).toBeGreaterThan(0)
    })
    fireEvent.click(screen.getAllByRole('button', { name: '갱신' })[0])
    await waitFor(() => {
      expect(mocks.register).toHaveBeenCalled()
    })
    expect(screen.queryByText(/이 워크스페이스를 연결할까요\?/)).not.toBeInTheDocument()
  })

  it('등록됨 → 제거 버튼', async () => {
    mocks.getStatus.mockResolvedValue(makeStatus({ registered: true }, { registered: true }))
    render(<AISettings />)
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: '제거' }).length).toBe(2)
    })
  })

  it('제거 클릭 → unregister 호출', async () => {
    mocks.getStatus.mockResolvedValue(makeStatus({ registered: true }, { registered: true }))
    render(<AISettings />)
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: '제거' }).length).toBe(2)
    })
    fireEvent.click(screen.getAllByRole('button', { name: '제거' })[0])
    await waitFor(() => {
      expect(mocks.unregister).toHaveBeenCalled()
    })
  })

  it('outdated → 갱신 버튼 + 경고 메시지', async () => {
    mocks.getStatus.mockResolvedValue(
      makeStatus({ registered: true, outdated: true }, { registered: false })
    )
    render(<AISettings />)
    await waitFor(() => {
      expect(screen.getByText('갱신')).toBeInTheDocument()
      expect(screen.getByText(/다른 경로로 등록되어/)).toBeInTheDocument()
    })
  })

  it('미지원 OS → 지원되지 않습니다', async () => {
    mocks.getStatus.mockResolvedValue(makeStatus({ supported: false }))
    render(<AISettings />)
    await waitFor(() => {
      expect(screen.getByText(/지원되지 않습니다/)).toBeInTheDocument()
    })
  })
})

describe('AISettings — 수동 설정 토글', () => {
  it('수동 설정 클릭 → MCP 서버 경로 + JSON 노출', async () => {
    render(<AISettings />)
    await waitFor(() => {
      expect(mocks.getMcpServerPath).toHaveBeenCalled()
    })
    fireEvent.click(screen.getByText(/수동 설정/))
    expect(screen.getByText('MCP 서버 경로')).toBeInTheDocument()
    expect(screen.getByText('MCP 설정 JSON')).toBeInTheDocument()
  })
})

describe('AISettings — command/skill 파일', () => {
  it('commandFiles → Claude 커맨드 섹션 + expand', async () => {
    mocks.getCommandFiles.mockResolvedValue({
      success: true,
      data: [{ name: 'rally-do', description: 'Do command', content: '# Rally Do\n내용' }]
    })
    render(<AISettings />)
    await waitFor(() => {
      expect(screen.getByText('Claude 커맨드')).toBeInTheDocument()
      expect(screen.getByText('rally-do')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('rally-do'))
    await waitFor(() => {
      expect(screen.getByText(/# Rally Do/)).toBeInTheDocument()
    })
  })

  it('skillFiles → Claude Skills 섹션', async () => {
    mocks.getSkillFiles.mockResolvedValue({
      success: true,
      data: [{ name: 'note-writing', description: 'Note skill', content: '# Skill' }]
    })
    render(<AISettings />)
    await waitFor(() => {
      expect(screen.getByText('Claude Skills')).toBeInTheDocument()
      expect(screen.getByText('note-writing')).toBeInTheDocument()
    })
  })
})
