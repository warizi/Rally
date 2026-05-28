import { app, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../db'
import { reminders } from '../../db/schema'
import { entityLinkRepository } from '../../repositories/entity-link'
import { resolveNameConflict } from '../../lib/fs-utils'
import { toMs } from '../_shared/date'

/**
 * trash 시스템 — 공통 헬퍼.
 *
 * 책임:
 *   - FS trash 디렉토리 경로 계산 (`getTrashRoot`)
 *   - 휴지통 변경 broadcast (renderer 캐시 무효화 트리거)
 *   - entity-link / reminder 스냅샷 캡처 (soft-delete 전 metadata 저장)
 *   - workspace ↔ trash 파일 이동 (cross-device 안전)
 */

// ─── FS trash 루트 ────────────────────────────────────────────

export function getTrashRoot(workspaceId: string): string {
  let userData: string
  try {
    userData = app.getPath('userData')
  } catch {
    // 테스트 환경 fallback
    userData = path.join(process.cwd(), '.rally-test-userdata')
  }
  return path.join(userData, 'trash', workspaceId)
}

// ─── broadcast ────────────────────────────────────────────────

/**
 * 휴지통 변경 broadcast — renderer의 useTrashWatcher가 받아 모든 활성 도메인 list 캐시를 무효화.
 * service 어느 경로(직접 IPC, 또는 noteService.remove 같은 간접 호출)로 들어와도 일관 broadcast 보장.
 *
 * 트랜잭션 외부에서 호출돼야 함 — DB 커밋 완료 후 알림.
 */
export function broadcastTrashChanged(workspaceId: string): void {
  try {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('trash:changed', workspaceId)
    })
  } catch {
    // 테스트 환경 (electron 모듈 없음) — 무시
  }
}

// ─── entity-link / reminder snapshot ──────────────────────────

export interface LinkSnapshot {
  sourceType: string
  sourceId: string
  targetType: string
  targetId: string
  workspaceId: string
  createdAt: number
}

export interface ReminderSnapshot {
  id: string
  entityType: 'todo' | 'schedule'
  entityId: string
  offsetMs: number
  remindAt: number
  isFired: boolean
  createdAt: number
  updatedAt: number
}

export interface TrashMetadata {
  links?: LinkSnapshot[]
  reminders?: ReminderSnapshot[]
}

export function captureLinks(entityType: string, entityIds: string[]): LinkSnapshot[] {
  if (entityIds.length === 0) return []
  const rows = entityLinkRepository.findByEntities(entityType, entityIds)
  return rows.map((r) => ({
    sourceType: r.sourceType,
    sourceId: r.sourceId,
    targetType: r.targetType,
    targetId: r.targetId,
    workspaceId: r.workspaceId,
    createdAt: toMs(r.createdAt)
  }))
}

export function captureReminders(
  entityType: 'todo' | 'schedule',
  entityIds: string[]
): ReminderSnapshot[] {
  if (entityIds.length === 0) return []
  const rows = db
    .select()
    .from(reminders)
    .where(and(eq(reminders.entityType, entityType), inArray(reminders.entityId, entityIds)))
    .all()
  return rows.map((r) => ({
    id: r.id,
    entityType: r.entityType as 'todo' | 'schedule',
    entityId: r.entityId,
    offsetMs: r.offsetMs,
    remindAt: toMs(r.remindAt),
    isFired: r.isFired,
    createdAt: toMs(r.createdAt),
    updatedAt: toMs(r.updatedAt)
  }))
}

// ─── FS 이동 헬퍼 ────────────────────────────────────────────

/**
 * 워크스페이스 내 파일을 trash 디렉토리로 이동.
 * 같은 디스크면 fs.renameSync (atomic), 크로스-디스크면 copy + unlink.
 * 부모 디렉토리는 자동 생성. 이미 dst가 존재하면 throw (보장: caller가 batchId 유니크).
 */
export function moveToTrash(src: string, dst: string): void {
  fs.mkdirSync(path.dirname(dst), { recursive: true })
  try {
    fs.renameSync(src, dst)
  } catch (e) {
    // EXDEV (cross-device) 시 fallback
    if ((e as NodeJS.ErrnoException).code === 'EXDEV') {
      fs.copyFileSync(src, dst)
      fs.unlinkSync(src)
    } else if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      // 원본 파일이 이미 없음 — 이전 외부 삭제. DB row만 trash로 보내면 됨 (skip move)
      return
    } else {
      throw e
    }
  }
}

/** trash → 워크스페이스. 같은 위치에 다른 파일 있으면 자동 rename. */
export function moveFromTrash(src: string, dstBase: string, relativePath: string): string {
  if (!fs.existsSync(src)) {
    // trash 파일이 사라짐 (외부 정리?) → DB row만 복구, fs 작업 skip
    return relativePath
  }
  const parentRel = relativePath.includes('/') ? relativePath.split('/').slice(0, -1).join('/') : ''
  const parentAbs = parentRel ? path.join(dstBase, parentRel) : dstBase
  fs.mkdirSync(parentAbs, { recursive: true })
  const desiredName = relativePath.split('/').pop()!
  const finalName = resolveNameConflict(parentAbs, desiredName)
  const finalRel = parentRel ? `${parentRel}/${finalName}` : finalName
  const dst = path.join(dstBase, finalRel)
  try {
    fs.renameSync(src, dst)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EXDEV') {
      fs.copyFileSync(src, dst)
      fs.unlinkSync(src)
    } else {
      throw e
    }
  }
  return finalRel
}

/** trash batch 디렉토리 영구 삭제 */
export function purgeTrashDir(absPath: string | null): void {
  if (!absPath) return
  try {
    fs.rmSync(absPath, { recursive: true, force: true })
  } catch {
    // 이미 없음 등 — 무시
  }
}
