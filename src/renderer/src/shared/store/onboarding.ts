import { create } from 'zustand'

export const ONBOARDING_KEYS = {
  welcomeDismissed: 'onboarding.welcomeDismissed',
  checklistProgress: 'onboarding.checklistProgress',
  tipsShown: 'onboarding.tipsShown',
  checklistAcknowledged: 'onboarding.checklistAcknowledged'
} as const

export type ChecklistStepId =
  | 'first_note'
  | 'first_todo'
  | 'link_items'
  | 'canvas_node'
  | 'add_tag'
  | 'connect_ai'
  | 'view_trash'

export interface ChecklistStep {
  id: ChecklistStepId
  label: string
  description: string
  /** /folder, /todo, /canvas, /tag, /settings, /trash 등의 경로 */
  pathname: string
}

export const CHECKLIST_STEPS: readonly ChecklistStep[] = [
  {
    id: 'first_note',
    label: '첫 노트 만들기',
    description: '탐색기에서 노트를 하나 만들어보세요.',
    pathname: '/folder'
  },
  {
    id: 'first_todo',
    label: '첫 할 일 만들기',
    description: '오늘 해야 할 일 하나를 적어보세요.',
    pathname: '/todo'
  },
  {
    id: 'link_items',
    label: '항목 간 링크 만들기',
    description: '할 일과 노트를 연결해보세요.',
    pathname: '/todo'
  },
  {
    id: 'canvas_node',
    label: '캔버스에 노드 추가하기',
    description: '아이디어를 시각적으로 정리해보세요.',
    pathname: '/canvas'
  },
  {
    id: 'add_tag',
    label: '태그 만들고 부착하기',
    description: '태그로 콘텐츠를 분류해보세요.',
    pathname: '/tag'
  },
  {
    id: 'connect_ai',
    label: 'AI 통합 등록하기',
    description: '설정 > AI에서 Claude를 1-click 등록.',
    pathname: '/settings/ai'
  },
  {
    id: 'view_trash',
    label: '휴지통 살펴보기',
    description: '삭제 항목은 30일간 복구 가능합니다.',
    pathname: '/trash'
  }
] as const

interface OnboardingState {
  welcomeDismissed: boolean
  checklistProgress: Record<string, string>
  tipsShown: string[]
  checklistAcknowledged: boolean
  hydrated: boolean
}

interface OnboardingActions {
  hydrate: () => Promise<void>
  dismissWelcome: () => Promise<void>
  resetWelcome: () => Promise<void>
  markChecklistStep: (stepId: ChecklistStepId) => Promise<void>
  markTipShown: (tipId: string) => Promise<void>
  acknowledgeChecklist: () => Promise<void>
  resetChecklist: () => Promise<void>
}

type OnboardingStore = OnboardingState & OnboardingActions

const initialState: OnboardingState = {
  welcomeDismissed: false,
  checklistProgress: {},
  tipsShown: [],
  checklistAcknowledged: false,
  hydrated: false
}

function parseBool(value: string | null | undefined): boolean {
  return value === 'true'
}

function parseJsonRecord(value: string | null | undefined): Record<string, string> {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>
    }
  } catch {
    // ignore — corrupt value, fall back to {}
  }
  return {}
}

function parseJsonStringArray(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === 'string')
    }
  } catch {
    // ignore — corrupt value, fall back to []
  }
  return []
}

export const useOnboardingStore = create<OnboardingStore>()((set, get) => ({
  ...initialState,

  hydrate: async (): Promise<void> => {
    const [welcomeRes, checklistRes, tipsRes, ackRes] = await Promise.all([
      window.api.settings.get(ONBOARDING_KEYS.welcomeDismissed),
      window.api.settings.get(ONBOARDING_KEYS.checklistProgress),
      window.api.settings.get(ONBOARDING_KEYS.tipsShown),
      window.api.settings.get(ONBOARDING_KEYS.checklistAcknowledged)
    ])

    set({
      welcomeDismissed: parseBool(welcomeRes.success ? welcomeRes.data : null),
      checklistProgress: parseJsonRecord(checklistRes.success ? checklistRes.data : null),
      tipsShown: parseJsonStringArray(tipsRes.success ? tipsRes.data : null),
      checklistAcknowledged: parseBool(ackRes.success ? ackRes.data : null),
      hydrated: true
    })
  },

  dismissWelcome: async (): Promise<void> => {
    set({ welcomeDismissed: true })
    await window.api.settings.set(ONBOARDING_KEYS.welcomeDismissed, 'true')
  },

  resetWelcome: async (): Promise<void> => {
    set({ welcomeDismissed: false })
    await window.api.settings.set(ONBOARDING_KEYS.welcomeDismissed, 'false')
  },

  markChecklistStep: async (stepId: string): Promise<void> => {
    const current = get().checklistProgress
    if (current[stepId]) return
    const next = { ...current, [stepId]: new Date().toISOString() }
    set({ checklistProgress: next })
    await window.api.settings.set(ONBOARDING_KEYS.checklistProgress, JSON.stringify(next))
  },

  markTipShown: async (tipId: string): Promise<void> => {
    const current = get().tipsShown
    if (current.includes(tipId)) return
    const next = [...current, tipId]
    set({ tipsShown: next })
    await window.api.settings.set(ONBOARDING_KEYS.tipsShown, JSON.stringify(next))
  },

  acknowledgeChecklist: async (): Promise<void> => {
    if (get().checklistAcknowledged) return
    set({ checklistAcknowledged: true })
    await window.api.settings.set(ONBOARDING_KEYS.checklistAcknowledged, 'true')
  },

  resetChecklist: async (): Promise<void> => {
    set({ checklistProgress: {}, tipsShown: [], checklistAcknowledged: false })
    await Promise.all([
      window.api.settings.set(ONBOARDING_KEYS.checklistProgress, '{}'),
      window.api.settings.set(ONBOARDING_KEYS.tipsShown, '[]'),
      window.api.settings.set(ONBOARDING_KEYS.checklistAcknowledged, 'false')
    ])
  }
}))

/** Selectors */
export function selectChecklistCounts(state: OnboardingState): {
  total: number
  done: number
  isAllDone: boolean
} {
  const total = CHECKLIST_STEPS.length
  let done = 0
  for (const step of CHECKLIST_STEPS) {
    if (state.checklistProgress[step.id]) done++
  }
  return { total, done, isAllDone: done === total }
}
