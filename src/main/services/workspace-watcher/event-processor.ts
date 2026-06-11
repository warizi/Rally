import path from 'path'
import fs from 'fs'
import type * as parcelWatcher from '@parcel/watcher'
import { folderRepository } from '../../repositories/folder'
import { entityLinkRepository } from '../../repositories/entity-link'
import { nanoid } from 'nanoid'
import { fileTypeConfigs } from './file-type-config'
import type { FileTypeConfig } from './file-type-config'
import { USER_ACTOR } from '../_shared/actor'
import { readDirRecursiveAsync } from '../folder'
import { isHiddenRelPath, toWorkspaceRel } from '../../lib/fs-utils'

/**
 * lstat({bigint:true}) 결과에서 ino/dev identity 추출 (P2).
 * 테스트 mock 등 bigint 가 아닌 stat 객체에는 null 로 안전 처리.
 */
function identityOf(st: { ino?: unknown; dev?: unknown }): {
  ino: string | null
  dev: string | null
} {
  return {
    ino: typeof st.ino === 'bigint' ? st.ino.toString() : null,
    dev: typeof st.dev === 'bigint' ? st.dev.toString() : null
  }
}

/**
 * delete 이벤트의 경로가 디스크에 아직 실재하는지 확인 (시나리오 C 방어).
 *
 * Finder 의 "바꾸기(replace)" 는 기존 항목을 휴지통으로 보내고(delete 이벤트)
 * 새 항목을 들여오는(create 이벤트) 두 FS 작업이라 debounce 배치가 분리될 수 있다.
 * delete 처리 시점에 경로가 실재한다 = 이미 새 항목이 자리를 차지한 상태이므로
 * row 를 삭제하면 안 된다 — 링크·태그가 파괴되고 다음 스캔이 새 ID 로 재생성된다.
 */
async function pathStillExists(absPath: string): Promise<boolean> {
  try {
    await fs.promises.lstat(absPath)
    return true
  } catch {
    return false
  }
}

/**
 * ino 매칭이 불가능할 때(identity 미보유 환경·row.ino null)의 보수적 rename 폴백 (P3).
 *
 * 기존 greedy 페어링(같은 부모면 무조건 첫 delete 와 짝)은 다중 항목 동시 작업에서
 * 무관한 쌍을 rename 으로 오인했다 (R-04). 폴백은 모호성이 없는 경우에만 쌍을 인정한다:
 *  - 규칙 1 (이동): 같은 basename 의 unpaired delete 가 정확히 1개
 *  - 규칙 2 (이름 변경): 같은 부모의 unpaired delete 와 create 가 각각 정확히 1개
 * 모호하면 null — delete+create 로 처리된다 (ID 는 P4 휴지통 부활로 보완).
 */
function findFallbackPair(
  createEvent: parcelWatcher.Event,
  creates: parcelWatcher.Event[],
  deletes: parcelWatcher.Event[],
  consumedDeletePaths: Set<string>
): parcelWatcher.Event | null {
  const cDir = path.dirname(createEvent.path)
  const cBase = path.basename(createEvent.path)
  const unpaired = deletes.filter((d) => !consumedDeletePaths.has(d.path))

  const byBase = unpaired.filter((d) => path.basename(d.path) === cBase)
  if (byBase.length === 1) return byBase[0]

  const byDir = unpaired.filter((d) => path.dirname(d.path) === cDir)
  const createsInDir = creates.filter((c) => path.dirname(c.path) === cDir)
  if (byDir.length === 1 && createsInDir.length === 1) return byDir[0]

  return null
}

/**
 * 이벤트 배치 → DB 동기화 (P3: ino 기반 확정 매칭)
 *
 * 처리 순서 (순서 중요):
 * 1. getEventsSince 의 oldPath rename (플랫폼 의존적)
 * 2. 폴더 create — (dev,ino) 매칭 → move 확정 / 폴백 페어링 / 신규.
 *    어떤 경로든 subtree 강제 스캔 수행 (R-04 의 "paired create 스캔 생략" 제거)
 * 3. 폴더 delete — create 에서 이미 move/replace 처리된 경로는 skip
 * 4. 파일 타입별 create → delete (동일 원칙)
 *
 * create 를 delete 보다 먼저 처리하는 이유: 같은 배치의 move(delete+create)에서
 * delete 가 먼저 row 를 지우면 create 의 ino 매칭 대상이 사라진다. create 가 먼저
 * move 로 경로를 갱신하면 delete 는 옛 경로 조회 miss 로 자연스럽게 no-op 이 된다.
 */
