/**
 * 노트 임베드 NodeView (`rally_embed` ProseMirror 노드).
 *
 * 4 도메인 (note/csv/pdf) 을 한 NodeView 에서 처리. domain 별 분기:
 *  - note  → 제목 링크 (id 로 noteRepository.findById → 제목 fetch)
 *  - csv   → 읽기전용 표 컴포넌트 (h 메타로 컨테이너 height + 내부 스크롤)
 *  - pdf   → 툴바 없는 PDF 렌더러 (h 메타로 컨테이너 height + 내부 스크롤)
 *
 * 이번 1단계 구현: domain 별 placeholder 렌더링 (한 줄 인라인 박스, "embed: domain:id").
 * 다음 단계에서 React Portal 로 각 도메인 컴포넌트 wiring.
 */
import type { NodeView } from '@milkdown/kit/prose/view'
import type { Node } from '@milkdown/kit/prose/model'
import type { EditorView } from '@milkdown/kit/prose/view'

export function createNoteEmbedNodeViewFactory(workspaceId: string) {
  return (node: Node, view: EditorView, getPos: () => number | undefined): NoteEmbedNodeView => {
    return new NoteEmbedNodeView(node, view, getPos, workspaceId)
  }
}

class NoteEmbedNodeView implements NodeView {
  dom: HTMLElement

  constructor(
    private node: Node,
    _view: EditorView,
    _getPos: () => number | undefined,
    private workspaceId: string
  ) {
    void this.workspaceId // 추후 단계에서 사용
    this.dom = document.createElement('span')
    this.render()
  }

  private render(): void {
    const domain = this.node.attrs.domain as string
    const entityId = this.node.attrs.entityId as string
    const height = (this.node.attrs.height as number) || 0
    this.dom.setAttribute('data-rally-embed', 'true')
    this.dom.setAttribute('data-domain', domain)
    this.dom.setAttribute('data-entity-id', entityId)
    if (height > 0) this.dom.setAttribute('data-height', String(height))
    this.dom.className = 'rally-embed rally-embed-placeholder'
    this.dom.textContent = `embed: ${domain}:${entityId}${height > 0 ? `|h=${height}` : ''}`
  }

  update(node: Node): boolean {
    if (node.type.name !== this.node.type.name) return false
    this.node = node
    this.render()
    return true
  }

  stopEvent(): boolean {
    return false
  }

  ignoreMutation(): boolean {
    return true
  }
}
