/**
 * IPC API 모킹 헬퍼.
 * 기존 패턴 `(window as unknown as Record<string, unknown>).api = ...` 단순화.
 *
 * 사용:
 *   import { mockApi, defaultApiMock } from '@/test/ipc-mock'
 *   beforeEach(() => {
 *     const api = defaultApiMock()
 *     api.note.create.mockResolvedValue({ id: 'n1', name: 'X', folderId: null })
 *     mockApi(api)
 *   })
 */
import { vi, type Mock } from 'vitest'

type ApiShape = Record<string, Record<string, unknown>>

/** window.api 에 모킹 객체를 주입. setup.ts의 afterEach 가 자동으로 cleanup. */
export function mockApi<T extends ApiShape>(api: T): T {
  ;(window as unknown as Record<string, unknown>).api = api
  return api
}

/**
 * 자주 쓰는 도메인을 미리 vi.fn() 으로 채운 기본 모킹.
 * 필요한 메서드만 override 가능. 도메인 추가 시 이 함수에 등록.
 */
export function defaultApiMock(): Record<string, Record<string, Mock>> {
  const sub = (): Mock => vi.fn(() => () => {})

  return {
    workspace: {
      readAll: vi.fn(),
      readActive: vi.fn(),
      create: vi.fn(),
      switch: vi.fn(),
      remove: vi.fn(),
      selectDirectory: vi.fn()
    },
    folder: {
      readByWorkspace: vi.fn(),
      create: vi.fn(),
      rename: vi.fn(),
      remove: vi.fn(),
      move: vi.fn(),
      updateMeta: vi.fn(),
      onChanged: sub()
    },
    note: {
      readByWorkspace: vi.fn(),
      create: vi.fn(),
      rename: vi.fn(),
      remove: vi.fn(),
      readContent: vi.fn(),
      writeContent: vi.fn(),
      move: vi.fn(),
      duplicate: vi.fn(),
      import: vi.fn(),
      onChanged: sub()
    },
    csv: {
      readByWorkspace: vi.fn(),
      create: vi.fn(),
      remove: vi.fn(),
      readContent: vi.fn(),
      writeContent: vi.fn(),
      move: vi.fn(),
      import: vi.fn(),
      onChanged: sub()
    },
    pdf: {
      readByWorkspace: vi.fn(),
      import: vi.fn(),
      remove: vi.fn(),
      move: vi.fn(),
      onChanged: sub()
    },
    image: {
      readByWorkspace: vi.fn(),
      import: vi.fn(),
      remove: vi.fn(),
      move: vi.fn(),
      onChanged: sub()
    },
    todo: {
      readByWorkspace: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      reorder: vi.fn()
    },
    trash: {
      list: vi.fn(),
      remove: vi.fn(),
      restore: vi.fn(),
      hardDelete: vi.fn()
    }
  }
}
