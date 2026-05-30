/**
 * entities/tab-system/lib/build-tab-options.test.ts
 */
import { describe, it, expect } from 'vitest'
import { buildTabOptions } from '../build-tab-options'

describe('buildTabOptions', () => {
  it('folder kind → pathname=/folder/:id', () => {
    expect(buildTabOptions({ kind: 'folder', id: 'f1', title: 'My Folder' })).toEqual({
      type: 'folder',
      title: 'My Folder',
      pathname: '/folder/f1'
    })
  })

  it('note kind → /folder/note/:id', () => {
    expect(buildTabOptions({ kind: 'note', id: 'n1', title: 'Note A' })).toEqual({
      type: 'note',
      title: 'Note A',
      pathname: '/folder/note/n1'
    })
  })

  it('csv kind → /folder/csv/:id', () => {
    expect(buildTabOptions({ kind: 'csv', id: 'c1', title: 'CSV X' })).toEqual({
      type: 'csv',
      title: 'CSV X',
      pathname: '/folder/csv/c1'
    })
  })

  it('pdf kind → /folder/pdf/:id', () => {
    expect(buildTabOptions({ kind: 'pdf', id: 'p1', title: 'PDF Y' })).toEqual({
      type: 'pdf',
      title: 'PDF Y',
      pathname: '/folder/pdf/p1'
    })
  })

  it('image kind → /folder/image/:id', () => {
    expect(buildTabOptions({ kind: 'image', id: 'i1', title: 'Img' })).toEqual({
      type: 'image',
      title: 'Img',
      pathname: '/folder/image/i1'
    })
  })
})
