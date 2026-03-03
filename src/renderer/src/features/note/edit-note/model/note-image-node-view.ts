import type { NodeView } from '@milkdown/kit/prose/view'
import type { Node } from '@milkdown/kit/prose/model'
import type { EditorView } from '@milkdown/kit/prose/view'

export function createNoteImageNodeViewFactory(workspaceId: string) {
  return (node: Node, view: EditorView, getPos: () => number | undefined): NoteImageNodeView => {
    return new NoteImageNodeView(node, view, getPos, workspaceId)
  }
}

class NoteImageNodeView implements NodeView {
  dom: HTMLElement
  private blobUrl: string | null = null
  private img: HTMLImageElement
  private currentSrc: string = ''

  constructor(
    node: Node,
    _view: EditorView,
    _getPos: () => number | undefined,
    private workspaceId: string
  ) {
    this.dom = document.createElement('div')
    this.dom.classList.add('note-image-wrapper')

    this.img = document.createElement('img')
    this.img.alt = (node.attrs.alt as string) || ''
    this.img.title = (node.attrs.title as string) || ''
    this.img.style.maxWidth = '100%'
    this.img.style.display = 'block'
    this.img.style.margin = '0.5rem 0'

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
  }

  private async loadBlobUrl(src: string): Promise<void> {
    try {
      const res = await window.api.noteImage.readImage(this.workspaceId, src)
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

    this.img.alt = newAlt
    this.img.title = newTitle

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
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl)
      this.blobUrl = null
    }
  }

  stopEvent(): boolean {
    return false
  }

  ignoreMutation(): boolean {
    return true
  }
}
