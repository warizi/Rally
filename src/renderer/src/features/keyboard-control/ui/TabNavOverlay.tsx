/**
 * 탭 이동 오버레이 — shift + tab 모드 활성 시 표시.
 *
 * tab-nav-store 를 구독해서 items / focusIndex 렌더링. 표시 자체는
 * KeyboardOverlayPicker 가 담당, 키 입력 처리는 useTabNavigation hook.
 */
import { JSX } from 'react'
import { useTabNavStore } from '../model/tab-nav-store'
import { KeyboardOverlayPicker, type OverlayPickerItem } from './KeyboardOverlayPicker'
import { TAB_ICON, type TabType } from '@/shared/constants/tab-url'

export function TabNavOverlay(): JSX.Element | null {
  const open = useTabNavStore((s) => s.open)
  const items = useTabNavStore((s) => s.items)
  const focusIndex = useTabNavStore((s) => s.focusIndex)

  if (!open) return null

  const pickerItems: OverlayPickerItem[] = items.map((it) => {
    const Icon = TAB_ICON[it.type as TabType]
    return {
      id: it.tabId,
      label: it.title,
      icon: Icon ? <Icon className="size-3.5 text-muted-foreground" /> : null
    }
  })

  return (
    <KeyboardOverlayPicker
      items={pickerItems}
      focusIndex={focusIndex}
      title="탭 이동"
      footer="shift 유지 + tab 으로 순환, 떼면 해당 탭 열림"
    />
  )
}
