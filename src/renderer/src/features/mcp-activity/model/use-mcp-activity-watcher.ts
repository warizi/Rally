import { createElement, useEffect } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Bell,
  Calendar,
  CheckSquare,
  Copy,
  Link2,
  Network,
  Repeat,
  Tag as TagIcon,
  Trash2
} from 'lucide-react'
import { useTabStore } from '@/entities/tab-system'
import type { TabOptions } from '@/entities/tab-system/model/types'
import { formatAuthor } from '@shared/lib/format-author'
import { ROUTES, TAB_ICON, type TabType } from '@shared/constants/tab-url'

// preload `mcp:activity` 채널과 형태를 일치시킨다 (구조적 호환).
type McpActivityDomain =
  | 'note'
  | 'csv'
  | 'pdf'
  | 'image'
  | 'folder'
  | 'canvas'
  | 'todo'
  | 'schedule'
  | 'recurring-rule'
  | 'recurring-completion'
  | 'reminder'
  | 'tag'
  | 'template'
  | 'link'
  | 'workspace'
  | 'trash'

type McpActivityOperation =
  | 'create'
  | 'update'
  | 'rename'
  | 'move'
  | 'delete'
  | 'restore'
  | 'purge'
  | 'empty'
  | 'link'
  | 'unlink'
  | 'attach'
  | 'detach'
  | 'complete'
  | 'uncomplete'
  | 'switch'

interface McpActivityItem {
  type: McpActivityDomain
  id: string
  title: string
  path?: string
}

interface McpActivityRecord {
  domain: McpActivityDomain
  operation: McpActivityOperation
  items: McpActivityItem[]
}

interface McpActivityPayload {
  workspaceId: string | null
  actor: { kind: 'user' | 'ai'; id: string | null }
  records: McpActivityRecord[]
}

const DOMAIN_LABEL: Record<McpActivityDomain, string> = {
  note: '노트',
  csv: '테이블',
  pdf: 'PDF',
  image: '이미지',
  folder: '폴더',
  canvas: '캔버스',
  todo: '할일',
  schedule: '일정',
  'recurring-rule': '반복 규칙',
  'recurring-completion': '반복 완료',
  reminder: '리마인더',
  tag: '태그',
  template: '템플릿',
  link: '링크',
  workspace: '워크스페이스',
  trash: '휴지통'
}

const OP_LABEL: Record<McpActivityOperation, string> = {
  create: '생성',
  update: '수정',
  rename: '이름 변경',
  move: '이동',
  delete: '삭제',
  restore: '복원',
  purge: '영구 삭제',
  empty: '비움',
  link: '링크 연결',
  unlink: '링크 해제',
  attach: '태그 부착',
  detach: '태그 해제',
  complete: '완료',
  uncomplete: '완료 취소',
  switch: '전환'
}

/** 클릭 시 탭으로 열 수 있는 도메인 → (탭 타입, 라우트 패턴) */
const OPENABLE: Partial<Record<McpActivityDomain, { tabType: TabType; route: string }>> = {
  note: { tabType: 'note', route: ROUTES.NOTE_DETAIL },
  csv: { tabType: 'csv', route: ROUTES.CSV_DETAIL },
  pdf: { tabType: 'pdf', route: ROUTES.PDF_DETAIL },
  image: { tabType: 'image', route: ROUTES.IMAGE_DETAIL },
  todo: { tabType: 'todo-detail', route: ROUTES.TODO_DETAIL },
  canvas: { tabType: 'canvas-detail', route: ROUTES.CANVAS_DETAIL }
}

/** 탭으로 못 여는 도메인의 아이콘 */
const FALLBACK_ICON: Record<string, React.ElementType> = {
  folder: TAB_ICON.folder,
  schedule: Calendar,
  'recurring-rule': Repeat,
  'recurring-completion': Repeat,
  reminder: Bell,
  tag: TagIcon,
  template: Copy,
  link: Link2,
  workspace: CheckSquare,
  trash: Trash2,
  canvas: Network
}

