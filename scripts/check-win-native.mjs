#!/usr/bin/env node
/**
 * Windows 산출물(native module) 플랫폼 검사.
 *
 * mac에서 크로스빌드하면 npmRebuild:false + mac node_modules 재사용으로
 * darwin native addon(better-sqlite3 등)이 Windows 패키지에 그대로 들어가
 * Windows 실행 시 DB 초기화 전에 크래시한다. 이 스크립트는 installer 배포 전에
 * dist/win-unpacked 내부 native binary가 실제 Windows(PE)용인지 검사한다.
 *
 * 사용법:
 *   node scripts/check-win-native.mjs [대상경로=dist/win-unpacked]
 *
 * 실패 조건 (negative):
 *   - .dylib / .so 파일 존재
 *   - node_modules 경로에 darwin-* / linux-* 플랫폼 패키지 존재
 *   - .node / .dll 파일의 magic byte가 Mach-O 또는 ELF
 *   - node-pty 잔류 (터미널 기능 삭제됨 — 존재 자체가 회귀)
 *
 * 필수 조건 (positive): 아래 모듈의 Windows native binary 존재 + PE(MZ) magic
 *   - better-sqlite3, sqlite-vec, @parcel/watcher, @napi-rs/canvas, onnxruntime-node
 *
 * allowlist: onnxruntime-node/bin/napi-v3/{darwin,linux}/** — 한 패키지에 멀티플랫폼
 * 바이너리를 동봉하는 구조라 오탐. win32/x64 바이너리 존재는 positive 검사가 보장한다.
 */
import { readdirSync, existsSync, openSync, readSync, closeSync } from 'fs'
import path from 'path'

const target = process.argv[2] ?? 'dist/win-unpacked'

if (!existsSync(target)) {
  console.error(`✗ 대상 경로 없음: ${target}`)
  console.error('  사용법: node scripts/check-win-native.mjs [dist/win-unpacked]')
  process.exit(1)
}

const NATIVE_EXTS = new Set(['.node', '.dll', '.dylib', '.so'])

// onnxruntime-node는 멀티플랫폼 바이너리 동봉 구조 — darwin/linux 하위만 허용
const ALLOWLIST = [/onnxruntime-node[\\/]bin[\\/]napi-v3[\\/](darwin|linux)[\\/]/]

// 플랫폼별 패키지 디렉터리 패턴 (sqlite-vec-darwin-arm64, @parcel/watcher-linux-x64-glibc 등)
const FORBIDDEN_PKG_DIR = /node_modules[\\/](@[^\\/]+[\\/])?[^\\/]*(darwin|linux)-[^\\/]*[\\/]/

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else if (entry.isFile()) yield full
  }
}

/** 파일 선두 4바이트로 binary format 판정 */
function detectFormat(file) {
  const buf = Buffer.alloc(4)
  const fd = openSync(file, 'r')
  try {
    const read = readSync(fd, buf, 0, 4, 0)
    if (read < 4) return 'unknown'
  } finally {
    closeSync(fd)
  }
  if (buf[0] === 0x4d && buf[1] === 0x5a) return 'PE'
  if (buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) return 'ELF'
  const hex = buf.toString('hex')
  const machO = ['feedface', 'cefaedfe', 'feedfacf', 'cffaedfe', 'cafebabe', 'bebafeca']
  if (machO.includes(hex)) return 'Mach-O'
  return 'unknown'
}

const violations = []
const nativeFiles = []

for (const file of walk(target)) {
  const rel = path.relative(target, file)
  const ext = path.extname(file).toLowerCase()
  const allowed = ALLOWLIST.some((re) => re.test(rel))

  if (!allowed) {
    if (ext === '.dylib') violations.push(`${rel}: .dylib는 Windows 빌드에 있으면 안 됨`)
    if (ext === '.so') violations.push(`${rel}: .so는 Windows 빌드에 있으면 안 됨`)
    if (FORBIDDEN_PKG_DIR.test(rel + path.sep)) {
      violations.push(`${rel}: darwin/linux 플랫폼 패키지 잔류`)
    }
    if (/node_modules[\\/]node-pty[\\/]/.test(rel + path.sep)) {
      violations.push(`${rel}: node-pty 잔류 (터미널 기능 삭제됨)`)
    }
  }

  if (NATIVE_EXTS.has(ext)) {
    const format = detectFormat(file)
    nativeFiles.push({ rel, format })
    if (!allowed && (format === 'Mach-O' || format === 'ELF')) {
      violations.push(`${rel}: ${format} binary — Windows(PE)가 아님`)
    }
  }
}

// 필수 Windows native binary 존재 + PE 확인
const REQUIRED = [
  { name: 'better-sqlite3', pattern: /better-sqlite3[\\/].*\.node$/ },
  { name: 'sqlite-vec', pattern: /sqlite-vec[^\\/]*[\\/].*\.dll$/ },
  { name: '@parcel/watcher', pattern: /@parcel[\\/]watcher[^\\/]*[\\/].*\.node$/ },
  { name: '@napi-rs/canvas', pattern: /@napi-rs[\\/]canvas[^\\/]*[\\/].*\.node$/ },
  { name: 'onnxruntime-node', pattern: /onnxruntime-node[\\/].*win32[\\/].*\.(node|dll)$/ }
]

const positives = []
for (const { name, pattern } of REQUIRED) {
  const matches = nativeFiles.filter((f) => pattern.test(f.rel))
  const pe = matches.filter((f) => f.format === 'PE')
  if (pe.length === 0) {
    violations.push(
      `필수 모듈 ${name}: Windows(PE) native binary 없음` +
        (matches.length > 0 ? ` (발견: ${matches.map((m) => `${m.rel}=${m.format}`).join(', ')})` : '')
    )
  } else {
    positives.push(`${name}: PE (${pe.length}개)`)
  }
}

console.log(`[check-win-native] scanned ${target} — native 후보 ${nativeFiles.length}개`)

if (violations.length > 0) {
  console.error('[check-win-native] ✗ 위반 항목:')
  for (const v of violations) console.error(`  - ${v}`)
  process.exit(1)
}

console.log('[check-win-native] ✓ OK: Windows native module 구성 정상')
for (const p of positives) console.log(`  - ${p}`)
