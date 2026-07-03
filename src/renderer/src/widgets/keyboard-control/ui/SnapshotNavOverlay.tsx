/**
 * 탭 스냅샷 전환 오버레이 — primary modifier + shift + s 모드 활성 시 표시.
 */
import { JSX } from 'react'
import { Camera } from 'lucide-react'
import { useSnapshotNavStore } from '../model/snapshot-nav-store'
import { KeyboardOverlayPicker, type OverlayPickerItem } from './KeyboardOverlayPicker'
import { isMac } from '@shared/lib/platform'

export function SnapshotNavOverlay(): JSX.Element | null {
  const open = useSnapshotNavStore((s) => s.open)
  const items = useSnapshotNavStore((s) => s.items)
  const focusIndex = useSnapshotNavStore((s) => s.focusIndex)

  if (!open) return null

  const pickerItems: OverlayPickerItem[] = items.map((it) => ({
    id: it.snapshotId,
    label: it.name,
    icon: <Camera className="size-3.5 text-muted-foreground" />,
    meta: it.description || undefined
  }))

  return (
    <KeyboardOverlayPicker
      items={pickerItems}
      focusIndex={focusIndex}
      title="탭 스냅샷 전환"
      footer={`${isMac() ? 'cmd' : 'ctrl'} + shift 유지 + s 로 순환, 떼면 해당 스냅샷 복원`}
    />
  )
}
