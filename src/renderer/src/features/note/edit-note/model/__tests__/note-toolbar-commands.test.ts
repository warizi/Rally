/**
 * features/note/edit-note/model/note-toolbar-commands.test.ts
 *
 * toggleColorCommand — $command factory 검증 + 내부 토글 로직 (동일 색상 제거 /
 * 다른 색상 갈아끼움 / 미존재 mark fallback toggleMark).
 */
import { describe, it, expect, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  toggleMarkResult: vi.fn(() => true),
  commandFactoryCapture: null as null | ((ctx: unknown) => unknown),
  toggleMarkInner: vi.fn() as ReturnType<typeof vi.fn>
}))

vi.mock('@milkdown/kit/utils', () => ({
  $command: vi.fn((_name: string, factory: (ctx: unknown) => unknown) => {
    mocks.commandFactoryCapture = factory
    return { name: _name, factory }
  })
}))

vi.mock('@milkdown/kit/prose/commands', () => ({
  toggleMark: vi.fn((markType: unknown) => {
    mocks.toggleMarkInner.mockReturnValue(markType)
    return mocks.toggleMarkResult
  })
}))

vi.mock('../note-color-mark', () => ({
  COLOR_MARK_NAME: 'color'
}))

import { toggleColorCommand } from '../note-toolbar-commands'

interface MockMarkType {
  create: (attrs: { color: string }) => { type: 'color'; attrs: { color: string } }
}

function makeState(opts: {
  marks?: Record<string, MockMarkType>
  selection?: { from: number; to: number }
  nodes?: Array<{ isText: boolean; marks: Array<{ type: unknown; attrs: { color: string } }> }>
}): {
  state: unknown
  removeMarkCalls: Array<unknown[]>
  addMarkCalls: Array<unknown[]>
} {
  const removeMarkCalls: Array<unknown[]> = []
  const addMarkCalls: Array<unknown[]> = []
  const tr = {
    removeMark: (...args: unknown[]) => {
      removeMarkCalls.push(args)
      return tr
    },
    addMark: (...args: unknown[]) => {
      addMarkCalls.push(args)
      return tr
    }
  }
  const state = {
    schema: { marks: opts.marks ?? {} },
    selection: opts.selection ?? { from: 0, to: 10 },
    doc: {
      nodesBetween: (
        _from: number,
        _to: number,
        cb: (node: {
          isText: boolean
          marks: Array<{ type: unknown; attrs: { color: string } }>
        }) => boolean | void
      ) => {
        for (const n of opts.nodes ?? []) cb(n)
      }
    },
    tr
  }
  return { state, removeMarkCalls, addMarkCalls }
}

describe('toggleColorCommand', () => {
  it('$command 으로 등록됨', () => {
    expect(toggleColorCommand).toBeDefined()
    expect(mocks.commandFactoryCapture).not.toBeNull()
  })

  it('markType 없으면 false 반환', () => {
    const innerFactory = mocks.commandFactoryCapture!({}) as (color?: string) => unknown
    const cmd = innerFactory('#ff0000') as (state: unknown, dispatch?: unknown) => boolean
    const { state } = makeState({ marks: {} })
    expect(cmd(state)).toBe(false)
  })

  it('color=undefined → toggleMark fallback', () => {
    const markType: MockMarkType = {
      create: (attrs) => ({ type: 'color', attrs })
    }
    const innerFactory = mocks.commandFactoryCapture!({}) as (color?: string) => unknown
    const cmd = innerFactory(undefined) as (state: unknown, dispatch?: unknown) => boolean
    const { state } = makeState({ marks: { color: markType } })
    expect(cmd(state, vi.fn())).toBe(true)
    expect(mocks.toggleMarkResult).toHaveBeenCalled()
  })

  it('동일 color 모든 nodes → removeMark 호출 + true', () => {
    const markType: MockMarkType = {
      create: (a) => ({ type: 'color', attrs: a })
    }
    const innerFactory = mocks.commandFactoryCapture!({}) as (color?: string) => unknown
    const cmd = innerFactory('#ff0000') as (state: unknown, dispatch?: unknown) => boolean
    const { state, removeMarkCalls, addMarkCalls } = makeState({
      marks: { color: markType },
      nodes: [{ isText: true, marks: [{ type: markType, attrs: { color: '#ff0000' } }] }]
    })
    const dispatch = vi.fn()
    expect(cmd(state, dispatch)).toBe(true)
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(removeMarkCalls.length).toBe(1)
    expect(addMarkCalls.length).toBe(0)
  })

  it('mark 없거나 다른 색 → removeMark + addMark 호출', () => {
    const markType: MockMarkType = {
      create: (a) => ({ type: 'color', attrs: a })
    }
    const innerFactory = mocks.commandFactoryCapture!({}) as (color?: string) => unknown
    const cmd = innerFactory('#00ff00') as (state: unknown, dispatch?: unknown) => boolean
    const { state, removeMarkCalls, addMarkCalls } = makeState({
      marks: { color: markType },
      nodes: [{ isText: true, marks: [{ type: markType, attrs: { color: '#ff0000' } }] }]
    })
    const dispatch = vi.fn()
    expect(cmd(state, dispatch)).toBe(true)
    expect(removeMarkCalls.length).toBe(1)
    expect(addMarkCalls.length).toBe(1)
  })
})
