import fs from 'fs'
import * as parcelWatcher from '@parcel/watcher'
import { app } from 'electron'
import path from 'path'
import { folderRepository } from '../../repositories/folder'
import { cleanupOrphansAndDelete } from '../../lib/orphan-cleanup'
import { nanoid } from 'nanoid'
import { fileTypeConfigs } from './file-type-config'
import type { FileTypeConfig } from './file-type-config'
import { applyEvents } from './event-processor'
import { scanWorkspaceAsync, toNfc } from '../../lib/fs-utils'
import type { FileEntry } from '../../lib/fs-utils'
import { scoped } from '../../lib/logger'

const log = scoped('watcher')

// ─── orphan 대량 삭제 세이프가드 (R-01·R-02) ─────────────────
// 스캔 결과 급감이 "실제 삭제"인지 "스캔 불신(권한 거부·EMFILE·미마운트)"인지
// orphan 후보 경로의 디스크 실재 여부를 샘플링해 교차 검증한다.
// - 실재하는 orphan 이 하나라도 있으면 스캔이 누락한 것 → 삭제 보류
// - 전부 실제로 없으면 진짜 대량 삭제 → 그대로 진행 (외부 정리 작업 허용)
const ORPHAN_GUARD_MIN = 10 // 이 건수 미만이면 가드 없이 통과 (소규모 변경)
const ORPHAN_GUARD_RATIO = 0.5 // 기존 대비 이 비율 초과 소실 시 검증 발동
const ORPHAN_GUARD_SAMPLE = 20 // 디스크 실재 확인 샘플 수

// ─── ino/dev identity (P2) ───────────────────────────────────
// rename/move 추적의 기반. APFS ino 는 64bit → JS number 정밀도 초과 가능성이
// 있어 lstat({bigint:true}) 로 읽고 문자열로 저장한다.

const STAT_CHUNK = 32 // identity lstat 동시성 제한

async function statIdentity(absPath: string): Promise<{ ino: string; dev: string } | null> {
  try {
    const st = await fs.promises.lstat(absPath, { bigint: true })
    return { ino: st.ino.toString(), dev: st.dev.toString() }
  } catch {
    return null
  }
}

/** rel 경로 목록에 대해 identity 를 동시성 제한으로 일괄 조회 */
async function statIdentities(
  workspacePath: string,
  rels: string[]
): Promise<Map<string, { ino: string; dev: string }>> {
  const result = new Map<string, { ino: string; dev: string }>()
  for (let i = 0; i < rels.length; i += STAT_CHUNK) {
    await Promise.all(
      rels.slice(i, i + STAT_CHUNK).map(async (rel) => {
        const idn = await statIdentity(path.join(workspacePath, rel))
        if (idn) result.set(rel, idn)
      })
    )
  }
  return result
}

async function shouldSkipOrphanDelete(
  workspacePath: string,
  orphanRelPaths: string[],
  totalRows: number
): Promise<boolean> {
  if (orphanRelPaths.length < ORPHAN_GUARD_MIN) return false
  if (totalRows === 0 || orphanRelPaths.length / totalRows <= ORPHAN_GUARD_RATIO) return false
  for (const rel of orphanRelPaths.slice(0, ORPHAN_GUARD_SAMPLE)) {
    try {
      await fs.promises.access(path.join(workspacePath, rel))
      return true // orphan 으로 분류된 경로가 디스크에 실재 → 스캔 결과 불신
    } catch {
      /* 실제로 없음 — 다음 샘플 확인 */
    }
  }
  return false
}

/**
 * 오프라인(앱 미실행) 동안의 변경을 스냅샷 diff 로 빠르게 재생한다.
 *
 * P1 변경: 스냅샷이 없거나 getEventsSince 가 실패해도 여기서 풀스캔을 돌리지 않는다 —
 * 매 기동 reconcileWorkspace 가 폴더·파일 전체를 FS 기준으로 동기화하므로
 * 이 함수는 순수하게 "이벤트 재생 fast-path" 역할만 갖는다 (R-03·R-19 해소).
 */
export async function syncOfflineChanges(
  workspaceId: string,
  workspacePath: string
): Promise<void> {
  const snapshotPath = getSnapshotPath(workspaceId)
  if (!fs.existsSync(snapshotPath)) return

  let events: parcelWatcher.Event[] = []
  try {
    events = await parcelWatcher.getEventsSince(workspacePath, snapshotPath)
  } catch (err) {
    log.warn(`getEventsSince 실패 — 이벤트 재생 생략 (풀 reconcile 이 보정): ${String(err)}`)
    return
  }

  await applyEvents(workspaceId, workspacePath, events)

  try {
    await parcelWatcher.writeSnapshot(workspacePath, snapshotPath)
  } catch (err) {
    log.warn(`writeSnapshot 실패: ${String(err)}`)
  }
}

