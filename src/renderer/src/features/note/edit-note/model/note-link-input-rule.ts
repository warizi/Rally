import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'

const autolinkKey = new PluginKey('autolink')

/** 커서 직전 텍스트에서 URL/마크다운 링크를 감지하여 mark 적용 (Enter용) */
function applyAutolink(view: EditorView): void {
  const { state } = view
  const linkType = state.schema.marks.link
  if (!linkType) return

  const { from } = state.selection
  const $from = state.doc.resolve(from)
  const textBefore = $from.parent.textBetween(
    Math.max(0, $from.parentOffset - 500),
    $from.parentOffset,
    undefined,
    '\ufffc'
  )

  // [텍스트](URL) 패턴
  const mdMatch = textBefore.match(/\[([^[\]]+)]\(([^()]+)\)$/)
  if (mdMatch) {
    const [fullMatch, linkText, href] = mdMatch
    const matchStart = from - fullMatch.length
    const linkMark = linkType.create({ href })
    const tr = state.tr
      .delete(matchStart, from)
      .insertText(linkText, matchStart)
      .addMark(matchStart, matchStart + linkText.length, linkMark)
      .removeStoredMark(linkType)
    view.dispatch(tr)
    return
  }

  // 일반 URL 패턴
  const urlMatch = textBefore.match(/(https?:\/\/[^\s<>]+[^\s<>.,:;"')\]!?])$/)
  if (urlMatch) {
    const [url] = urlMatch
    const urlStart = from - url.length

    const existingMarks = state.doc.resolve(urlStart + 1).marks()
    if (existingMarks.some((m) => m.type === linkType)) return

    const linkMark = linkType.create({ href: url })
    const tr = state.tr.addMark(urlStart, from, linkMark).removeStoredMark(linkType)
    view.dispatch(tr)
  }
}

/**
 * 텍스트 입력 후 URL 패턴 자동 감지 → 링크 mark 적용
 * - 스페이스 입력 시 직전 텍스트에서 URL 감지
 * - 엔터 입력 시 직전 텍스트에서 URL 감지 (줄바꿈은 유지)
 * - [텍스트](URL) 마크다운 문법도 자동 변환
 * - 링크 끝에서 타이핑 시 mark 확장 방지
 */
export const autolinkPlugin = $prose(() => {
  return new Plugin({
    key: autolinkKey,
    props: {
      handleKeyDown(view, event) {
        if (event.key !== 'Enter') return false
        applyAutolink(view)
        return false
      },

      handleTextInput(view, from, _to, text) {
        const { state } = view
        const linkType = state.schema.marks.link
        if (!linkType) return false

        // 링크 mark 끝에서 타이핑 시 → 새 텍스트에 링크 확장 방지
        const $from = state.doc.resolve(from)
        const marksAtCursor = $from.marks()
        const linkAtCursor = marksAtCursor.find((m) => m.type === linkType)
        if (linkAtCursor) {
          // 커서 뒤에 링크가 없으면 → 링크 경계(끝)에 있음
          const nodeAfter = $from.nodeAfter
          const hasLinkAfter = nodeAfter && nodeAfter.marks.some((m) => m.type === linkType)
          if (!hasLinkAfter) {
            // 링크 mark 없이 텍스트 삽입
            const marksWithoutLink = marksAtCursor.filter((m) => m.type !== linkType)
            const tr = state.tr.insertText(text, from)
            // 삽입된 텍스트에서 링크 mark 제거
            tr.removeMark(from, from + text.length, linkType)
            tr.setStoredMarks(marksWithoutLink)
            view.dispatch(tr)
            return true
          }
        }

        // 스페이스가 아니면 autolink 불필요
        if (text !== ' ') return false

        const textBefore = $from.parent.textBetween(
          Math.max(0, $from.parentOffset - 500),
          $from.parentOffset,
          undefined,
          '\ufffc'
        )

        // [텍스트](URL) 패턴
        const mdMatch = textBefore.match(/\[([^[\]]+)]\(([^()]+)\)$/)
        if (mdMatch) {
          const [fullMatch, linkText, href] = mdMatch
          const matchStart = from - fullMatch.length
          const linkMark = linkType.create({ href })
          const tr = state.tr
            .delete(matchStart, from)
            .insertText(linkText + text, matchStart)
            .addMark(matchStart, matchStart + linkText.length, linkMark)
            .removeMark(
              matchStart + linkText.length,
              matchStart + linkText.length + text.length,
              linkType
            )
            .removeStoredMark(linkType)
          view.dispatch(tr)
          return true
        }

        // 일반 URL 패턴
        const urlMatch = textBefore.match(/(https?:\/\/[^\s<>]+[^\s<>.,:;"')\]!?])$/)
        if (urlMatch) {
          const [url] = urlMatch
          const urlStart = from - url.length

          const existingMarks = state.doc.resolve(urlStart + 1).marks()
          if (existingMarks.some((m) => m.type === linkType)) return false

          const linkMark = linkType.create({ href: url })
          const tr = state.tr
            .insertText(text, from)
            .addMark(urlStart, from, linkMark)
            .removeMark(from, from + text.length, linkType)
            .removeStoredMark(linkType)
          view.dispatch(tr)
          return true
        }

        return false
      },

      handlePaste(view, event) {
        const clipboardText = event.clipboardData?.getData('text/plain')
        if (!clipboardText) return false

        const trimmed = clipboardText.trim()
        if (!/^https?:\/\/[^\s]+$/.test(trimmed)) return false

        const { state } = view
        const linkType = state.schema.marks.link
        if (!linkType) return false

        const { from, to } = state.selection
        if (from !== to) {
          const linkMark = linkType.create({ href: trimmed })
          const tr = state.tr.addMark(from, to, linkMark).removeStoredMark(linkType)
          view.dispatch(tr)
          event.preventDefault()
          return true
        }

        const linkMark = linkType.create({ href: trimmed })
        const tr = state.tr
          .insertText(trimmed, from)
          .addMark(from, from + trimmed.length, linkMark)
          .removeStoredMark(linkType)
        view.dispatch(tr)
        event.preventDefault()
        return true
      }
    }
  })
})
