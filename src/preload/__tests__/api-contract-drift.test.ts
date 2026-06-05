/**
 * preload 타입 계약 ↔ 런타임 API 표면 drift 차단.
 *
 * `index.d.ts` 의 `interface API` 선언 키와 런타임 `apis/index.ts` 의 `api` 객체
 * 네임스페이스가 어긋나면 실패한다. 즉:
 * - 런타임 API 네임스페이스를 추가하고 타입 선언을 빠뜨리면 fail
 * - 타입 선언만 추가하고 런타임 구현을 빠뜨리면 fail
 *
 * 도메인별 타입 파일(`types/*.d.ts`)로 분리한 뒤에도 `API` 조립이 완전한지 보장한다.
 * (메서드/채널 단위 drift 는 preload-apis-exhaustive.test.ts 가 담당.)
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

vi.mock('electron', () => ({
  ipcRenderer: { invoke: vi.fn(), send: vi.fn(), on: vi.fn(), removeListener: vi.fn() }
}))

import { api } from '../apis'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const dtsSource = readFileSync(resolve(__dirname, '../index.d.ts'), 'utf-8')

/** `interface API { ... }` 블록에서 `key: XxxAPI` 의 key 목록을 추출. */
function declaredApiNamespaces(): string[] {
  const block = dtsSource.match(/interface API \{([\s\S]*?)\n\}/)
  if (!block) throw new Error('index.d.ts 에서 interface API 블록을 찾지 못했습니다')
  return [...block[1].matchAll(/^\s*([a-zA-Z]+):/gm)].map((m) => m[1]).sort()
}

describe('preload API contract drift', () => {
  it('런타임 api 네임스페이스와 index.d.ts interface API 선언 키가 일치한다', () => {
    const runtime = Object.keys(api).sort()
    const declared = declaredApiNamespaces()
    expect(declared).toEqual(runtime)
  })

  it('네임스페이스가 충분히 존재한다 (스캐너 sanity)', () => {
    expect(declaredApiNamespaces().length).toBeGreaterThan(25)
  })
})