export async function applyEvents(
  workspaceId: string,
  workspacePath: string,
  events: parcelWatcher.Event[]
): Promise<{
  folderPaths: string[]
  orphanPaths: Map<string, string[]>
}> {
  const changedFolderPaths: string[] = []
  const orphanPaths = new Map<string, string[]>(fileTypeConfigs.map((c) => [c.entityType, []]))

  const isFileEvent = (absPath: string): boolean =>
    fileTypeConfigs.some((c) => c.matchExtension(absPath))

  const isFolderEvent = (e: parcelWatcher.Event): boolean =>
    !isFileEvent(e.path) && !isHiddenRelPath(toWorkspaceRel(workspacePath, e.path))

  // ─── Step 1: getEventsSince rename + oldPath (플랫폼 의존적) ──
  const oldPathHandled = new Set<string>()
  for (const event of events) {
    if (!isFolderEvent(event)) continue
    if (
      'oldPath' in event &&
      typeof (event as unknown as { oldPath: string }).oldPath === 'string'
    ) {
      const rel = toWorkspaceRel(workspacePath, event.path)
      const oldRel = toWorkspaceRel(
        workspacePath,
        (event as unknown as { oldPath: string }).oldPath
      )
      folderRepository.bulkUpdatePathPrefix(workspaceId, oldRel, rel, USER_ACTOR)
      for (const config of fileTypeConfigs) {
        config.repository.bulkUpdatePathPrefix(workspaceId, oldRel, rel, USER_ACTOR)
      }
      changedFolderPaths.push(rel)
      oldPathHandled.add(event.path)
    }
  }

  // ─── Step 2: 폴더 create — ino 확정 매칭 / 폴백 / 신규 ───────
  const folderCreates = events.filter(
    (e) => e.type === 'create' && isFolderEvent(e) && !oldPathHandled.has(e.path)
  )
  const folderDeletes = events.filter(
    (e) => e.type === 'delete' && isFolderEvent(e) && !oldPathHandled.has(e.path)
  )
  const consumedFolderDeletes = new Set<string>()
  const folderCreateRels = new Set(folderCreates.map((e) => toWorkspaceRel(workspacePath, e.path)))

  const applyFolderMove = (oldRel: string, newRel: string): void => {
    folderRepository.bulkUpdatePathPrefix(workspaceId, oldRel, newRel, USER_ACTOR)
    for (const config of fileTypeConfigs) {
      config.repository.bulkUpdatePathPrefix(workspaceId, oldRel, newRel, USER_ACTOR)
    }
    changedFolderPaths.push(newRel)
  }

  for (const event of folderCreates) {
    const rel = toWorkspaceRel(workspacePath, event.path)

    let identity: { ino: string | null; dev: string | null }
    try {
      // R-09: lstat — 심볼릭 링크를 따라가지 않아 스캔(isSymbolicLink skip)과 규칙 통일
      const stat = await fs.promises.lstat(event.path, { bigint: true })
      if (!stat.isDirectory()) continue
      identity = identityOf(stat)
    } catch {
      continue
    }

    // ① (dev,ino) 확정 매칭 — 어디서 이동돼 왔든 같은 폴더 (R-04 근본 해결)
    const byIdentity =
      identity.ino && identity.dev
        ? folderRepository.findByIdentity(workspaceId, identity.ino, identity.dev)
        : undefined
    if (byIdentity) {
      if (byIdentity.relativePath !== rel) {
        applyFolderMove(byIdentity.relativePath, rel)
      }
      await scanFolderSubtree(workspaceId, workspacePath, rel, changedFolderPaths, orphanPaths)
      continue
    }

    // ② 같은 경로의 기존 row — 동명 덮어쓰기(replace) 포함: row 유지 + identity 갱신
    const existing = folderRepository.findByRelativePath(workspaceId, rel)
    if (existing) {
      if (identity.ino && existing.ino !== identity.ino) {
        folderRepository.update(existing.id, { ino: identity.ino, dev: identity.dev })
      }
      await scanFolderSubtree(workspaceId, workspacePath, rel, changedFolderPaths, orphanPaths)
      continue
    }

    // ③ 보수적 폴백 페어링 (ino 미보유 환경)
    const fallback = findFallbackPair(event, folderCreates, folderDeletes, consumedFolderDeletes)
    if (fallback) {
      const oldRel = toWorkspaceRel(workspacePath, fallback.path)
      const oldFolder = folderRepository.findByRelativePath(workspaceId, oldRel)
      if (oldFolder) {
        consumedFolderDeletes.add(fallback.path)
        applyFolderMove(oldRel, rel)
        await scanFolderSubtree(workspaceId, workspacePath, rel, changedFolderPaths, orphanPaths)
        continue
      }
    }

    // ④ 신규 폴더
    const now = new Date()
    folderRepository.create({
      id: nanoid(),
      workspaceId,
      relativePath: rel,
      color: null,
      order: 0,
      ino: identity.ino,
      dev: identity.dev,
      createdAt: now,
      updatedAt: now
    })
    changedFolderPaths.push(rel)
    // 외부에서 이동돼 들어온 폴더의 내부 파일/서브폴더는 watcher 이벤트가 생략될 수
    // 있으므로 직접 재귀 스캔으로 보완. 이미 등록된 record 는 findByRelativePath 로 skip.
    await scanFolderSubtree(workspaceId, workspacePath, rel, changedFolderPaths, orphanPaths)
  }

  // ─── Step 3: 폴더 delete ─────────────────────────────────────
  for (const event of folderDeletes) {
    if (consumedFolderDeletes.has(event.path)) continue
    const rel = toWorkspaceRel(workspacePath, event.path)
    // 같은 배치에 동일 경로 create 가 있으면 replace 패턴 — 삭제하지 않는다
    if (folderCreateRels.has(rel)) continue
    // 경로가 디스크에 실재하면 stale delete (Finder "바꾸기" 가 delete→create 를
    // 별개 배치로 쪼개는 경우 포함) — 삭제하지 않는다. 새 항목은 create/스캔이 정리.
    if (await pathStillExists(event.path)) continue

    const existing = folderRepository.findByRelativePath(workspaceId, rel)
    if (existing) {
      // 삭제 전 하위 파일 경로 수집 → changed 이벤트에 포함
      for (const config of fileTypeConfigs) {
        const children = config.repository
          .findByWorkspaceId(workspaceId)
          .filter((item) => item.relativePath.startsWith(rel + '/'))
        orphanPaths.get(config.entityType)!.push(...children.map((item) => item.relativePath))
        for (const child of children) {
          entityLinkRepository.removeAllByEntity(config.entityType, child.id)
        }
        config.repository.bulkDeleteByPrefix(workspaceId, rel)
      }
      folderRepository.bulkDeleteByPrefix(workspaceId, rel)
      changedFolderPaths.push(rel)
    }
  }

  // ─── Step 4: 파일 타입별 create → delete ─────────────────────
  for (const config of fileTypeConfigs) {
    await processFileTypeEvents(workspaceId, workspacePath, events, config)
  }

  return { folderPaths: changedFolderPaths, orphanPaths }
}

