/**
 * useOnboardingStore + selectChecklistCounts 테스트.
 *
 * hydrate / dismissWelcome / markChecklistStep / markTipShown / acknowledge / reset
 * 모두 window.api.settings.get/set 호출 + state 갱신 검증.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  useOnboardingStore,
  selectChecklistCounts,
  ONBOARDING_KEYS,
  CHECKLIST_STEPS
} from '../onboarding'

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    settings: {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue({ success: true })
    }
  }
  vi.clearAllMocks()
  // store 초기 상태로 리셋
  useOnboardingStore.setState({
    welcomeDismissed: false,
    checklistProgress: {},
    tipsShown: [],
    checklistAcknowledged: false,
    hydrated: false
  })
})

const api = (): typeof window.api => (window as unknown as { api: typeof window.api }).api

describe('hydrate', () => {
  it('settings.get 4종 호출 후 state 채움', async () => {
    vi.mocked(api().settings.get).mockImplementation((key: string) => {
      const map: Record<string, string> = {
        [ONBOARDING_KEYS.welcomeDismissed]: 'true',
        [ONBOARDING_KEYS.checklistProgress]: '{"first_note":"2026-01-01"}',
        [ONBOARDING_KEYS.tipsShown]: '["tip-1"]',
        [ONBOARDING_KEYS.checklistAcknowledged]: 'true'
      }
      return Promise.resolve({ success: true, data: map[key] ?? null })
    })

    await useOnboardingStore.getState().hydrate()
    const s = useOnboardingStore.getState()
    expect(s.welcomeDismissed).toBe(true)
    expect(s.checklistProgress).toEqual({ first_note: '2026-01-01' })
    expect(s.tipsShown).toEqual(['tip-1'])
    expect(s.checklistAcknowledged).toBe(true)
    expect(s.hydrated).toBe(true)
  })

  it('settings.get 가 실패해도 hydrated=true + 기본값', async () => {
    vi.mocked(api().settings.get).mockResolvedValue({ success: false, message: 'err' })
    await useOnboardingStore.getState().hydrate()
    const s = useOnboardingStore.getState()
    expect(s.hydrated).toBe(true)
    expect(s.welcomeDismissed).toBe(false)
    expect(s.checklistProgress).toEqual({})
  })

  it('checklistProgress 가 손상된 JSON 일 때 {} 로 fallback', async () => {
    vi.mocked(api().settings.get).mockImplementation((key: string) =>
      Promise.resolve({
        success: true,
        data: key === ONBOARDING_KEYS.checklistProgress ? '{corrupt' : null
      })
    )
    await useOnboardingStore.getState().hydrate()
    expect(useOnboardingStore.getState().checklistProgress).toEqual({})
  })

  it('tipsShown 이 배열이 아니면 [] 로 fallback', async () => {
    vi.mocked(api().settings.get).mockImplementation((key: string) =>
      Promise.resolve({
        success: true,
        data: key === ONBOARDING_KEYS.tipsShown ? '{"not":"array"}' : null
      })
    )
    await useOnboardingStore.getState().hydrate()
    expect(useOnboardingStore.getState().tipsShown).toEqual([])
  })
})

describe('dismissWelcome / resetWelcome', () => {
  it('dismissWelcome → true + settings.set', async () => {
    await useOnboardingStore.getState().dismissWelcome()
    expect(useOnboardingStore.getState().welcomeDismissed).toBe(true)
    expect(api().settings.set).toHaveBeenCalledWith(ONBOARDING_KEYS.welcomeDismissed, 'true')
  })

  it('resetWelcome → false + settings.set', async () => {
    useOnboardingStore.setState({ welcomeDismissed: true })
    await useOnboardingStore.getState().resetWelcome()
    expect(useOnboardingStore.getState().welcomeDismissed).toBe(false)
    expect(api().settings.set).toHaveBeenCalledWith(ONBOARDING_KEYS.welcomeDismissed, 'false')
  })
})

describe('markChecklistStep', () => {
  it('첫 호출 → checklistProgress 에 등록', async () => {
    await useOnboardingStore.getState().markChecklistStep('first_note')
    expect(useOnboardingStore.getState().checklistProgress.first_note).toBeDefined()
  })

  it('이미 등록된 step → 호출 무시 (settings.set 호출 안 됨)', async () => {
    useOnboardingStore.setState({ checklistProgress: { first_note: '2026-01-01' } })
    await useOnboardingStore.getState().markChecklistStep('first_note')
    expect(api().settings.set).not.toHaveBeenCalled()
  })
})

describe('markTipShown', () => {
  it('첫 호출 → tipsShown 에 추가', async () => {
    await useOnboardingStore.getState().markTipShown('tip-a')
    expect(useOnboardingStore.getState().tipsShown).toEqual(['tip-a'])
  })

  it('이미 표시된 tip → 호출 무시', async () => {
    useOnboardingStore.setState({ tipsShown: ['tip-a'] })
    await useOnboardingStore.getState().markTipShown('tip-a')
    expect(api().settings.set).not.toHaveBeenCalled()
  })
})

describe('acknowledgeChecklist / resetChecklist', () => {
  it('acknowledgeChecklist → true + settings.set', async () => {
    await useOnboardingStore.getState().acknowledgeChecklist()
    expect(useOnboardingStore.getState().checklistAcknowledged).toBe(true)
    expect(api().settings.set).toHaveBeenCalled()
  })

  it('이미 ack 상태면 호출 무시', async () => {
    useOnboardingStore.setState({ checklistAcknowledged: true })
    await useOnboardingStore.getState().acknowledgeChecklist()
    expect(api().settings.set).not.toHaveBeenCalled()
  })

  it('resetChecklist → 3 종 키 초기화 + 3 settings.set', async () => {
    useOnboardingStore.setState({
      checklistProgress: { first_note: 'x' },
      tipsShown: ['tip-a'],
      checklistAcknowledged: true
    })
    await useOnboardingStore.getState().resetChecklist()
    const s = useOnboardingStore.getState()
    expect(s.checklistProgress).toEqual({})
    expect(s.tipsShown).toEqual([])
    expect(s.checklistAcknowledged).toBe(false)
    expect(api().settings.set).toHaveBeenCalledTimes(3)
  })
})

describe('selectChecklistCounts', () => {
  it('빈 상태 → done=0, isAllDone=false', () => {
    const r = selectChecklistCounts(useOnboardingStore.getState())
    expect(r.done).toBe(0)
    expect(r.total).toBe(CHECKLIST_STEPS.length)
    expect(r.isAllDone).toBe(false)
  })

  it('일부 step 완료', () => {
    useOnboardingStore.setState({
      checklistProgress: { first_note: 'x', first_todo: 'y' }
    })
    const r = selectChecklistCounts(useOnboardingStore.getState())
    expect(r.done).toBe(2)
    expect(r.isAllDone).toBe(false)
  })

  it('모든 step 완료 → isAllDone=true', () => {
    const allProgress: Record<string, string> = {}
    for (const step of CHECKLIST_STEPS) {
      allProgress[step.id] = '2026-01-01'
    }
    useOnboardingStore.setState({ checklistProgress: allProgress })
    const r = selectChecklistCounts(useOnboardingStore.getState())
    expect(r.done).toBe(CHECKLIST_STEPS.length)
    expect(r.isAllDone).toBe(true)
  })
})
