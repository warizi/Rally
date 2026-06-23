import { createElement, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isWorkspaceOwnWrite } from '@shared/lib/workspace-own-write'
import { useTabStore } from '@/entities/tab-system'
import type { TabOptions } from '@/entities/tab-system/model/types'
import { AuthorBadge } from '@shared/ui/author-badge'

interface WatchedItem {
  id: string
  relativePath: string
  title: string
  updatedBy?: 'user' | 'ai'
  updatedById?: string | null
  updatedAt?: Date | string | number
}

interface WatcherActor {
  kind: 'user' | 'ai'
  id: string | null
}

interface FileWatcherConfig {
  /** window.api[type].onChanged 메서드 */
  onChanged: (
    cb: (workspaceId: string, changedRelPaths: string[], actor: WatcherActor | null) => void
  ) => () => void
  /** React Query 캐시 키 prefix (예: 'note') */
  queryKeyPrefix: string
  /** 토스트 아이콘 컴포넌트 */
  icon: React.ComponentType<{ className?: string }>
  /** 커스텀 이벤트 이름 */
  externalChangedEvent: string
  /** entity ID 필드명 (CustomEvent detail) */
  idField: string
  /** isOwnWrite 함수 */
  isOwnWrite: (id: string) => boolean
  /** 클릭 시 열 탭 옵션 빌더 */
  buildTabOptions: (item: WatchedItem) => TabOptions
}

/** 토스트에 표시할 외부 변경 항목 (deleted 항목은 클릭 불가) */
interface AffectedItem {
  item: WatchedItem
  clickable: boolean
}

export function useFileWatcher(config: FileWatcherConfig): void {
  const queryClient = useQueryClient()
  const openTab = useTabStore((s) => s.openTab)
  const readyRef = useRef(false)
  const {
    onChanged,
    queryKeyPrefix,
    icon,
    externalChangedEvent,
    idField,
    isOwnWrite: checkOwnWrite,
    buildTabOptions
  } = config

  useEffect(() => {
    const timer = setTimeout(() => {
      readyRef.current = true
    }, 2000)

    /** 외부 변경 토스트 — 생성/수정/삭제 구분 없이 "외부에서 변경되었습니다"로 통일 */
    const showChangedToast = (affected: AffectedItem[]): void => {
      toast.info('외부에서 변경되었습니다', {
        description: createElement(
          'ul',
          { className: 'mt-1 flex flex-col gap-0.5' },
          ...affected.map(({ item, clickable }) =>
            createElement(
              'li',
              { key: item.id },
              createElement(
                clickable ? 'button' : 'div',
                clickable
                  ? {
                      type: 'button',
                      className:
                        'flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-accent cursor-pointer',
                      onClick: () => {
                        openTab(buildTabOptions(item))
                        toast.dismiss()
                      }
                    }
                  : {
                      className:
                        'flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-muted-foreground'
                    },
                createElement(icon, { className: 'size-3.5 shrink-0' }),
                createElement('span', { className: 'truncate flex-1' }, item.title),
                item.updatedBy &&
                  createElement(AuthorBadge, {
                    by: item.updatedBy,
                    byId: item.updatedById ?? null,
                    at: item.updatedAt,
                    size: 'sm'
                  })
              )
            )
          )
        )
      })
    }

    const unsub = onChanged((workspaceId, changedRelPaths, actor) => {
      const queryKey = [queryKeyPrefix, 'workspace', workspaceId]
      // 갱신 전 캐시 — invalidate 후 새 캐시와 합쳐, 외부에서 새로 생성된 파일까지 포착한다.
      const oldItems = queryClient.getQueryData<WatchedItem[]>(queryKey) ?? []

      void queryClient.invalidateQueries({ queryKey }).then(() => {
        if (changedRelPaths.length === 0 || isWorkspaceOwnWrite(workspaceId)) return

        const newItems = queryClient.getQueryData<WatchedItem[]>(queryKey) ?? []
        const oldByPath = new Map(oldItems.map((i) => [i.relativePath, i] as const))
        const newByPath = new Map(newItems.map((i) => [i.relativePath, i] as const))

        // 변경된 경로의 항목 수집 (생성=new / 삭제=old / 수정=둘다), own-write 제외·중복 제거
        const affected: AffectedItem[] = []
        const seen = new Set<string>()
        for (const path of changedRelPaths) {
          const inNew = newByPath.get(path)
          const item = inNew ?? oldByPath.get(path)
          if (!item || seen.has(item.id) || checkOwnWrite(item.id)) continue
          seen.add(item.id)
          affected.push({ item, clickable: Boolean(inNew) })
        }

        // 토스트는 진짜 외부 편집(actor 없음) + 마운트 2초 후에만.
        // MCP(actor 있음) 변경은 mcp:activity 전용 토스트가 담당한다.
        if (readyRef.current && !actor && affected.length > 0) {
          showChangedToast(affected)
        }

        // 열린 에디터 새로고침 — 여전히 존재하는 항목은 content refetch + 외부변경 이벤트 dispatch
        for (const { item, clickable } of affected) {
          if (!clickable) continue
          void queryClient
            .refetchQueries({ queryKey: [queryKeyPrefix, 'content', item.id] })
            .then(() => {
              window.dispatchEvent(
                new CustomEvent(externalChangedEvent, { detail: { [idField]: item.id } })
              )
            })
        }
      })
    })

    return () => {
      clearTimeout(timer)
      unsub()
    }
  }, [
    queryClient,
    onChanged,
    queryKeyPrefix,
    icon,
    externalChangedEvent,
    idField,
    checkOwnWrite,
    buildTabOptions,
    openTab
  ])
}
