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

describe('외부 URL 열기 경로는 allowlist 로 가드된다', () => {
  it('공용 allowlist 함수를 import 한다', () => {
    expect(indexSource).toMatch(
      /import\s*\{[^}]*\bisAllowedExternalUrl\b[^}]*\}\s*from\s*['"]\.\/lib\/external-url['"]/
    )
  })

  it('setWindowOpenHandler 는 isAllowedExternalUrl 통과 시에만 openExternal 호출', () => {
    expect(indexSource).toMatch(
      /setWindowOpenHandler\(\(details\)\s*=>\s*\{[\s\S]*?if\s*\(isAllowedExternalUrl\(details\.url\)\)\s*\{[\s\S]*?shell\.openExternal\(details\.url\)/
    )
  })

  it('shell:openExternal IPC 는 isAllowedExternalUrl 통과 시에만 openExternal 호출', () => {
    expect(indexSource).toMatch(
      /shell:openExternal['"][\s\S]*?if\s*\(isAllowedExternalUrl\(url\)\)\s*\{[\s\S]*?shell\.openExternal\(url\)/
    )
  })

  it('검증 없이 details.url 을 직접 openExternal 에 넘기지 않는다', () => {
    expect(indexSource).not.toMatch(
      /setWindowOpenHandler\(\(details\)\s*=>\s*\{\s*shell\.openExternal\(details\.url\)/
    )
  })
})

describe('will-navigate 정책으로 임의 navigation 을 차단한다 (LIMIT_NAVIGATION)', () => {
  it('navigation allowlist 함수를 import 한다', () => {
    expect(indexSource).toMatch(
      /import\s*\{[^}]*\bisAllowedAppNavigation\b[^}]*\}\s*from\s*['"]\.\/lib\/external-url['"]/
    )
  })

  it("webContents 에 'will-navigate' 핸들러가 등록되어 있다", () => {
    expect(indexSource).toMatch(/webContents\.on\(\s*['"]will-navigate['"]/)
  })

  it("redirect 우회 차단을 위해 'will-redirect' 도 동일 정책으로 등록되어 있다", () => {
    expect(indexSource).toMatch(/webContents\.on\(\s*['"]will-redirect['"]/)
  })

  it('허용되지 않은 navigation 은 event.preventDefault() 로 차단한다', () => {
    expect(indexSource).toMatch(
      /if\s*\(\s*!isAllowedAppNavigation\([\s\S]*?\)\s*\)\s*\{[\s\S]*?event\.preventDefault\(\)/
    )
  })

  it('navigation 차단은 isAllowedAppNavigation 정책으로 판정한다 (직접 허용 금지)', () => {
    // will-navigate 콜백이 isAllowedAppNavigation 을 거치지 않고 그냥 통과시키지 않는다.
    expect(indexSource).toMatch(/will-navigate['"]\s*,\s*blockUnlessAppNavigation/)
  })
})
