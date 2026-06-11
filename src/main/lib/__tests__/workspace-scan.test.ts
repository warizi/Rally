/**
 * scanWorkspaceAsync (P1 단일 패스 스캐너) — 실제 파일시스템 기반 검증.
 *
 * 1. 동등성: 기존 read*RecursiveAsync / readDirRecursiveAsync 와 동일 결과 집합
 * 2. 규칙: 숨김(.)·심볼릭 링크 제외, NFC 정규화
 * 3. 오류: 루트 접근 불가 시 errors 수집 (빈 결과와 구분 — R-02)
 * 4. 동시성 제한이 결과에 영향 없음
 * 5. 벤치: 기존 "타입별 4회 순회" 대비 시간 로그 (회귀 감지는 수동)
 *
 * 규모: 기본 36 dirs × 28 files ≈ 1,000 files.
 * 10k 벤치: SCAN_BENCH_SCALE=10 npx vitest run --config vitest.config.node.mts workspace-scan
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  scanWorkspaceAsync,
  readMdFilesRecursiveAsync,
  readCsvFilesRecursiveAsync,
  readPdfFilesRecursiveAsync,
  readImageFilesRecursiveAsync
} from '../fs-utils'
import { readDirRecursiveAsync } from '../../services/folder'

const SCALE = Number(process.env.SCAN_BENCH_SCALE ?? 1)
const NUM_DIRS = 36 * SCALE
const MD_PER_DIR = 8
const CSV_PER_DIR = 8
const PNG_PER_DIR = 8
const TXT_PER_DIR = 4

let root = ''

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-scan-test-'))
  for (let d = 0; d < NUM_DIRS; d++) {
    // 2단 중첩: group{n}/dir{n} — 폴더 트리 형태 재현
    const dir = path.join(root, `group${d % 6}`, `dir${d}`)
    fs.mkdirSync(dir, { recursive: true })
    for (let f = 0; f < MD_PER_DIR; f++) fs.writeFileSync(path.join(dir, `note${f}.md`), 'x')
    for (let f = 0; f < CSV_PER_DIR; f++) fs.writeFileSync(path.join(dir, `data${f}.csv`), 'x')
    for (let f = 0; f < PNG_PER_DIR; f++) fs.writeFileSync(path.join(dir, `img${f}.png`), 'x')
    for (let f = 0; f < TXT_PER_DIR; f++) fs.writeFileSync(path.join(dir, `etc${f}.txt`), 'x')
  }
  // 숨김 폴더·숨김 파일 — 제외 대상
  fs.mkdirSync(path.join(root, '.hidden-dir'))
  fs.writeFileSync(path.join(root, '.hidden-dir', 'inside.md'), 'x')
  fs.writeFileSync(path.join(root, '.hidden.md'), 'x')
  // 심볼릭 링크 — 제외 대상
  fs.symlinkSync(path.join(root, 'group0'), path.join(root, 'link-to-group0'))
})

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('scanWorkspaceAsync — 동등성', () => {
  it('기존 타입별 재귀 스캐너와 동일한 파일·폴더 집합을 돌려준다', async () => {
    const t0 = performance.now()
    const scan = await scanWorkspaceAsync(root)
    const tScan = performance.now() - t0

    const t1 = performance.now()
    const [md, csv, pdf, img, dirs] = await Promise.all([
      readMdFilesRecursiveAsync(root, ''),
      readCsvFilesRecursiveAsync(root, ''),
      readPdfFilesRecursiveAsync(root, ''),
      readImageFilesRecursiveAsync(root, ''),
      readDirRecursiveAsync(root, '')
    ])
    const tLegacy = performance.now() - t1

    const sortRel = (xs: Array<{ relativePath: string }>): string[] =>
      xs.map((x) => x.relativePath).sort()

    expect(sortRel(scan.folders)).toEqual(sortRel(dirs))
    expect(sortRel(scan.files.filter((f) => f.name.endsWith('.md')))).toEqual(sortRel(md))
    expect(sortRel(scan.files.filter((f) => f.name.endsWith('.csv')))).toEqual(sortRel(csv))
    expect(sortRel(scan.files.filter((f) => f.name.endsWith('.pdf')))).toEqual(sortRel(pdf))
    expect(sortRel(scan.files.filter((f) => f.name.endsWith('.png')))).toEqual(sortRel(img))
    expect(scan.errors).toEqual([])

    // 규모 검증 — 생성한 개수와 일치
    expect(scan.files).toHaveLength(NUM_DIRS * (MD_PER_DIR + CSV_PER_DIR + PNG_PER_DIR + TXT_PER_DIR))

    // 벤치 로그 (단언 없음 — 수동 관찰용)
    // eslint-disable-next-line no-console
    console.log(
      `[scan-bench] files=${scan.files.length} dirs=${scan.folders.length} ` +
        `single-pass=${tScan.toFixed(1)}ms legacy-5-pass=${tLegacy.toFixed(1)}ms`
    )
  })

  it('숨김 폴더·숨김 파일·심볼릭 링크는 제외된다', async () => {
    const scan = await scanWorkspaceAsync(root)

    expect(scan.files.some((f) => f.relativePath.includes('.hidden'))).toBe(false)
    expect(scan.folders.some((f) => f.relativePath.includes('.hidden'))).toBe(false)
    expect(scan.folders.some((f) => f.relativePath.includes('link-to-group0'))).toBe(false)
  })

  it('파일명은 NFC 로 정규화된다', async () => {
    const NFD = '한글파일.md'.normalize('NFD')
    const NFC = '한글파일.md'.normalize('NFC')
    fs.writeFileSync(path.join(root, NFD), 'x')
    try {
      const scan = await scanWorkspaceAsync(root)
      const hangul = scan.files.filter((f) => f.relativePath.normalize('NFC') === NFC)
      expect(hangul).toHaveLength(1)
      // 반환 경로 자체가 NFC
      expect(hangul[0].relativePath).toBe(NFC)
    } finally {
      fs.rmSync(path.join(root, NFD), { force: true })
    }
  })

  it('동시성 제한(concurrency=2)에서도 동일 결과', async () => {
    const full = await scanWorkspaceAsync(root)
    const limited = await scanWorkspaceAsync(root, { concurrency: 2 })

    expect(limited.files.map((f) => f.relativePath).sort()).toEqual(
      full.files.map((f) => f.relativePath).sort()
    )
    expect(limited.folders.map((f) => f.relativePath).sort()).toEqual(
      full.folders.map((f) => f.relativePath).sort()
    )
  })

  it('루트 접근 불가 → errors 에 수집되고 빈 결과 (R-02: 오류와 빈 결과 구분)', async () => {
    const scan = await scanWorkspaceAsync(path.join(root, 'does-not-exist'))

    expect(scan.errors).toHaveLength(1)
    expect(scan.files).toEqual([])
    expect(scan.folders).toEqual([])
  })
})
