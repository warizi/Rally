/**
 * 빌드 파이프라인 정적 검증.
 *
 * 배포-2: dist-mcp 가 npm run build (또는 dev) 시 자동 재빌드되어야 한다.
 * npm 의 prebuild / predev 라이프사이클 hook 으로 build:mcp 가 chain 됨.
 *
 * 회귀 시나리오: 누군가 prebuild/predev hook 을 제거하면 packaging 시 dist-mcp
 * 가 stale 상태로 들어가 보안-2 토큰 / 새 도메인 분할 등이 반영 안 됨.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const pkgPath = resolve(process.cwd(), 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
  scripts: Record<string, string>
}

describe('build pipeline (배포-2)', () => {
  it('package.json 에 build:mcp 스크립트 존재 (tsup)', () => {
    expect(pkg.scripts['build:mcp']).toBeTruthy()
    expect(pkg.scripts['build:mcp']).toMatch(/tsup/)
  })

  it('prebuild hook 이 build:mcp 를 호출한다 (npm 라이프사이클)', () => {
    expect(pkg.scripts.prebuild, 'prebuild hook 누락').toBeTruthy()
    expect(pkg.scripts.prebuild).toMatch(/build:mcp/)
  })

  it('predev hook 이 build:mcp 를 호출한다 (dev 첫 실행 시 dist-mcp 보장)', () => {
    expect(pkg.scripts.predev, 'predev hook 누락').toBeTruthy()
    expect(pkg.scripts.predev).toMatch(/build:mcp/)
  })

  it('build 스크립트는 여전히 typecheck + electron-vite build 수행', () => {
    expect(pkg.scripts.build).toMatch(/typecheck/)
    expect(pkg.scripts.build).toMatch(/electron-vite\s+build/)
  })
})

describe('electron-builder.yml (배포-2)', () => {
  const builderYml = readFileSync(resolve(process.cwd(), 'electron-builder.yml'), 'utf-8')

  it('extraResources 에 dist-mcp 포함 (prod 패키지에 들어가야 함)', () => {
    expect(builderYml).toMatch(/from:\s*dist-mcp\b/)
    expect(builderYml).toMatch(/to:\s*dist-mcp\b/)
  })

  it('extraResources 의 모든 from 경로가 실제 존재한다 (누락 리소스 경고 0건)', () => {
    // dist-mcp 는 prebuild(build:mcp)가 생성 — 빌드 시점에는 존재하므로 검사에서 제외
    const BUILD_GENERATED = new Set(['dist-mcp'])
    const fromPaths = [...builderYml.matchAll(/from:\s*(\S+)/g)].map((m) => m[1])
    expect(fromPaths.length).toBeGreaterThan(0)
    for (const p of fromPaths) {
      if (BUILD_GENERATED.has(p)) continue
      expect(existsSync(resolve(process.cwd(), p)), `extraResources from 경로 없음: ${p}`).toBe(
        true
      )
    }
  })

  it('플랫폼별 build 아이콘 리소스가 존재한다', () => {
    for (const icon of ['build/icon.ico', 'build/icon.icns', 'build/icon.png']) {
      expect(existsSync(resolve(process.cwd(), icon)), `${icon} 없음`).toBe(true)
    }
  })

  it('터미널 삭제 후 resources/bin 이 extraResources 에 남아있지 않다', () => {
    expect(builderYml).not.toMatch(/resources\/bin/)
  })

  it('win target 이 nsis x64 로 고정되어 있다 (arm64 기본 산출물 혼동 방지)', () => {
    // win: 섹션만 추출 (다음 top-level 키 전까지)
    const winSection = builderYml.slice(builderYml.indexOf('\nwin:'), builderYml.indexOf('\nnsis:'))
    expect(winSection).toMatch(/target:\s*nsis/)
    expect(winSection).toMatch(/arch:/)
    expect(winSection).toMatch(/-\s*x64/)
    expect(winSection).not.toMatch(/-\s*arm64/)
  })
})

/**
 * Windows 산출물은 Windows runner에서 npm ci 한 dependency tree로 만들어야 한다.
 * macOS node_modules 재사용 시 darwin native addon이 섞여 Windows에서 시작 크래시.
 */
describe('release workflow Windows job (window 배포)', () => {
  const releaseYml = readFileSync(resolve(process.cwd(), '.github/workflows/release.yml'), 'utf-8')
  // build-win job 블록만 추출해 검증 (다른 job 의 내용에 오매칭 방지)
  const winJob = releaseYml.slice(releaseYml.indexOf('build-win:'))

  it('release workflow 에 build-win job 존재', () => {
    expect(releaseYml).toMatch(/^\s{2}build-win:/m)
  })

  it('build-win 은 windows-latest runner 에서 실행된다', () => {
    expect(winJob).toMatch(/runs-on:\s*windows-latest/)
  })

  it('build-win 은 npm ci 로 fresh install 한다 (--ignore-scripts 금지)', () => {
    expect(winJob).toMatch(/npm ci/)
    expect(winJob).not.toMatch(/npm ci[^\n]*--ignore-scripts/)
  })

  it('build-win 은 x64 를 명시해 빌드한다', () => {
    expect(winJob).toMatch(/build:win|electron-builder\s+--win/)
    expect(winJob).toMatch(/--x64/)
  })

  it('build-win publish step 에 GH_TOKEN 이 주입된다', () => {
    expect(winJob).toMatch(/GH_TOKEN/)
  })

  it('build-win 에 native module 검사 step 이 있다', () => {
    expect(winJob).toMatch(/check:win-native/)
  })
})

/**
 * Windows 산출물 native module 검사 스크립트 존재/구성 회귀 방지.
 * 실제 동작 검증은 스크립트 자체가 담당하고, 여기서는 등록 누락만 차단한다.
 */
describe('check:win-native 스크립트 (window 배포)', () => {
  const scriptPath = resolve(process.cwd(), 'scripts/check-win-native.mjs')
  const scriptSrc = readFileSync(scriptPath, 'utf-8')

  it('package.json 에 check:win-native 스크립트가 등록되어 있다', () => {
    expect(pkg.scripts['check:win-native']).toBeTruthy()
    expect(pkg.scripts['check:win-native']).toMatch(/check-win-native\.mjs/)
  })

  it('금지 대상 기준(.dylib/.so/Mach-O/ELF/node-pty)이 들어 있다', () => {
    expect(scriptSrc).toMatch(/\.dylib/)
    expect(scriptSrc).toMatch(/\.so/)
    expect(scriptSrc).toMatch(/Mach-O/)
    expect(scriptSrc).toMatch(/ELF/)
    expect(scriptSrc).toMatch(/node-pty/)
  })

  it('필수 Windows native 모듈이 positive 검사에 포함되어 있다', () => {
    for (const mod of [
      'better-sqlite3',
      'sqlite-vec',
      '@parcel/watcher',
      '@napi-rs/canvas',
      'onnxruntime-node'
    ]) {
      expect(scriptSrc, `${mod} 검사 누락`).toContain(mod)
    }
  })
})
