import AdmZip from 'adm-zip'
import type { workspaces } from '../../db/schema'

import type { BackupManifest } from './types'
import { backupSerializer } from './serializer'
import { backupDeserializer } from './deserializer'

/**
 * 백업 시스템 — 워크스페이스 export / import (zip 기반).
 *
 * 본 파일은 공개 API 파사드. 책임은 모듈로 위임:
 *   - `./types.ts`           — BackupManifest 등 공개 타입
 *   - `./helpers.ts`         — 직렬화, 위상정렬, FS 복사, batch insert
 *   - `./id-mapper.ts`       — IdMapper 클래스 + BackupEntityType
 *   - `./tab-mapper.ts`      — 탭 세션 JSON 내부 ID 재매핑
 *   - `./import-schemas.ts`  — zod 스키마 (24 entity, any 0)
 *   - `./serializer.ts`      — export 본문 (DB → JSON → zip)
 *   - `./deserializer.ts`    — import 본문 (zip → zod parse → IdMapper → DB)
 *
 * P0-2 Phase 3 결과:
 *   - any 33회 → 0회 (zod 추론 타입으로 완전 대체)
 *   - silent fallback 제거 (tab-mapper / deserializer 의 손상 JSON 명시 throw)
 *   - 파사드 ≤ 150L 달성
 *
 * 설계: `리팩토링/리팩토링 전 분석/세부 항목/[P0-2] backup.ts 파이프라인 분해`
 */

// 외부 호환 — BackupManifest 재노출
export type { BackupManifest }

// ──────────────────────────────────────────────
// Backup Service (파사드)
// ──────────────────────────────────────────────

export const backupService = {
  /**
   * 워크스페이스 → zip export.
   * @param workspaceId  대상 워크스페이스 ID
   * @param savePath     출력 zip 절대 경로
   */
  async export(workspaceId: string, savePath: string): Promise<void> {
    return backupSerializer.serialize(workspaceId, savePath)
  },

  /**
   * zip → 새 워크스페이스 import.
   * @param zipPath  소스 zip 절대 경로
   * @param newName  새 워크스페이스 이름
   * @param newPath  새 워크스페이스 디렉토리 (파일 복사 대상)
   * @returns 생성된 workspace row
   */
  async import(
    zipPath: string,
    newName: string,
    newPath: string
  ): Promise<typeof workspaces.$inferSelect> {
    return backupDeserializer.deserialize(zipPath, newName, newPath)
  },

  /**
   * zip 을 풀지 않고 manifest 만 추출.
   * version 미지원 / manifest 누락 시 throw.
   */
  readManifest(zipPath: string): BackupManifest {
    const zip = new AdmZip(zipPath)
    const entry = zip.getEntry('manifest.json')
    if (!entry) throw new Error('Invalid backup file: manifest.json not found')
    const content = entry.getData().toString('utf8')
    const manifest: BackupManifest = JSON.parse(content)
    if (manifest.version !== 1) {
      throw new Error(`Unsupported backup version: ${manifest.version}`)
    }
    return manifest
  }
}
