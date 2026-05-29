/**
 * widgets/settings/ui/AISettings.test.tsx
 *
 * AISettings 마운트 smoke — window.api 호출 + SkillsManager 마운트.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@shared/store/onboarding', () => ({
  useOnboardingStore: () => ({ tipsSeen: {}, markTipSeen: vi.fn() })
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

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    mcpClient: {
      getStatus: vi.fn().mockResolvedValue({
        success: true,
        data: {
          status: {
            claudeDesktop: {
              configPath: '/p1',
              supported: true,
              configExists: false,
              registered: false,
              outdated: false
            },
            claudeCode: {
              configPath: '/p2',
              supported: true,
              configExists: false,
              registered: false,
              outdated: false
            }
          },
          serverKey: 'rally',
          serverConfig: {}
        }
      })
    },
    appInfo: {
      getMcpServerPath: vi.fn().mockResolvedValue({ success: true, data: '/server' }),
      getCommandFiles: vi.fn().mockResolvedValue({ success: true, data: [] }),
      getSkillFiles: vi.fn().mockResolvedValue({ success: true, data: [] })
    }
  }
})

describe('AISettings', () => {
  it('SkillsManager 마운트 (smoke)', () => {
    render(<AISettings />)
    expect(screen.getByTestId('skills-manager')).toBeInTheDocument()
  })

  it('클라이언트 라벨 노출 (Claude Desktop / Claude Code)', () => {
    render(<AISettings />)
    expect(screen.getByText('Claude Desktop')).toBeInTheDocument()
    expect(screen.getByText(/Claude Code/)).toBeInTheDocument()
  })
})