function iconFor(domain: McpActivityDomain): React.ElementType {
  const openable = OPENABLE[domain]
  if (openable) return TAB_ICON[openable.tabType]
  return FALLBACK_ICON[domain] ?? Bell
}

function buildTabOptions(domain: McpActivityDomain, id: string, title: string): TabOptions | null {
  const openable = OPENABLE[domain]
  if (!openable) return null
  return {
    type: openable.tabType,
    pathname: openable.route.replace(/:[A-Za-z]+/, id),
    title
  }
}

/** 도메인 변경 시 무효화할 React Query prefix 들 */
function invalidateForDomain(qc: QueryClient, domain: McpActivityDomain): void {
  const prefixes: string[][] = []
  switch (domain) {
    case 'recurring-completion':
      prefixes.push(['recurring-completion'], ['recurring-rule'])
      break
    case 'link':
      prefixes.push(['entity-link'], ['todo'])
      break
    case 'tag':
      prefixes.push(['tag'], ['itemTag'])
      break
    case 'trash':
      // 복원/영구삭제는 어느 도메인이든 영향 → 폭넓게 무효화
      prefixes.push(
        ['note'],
        ['csv'],
        ['pdf'],
        ['image'],
        ['folder'],
        ['canvas'],
        ['todo'],
        ['schedule'],
        ['recurring-rule'],
        ['template']
      )
      break
    case 'workspace':
      break
    default:
      prefixes.push([domain])
  }
  for (const key of prefixes) qc.invalidateQueries({ queryKey: key })
}

/**
 * MCP 전용 활동 토스트 — 파일 워처와 분리된 별도 채널(`mcp:activity`).
 * 파일/할일/캔버스/일정/태그 등 MCP 로 조작한 모든 도메인을 토스트로 알리고,
 * 클릭 시 해당 항목을 탭으로 연다. payload 에 title 이 실려오므로 캐시에 의존하지 않는다.
 * MainLayout 에서 1회 마운트한다.
 */
export function useMcpActivityWatcher(): void {
  const queryClient = useQueryClient()
  const openTab = useTabStore((s) => s.openTab)

  useEffect(() => {
    const unsub = window.api.mcpActivity.onActivity((payload: McpActivityPayload) => {
      const who = formatAuthor('ai', payload.actor.id ?? null)
      for (const record of payload.records) {
        invalidateForDomain(queryClient, record.domain)
        showToast(who, record, openTab)
      }
    })
    return unsub
  }, [queryClient, openTab])
}

function showToast(
  who: string,
  record: McpActivityRecord,
  openTab: (options: TabOptions) => void
): void {
  const { domain, operation, items } = record
  const Icon = iconFor(domain)
  const domainLabel = DOMAIN_LABEL[domain]
  const opLabel = OP_LABEL[operation]
  const count = items.length

  const title =
    count === 1
      ? `${who}가 ${domainLabel} '${items[0].title}' ${opLabel}`
      : `${who}가 ${domainLabel} ${count}개 ${opLabel}`

  const description = createElement(
    'ul',
    { className: 'mt-1 flex flex-col gap-0.5' },
    ...items.map((item) => {
      const tabOptions = buildTabOptions(domain, item.id, item.title)
      return createElement(
        'li',
        { key: item.id },
        createElement(
          'button',
          {
            type: 'button',
            disabled: !tabOptions,
            className: tabOptions
              ? 'flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-accent cursor-pointer'
              : 'flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-muted-foreground',
            onClick: tabOptions
              ? () => {
                  openTab(tabOptions)
                  toast.dismiss()
                }
              : undefined
          },
          createElement(Icon, { className: 'size-3.5 shrink-0' }),
          createElement('span', { className: 'truncate flex-1' }, item.title)
        )
      )
    })
  )

  toast.info(title, { description })
}
