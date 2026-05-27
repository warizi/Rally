import type { NodeView } from '@milkdown/kit/prose/view'
import type { Node } from '@milkdown/kit/prose/model'
import type { EditorView } from '@milkdown/kit/prose/view'

export function createNoteImageNodeViewFactory(workspaceId: string) {
  return (node: Node, view: EditorView, getPos: () => number | undefined): NoteImageNodeView => {
    return new NoteImageNodeView(node, view, getPos, workspaceId)
  }
}

/** alt 에서 `h=NNN` 메타 파싱. 없으면 null. */
function parseHeightFromAlt(alt: string): number | null {
  const m = alt.match(/(?:^|\s)h=(\d+)(?:\s|$)/)
  if (!m) return null
  const h = parseInt(m[1], 10)
  return Number.isNaN(h) || h <= 0 ? null : h
}

/** alt 안의 `h=NNN` 만 새 값으로 교체. h 메타가 없었으면 끝에 추가. */
function setHeightInAlt(alt: string, height: number): string {
  const stripped = alt.replace(/(?:^|\s)h=\d+(?=\s|$)/g, '').trim()
  return stripped ? `${stripped} h=${height}` : `h=${height}`
}

class NoteImageNodeView implements NodeView {
  dom: HTMLElement
  private blobUrl: string | null = null
  private img: HTMLImageElement
  private handle: HTMLDivElement
  private currentSrc: string = ''
  private currentAlt: string = ''
  private destroyed = false
  private loadId = 0

  constructor(
    private node: Node,
    private view: EditorView,
    private getPos: () => number | undefined,
    private workspaceId: string
  ) {
    this.dom = document.createElement('div')
    this.dom.classList.add('note-image-wrapper')
    this.dom.style.position = 'relative'
    this.dom.style.display = 'inline-block'
    this.dom.style.maxWidth = '100%'

    this.img = document.createElement('img')
    const altRaw = (node.attrs.alt as string) || ''
    this.currentAlt = altRaw
    this.img.alt = altRaw
    this.img.title = (node.attrs.title as string) || ''
    this.img.style.maxWidth = '100%'
    this.img.style.display = 'block'
    this.img.style.margin = '0.5rem 0'
    this.applyHeightStyle(altRaw)

    const src = node.attrs.src as string
    this.currentSrc = src

    if (src && src.startsWith('.images/')) {
      this.img.style.minHeight = '2rem'
      this.img.style.background = 'var(--muted, #f3f4f6)'
      this.img.style.borderRadius = '0.375rem'
      this.loadBlobUrl(src)
    } else {
      this.img.src = src || ''
    }

    this.dom.appendChild(this.img)

    // resize handle — 이미지 하단 6px 영역에서 ns-resize drag.
    this.handle = document.createElement('div')
    this.handle.contentEditable = 'false'
    this.handle.className = 'note-image-resize-handle'
    Object.assign(this.handle.style, {
      height: '6px',
      cursor: 'ns-resize',
      background: 'transparent',
      borderRadius: '2px',
      marginBottom: '0.5rem',
      transition: 'background-color 120ms ease'
    } as Partial<CSSStyleDeclaration>)
    this.handle.addEventListener('mouseenter', () => {
      this.handle.style.background = 'var(--muted, rgba(0,0,0,0.08))'
    })
    this.handle.addEventListener('mouseleave', () => {
      this.handle.style.background = 'transparent'
    })
    this.handle.addEventListener('pointerdown', this.handlePointerDown)
    this.dom.appendChild(this.handle)
  }

  /** alt 의 h=NNN 메타 → img maxHeight 적용 (없으면 해제). */
  private applyHeightStyle(alt: string): void {
    const h = parseHeightFromAlt(alt)
    if (h !== null) {
      this.img.style.maxHeight = `${h}px`
      this.img.style.height = 'auto'
    } else {
      this.img.style.maxHeight = ''
      this.img.style.height = ''
    }
  }

  private handlePointerDown = (e: PointerEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    // drag 시작 시 실제 렌더링 높이를 측정 → h 메타 없는 상태에서도 자연스러운 시작점.
    const startH = Math.round(this.img.getBoundingClientRect().height)
    const startY = e.clientY
    this.handle.setPointerCapture(e.pointerId)

    const onMove = (ev: PointerEvent): void => {
      const next = Math.max(40, startH + (ev.clientY - startY))
      this.persistHeight(next)
    }
    const onUp = (ev: PointerEvent): void => {
      this.handle.removeEventListener('pointermove', onMove)
      this.handle.removeEventListener('pointerup', onUp)
      this.handle.releasePointerCapture(ev.pointerId)
    }
    this.handle.addEventListener('pointermove', onMove)
    this.handle.addEventListener('pointerup', onUp)
  }

  /** drag 중/종료 시 alt 의 h 메타를 갱신 — setNodeMarkup transaction. */
  private persistHeight(height: number): void {
    const pos = this.getPos()
    if (typeof pos !== 'number') return
    const newAlt = setHeightInAlt(this.currentAlt, height)
    if (newAlt === this.currentAlt) return
    const tr = this.view.state.tr.setNodeMarkup(pos, undefined, {
      ...this.node.attrs,
      alt: newAlt
    })
    this.view.dispatch(tr)
  }

  private async loadBlobUrl(src: string): Promise<void> {
    const id = ++this.loadId
    try {
      const res = await window.api.noteImage.readImage(this.workspaceId, src)
      if (this.destroyed || this.loadId !== id) return
      if (res.success && res.data) {
        const blob = new Blob([res.data.data])
        this.blobUrl = URL.createObjectURL(blob)
        this.img.src = this.blobUrl
        this.img.style.minHeight = ''
        this.img.style.background = ''
      }
    } catch {
      // 이미지 로드 실패 시 placeholder 유지
    }
  }

  update(node: Node): boolean {
    if (node.type.name !== 'image') return false

    const newSrc = node.attrs.src as string
    const newAlt = (node.attrs.alt as string) || ''
    const newTitle = (node.attrs.title as string) || ''

    this.node = node
    this.img.alt = newAlt
    this.img.title = newTitle

    if (this.currentAlt !== newAlt) {
      this.currentAlt = newAlt
      this.applyHeightStyle(newAlt)
    }

    if (this.currentSrc !== newSrc) {
      this.currentSrc = newSrc
      if (this.blobUrl) {
        URL.revokeObjectURL(this.blobUrl)
        this.blobUrl = null
      }
      if (newSrc && newSrc.startsWith('.images/')) {
        this.loadBlobUrl(newSrc)
      } else {
        this.img.src = newSrc || ''
      }
    }

    return true
  }

  destroy(): void {
    this.destroyed = true
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl)
      this.blobUrl = null
    }
  }

  /** handle drag pointer 이벤트는 PM 로 전달하지 않음 (selection 생성 방지). */
  stopEvent(event: Event): boolean {
    const t = event.target as HTMLElement | null
    if (t && t === this.handle) {
      return event.type.startsWith('pointer') || event.type.startsWith('mouse')
    }
    return false
  }

  ignoreMutation(): boolean {
    return true
  }
}
