/**
 * widgets/history-timeline/lib/link-to-tab.test.ts
 *
 * HistoryLink type 별 TabOptions 매핑.
 */
import { describe, it, expect } from 'vitest'
import { linkToTabOptions } from '../link-to-tab'
import type { HistoryLink } from '@entities/history'

describe('linkToTabOptions', () => {
  it('note → /folder/note/:id', () => {
    const link = { type: 'note', id: 'n1', title: 'Note A' } as HistoryLink
    expect(linkToTabOptions(link)).toEqual({
      type: 'note',
      pathname: '/folder/note/n1',
      title: 'Note A'
    })
  })

  it('csv → /folder/csv/:id', () => {
    expect(linkToTabOptions({ type: 'csv', id: 'c1', title: 'C' } as HistoryLink)).toEqual({
      type: 'csv',
      pathname: '/folder/csv/c1',
      title: 'C'
    })
  })

  it('pdf → /folder/pdf/:id', () => {
    expect(linkToTabOptions({ type: 'pdf', id: 'p1', title: 'P' } as HistoryLink)).toEqual({
      type: 'pdf',
      pathname: '/folder/pdf/p1',
      title: 'P'
    })
  })

  it('image → /folder/image/:id', () => {
    expect(linkToTabOptions({ type: 'image', id: 'i1', title: 'I' } as HistoryLink)).toEqual({
      type: 'image',
      pathname: '/folder/image/i1',
      title: 'I'
    })
  })

  it('canvas → /canvas/:id + type=canvas-detail', () => {
    expect(linkToTabOptions({ type: 'canvas', id: 'cv1', title: 'CV' } as HistoryLink)).toEqual({
      type: 'canvas-detail',
      pathname: '/canvas/cv1',
      title: 'CV'
    })
  })

  it('unknown type → null', () => {
    expect(
      linkToTabOptions({ type: 'unknown', id: 'x', title: 'X' } as unknown as HistoryLink)
    ).toBeNull()
  })
})
