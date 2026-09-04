/**
 * scripts/check-win-native.mjs — Windows 산출물 native 검사의 판정 로직을 합성 픽스처로 검증.
 *
 * 실제 바이너리 대신 magic byte 만 가진 파일을 만든다 (PE=MZ, Mach-O=0xFEEDFACF, ELF=0x7F ELF).
 * 배경: 1.17.2 릴리스에서 onnxruntime-node 1.29 가 바이너리 경로를 napi-v3 → napi-v6 로 옮기고
 * better-sqlite3 13 이 전 플랫폼 prebuild 를 동봉하면서, 정상 산출물이 allowlist 밖으로 나가 게이트가 실패했다.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const SCRIPT = path.resolve(process.cwd(), 'scripts/check-win-native.mjs')
const PE = Buffer.from('MZ ', 'latin1')
const MACHO = Buffer.from([0xcf, 0xfa, 0xed, 0xfe])
const ELF = Buffer.from([0x7f, 0x45, 0x4c, 0x46])

let dir: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-win-native-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function put(rel: string, magic: Buffer): void {
  const full = path.join(dir, 'resources', 'app.asar.unpacked', 'node_modules', rel)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, Buffer.concat([magic, Buffer.alloc(16)]))
}

/** 필수 5종의 win32 PE 바이너리 — 모든 케이스의 기본 골격 */
function requiredWin(): void {
  put('better-sqlite3/prebuilds/win32-x64.node', PE)
  put('sqlite-vec-windows-x64/vec0.dll', PE)
  put('@parcel/watcher-win32-x64/watcher.node', PE)
  put('@napi-rs/canvas-win32-x64-msvc/skia.win32-x64-msvc.node', PE)
  put('onnxruntime-node/bin/napi-v6/win32/x64/onnxruntime_binding.node', PE)
  put('onnxruntime-node/bin/napi-v6/win32/x64/onnxruntime.dll', PE)
}

function run(): { code: number; out: string } {
  const res = spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf-8' })
  return { code: res.status ?? -1, out: res.stdout + res.stderr }
}

describe('check-win-native — 멀티플랫폼 동봉 패키지 허용', () => {
  it('필수 5종 PE 만 있으면 통과', () => {
    requiredWin()
    const r = run()
    expect(r.code, r.out).toBe(0)
  })

  it('better-sqlite3 13 의 darwin/linux prebuild 동봉은 허용 (13.x 구조)', () => {
    requiredWin()
    put('better-sqlite3/prebuilds/darwin-arm64.node', MACHO)
    put('better-sqlite3/prebuilds/linux-x64.node', ELF)
    put('better-sqlite3/prebuilds/linuxmusl-arm64.node', ELF)
    const r = run()
    expect(r.code, r.out).toBe(0)
  })

  it('onnxruntime-node napi-v6 의 darwin/linux 하위(dylib 포함)는 허용 (1.29 구조)', () => {
    requiredWin()
    put('onnxruntime-node/bin/napi-v6/darwin/arm64/libonnxruntime.1.29.0.dylib', MACHO)
    put('onnxruntime-node/bin/napi-v6/darwin/arm64/onnxruntime_binding.node', MACHO)
    put('onnxruntime-node/bin/napi-v6/linux/x64/onnxruntime_binding.node', ELF)
    const r = run()
    expect(r.code, r.out).toBe(0)
  })

  it('onnxruntime-node napi-v3 (1.14 구조) 도 여전히 허용', () => {
    requiredWin()
    put('onnxruntime-node/bin/napi-v3/darwin/arm64/libonnxruntime.dylib', MACHO)
    const r = run()
    expect(r.code, r.out).toBe(0)
  })
})

describe('check-win-native — 실제 혼입은 여전히 차단', () => {
  it('better-sqlite3 build/Release 에 Mach-O 가 있으면 실패 (mac 크로스빌드 혼입)', () => {
    requiredWin()
    put('better-sqlite3/build/Release/better_sqlite3.node', MACHO)
    const r = run()
    expect(r.code, r.out).toBe(1)
    expect(r.out).toContain('Mach-O')
  })

  it('필수 모듈의 win32 PE 가 없으면 실패', () => {
    requiredWin()
    fs.rmSync(
      path.join(dir, 'resources', 'app.asar.unpacked', 'node_modules', 'onnxruntime-node'),
      {
        recursive: true
      }
    )
    put('onnxruntime-node/bin/napi-v6/darwin/arm64/onnxruntime_binding.node', MACHO)
    const r = run()
    expect(r.code, r.out).toBe(1)
    expect(r.out).toContain('필수 모듈 onnxruntime-node')
  })

  it('darwin 플랫폼 패키지 디렉터리 잔류는 실패', () => {
    requiredWin()
    put('sqlite-vec-darwin-arm64/vec0.dylib', MACHO)
    const r = run()
    expect(r.code, r.out).toBe(1)
  })

  it('node-pty 잔류는 실패', () => {
    requiredWin()
    put('node-pty/build/Release/pty.node', PE)
    const r = run()
    expect(r.code, r.out).toBe(1)
    expect(r.out).toContain('node-pty')
  })
})
