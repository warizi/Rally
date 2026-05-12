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
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { nanoid } from 'nanoid'

/**
 * P0-2 follow-up: 라운드트립 시 모든 entity insert 경로가 실행되도록
 * seedFullWorkspace 외에 추가 entity 직접 시드 (coverage 보강).
 */
function seedAdditionalEntities(workspaceId: string, folderId: string, noteId: string, todoId: string, scheduleId: string): {
  tagId: string
  recurringRuleId: string
  tabSnapshotId: string
} {
  const now = new Date()

  // tag + itemTag
  const tagId = nanoid()
  testDb.insert(schema.tags).values({
    id: tagId,
    workspaceId,
    name: 'urgent',
    color: '#ff0000',
    description: 'urgent tag',
    createdAt: now
  }).run()
  testDb.insert(schema.itemTags).values({
    id: nanoid(),
    itemType: 'note',
    itemId: noteId,
    tagId,
    createdAt: now
  }).run()

  // schedule_todo (composite PK)
  testDb.insert(schema.scheduleTodos).values({
    scheduleId,
    todoId
  }).run()

  // entity_link (note ↔ todo 양방향)
  testDb.insert(schema.entityLinks).values({
    sourceType: 'note',
    sourceId: noteId,
    targetType: 'todo',
    targetId: todoId,
    workspaceId,
    createdAt: now
  }).run()

  // reminder
  testDb.insert(schema.reminders).values({
    id: nanoid(),
    entityType: 'todo',
    entityId: todoId,
    offsetMs: 3600000,
    remindAt: now,
    isFired: false,
    createdAt: now,
    updatedAt: now
  }).run()

  // recurring_rule + completion
  const recurringRuleId = nanoid()
  testDb.insert(schema.recurringRules).values({
    id: recurringRuleId,
    workspaceId,
    title: 'Daily standup',
    description: '',
    priority: 'medium',
    recurrenceType: 'daily',
    daysOfWeek: null,
    startDate: now,
    endDate: null,
    startTime: '09:00',
    endTime: '09:30',
    reminderOffsetMs: null,
    createdAt: now,
    updatedAt: now
  }).run()
  testDb.insert(schema.recurringCompletions).values({
    id: nanoid(),
    ruleId: recurringRuleId,
    ruleTitle: 'Daily standup',
    workspaceId,
    completedDate: '2026-05-12',
    completedAt: now,
    createdAt: now
  }).run()

  // template
  testDb.insert(schema.templates).values({
    id: nanoid(),
    workspaceId,
    title: 'Note template',
    type: 'note',
    jsonData: JSON.stringify({ body: 'template body' }),
    createdAt: now
  }).run()

  // terminal_layout + session
  const terminalLayoutId = nanoid()
  testDb.insert(schema.terminalLayouts).values({
    id: terminalLayoutId,
    workspaceId,
    layoutJson: JSON.stringify({ type: 'single' }),
    createdAt: now,
    updatedAt: now
  }).run()
  testDb.insert(schema.terminalSessions).values({
    id: nanoid(),
    workspaceId,
    layoutId: terminalLayoutId,
    name: 'main',
    cwd: '/tmp',
    shell: '/bin/zsh',
    rows: 24,
    cols: 80,
    screenSnapshot: null,
    sortOrder: 0,
    isActive: 1, // integer column (no boolean mode in schema)
    createdAt: now,
    updatedAt: now
  }).run()

  // tab_session — tabsJson/panesJson/layoutJson 에 노트 id 포함 (재매핑 검증)
  const tabsJson = JSON.stringify({
    'tab-1': {
      id: 'tab-1',
      type: 'note',
      title: 'My note',
      icon: 'file',
      pathname: `/folder/note/${noteId}`,
      searchParams: { folderOpenState: JSON.stringify({ [folderId]: true }) },
      pinned: false,
      createdAt: now.getTime(),
      lastAccessedAt: now.getTime()
    }
  })
  const panesJson = JSON.stringify({
    'pane-1': {
      id: 'pane-1',
      tabIds: ['tab-1'],
      activeTabId: 'tab-1',
      size: 100,
      minSize: 10
    }
  })
  const layoutJson = JSON.stringify({
    id: 'root',
    type: 'pane',
    paneId: 'pane-1'
  })
  testDb.insert(schema.tabSessions).values({
    workspaceId,
    activePaneId: 'pane-1',
    tabsJson,
    panesJson,
    layoutJson,
    updatedAt: now
  }).run()

  // tab_snapshot
  const tabSnapshotId = nanoid()
  testDb.insert(schema.tabSnapshots).values({
    id: tabSnapshotId,
    workspaceId,
    name: 'Layout-A',
    description: 'snapshot',
    tabsJson,
    panesJson,
    layoutJson,
    createdAt: now,
    updatedAt: now
  }).run()

  return { tagId, recurringRuleId, tabSnapshotId }
}

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

    // 1b. 추가 entity 시드 — deserializer 의 모든 insert 경로 실행 (coverage 보강)
    seedAdditionalEntities(
      seeded.ws.id,
      seeded.folders[0].id,
      seeded.notes[0].id,
      seeded.todos[0].id,
      seeded.schedules[0].id
    )

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

  it('S6 — large workspace (1000 notes) round-trip smoke', async () => {
    const seeded = seedFullWorkspace({ workspacePath, name: 'Large' })

    // 1000 노트 추가 시드 (smoke — 메모리/시간 폭증 없이 완주)
    const { seed } = await import('./lib/seed')
    for (let i = 0; i < 1000; i++) {
      seed.note(seeded.ws.id, {
        title: `Bulk note ${i}`,
        relativePath: `Bulk note ${i}.md`
      })
    }

    const start = Date.now()
    await backupService.export(seeded.ws.id, zipPath)
    const exportMs = Date.now() - start

    const importStart = Date.now()
    const newWs = await backupService.import(zipPath, 'LargeTarget', importPath)
    const importMs = Date.now() - importStart

    // eslint-disable-next-line no-console
    console.log(
      `[P0-2 S6] 1000-note round-trip: export=${exportMs}ms, import=${importMs}ms`
    )

    // 30 초 이내 (smoke threshold — 대용량 핸들링 능력 확인)
    expect(exportMs).toBeLessThan(30_000)
    expect(importMs).toBeLessThan(30_000)
    expect(newWs.id).not.toBe(seeded.ws.id)
  }, 60_000)

  it('S7 — imports legacy backup with ISO string timestamps (pre-Phase 3 compat)', async () => {
    const seeded = seedFullWorkspace({ workspacePath, name: 'LegacySource' })

    // 1. 정상 export (신규 number 형식)
    await backupService.export(seeded.ws.id, zipPath)

    // 2. zip 풀어서 모든 data/*.json 의 number timestamp 를 ISO string 으로 변환
    //    → Phase 3 이전 버전의 백업 형식 시뮬레이션
    const legacyDir = path.join(tmpRoot, 'legacy-unzip')
    fs.mkdirSync(legacyDir, { recursive: true })
    new AdmZip(zipPath).extractAllTo(legacyDir, true)

    const dataDir = path.join(legacyDir, 'data')
    for (const filename of fs.readdirSync(dataDir)) {
      if (!filename.endsWith('.json')) continue
      const filePath = path.join(dataDir, filename)
      const raw: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      // 배열의 각 row 의 number timestamp 필드 → ISO string
      if (Array.isArray(raw)) {
        for (const row of raw as Record<string, unknown>[]) {
          for (const key of Object.keys(row)) {
            if (
              (key === 'createdAt' || key === 'updatedAt' || key.endsWith('At')) &&
              typeof row[key] === 'number'
            ) {
              row[key] = new Date(row[key] as number).toISOString()
            }
          }
        }
        fs.writeFileSync(filePath, JSON.stringify(raw))
      }
    }

    // 3. 재패키징
    const legacyZip = path.join(tmpRoot, 'legacy.zip')
    const out = new AdmZip()
    out.addLocalFolder(legacyDir)
    out.writeZip(legacyZip)

    // 4. import — zod union (number | string) 으로 통과해야 함
    const newWs = await backupService.import(legacyZip, 'LegacyTarget', importPath)
    expect(newWs.id).not.toBe(seeded.ws.id)
    expect(newWs.name).toBe('LegacyTarget')

    // 데이터 의미적 동등 (toDate(string) 으로 정확히 복원되는지)
    expectWorkspacesEquivalent(seeded.ws.id, newWs.id)
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
