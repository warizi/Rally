/**
 * P0-2 진입 게이트: backup.ts 라운드트립.
 *
 * 시나리오:
 *   S1 — 풍부한 워크스페이스 → export → 새 path로 import → 모든 entity 의미적 동등
 *   S2 — 손상된 zip 거부
 *   S3 — 지원하지 않는 version 거부
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import AdmZip from 'adm-zip'

// Electron app.getVersion() 모킹 (테스트 환경에서 사용 불가)
vi.mock('electron', () => ({
  app: {
    getVersion: (): string => '1.7.2-test'
  }
}))

import { backupService } from '../backup'
import { seedFullWorkspace } from './lib/seed'
import { expectWorkspacesEquivalent } from './lib/workspace-compare'

let tmpRoot: string
let workspacePath: string
let zipPath: string
let importPath: string

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-backup-test-'))
  workspacePath = path.join(tmpRoot, 'source-workspace')
  importPath = path.join(tmpRoot, 'target-workspace')
  zipPath = path.join(tmpRoot, 'backup.zip')
  fs.mkdirSync(workspacePath, { recursive: true })
})

afterEach(() => {
  if (tmpRoot && fs.existsSync(tmpRoot)) {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
  }
})

describe('backupService — round trip', () => {
  it('S1 — exports and re-imports preserves all entity data semantically', async () => {
    // 1. 풍부한 워크스페이스 시드
    const seeded = seedFullWorkspace({ workspacePath, name: 'Source' })
    expect(seeded.folders).toHaveLength(3)
    expect(seeded.notes).toHaveLength(3)
    expect(seeded.todos).toHaveLength(2)
    expect(seeded.canvasNodes).toHaveLength(2)
    expect(seeded.canvasEdges).toHaveLength(1)

    // 2. export
    await backupService.export(seeded.ws.id, zipPath)
    expect(fs.existsSync(zipPath), 'zip file created').toBe(true)

    // manifest 검증 (readManifest 동작 확인 겸용)
    const manifest = backupService.readManifest(zipPath)
    expect(manifest.version).toBe(1)
    expect(manifest.workspaceName).toBe('Source')
    expect(manifest.tables).toContain('folders')
    expect(manifest.tables).toContain('canvas-nodes')

    // 3. 새 워크스페이스로 import
    const newWs = await backupService.import(zipPath, 'Target', importPath)
    expect(newWs.id).not.toBe(seeded.ws.id)
    expect(newWs.name).toBe('Target')
    expect(newWs.path).toBe(importPath)

    // 4. 의미적 동등성 검증
    expectWorkspacesEquivalent(seeded.ws.id, newWs.id)
  })

  it('S2 — readManifest rejects file without manifest.json', () => {
    const badZip = path.join(tmpRoot, 'no-manifest.zip')
    const zip = new AdmZip()
    zip.addFile('readme.txt', Buffer.from('not a backup', 'utf8'))
    zip.writeZip(badZip)

    expect(() => backupService.readManifest(badZip)).toThrow(/manifest\.json not found/)
  })

  it('S3 — readManifest rejects unsupported version', () => {
    const badZip = path.join(tmpRoot, 'bad-version.zip')
    const zip = new AdmZip()
    zip.addFile(
      'manifest.json',
      Buffer.from(JSON.stringify({ version: 999, appVersion: 'x', workspaceName: 'x', exportedAt: 'x', tables: [] }))
    )
    zip.writeZip(badZip)

    expect(() => backupService.readManifest(badZip)).toThrow(/Unsupported backup version/)
  })

  // ──────────────────────────────────────────────
  // P0-2 Phase 3 zod 검증 시나리오
  // ──────────────────────────────────────────────

  it('S4 — import rejects malformed JSON (zod parse fail)', async () => {
    const seeded = seedFullWorkspace({ workspacePath, name: 'Source' })

    await backupService.export(seeded.ws.id, zipPath)

    // zip 풀어서 folders.json 을 손상시키고 다시 압축
    const tmpDir = path.join(tmpRoot, 'tamper-unzip')
    fs.mkdirSync(tmpDir, { recursive: true })
    new AdmZip(zipPath).extractAllTo(tmpDir, true)

    // folders.json 의 한 row 에 필수 필드 'relativePath' 제거 → ZodError
    const foldersFile = path.join(tmpDir, 'data', 'folders.json')
    const folders = JSON.parse(fs.readFileSync(foldersFile, 'utf8')) as unknown[]
    if (folders.length > 0) {
      const first = folders[0] as Record<string, unknown>
      delete first.relativePath
    }
    fs.writeFileSync(foldersFile, JSON.stringify(folders))

    // 재패키징
    const tamperedZip = path.join(tmpRoot, 'tampered.zip')
    const out = new AdmZip()
    out.addLocalFolder(tmpDir)
    out.writeZip(tamperedZip)

    await expect(
      backupService.import(tamperedZip, 'Target', importPath)
    ).rejects.toThrow(/Invalid backup data in folders\.json/)
  })

  it('S5 — import rejects non-array JSON file', async () => {
    const seeded = seedFullWorkspace({ workspacePath, name: 'Source' })

    await backupService.export(seeded.ws.id, zipPath)

    const tmpDir = path.join(tmpRoot, 'tamper-unzip-2')
    fs.mkdirSync(tmpDir, { recursive: true })
    new AdmZip(zipPath).extractAllTo(tmpDir, true)

    // folders.json 을 객체로 치환 (배열 아님)
    fs.writeFileSync(
      path.join(tmpDir, 'data', 'folders.json'),
      JSON.stringify({ malformed: true })
    )

    const tamperedZip = path.join(tmpRoot, 'tampered2.zip')
    const out = new AdmZip()
    out.addLocalFolder(tmpDir)
    out.writeZip(tamperedZip)

    await expect(
      backupService.import(tamperedZip, 'Target', importPath)
    ).rejects.toThrow(/is not an array/)
  })
})
