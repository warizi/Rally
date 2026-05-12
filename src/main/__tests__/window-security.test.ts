/**
 * src/main/index.ts 의 BrowserWindow webPreferences 보안 설정 정적 검증.
 *
 * 보안-1 Phase 4 — sandbox=true 등이 실수로 다시 false 로 돌아가는 회귀를 차단.
 * (electronegativity free 버전이 sandbox 체크를 지원하지 않아 직접 텍스트 검증)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const indexSource = readFileSync(resolve(__dirname, '../index.ts'), 'utf-8')

describe('main BrowserWindow webPreferences', () => {
  it('sandbox 는 true 로 선언되어 있다', () => {
    expect(indexSource).toMatch(/sandbox:\s*true/)
    expect(indexSource).not.toMatch(/sandbox:\s*false/)
  })

  it('contextIsolation 은 명시적으로 true', () => {
    expect(indexSource).toMatch(/contextIsolation:\s*true/)
    expect(indexSource).not.toMatch(/contextIsolation:\s*false/)
  })

  it('nodeIntegration 은 명시적으로 false', () => {
    expect(indexSource).toMatch(/nodeIntegration:\s*false/)
    expect(indexSource).not.toMatch(/nodeIntegration:\s*true/)
  })

  it('webSecurity 는 명시적으로 true', () => {
    expect(indexSource).toMatch(/webSecurity:\s*true/)
    expect(indexSource).not.toMatch(/webSecurity:\s*false/)
  })

  it('preload 스크립트가 선언되어 있다', () => {
    expect(indexSource).toMatch(/preload:\s*join\(__dirname,\s*['"]\.\.\/preload\/index\.js['"]\)/)
  })
})
