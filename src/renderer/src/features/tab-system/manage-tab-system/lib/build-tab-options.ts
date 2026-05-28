import type { TabType } from '@shared/constants/tab-url'
import type { TabOptions } from '../model/types'

interface TreeNodeForTab {
  kind: TabType // 'folder' | 'note' | 'csv' | 'pdf' | 'image' 등
  id: string
  title: string
}

/**
 * 트리 노드 정보(kind + id + title)에서 탭 오픈용 TabOptions를 만든다.
 * 폴더는 `/folder/:id`, 그 외는 `/folder/{kind}/:id` 패턴.
 */
export function buildTabOptions(node: TreeNodeForTab): TabOptions {
  const pathname = node.kind === 'folder' ? `/folder/${node.id}` : `/folder/${node.kind}/${node.id}`
  return {
    type: node.kind,
    title: node.title,
    pathname
  }
}