// ─── 공유 코어: 항목 집합 ↔ DB 동기화 ─────────────────────────

/**
 * 파일 타입 하나를 FS 항목 집합과 동기화한다.
 *
 * 매칭 우선순위 (P3): NFC path 일치 → (dev,ino) 일치(move) → 신규.
 * path 일치를 먼저 보는 이유: 같은 경로 재등장은 사용자 관점 "같은 항목"이고,
 * path 미일치 항목만 lstat 하면 steady state 에서 identity 조회 비용이 0 이다.
 *
 * 규칙:
 * - NFC 자가 보정 (R-06): DB 의 raw 경로가 NFD 등으로 달라도 NFC 기준으로 같은
 *   항목이면 insert/delete 대신 relativePath 만 NFC 로 갱신 — ID·링크 보존.
 * - move 감지 (P3): path 미일치 fs entry 의 (dev,ino)가 path 미일치 DB row 와
 *   일치하면 이동으로 판정 — update 로 ID·링크 보존, insert/orphan 에서 제외.
 * - dev 가드 (P3): rootDev 와 다른 dev 를 가진 row 는 볼륨 교체로 보고 re-backfill.
 * - 스캔 부분 실패 시 신규 등록만 수행하고 orphan 삭제 보류 (R-02)
 * - orphan 급감 시 디스크 실재 교차검증 후 보류 (R-01)
 */
async function reconcileFileTypeEntries(
  workspaceId: string,
  workspacePath: string,
  config: FileTypeConfig,
  fsEntries: FileEntry[],
  scanFailed: boolean,
  rootDev: string | null
): Promise<void> {
  const dbRows = config.repository.findByWorkspaceId(workspaceId)
  const dbByNfc = new Map(dbRows.map((r) => [toNfc(r.relativePath), r]))

  const now = new Date()
  const insertCandidates: FileEntry[] = []
  const identityBackfillRels: Array<{ id: string; rel: string }> = []
  const matchedIds = new Set<string>()
  for (const e of fsEntries) {
    const existing = dbByNfc.get(e.relativePath) // 스캔 결과는 항상 NFC
    if (existing) {
      matchedIds.add(existing.id)
      if (existing.relativePath !== e.relativePath) {
        // NFC 보정 — ID 보존한 채 경로 표기만 통일
        config.repository.update(existing.id, { relativePath: e.relativePath, updatedAt: now })
      }
      // P2: ino 미보유 row backfill / P3: 볼륨 교체(dev 불일치) 시 re-backfill
      if (existing.ino == null || (rootDev !== null && existing.dev !== rootDev)) {
        identityBackfillRels.push({ id: existing.id, rel: e.relativePath })
      }
      continue
    }
    insertCandidates.push(e)
  }

  // 신규 row 는 생성 시점에 identity 포함, 기존 row 는 backfill (둘 다 동시성 제한)
  const identities = await statIdentities(workspacePath, [
    ...insertCandidates.map((e) => e.relativePath),
    ...identityBackfillRels.map((b) => b.rel)
  ])
  for (const b of identityBackfillRels) {
    const idn = identities.get(b.rel)
    if (idn) config.repository.update(b.id, { ino: idn.ino, dev: idn.dev })
  }

  // P3 move 감지: path 미일치 fs entry ↔ path 미일치 DB row 의 (dev,ino) 대조
  const unmatchedByIdentity = new Map(
    dbRows
      .filter((r) => !matchedIds.has(r.id) && r.ino != null && r.dev != null)
      .map((r) => [`${r.dev}:${r.ino}`, r])
  )

  const toInsert: Record<string, unknown>[] = []
  for (const e of insertCandidates) {
    const idn = identities.get(e.relativePath)
    const moved = idn ? unmatchedByIdentity.get(`${idn.dev}:${idn.ino}`) : undefined
    if (moved) {
      // 이동 — ID·링크 보존한 채 경로·제목만 갱신
      const parentRel = e.relativePath.includes('/')
        ? e.relativePath.split('/').slice(0, -1).join('/')
        : null
      const folder = parentRel ? folderRepository.findByRelativePath(workspaceId, parentRel) : null
      config.repository.update(moved.id, {
        relativePath: e.relativePath,
        folderId: folder?.id ?? null,
        title: config.extractTitle(e.name),
        updatedAt: now
      })
      matchedIds.add(moved.id)
      unmatchedByIdentity.delete(`${idn!.dev}:${idn!.ino}`)
      continue
    }
    const parentRel = e.relativePath.includes('/')
      ? e.relativePath.split('/').slice(0, -1).join('/')
      : null
    const folder = parentRel ? folderRepository.findByRelativePath(workspaceId, parentRel) : null
    toInsert.push({
      id: nanoid(),
      workspaceId,
      relativePath: e.relativePath,
      folderId: folder?.id ?? null,
      title: config.extractTitle(e.name),
      description: '',
      preview: '',
      order: 0,
      ino: idn?.ino ?? null,
      dev: idn?.dev ?? null,
      createdAt: now,
      updatedAt: now
    })
  }
  config.repository.createMany(toInsert)

  // P2 커버리지 관측: backfill 진행 상황 (목표 — 재기동 2회 내 100%)
  if (identityBackfillRels.length > 0 || insertCandidates.length > 0) {
    log.info(
      `[identity] ${config.entityType} backfill=${identityBackfillRels.length} insert=${insertCandidates.length}`
    )
  }

  if (scanFailed) {
    log.warn(`[reconcile:${config.entityType}] 스캔 부분 실패 — orphan 삭제 보류`)
    return
  }

  // orphan = NFC path 로도, (dev,ino) move 로도 매칭되지 않은 row
  const orphans = dbRows.filter((r) => !matchedIds.has(r.id))
  const allRows = dbRows
  if (
    orphans.length > 0 &&
    (await shouldSkipOrphanDelete(
      workspacePath,
      orphans.map((r) => r.relativePath),
      allRows.length
    ))
  ) {
    log.warn(
      `[reconcile:${config.entityType}] orphan 급감(${orphans.length}/${allRows.length}) — 디스크 실재 확인됨, 삭제 보류`
    )
    return
  }
  // 매칭된 row 는 위에서 모두 NFC 로 보정됐으므로 raw 비교 기반 deleteOrphans 에
  // NFC 스캔 경로를 그대로 keep-list 로 넘겨도 안전하다 (신규 insert 포함).
  cleanupOrphansAndDelete(
    config.entityType,
    orphans.map((r) => r.id),
    () =>
      config.repository.deleteOrphans(
        workspaceId,
        fsEntries.map((e) => e.relativePath)
      )
  )
}

