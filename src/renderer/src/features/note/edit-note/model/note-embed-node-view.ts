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
    private view: EditorView,
    private getPos: () => number | undefined,
    private workspaceId: string
  ) {
    void this.workspaceId // workspaceId 는 EmbedView 내부 hook 에서 useCurrentWorkspaceStore 로 가져옴
    this.portalId = nanoid()
    // 노트(링크)는 span(inline), csv/pdf 는 div(block) — span 안 div 는 HTML
    // 유효성 X. 도메인별 tag 분기.
    const domain = node.attrs.domain as string
    const isBlock = domain === 'csv' || domain === 'pdf'
    this.dom = document.createElement(isBlock ? 'div' : 'span')
    this.dom.setAttribute('data-rally-embed', 'true')
    this.dom.setAttribute('data-portal-id', this.portalId)
    this.dom.className = 'rally-embed-host'
    // 브라우저 native selection 으로 임베드 내부 텍스트가 같이 선택되어
    // inline-toolbar (색상/굵게 등) 가 임베드를 변환 시도하는 걸 막는다.
    this.dom.style.userSelect = 'none'
    if (isBlock) {
      this.dom.style.width = '100%'
    } else {
      this.dom.style.display = 'inline-block'
      this.dom.style.verticalAlign = 'baseline'
    }
    this.register()
  }

  private handleHeightChange = (newHeight: number): void => {
    const pos = this.getPos()
    if (typeof pos !== 'number') return
    const tr = this.view.state.tr.setNodeMarkup(pos, undefined, {
      ...this.node.attrs,
      height: Math.max(0, Math.round(newHeight))
    })
    this.view.dispatch(tr)
  }

  private register(): void {
    useEmbedPortalStore.getState().register({
      portalId: this.portalId,
      host: this.dom,
      domain: this.node.attrs.domain as EmbedDomain,
      entityId: this.node.attrs.entityId as string,
      height: (this.node.attrs.height as number) || 0,
      onHeightChange: this.handleHeightChange
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

  /**
   * pointer / mouse / click / drag / touch 이벤트를 ProseMirror 로 전파하지 않음.
   *
   * - PM 의 NodeSelection / TextSelection 이 임베드 위에서 생성되지 않게 → crepe
   *   inline-toolbar (selection 기반) 가 trigger 되지 않아 색상/굵게/코드블럭
   *   변환 메뉴가 임베드에 적용되지 않는다.
   * - keyboard 이벤트는 PM 에 넘긴다 — 옆 caret 에서 backspace 로 atom 삭제 가능.
   * - React onClick / pointerDown (resize handle 등) 은 NodeView 내부에서
   *   처리되므로 영향 없음.
   */
  stopEvent(event: Event): boolean {
    const t = event.type
    return (
      t.startsWith('pointer') ||
      t.startsWith('mouse') ||
      t.startsWith('drag') ||
      t.startsWith('touch') ||
      t === 'click' ||
      t === 'dblclick' ||
      t === 'contextmenu'
    )
  }

  ignoreMutation(): boolean {
    return true
  }
}
