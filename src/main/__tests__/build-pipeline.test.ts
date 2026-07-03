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
import { readFileSync } from 'node:fs'
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
})
