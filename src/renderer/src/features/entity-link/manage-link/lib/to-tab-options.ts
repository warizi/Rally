import type { LinkableEntityType } from '@shared/lib/entity-link'
import type { TabType } from '@shared/constants/tab-url'

export function toTabOptions(
  linkedType: LinkableEntityType,
  linkedId: string,
  title: string,
  parentId?: string | null
): { type: TabType; pathname: string; title: string } | null {
  switch (linkedType) {
    case 'todo':
      return { type: 'todo-detail', pathname: `/todo/${parentId ?? linkedId}`, title }
    case 'note':
      return { type: 'note', pathname: `/folder/note/${linkedId}`, title }
    case 'pdf':
      return { type: 'pdf', pathname: `/folder/pdf/${linkedId}`, title }
    case 'csv':
      return { type: 'csv', pathname: `/folder/csv/${linkedId}`, title }
    case 'image':
      return { type: 'image', pathname: `/folder/image/${linkedId}`, title }
    case 'schedule':
      return { type: 'calendar', pathname: '/calendar', title: '캘린더' }
  }
}
