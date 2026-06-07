/**
 * 설정 다이얼로그 — 단축키 탭.
 *
 * 현재 구현된 글로벌 단축키 spec 을 카테고리별로 정리해 보여준다.
 * 사용자가 수정하지 않는 read-only reference (실제 매핑은 keyboard-control
 * feature 의 hook 들에 하드코딩).
 */
import { JSX, ReactNode } from 'react'
import { Kbd, KbdGroup } from '@shared/ui/kbd'

interface ShortcutRow {
  label: string
  keys: ReactNode
  description?: string
}

interface ShortcutGroup {
  title: string
  rows: ShortcutRow[]
}

// macOS 표기 — 다른 OS 지원 시 분기 필요. 현재는 macOS 전용 feature.
function Combo({ keys, trigger }: { keys: string[]; trigger?: string }): JSX.Element {
  return (
    <KbdGroup>
      {keys.map((k) => (
        <Kbd key={k}>{k}</Kbd>
      ))}
      {trigger && (
        <>
          <span className="text-muted-foreground text-xs px-0.5">+</span>
          <Kbd>{trigger}</Kbd>
        </>
      )}
    </KbdGroup>
  )
}

const GROUPS: ShortcutGroup[] = [
  {
    title: '검색',
    rows: [
      {
        label: '전체 검색',
        keys: <Combo keys={['⌘', '⇧']} trigger="F" />,
        description:
          'cmd + shift + f 를 누르면 전체 검색 다이얼로그가 열립니다. 노트 · 표 · PDF · 이미지 · 캔버스 · 할일을 한 번에 검색하고, 결과를 클릭하면 해당 탭이 열립니다. 입력 필드 / 편집기에 포커스가 있어도 동작합니다.'
      }
    ]
  },
  {
    title: '탭 레이아웃',
    rows: [
      {
        label: 'Pane 이동',
        keys: <Combo keys={['⌃', '⇧']} trigger="←→↑↓" />,
        description:
          'ctrl + shift 를 누른 상태에서 방향키를 누르면 인접한 pane 으로 active 가 이동합니다. 누르고 있는 동안 layout 미니 그림 오버레이가 표시됩니다.'
      },
      {
        label: '탭 이동',
        keys: <Combo keys={['⌘', '⌥']} trigger="] / [" />,
        description:
          'cmd + opt 를 누른 상태에서 ] (다음) 또는 [ (이전) 을 누르면 현재 pane 의 탭 사이를 순환합니다. 모디파이어를 떼면 강조된 탭이 활성화됩니다.'
      },
      {
        label: '탭 스냅샷 전환',
        keys: <Combo keys={['⌘', '⇧']} trigger="S" />,
        description:
          'cmd + shift 를 누른 상태에서 s 를 누르면 워크스페이스의 탭 스냅샷 리스트를 순환합니다. 모디파이어를 떼면 강조된 스냅샷으로 layout 이 복원됩니다.'
      }
    ]
  }
]

export function KeyboardShortcutsSettings(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">키보드 단축키</h2>
        <p className="text-sm text-muted-foreground mt-1">
          현재 지원되는 키보드 단축키 목록입니다. macOS 만 지원하며, 입력 필드 / 노트 편집기에
          포커스가 있을 때는 비활성화됩니다.
        </p>
      </div>

      {GROUPS.map((group) => (
        <section key={group.title} className="space-y-3">
          <h3 className="text-sm font-medium text-foreground/80 border-b pb-1.5">{group.title}</h3>
          <div className="space-y-3">
            {group.rows.map((row) => (
              <div key={row.label} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-medium">{row.label}</div>
                  <div className="shrink-0">{row.keys}</div>
                </div>
                {row.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{row.description}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground leading-relaxed">
        파일 탐색기 / 할일 / 노트 등 컨텍스트별 단축키는 후속 작업으로 추가될 예정입니다.
      </div>
    </div>
  )
}