/**
 * 특정 파일 타입의 create/delete 이벤트 처리 (P3: ino 확정 매칭)
 */
async function processFileTypeEvents(
  workspaceId: string,
  workspacePath: string,
  events: parcelWatcher.Event[],
  config: FileTypeConfig
): Promise<void> {
  const filterEvent = (e: parcelWatcher.Event, type: 'create' | 'delete'): boolean => {
    if (e.type !== type || !config.matchExtension(e.path)) return false
    // R-08: 숨김 검사도 세그먼트 단위 — .obsidian/x.md 같은 숨김 폴더 내부 파일이
    // 이벤트로만 등록됐다가 reconcile 에서 삭제되는 플립플롭을 막는다
    const rel = toWorkspaceRel(workspacePath, e.path)
    if (isHiddenRelPath(rel)) return false
    return !config.skipFilter?.(rel)
  }

  const deletes = events.filter((e) => filterEvent(e, 'delete'))
  const creates = events.filter((e) => filterEvent(e, 'create'))
  const consumedDeletes = new Set<string>()
  const createRels = new Set(creates.map((e) => toWorkspaceRel(workspacePath, e.path)))

  const resolveFolderId = (rel: string): string | null => {
    const parentRel = rel.includes('/') ? rel.split('/').slice(0, -1).join('/') : null
    if (!parentRel) return null
    return folderRepository.findByRelativePath(workspaceId, parentRel)?.id ?? null
  }

  // ── create: ino 확정 매칭 → replace → 폴백 → 신규 ────────────
  for (const createEvent of creates) {
    const rel = toWorkspaceRel(workspacePath, createEvent.path)

    let identity: { ino: string | null; dev: string | null }
    try {
      // R-09: lstat — 스캔 규칙(symlink 제외)과 통일
      const stat = await fs.promises.lstat(createEvent.path, { bigint: true })
      if (!stat.isFile()) continue
      identity = identityOf(stat)
    } catch {
      continue
    }

    // ① (dev,ino) 확정 매칭 — move: ID·링크 보존 (R-04)
    const byIdentity =
      identity.ino && identity.dev
        ? config.repository.findByIdentity(workspaceId, identity.ino, identity.dev)
        : undefined
    if (byIdentity) {
      if (byIdentity.relativePath !== rel) {
        config.repository.update(byIdentity.id, {
          relativePath: rel,
          folderId: resolveFolderId(rel),
          title: config.extractTitle(createEvent.path),
          updatedAt: new Date()
        })
      }
      continue
    }

    // ② 같은 경로의 기존 row — 동명 덮어쓰기(replace): row 유지 + identity 갱신
    const existing = config.repository.findByRelativePath(workspaceId, rel)
    if (existing) {
      if (identity.ino && existing.ino !== identity.ino) {
        config.repository.update(existing.id, { ino: identity.ino, dev: identity.dev })
      }
      continue
    }

    // ③ 보수적 폴백 페어링 (ino 미보유 환경) — 모호하면 신규로 처리
    const fallback = findFallbackPair(createEvent, creates, deletes, consumedDeletes)
    if (fallback) {
      const oldRel = toWorkspaceRel(workspacePath, fallback.path)
      const oldRow = config.repository.findByRelativePath(workspaceId, oldRel)
      if (oldRow) {
        consumedDeletes.add(fallback.path)
        config.repository.update(oldRow.id, {
          relativePath: rel,
          folderId: resolveFolderId(rel) ?? oldRow.folderId,
          title: config.extractTitle(createEvent.path),
          updatedAt: new Date()
        })
        continue
      }
    }

    // ④ 신규 등록
    const now = new Date()
    config.repository.create({
      id: nanoid(),
      workspaceId,
      relativePath: rel,
      folderId: resolveFolderId(rel),
      title: config.extractTitle(createEvent.path),
      description: '',
      preview: '',
      order: 0,
      ino: identity.ino,
      dev: identity.dev,
      createdAt: now,
      updatedAt: now
    })
  }

  // ── delete: move/replace 로 소비된 경로는 skip ────────────────
  for (const deleteEvent of deletes) {
    if (consumedDeletes.has(deleteEvent.path)) continue
    const rel = toWorkspaceRel(workspacePath, deleteEvent.path)
    // 같은 배치에 동일 경로 create 가 있으면 replace 패턴 — 삭제하지 않는다
    if (createRels.has(rel)) continue
    // 경로가 디스크에 실재하면 stale delete — 삭제하지 않는다 (배치 분리 replace 방어)
    if (await pathStillExists(deleteEvent.path)) continue
    const existing = config.repository.findByRelativePath(workspaceId, rel)
    if (existing) {
      entityLinkRepository.removeAllByEntity(config.entityType, existing.id)
      config.repository.delete(existing.id)
    }
  }
}

