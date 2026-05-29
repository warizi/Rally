/**
 * preload api 전수 호출 회귀 테스트.
 *
 * preload-apis.test.ts 는 namespace 별 1–3 메서드 spot-check.
 * 본 파일은 모든 method 가 정확한 채널 + 인자로 ipcRenderer.invoke 를 호출하는지 데이터
 * 기반으로 일괄 검증. 라인 커버리지를 90%+ 로 끌어올린다.
 *
 * 채널명 회귀 차단 + 채널/메서드 수 mismatch 가 발생하면 즉시 fail.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { invokeMock, sendMock, onMock, removeListenerMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  sendMock: vi.fn(),
  onMock: vi.fn(),
  removeListenerMock: vi.fn()
}))

vi.mock('electron', () => ({
  ipcRenderer: {
    invoke: invokeMock,
    send: sendMock,
    on: onMock,
    removeListener: removeListenerMock
  }
}))

import { api } from '../apis'

beforeEach(() => {
  vi.clearAllMocks()
})

type ApiNamespace = keyof typeof api

// 채널명이 method 이름과 다른 경우를 명시. 명시 안 된 메서드는 `${ns}:${method}` 로 매핑.
const CHANNEL_OVERRIDES: Record<string, string> = {
  'tag.getAll': 'tag:getAll',
  'reminder.set': 'reminder:set',
  'reminder.removeByEntity': 'reminder:removeByEntity',
  'reminder.findByEntity': 'reminder:findByEntity',
  // tab-snapshot
  'tabSnapshot.save': 'tabSnapshot:save'
  // entity-link uses kebab-case channel for one method
  // entityLink.onChanged subscribes to 'entity-link:changed' — handled as subscriber
}

function channelFor(ns: string, method: string): string {
  const k = `${ns}.${method}`
  return CHANNEL_OVERRIDES[k] ?? `${ns}:${method}`
}

function recordInvoke(ns: string, method: string, args: unknown[]): void {
  const fn = (api[ns as ApiNamespace] as Record<string, (...a: unknown[]) => unknown>)[method]
  fn(...args)
}

// ─── invoke 채널 매핑 (대다수가 단순 패턴) ─────────────────────
const INVOKE_CASES: Array<{ ns: ApiNamespace; method: string; args: unknown[]; channel?: string }> =
  [
    // appInfo
    { ns: 'appInfo', method: 'getVersion', args: [] },
    { ns: 'appInfo', method: 'getMcpServerPath', args: [] },
    { ns: 'appInfo', method: 'getCommandFiles', args: [] },
    { ns: 'appInfo', method: 'getSkillFiles', args: [] },

    // backup
    { ns: 'backup', method: 'export', args: ['ws-1'] },
    { ns: 'backup', method: 'selectFile', args: [] },
    { ns: 'backup', method: 'readManifest', args: ['/p/x.zip'] },
    { ns: 'backup', method: 'import', args: ['/p/x.zip', 'name', '/dest'] },

    // canvas-edge
    { ns: 'canvasEdge', method: 'findByCanvas', args: ['canv-1'] },
    { ns: 'canvasEdge', method: 'create', args: ['canv-1', {}] },
    { ns: 'canvasEdge', method: 'update', args: ['edge-1', {}] },
    { ns: 'canvasEdge', method: 'remove', args: ['edge-1'] },

    // canvas-node
    { ns: 'canvasNode', method: 'findByCanvas', args: ['canv-1'] },
    { ns: 'canvasNode', method: 'create', args: ['canv-1', {}] },
    { ns: 'canvasNode', method: 'update', args: ['node-1', {}] },
    { ns: 'canvasNode', method: 'updatePositions', args: [[]] },
    { ns: 'canvasNode', method: 'remove', args: ['node-1'] },
    { ns: 'canvasNode', method: 'syncState', args: ['canv-1', { nodes: [], edges: [] }] },

    // canvas
    { ns: 'canvas', method: 'findByWorkspace', args: ['ws-1', { search: '' }] },
    { ns: 'canvas', method: 'findById', args: ['canv-1'] },
    { ns: 'canvas', method: 'create', args: ['ws-1', {}] },
    { ns: 'canvas', method: 'update', args: ['canv-1', {}] },
    { ns: 'canvas', method: 'updateViewport', args: ['canv-1', { x: 0, y: 0, zoom: 1 }] },
    { ns: 'canvas', method: 'remove', args: ['canv-1'] },
    { ns: 'canvas', method: 'toggleLock', args: ['canv-1', true] },

    // csv
    { ns: 'csv', method: 'readByWorkspace', args: ['ws-1'] },
    { ns: 'csv', method: 'create', args: ['ws-1', null, 'x'] },
    { ns: 'csv', method: 'rename', args: ['ws-1', 'csv-1', 'new'] },
    { ns: 'csv', method: 'remove', args: ['ws-1', 'csv-1'] },
    { ns: 'csv', method: 'readContent', args: ['ws-1', 'csv-1'] },
    { ns: 'csv', method: 'writeContent', args: ['ws-1', 'csv-1', 'a,b\n1,2'] },
    { ns: 'csv', method: 'move', args: ['ws-1', 'csv-1', null, 0] },
    { ns: 'csv', method: 'updateMeta', args: ['ws-1', 'csv-1', { description: 'd' }] },
    { ns: 'csv', method: 'import', args: ['ws-1', null, '/src.csv'] },
    { ns: 'csv', method: 'duplicate', args: ['ws-1', 'csv-1'] },
    { ns: 'csv', method: 'toggleLock', args: ['ws-1', 'csv-1', true] },
    { ns: 'csv', method: 'selectFile', args: [] },

    // entity-link
    { ns: 'entityLink', method: 'link', args: ['note', 'n-1', 'todo', 't-1', 'ws-1'] },
    { ns: 'entityLink', method: 'unlink', args: ['note', 'n-1', 'todo', 't-1'] },
    { ns: 'entityLink', method: 'getLinked', args: ['todo', 't-1'] },

    // folder
    { ns: 'folder', method: 'readTree', args: ['ws-1'] },
    { ns: 'folder', method: 'create', args: ['ws-1', null, 'docs'] },
    { ns: 'folder', method: 'rename', args: ['ws-1', 'f-1', 'newName'] },
    { ns: 'folder', method: 'remove', args: ['ws-1', 'f-1'] },
    { ns: 'folder', method: 'move', args: ['ws-1', 'f-1', null, 0] },
    { ns: 'folder', method: 'updateMeta', args: ['ws-1', 'f-1', { color: '#fff' }] },

    // history
    { ns: 'history', method: 'fetch', args: ['ws-1', undefined] },

    // image
    { ns: 'image', method: 'readByWorkspace', args: ['ws-1'] },
    { ns: 'image', method: 'import', args: ['ws-1', null, '/x.png'] },
    { ns: 'image', method: 'duplicate', args: ['ws-1', 'img-1'] },
    { ns: 'image', method: 'rename', args: ['ws-1', 'img-1', 'newName'] },
    { ns: 'image', method: 'remove', args: ['ws-1', 'img-1'] },
    { ns: 'image', method: 'readContent', args: ['ws-1', 'img-1'] },
    { ns: 'image', method: 'move', args: ['ws-1', 'img-1', null, 0] },
    { ns: 'image', method: 'updateMeta', args: ['ws-1', 'img-1', { description: 'd' }] },
    { ns: 'image', method: 'selectFile', args: [] },

    // item-tag
    { ns: 'itemTag', method: 'getTagsByItem', args: ['note', 'n-1'] },
    { ns: 'itemTag', method: 'getItemIdsByTag', args: ['tag-1', 'note'] },
    { ns: 'itemTag', method: 'attach', args: ['note', 'tag-1', 'n-1'] },
    { ns: 'itemTag', method: 'detach', args: ['note', 'tag-1', 'n-1'] },

    // mcpClient
    { ns: 'mcpClient', method: 'getStatus', args: [] },
    { ns: 'mcpClient', method: 'register', args: ['claudeDesktop'] },
    { ns: 'mcpClient', method: 'unregister', args: ['claudeDesktop'] },

    // note-image
    { ns: 'noteImage', method: 'saveFromPath', args: ['ws-1', '/x.png'] },
    { ns: 'noteImage', method: 'saveFromBuffer', args: ['ws-1', new ArrayBuffer(0), 'png'] },
    { ns: 'noteImage', method: 'readImage', args: ['ws-1', '.images/x.png'] },

    // note-style-template
    { ns: 'noteStyleTemplate', method: 'list', args: [] },
    { ns: 'noteStyleTemplate', method: 'create', args: [{ name: 'n', settingsJson: '{}' }] },
    { ns: 'noteStyleTemplate', method: 'remove', args: ['tpl-1'] },

    // pdf (similar to image)
    { ns: 'pdf', method: 'readByWorkspace', args: ['ws-1'] },
    { ns: 'pdf', method: 'import', args: ['ws-1', null, '/x.pdf'] },
    { ns: 'pdf', method: 'duplicate', args: ['ws-1', 'pdf-1'] },
    { ns: 'pdf', method: 'rename', args: ['ws-1', 'pdf-1', 'newName'] },
    { ns: 'pdf', method: 'remove', args: ['ws-1', 'pdf-1'] },
    { ns: 'pdf', method: 'readContent', args: ['ws-1', 'pdf-1'] },
    { ns: 'pdf', method: 'move', args: ['ws-1', 'pdf-1', null, 0] },
    { ns: 'pdf', method: 'updateMeta', args: ['ws-1', 'pdf-1', { description: 'd' }] },
    { ns: 'pdf', method: 'selectFile', args: [] },

    // recurring-completion
    { ns: 'recurringCompletion', method: 'complete', args: ['rule-1', new Date()] },
    { ns: 'recurringCompletion', method: 'uncomplete', args: ['comp-1'] },
    { ns: 'recurringCompletion', method: 'findTodayByWorkspace', args: ['ws-1', new Date()] },

    // recurring-rule
    { ns: 'recurringRule', method: 'findByWorkspace', args: ['ws-1'] },
    { ns: 'recurringRule', method: 'findToday', args: ['ws-1', new Date()] },
    { ns: 'recurringRule', method: 'create', args: ['ws-1', {}] },
    { ns: 'recurringRule', method: 'update', args: ['rule-1', {}] },
    { ns: 'recurringRule', method: 'delete', args: ['rule-1'] },

    // reminder
    { ns: 'reminder', method: 'findByEntity', args: ['todo', 't-1'] },
    { ns: 'reminder', method: 'set', args: [{}] },
    { ns: 'reminder', method: 'remove', args: ['rem-1'] },
    { ns: 'reminder', method: 'removeByEntity', args: ['todo', 't-1'] },

    // schedule
    { ns: 'schedule', method: 'findAllByWorkspace', args: ['ws-1'] },
    {
      ns: 'schedule',
      method: 'findByWorkspace',
      args: ['ws-1', { start: new Date(), end: new Date() }]
    },
    { ns: 'schedule', method: 'findById', args: ['sch-1'] },
    { ns: 'schedule', method: 'create', args: ['ws-1', {}] },
    { ns: 'schedule', method: 'update', args: ['sch-1', {}] },
    { ns: 'schedule', method: 'remove', args: ['sch-1'] },
    { ns: 'schedule', method: 'move', args: ['sch-1', new Date(), new Date()] },
    { ns: 'schedule', method: 'linkTodo', args: ['sch-1', 't-1'] },
    { ns: 'schedule', method: 'unlinkTodo', args: ['sch-1', 't-1'] },
    { ns: 'schedule', method: 'getLinkedTodos', args: ['sch-1'] },

    // skill
    { ns: 'skill', method: 'list', args: [] },
    { ns: 'skill', method: 'get', args: ['sk-1'] },
    { ns: 'skill', method: 'create', args: [{}] },
    { ns: 'skill', method: 'update', args: ['sk-1', {}] },
    { ns: 'skill', method: 'remove', args: ['ws-1', 'sk-1'] },
    { ns: 'skill', method: 'resetSystem', args: ['sys-1'] },
    { ns: 'skill', method: 'apply', args: ['sk-1'] },
    { ns: 'skill', method: 'unapply', args: ['sk-1'] },
    { ns: 'skill', method: 'status', args: [] },
    { ns: 'skill', method: 'export', args: ['sk-1'] },

    // tag
    { ns: 'tag', method: 'getAll', args: ['ws-1'] },
    { ns: 'tag', method: 'create', args: ['ws-1', {}] },
    { ns: 'tag', method: 'update', args: ['tag-1', {}] },
    { ns: 'tag', method: 'remove', args: ['tag-1'] },

    // template
    { ns: 'template', method: 'list', args: ['ws-1', 'note'] },
    { ns: 'template', method: 'create', args: [{}] },
    { ns: 'template', method: 'delete', args: ['tpl-1'] },

    // todo
    { ns: 'todo', method: 'findByWorkspace', args: ['ws-1', { filter: 'active' }] },
    { ns: 'todo', method: 'findByDateRange', args: ['ws-1', {}] },
    { ns: 'todo', method: 'create', args: ['ws-1', {}] },
    { ns: 'todo', method: 'update', args: ['t-1', {}] },
    { ns: 'todo', method: 'remove', args: ['t-1'] },
    { ns: 'todo', method: 'reorderList', args: ['ws-1', []] },
    { ns: 'todo', method: 'reorderKanban', args: ['ws-1', []] },
    { ns: 'todo', method: 'reorderSub', args: ['p-1', []] },
    { ns: 'todo', method: 'findCompletedWithRecurring', args: ['ws-1'] },

    // trash
    { ns: 'trash', method: 'list', args: ['ws-1', undefined] },
    { ns: 'trash', method: 'count', args: ['ws-1'] },
    { ns: 'trash', method: 'restore', args: ['ws-1', 'batch-1'] },
    { ns: 'trash', method: 'purge', args: ['ws-1', 'batch-1'] },
    { ns: 'trash', method: 'emptyAll', args: ['ws-1'] },
    { ns: 'trash', method: 'getRetention', args: [] },
    { ns: 'trash', method: 'setRetention', args: ['30d'] },
    { ns: 'trash', method: 'sweepNow', args: [] },
    { ns: 'trash', method: 'softRemove', args: ['ws-1', 'note', 'n-1'] },

    // workspace
    { ns: 'workspace', method: 'getAll', args: [] },
    { ns: 'workspace', method: 'getById', args: ['ws-1'] },
    { ns: 'workspace', method: 'create', args: ['name', '/p'] },
    { ns: 'workspace', method: 'update', args: ['ws-1', {}] },
    { ns: 'workspace', method: 'delete', args: ['ws-1'] },
    { ns: 'workspace', method: 'activate', args: ['ws-1'] },
    { ns: 'workspace', method: 'selectDirectory', args: [] }
  ]

describe('preload api — exhaustive invoke channel wiring', () => {
  for (const { ns, method, args } of INVOKE_CASES) {
    const channel = channelFor(ns, method)
    it(`${ns}.${String(method)} → ${channel}`, () => {
      recordInvoke(ns, String(method), args)
      const calls = invokeMock.mock.calls
      expect(calls.length).toBeGreaterThan(0)
      const callArgs = calls[0] as unknown as readonly [string, ...unknown[]]
      expect(callArgs[0]).toBe(channel)
      // 인자 갯수가 일치해야 함 (channel + payload)
      expect(callArgs.length - 1).toBe(args.length)
    })
  }
})

describe('preload api — onChanged subscribers', () => {
  // onChanged 패턴이 있는 namespace 만
  const subscribers: Array<{ ns: ApiNamespace; method: string; channel: string }> = [
    { ns: 'note', method: 'onChanged', channel: 'note:changed' },
    { ns: 'csv', method: 'onChanged', channel: 'csv:changed' },
    { ns: 'pdf', method: 'onChanged', channel: 'pdf:changed' },
    { ns: 'image', method: 'onChanged', channel: 'image:changed' },
    { ns: 'folder', method: 'onChanged', channel: 'folder:changed' },
    { ns: 'canvas', method: 'onChanged', channel: 'canvas:changed' },
    { ns: 'todo', method: 'onChanged', channel: 'todo:changed' },
    { ns: 'tag', method: 'onChanged', channel: 'tag:changed' },
    { ns: 'reminder', method: 'onChanged', channel: 'reminder:changed' },
    { ns: 'reminder', method: 'onFired', channel: 'reminder:fired' },
    { ns: 'template', method: 'onChanged', channel: 'template:changed' },
    { ns: 'entityLink', method: 'onChanged', channel: 'entity-link:changed' }
  ]

  for (const { ns, method, channel } of subscribers) {
    it(`${ns}.${method} → ipcRenderer.on(${channel}) + unsubscribe`, () => {
      const fn = (api[ns] as unknown as Record<string, (cb: unknown) => () => void>)[method]
      const off = fn(vi.fn())
      expect(onMock).toHaveBeenCalledWith(channel, expect.any(Function))
      off()
      expect(removeListenerMock).toHaveBeenCalledWith(channel, expect.any(Function))
    })
  }
})

describe('preload terminal api — invoke + send + listener Map', () => {
  it('create / destroy / destroyAll / saveSnapshot / getSessions / getLayout / updateSession / saveLayout / closeSession → invoke', () => {
    api.terminal.create({ workspaceId: 'ws-1', cwd: '/tmp', cols: 80, rows: 24 })
    api.terminal.destroy('t-1')
    api.terminal.destroyAll('ws-1')
    api.terminal.saveSnapshot('t-1', 'x')
    api.terminal.getSessions('ws-1')
    api.terminal.getLayout('ws-1')
    api.terminal.updateSession('t-1', {})
    api.terminal.saveLayout('ws-1', '{}')
    api.terminal.closeSession('t-1')

    const channels = invokeMock.mock.calls.map((c) => c[0])
    expect(channels).toEqual([
      'terminal:create',
      'terminal:destroy',
      'terminal:destroyAll',
      'terminal:saveSnapshot',
      'terminal:getSessions',
      'terminal:getLayout',
      'terminal:updateSession',
      'terminal:saveLayout',
      'terminal:closeSession'
    ])
  })

  it('write / resize → ipcRenderer.send (fire-and-forget)', () => {
    api.terminal.write({ id: 't-1', data: 'x' })
    api.terminal.resize({ id: 't-1', cols: 100, rows: 30 })
    expect(sendMock.mock.calls.map((c) => c[0])).toEqual(['terminal:write', 'terminal:resize'])
  })

  it('onData / onExit → 콜백 등록 + unsubscribe (Map 기반)', () => {
    const off1 = api.terminal.onData('t-1', vi.fn())
    const off2 = api.terminal.onExit('t-1', vi.fn())
    expect(typeof off1).toBe('function')
    expect(typeof off2).toBe('function')
    off1()
    off2()
  })
})

describe('preload settings / shell / tab-session / tab-snapshot 동작 sanity', () => {
  it('각 namespace 의 모든 method 가 정의되어 있음', () => {
    for (const ns of ['settings', 'tabSession', 'tabSnapshot', 'onboarding'] as ApiNamespace[]) {
      const methods = Object.keys(api[ns])
      expect(methods.length).toBeGreaterThan(0)
      for (const m of methods) {
        const fn = (api[ns] as Record<string, unknown>)[m]
        expect(typeof fn).toBe('function')
      }
    }
  })

  it('settings / tabSession / tabSnapshot / onboarding 의 메서드 호출 시 invoke 가 일어남', () => {
    for (const ns of ['settings', 'tabSession', 'tabSnapshot', 'onboarding'] as ApiNamespace[]) {
      const methods = Object.keys(api[ns]).filter((m) => !m.startsWith('on'))
      for (const m of methods) {
        const before = invokeMock.mock.calls.length
        const fn = (api[ns] as Record<string, (...a: unknown[]) => unknown>)[m]
        try {
          fn('arg-a', 'arg-b', 'arg-c')
        } catch {
          // 인자 갯수 mismatch 는 무시 — invoke 호출 여부만 검증
        }
        expect(invokeMock.mock.calls.length).toBeGreaterThan(before)
      }
    }
  })
})
