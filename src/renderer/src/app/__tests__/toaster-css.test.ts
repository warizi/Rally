/**
 * global.css 의 sonner Toaster 오버라이드 회귀 고정.
 *
 * ::-webkit-scrollbar 를 스타일링하면 overlay 스크롤바가 꺼져 scrollbar-gutter 가 실제 폭을 차지한다.
 * 토스트는 --width 고정이라 토스터 안쪽 폭이 그만큼 줄면 토스트가 밀리고 잘린다 (2026-07 "토스트 overflow").
 * 토스터 폭에 스크롤바 폭을 더해 보정하는데, 스크롤바 폭과 보정값이 한 변수(--toaster-scrollbar)로만
 * 정의돼야 두 값이 어긋나 잘림이 재발하지 않는다. 실측(Electron offscreen): 보정 없으면 왼쪽 8px 잘림.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const css = fs.readFileSync(
  path.resolve(process.cwd(), 'src/renderer/src/app/styles/global.css'),
  'utf-8'
)

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`)
  expect(start, `selector not found: ${selector}`).toBeGreaterThanOrEqual(0)
  return css.slice(start, css.indexOf('}', start))
}

describe('sonner Toaster CSS — 스크롤바 폭 보정', () => {
  const toaster = block("[data-sonner-toaster][data-expanded='true']")
  const scrollbar = block("[data-sonner-toaster][data-expanded='true']::-webkit-scrollbar")

  it('토스터 폭은 --width 에 스크롤바 폭 변수를 더한 값이다', () => {
    expect(toaster).toMatch(/width:\s*calc\(var\(--width\)\s*\+\s*var\(--toaster-scrollbar\)\)/)
  })

  it('스크롤바 폭은 같은 변수를 쓴다 — 리터럴 px 로 갈라지면 잘림이 재발한다', () => {
    expect(scrollbar).toMatch(/width:\s*var\(--toaster-scrollbar\)/)
    expect(scrollbar).not.toMatch(/width:\s*\d+px/)
  })

  it('변수는 토스터 블록에서 정의되고 스크롤 전환 규칙은 유지된다', () => {
    expect(toaster).toMatch(/--toaster-scrollbar:\s*\d+px/)
    expect(toaster).toMatch(/overflow-y:\s*auto/)
    expect(toaster).toMatch(/scrollbar-gutter:\s*stable/)
  })
})
