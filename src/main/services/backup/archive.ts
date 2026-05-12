import fs from 'fs'
import path from 'path'
import archiver from 'archiver'
import AdmZip from 'adm-zip'

import type { BackupManifest } from './types'

/**
 * 백업 zip 입출력 — archiver (생성), adm-zip (해제/manifest 조회).
 *
 * serializer / deserializer 가 직접 archiver/AdmZip 을 import 하지 않고
 * 본 모듈을 통과해서 책임을 단일화.
 */

interface PackOptions {
  /** 출력 zip 파일 절대 경로 */
  savePath: string
  /** 데이터 JSON 들이 모인 디렉토리 — zip 내부 `data/` 로 들어감 */
  dataDir: string
  /** manifest.json 절대 경로 — zip 내부 root 로 들어감 */
  manifestPath: string
  /** 워크스페이스 파일 디렉토리 — 존재하면 zip 내부 `files/` 로 들어감 */
  workspacePath: string
}

/**
 * zip 생성 (스트리밍).
 * archiver level 6 — 압축률 + 속도 균형.
 */
export async function packZip(options: PackOptions): Promise<void> {
  const { savePath, dataDir, manifestPath, workspacePath } = options
  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(savePath)
    const archive = archiver('zip', { zlib: { level: 6 } })

    output.on('close', resolve)
    archive.on('error', reject)

    archive.pipe(output)
    archive.directory(dataDir, 'data')
    archive.file(manifestPath, { name: 'manifest.json' })

    if (fs.existsSync(workspacePath)) {
      archive.directory(workspacePath, 'files')
    }

    archive.finalize()
  })
}

/**
 * zip 해제 — `tmpDir` 에 전체 내용 풀기.
 * 손상된 zip / 잘못된 경로는 AdmZip 이 throw.
 */
export function unpackZip(zipPath: string, tmpDir: string): void {
  const zip = new AdmZip(zipPath)
  zip.extractAllTo(tmpDir, true)
}

/**
 * manifest 만 조회 (zip 풀지 않음).
 * version 미지원 / manifest 누락 시 throw.
 */
export function readManifestFromZip(zipPath: string): BackupManifest {
  const zip = new AdmZip(zipPath)
  const entry = zip.getEntry('manifest.json')
  if (!entry) throw new Error('Invalid backup file: manifest.json not found')
  const content = entry.getData().toString('utf8')
  const manifest = JSON.parse(content) as BackupManifest
  if (manifest.version !== 1) {
    throw new Error(`Unsupported backup version: ${manifest.version}`)
  }
  return manifest
}

/** zip 내부 파일 절대 경로 조립 (해제된 tmpDir 기준) */
export function dataFilePath(tmpDir: string, filename: string): string {
  return path.join(tmpDir, 'data', filename)
}

/** files/ 디렉토리 경로 (해제된 tmpDir 기준) */
export function filesDirPath(tmpDir: string): string {
  return path.join(tmpDir, 'files')
}

/** manifest.json 경로 (해제된 tmpDir 기준) */
export function manifestPath(tmpDir: string): string {
  return path.join(tmpDir, 'manifest.json')
}