/**
 * 새로 등장한 폴더의 subtree 를 재귀 스캔해 누락된 폴더/파일 record 를 보완한다.
 *
 * macOS FSEvents 같은 일부 FS watcher 는 외부에서 한꺼번에 이동돼 들어오는 폴더의
 * 내부 파일·서브폴더 create 이벤트를 생략한다. 이 helper 는 그런 환경에서도 폴더가
 * 새로 인식될 때 내부를 강제로 스캔해 DB 와 FS 를 일관 유지한다.
 *
 * P3: move 로 판정된 폴더에도 항상 수행 — 기존 record 는 findByRelativePath 로
 * skip 되므로 중복 호출 안전. (identity 는 다음 reconcile backfill 이 채운다)
 */
async function scanFolderSubtree(
  workspaceId: string,
  workspacePath: string,
  folderRel: string,
  changedFolderPaths: string[],
  orphanPaths: Map<string, string[]>
): Promise<void> {
  const now = new Date()

  const subDirs = await readDirRecursiveAsync(workspacePath, folderRel)
  for (const sub of subDirs) {
    const existing = folderRepository.findByRelativePath(workspaceId, sub.relativePath)
    if (existing) continue
    folderRepository.create({
      id: nanoid(),
      workspaceId,
      relativePath: sub.relativePath,
      color: null,
      order: 0,
      createdAt: now,
      updatedAt: now
    })
    changedFolderPaths.push(sub.relativePath)
  }

  for (const config of fileTypeConfigs) {
    const files = await config.readFilesAsync(workspacePath, folderRel)
    const collected = orphanPaths.get(config.entityType)!
    for (const f of files) {
      if (config.skipFilter?.(f.relativePath)) continue
      const existing = config.repository.findByRelativePath(workspaceId, f.relativePath)
      if (existing) continue
      const parentRel = f.relativePath.includes('/')
        ? f.relativePath.split('/').slice(0, -1).join('/')
        : null
      const folder = parentRel ? folderRepository.findByRelativePath(workspaceId, parentRel) : null
      config.repository.create({
        id: nanoid(),
        workspaceId,
        relativePath: f.relativePath,
        folderId: folder?.id ?? null,
        title: config.extractTitle(f.name),
        description: '',
        preview: '',
        order: 0,
        createdAt: now,
        updatedAt: now
      })
      collected.push(f.relativePath)
    }
  }
}
