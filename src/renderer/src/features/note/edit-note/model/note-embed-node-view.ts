/**
 * 노트 임베드 NodeView — host DOM 생성 + portal store 등록.
 *
 * NoteEditor 의 EmbedPortals 컴포넌트가 store 를 구독해서 host 안에 React
 * 컴포넌트 (EmbedView) 를 portal mount.
 */
import type { NodeView } from '@milkdown/kit/prose/view'
import type { Node } from '@milkdown/kit/prose/model'
import type { EditorView } from '@milkdown/kit/prose/view'
import { nanoid } from 'nanoid'
import { useEmbedPortalStore } from './embed-portal-store'
import type { EmbedDomain } from './note-embed-schema'

export function createNoteEmbedNodeViewFactory(workspaceId: string) {
  return (node: Node, view: EditorView, getPos: () => number | undefined): NoteEmbedNodeView => {
    return new NoteEmbedNodeView(node, view, getPos, workspaceId)
  }
}

class NoteEmbedNodeView implements NodeView {
  dom: HTMLElement
  private portalId: string

  constructor(
    private node: Node,
    _view: EditorView,
    _getPos: () => number | undefined,
    private workspaceId: string
  ) {
    void this.workspaceId // workspaceId 는 EmbedView 내부 hook 에서 useCurrentWorkspaceStore 로 가져옴
    this.portalId = nanoid()
    this.dom = document.createElement('span')
    this.dom.setAttribute('data-rally-embed', 'true')
    this.dom.setAttribute('data-portal-id', this.portalId)
    this.dom.className = 'rally-embed-host'
    // 노트(링크)는 inline, csv/pdf 는 block + 100% 폭 (paragraph 너비 가득 차게)
    const domain = node.attrs.domain as string
    if (domain === 'csv' || domain === 'pdf') {
      this.dom.style.display = 'block'
      this.dom.style.width = '100%'
    } else {
      this.dom.style.display = 'inline-block'
      this.dom.style.verticalAlign = 'baseline'
    }
    this.register()
  }

  private register(): void {
    useEmbedPortalStore.getState().register({
      portalId: this.portalId,
      host: this.dom,
      domain: this.node.attrs.domain as EmbedDomain,
      entityId: this.node.attrs.entityId as string,
      height: (this.node.attrs.height as number) || 0
    })
  }

  update(node: Node): boolean {
    if (node.type.name !== this.node.type.name) return false
    this.node = node
    useEmbedPortalStore.getState().updateEntry(this.portalId, {
      domain: node.attrs.domain as EmbedDomain,
      entityId: node.attrs.entityId as string,
      height: (node.attrs.height as number) || 0
    })
    return true
  }

  destroy(): void {
    useEmbedPortalStore.getState().unregister(this.portalId)
  }

  stopEvent(): boolean {
    return false
  }

  ignoreMutation(): boolean {
    return true
  }
}