/**
 * 특정 파일 타입의 FS ↔ DB 동기화 — 자체 스캔 버전.
 * (단일 타입만 갱신이 필요한 호출부·테스트용. 전체 동기화는 reconcileWorkspace 사용)
 */
export async function reconcileFileType(
  workspaceId: string,
  workspacePath: string,
  config: FileTypeConfig
): Promise<void> {
  let scanError: unknown = null
  const fsEntries = await config.readFilesAsync(workspacePath, '', (err) => {
    scanError = err
  })
  const rootDev = (await statIdentity(workspacePath))?.dev ?? null
  await reconcileFileTypeEntries(
    workspaceId,
    workspacePath,
    config,
    fsEntries,
    scanError !== null,
    rootDev
  )
}

/**
 * 워크스페이스 전체 FS ↔ DB 동기화 — 매 기동 실행 (P1, R-03 해소).
 *
 * 단일 패스 스캔(동시성 제한)으로 폴더+파일을 한 번에 수집한 뒤
 * 폴더 → 파일 타입 순으로 동기화한다. 기존 "타입별 4회 전체 순회 + 폴더는
 * 스냅샷 실패 시에만" 구조를 대체한다.
 */
export async function reconcileWorkspace(
  workspaceId: string,
  workspacePath: string
): Promise<void> {
  const scan = await scanWorkspaceAsync(workspacePath)
  const scanFailed = scan.errors.length > 0
  if (scanFailed) {
    log.warn(
      `workspace 스캔 부분 실패 ${scan.errors.length}건 — 이번 reconcile 은 등록만 수행: ${String(scan.errors[0])}`
    )
  }

  // ── 폴더: NFC 보정 → identity backfill → move 감지 → 신규 → orphan ──
  const rootDev = (await statIdentity(workspacePath))?.dev ?? null
  const dbFolders = folderRepository.findByWorkspaceId(workspaceId)
  const folderByNfc = new Map(dbFolders.map((f) => [toNfc(f.relativePath), f]))
  const now = new Date()

  const folderInsertEntries: FileEntry[] = []
  const folderBackfills: Array<{ id: string; rel: string }> = []
  const matchedFolderIds = new Set<string>()
  for (const e of scan.folders) {
    const existing = folderByNfc.get(e.relativePath)
    if (existing) {
      matchedFolderIds.add(existing.id)
      if (existing.relativePath !== e.relativePath) {
        // NFC 보정 — 스캔이 모든 깊이의 폴더를 항목으로 갖고 있으므로
        // prefix 연쇄 갱신 없이 row 별 ID 기반 update 로 충분하다 (stale 참조 없음).
        // 하위 파일 row 는 각 타입 reconcile 에서 동일하게 개별 보정된다.
        folderRepository.update(existing.id, { relativePath: e.relativePath, updatedAt: now })
      }
      if (existing.ino == null || (rootDev !== null && existing.dev !== rootDev)) {
        folderBackfills.push({ id: existing.id, rel: e.relativePath })
      }
      continue
    }
    folderInsertEntries.push(e)
  }

  const folderIdentities = await statIdentities(workspacePath, [
    ...folderInsertEntries.map((e) => e.relativePath),
    ...folderBackfills.map((b) => b.rel)
  ])
  for (const b of folderBackfills) {
    const idn = folderIdentities.get(b.rel)
    if (idn) folderRepository.update(b.id, { ino: idn.ino, dev: idn.dev })
  }

  // P3 move 감지: path 미일치 스캔 폴더 ↔ path 미일치 DB 폴더의 (dev,ino) 대조.
  // 하위 파일 row 는 각 타입 reconcile 에서 자체 매칭되므로 폴더 row 단독 갱신로 충분.
  const unmatchedFolderByIdentity = new Map(
    dbFolders
      .filter((f) => !matchedFolderIds.has(f.id) && f.ino != null && f.dev != null)
      .map((f) => [`${f.dev}:${f.ino}`, f])
  )

  const foldersToInsert: Parameters<typeof folderRepository.createMany>[0] = []
  for (const e of folderInsertEntries) {
    const idn = folderIdentities.get(e.relativePath)
    const moved = idn ? unmatchedFolderByIdentity.get(`${idn.dev}:${idn.ino}`) : undefined
    if (moved) {
      folderRepository.update(moved.id, { relativePath: e.relativePath, updatedAt: now })
      matchedFolderIds.add(moved.id)
      unmatchedFolderByIdentity.delete(`${idn!.dev}:${idn!.ino}`)
      continue
    }
    foldersToInsert.push({
      id: nanoid(),
      workspaceId,
      relativePath: e.relativePath,
      color: null,
      order: 0,
      ino: idn?.ino ?? null,
      dev: idn?.dev ?? null,
      createdAt: now,
      updatedAt: now
    })
  }
  folderRepository.createMany(foldersToInsert)

  // P2 커버리지 관측: backfill 진행 상황 (목표 — 재기동 2회 내 100%)
  if (folderBackfills.length > 0 || folderInsertEntries.length > 0) {
    log.info(
      `[identity] folder backfill=${folderBackfills.length} insert=${folderInsertEntries.length} ` +
        `(resolved=${folderIdentities.size})`
    )
  }

  if (!scanFailed) {
    const folderOrphans = dbFolders.filter((f) => !matchedFolderIds.has(f.id))
    if (
      folderOrphans.length > 0 &&
      (await shouldSkipOrphanDelete(
        workspacePath,
        folderOrphans.map((f) => f.relativePath),
        dbFolders.length
      ))
    ) {
      log.warn(
        `[reconcile:folder] orphan 급감(${folderOrphans.length}/${dbFolders.length}) — 디스크 실재 확인됨, 삭제 보류`
      )
    } else {
      folderRepository.deleteOrphans(
        workspaceId,
        scan.folders.map((f) => f.relativePath)
      )
    }
  } else {
    log.warn('[reconcile:folder] 스캔 부분 실패 — orphan 삭제 보류')
  }

  // ── 파일 타입별 동기화 (단일 스캔 결과 재사용) ───────────────
  for (const config of fileTypeConfigs) {
    const entries = scan.files.filter(
      (f) => config.matchExtension(f.name) && !config.skipFilter?.(f.relativePath)
    )
    try {
      await reconcileFileTypeEntries(
        workspaceId,
        workspacePath,
        config,
        entries,
        scanFailed,
        rootDev
      )
    } catch (err) {
      log.warn(`[reconcile:${config.entityType}] 실패 — skip: ${String(err)}`)
    }
  }
}

export function getSnapshotPath(workspaceId: string): string {
  const snapshotsDir = path.join(app.getPath('userData'), 'workspace-snapshots')
  fs.mkdirSync(snapshotsDir, { recursive: true })
  return path.join(snapshotsDir, `${workspaceId}.snapshot`)
}

export { fileTypeConfigs }
