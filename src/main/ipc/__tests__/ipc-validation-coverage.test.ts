/**
 * 100% IPC 입력 검증 회귀 차단 정적 테스트.
 *
 * `src/main/ipc/*.ts` 의 모든 `ipcMain.handle(...)` 등록이 승인된 검증 래퍼
 * (`validateIpc` / `validateIpcAsync` / `validateNoArgs`) 를 두 번째 인자로 쓰는지
 * 소스 레벨에서 스캔한다. raw function expression 을 직접 넘기는 핸들러가 새로 추가되면
 * 이 테스트가 실패한다.
 *
 * 목표: allowlist 0건. 검증 없는 신규 IPC handler 추가를 CI 에서 차단한다.
 *
 * 주의: `ipcMain.on(...)` (fire-and-forget, invoke 응답 없음) 은 검증 대상이 아니라
 * 별도로 스캔하지 않는다. boundary 입력 검증은 `ipcMain.handle` 채널을 대상으로 한다.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join, resolve } from 'path'

const IPC_DIR = resolve(process.cwd(), 'src/main/ipc')
const APPROVED_WRAPPERS = ['validateIpc', 'validateIpcAsync', 'validateNoArgs'] as const

/**
 * 모든 `ipcMain.handle('channel', <wrapper>...` 매칭에서 channel 과 그 뒤에 오는
 * 첫 토큰(검증 래퍼명 또는 raw expression 의 시작부)을 추출한다.
 * 멀티라인 등록도 처리하도록 채널 문자열 뒤 공백/콤마/공백을 흡수한 뒤 20자를 본다.
 */
const HANDLE_RE = /ipcMain\.handle\(\s*('(?:[^'\\]|\\.)*')\s*,\s*([\s\S]{0,24})/g
const WRAPPER_HEAD_RE = new RegExp(`^(${APPROVED_WRAPPERS.join('|')})\\b`)

function ipcSourceFiles(): string[] {
  return readdirSync(IPC_DIR)
    .filter((f) => f.endsWith('.ts') && f !== 'schemas.ts')
    .map((f) => join(IPC_DIR, f))
}

interface HandlerRegistration {
  file: string
  channel: string
  wrapper: string | null // 승인 래퍼명, 또는 raw 일 때 null
  head: string
}

function scanHandlers(): HandlerRegistration[] {
  const out: HandlerRegistration[] = []
  for (const file of ipcSourceFiles()) {
    const src = readFileSync(file, 'utf-8')
    for (const m of src.matchAll(HANDLE_RE)) {
      const channel = m[1].slice(1, -1)
      const head = m[2]
      const wrapperMatch = head.match(WRAPPER_HEAD_RE)
      out.push({
        file: file.replace(IPC_DIR, 'ipc'),
        channel,
        wrapper: wrapperMatch ? wrapperMatch[1] : null,
        head: head.replace(/\n/g, ' ').slice(0, 24)
      })
    }
  }
  return out
}

describe('IPC 입력 검증 커버리지 (정적 회귀)', () => {
  const handlers = scanHandlers()

  it('스캔된 ipcMain.handle 채널이 충분히 존재한다 (스캐너 sanity)', () => {
    // 회귀로 채널이 통째로 누락되는(=스캐너가 0건을 보는) 상황 방지.
    expect(handlers.length).toBeGreaterThan(150)
  })

  it('모든 채널명이 고유하다 (중복 등록 없음)', () => {
    const seen = new Map<string, number>()
    for (const h of handlers) seen.set(h.channel, (seen.get(h.channel) ?? 0) + 1)
    const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([c]) => c)
    expect(dupes).toEqual([])
  })

  it('모든 ipcMain.handle 가 승인된 검증 래퍼를 통과한다 (raw handler 0건)', () => {
    const violations = handlers
      .filter((h) => h.wrapper === null)
      .map((h) => `${h.file} :: '${h.channel}' → 비검증 핸들러 ("${h.head}…")`)

    // 위반이 있으면 채널 목록과 함께 실패시킨다.
    expect(violations, `검증 래퍼 없는 IPC handler 발견:\n${violations.join('\n')}`).toEqual([])
  })

  it('검증 래퍼 분포를 노출한다 (가시성)', () => {
    const dist = APPROVED_WRAPPERS.map(
      (w) => `${w}=${handlers.filter((h) => h.wrapper === w).length}`
    )
    // 모든 핸들러가 셋 중 하나로 분류되어야 한다 (합 == 전체).
    const classified = handlers.filter((h) => h.wrapper !== null).length
    expect(classified, dist.join(' ')).toBe(handlers.length)
  })
})
