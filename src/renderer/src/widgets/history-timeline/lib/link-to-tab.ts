import type { TabOptions } from '@/features/tap-system/manage-tab-system'
import type { HistoryLink } from '@entities/history'

/** HistoryLink → openTab options */
export function linkToTabOptions(link: HistoryLink): TabOptions | null {
  switch (link.type) {
    case 'note':
      return { type: 'note', pathname: `/folder/note/${link.id}`, title: link.title }
    case 'csv':
      return { type: 'csv', pathname: `/folder/csv/${link.id}`, title: link.title }
    case 'pdf':
      return { type: 'pdf', pathname: `/folder/pdf/${link.id}`, title: link.title }
    case 'image':
      return { type: 'image', pathname: `/folder/image/${link.id}`, title: link.title }
    case 'canvas':
      return {
        type: 'canvas-detail',
        pathname: `/canvas/${link.id}`,
        title: link.title
      }
    default:
      return null
  }
}
