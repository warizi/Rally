/**
 * Zip Slip 회귀 테스트 — adm-zip 이 `../` 항목을 targetDir 밖으로 쓰지 않는지 고정.
 *
 * 감사 항목 L-5 (adm-zip 0.6.0 major 업그레이드) 의 전제: 0.5.x 에서 검증된
 * 경로 탈출 방어(canonical/sanitize)가 업그레이드 후에도 유지되어야 한다.
 *
 * AdmZip.addFile 은 항목 이름을 정규화해 버리므로 `../` 가 살아있는 zip 을
 * 만들려면 로컬 헤더 / 중앙 디렉터리 / EOCD 를 직접 조립해야 한다 (method 0 = stored).
 *
 * 방어는 두 겹이다 — Utils.canonical (posix normalize 로 `..` 제거) +
 * Utils.sanitize (targetDir 밖이면 basename 으로 강등). 변이 검증 (2026-09-03):
 * node_modules/adm-zip/util/utils.js 에서 둘 다 무력화하면 traversal 4건이 전부 실패하고,
 * sanitize 하나만 무력화하면 canonical 이 잡아 통과한다.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import AdmZip from 'adm-zip'
import { unpackZip } from '../backup/archive'

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** 항목 이름을 손대지 않고 stored zip 을 만든다. */
function buildRawZip(entries: Array<{ name: string; data: Buffer }>): Buffer {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8')
    const crc = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(0, 6) // flags
    local.writeUInt16LE(0, 8) // method: stored
    local.writeUInt16LE(0, 10) // time
    local.writeUInt16LE(0x21, 12) // date (1980-01-01)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)
    const localRec = Buffer.concat([local, nameBuf, data])

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4) // version made by
    central.writeUInt16LE(20, 6) // version needed
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0x21, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt16LE(0, 30) // extra len
    central.writeUInt16LE(0, 32) // comment len
    central.writeUInt16LE(0, 34) // disk
    central.writeUInt16LE(0, 36) // internal attr
    central.writeUInt32LE(0, 38) // external attr
    central.writeUInt32LE(offset, 42)
    centrals.push(Buffer.concat([central, nameBuf]))

    locals.push(localRec)
    offset += localRec.length
  }
  const cdSize = centrals.reduce((n, b) => n + b.length, 0)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(cdSize, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20)
  return Buffer.concat([...locals, ...centrals, eocd])
}

function walk(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))
}

let root: string
let outDir: string

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-zip-slip-'))
  outDir = path.join(root, 'out')
  fs.mkdirSync(outDir)
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('unpackZip — Zip Slip 방어', () => {
  it('원시 zip 의 `../` 항목 이름이 손상되지 않고 보존된다 (테스트 자체의 전제)', () => {
    const zipPath = path.join(root, 'raw.zip')
    fs.writeFileSync(zipPath, buildRawZip([{ name: '../evil.txt', data: Buffer.from('x') }]))
    // adm-zip 파서가 항목 이름을 있는 그대로 읽는지 — 정규화된다면 아래 테스트는 무의미
    const names = new AdmZip(zipPath).getEntries().map((e) => e.entryName)
    expect(names).toEqual(['../evil.txt'])
  })

  it.each([['../evil.txt'], ['../../evil.txt'], ['data/../../evil.txt'], ['..\\evil.txt']])(
    '%s 항목은 targetDir 밖에 파일을 만들지 않는다',
    (name) => {
      const zipPath = path.join(root, 'slip.zip')
      fs.writeFileSync(zipPath, buildRawZip([{ name, data: Buffer.from('pwned') }]))

      unpackZip(zipPath, outDir)

      const written = walk(root).filter((p) => p !== zipPath)
      expect(written.length, 'something was extracted').toBeGreaterThan(0)
      for (const p of written) {
        expect(p.startsWith(outDir + path.sep), `escaped targetDir: ${p}`).toBe(true)
      }
      expect(fs.existsSync(path.join(root, 'evil.txt'))).toBe(false)
      expect(fs.existsSync(path.join(os.tmpdir(), 'evil.txt'))).toBe(false)
    }
  )

  it('정상 항목은 그대로 풀린다', () => {
    const zipPath = path.join(root, 'ok.zip')
    fs.writeFileSync(
      zipPath,
      buildRawZip([
        { name: 'manifest.json', data: Buffer.from('{}') },
        { name: 'data/notes.json', data: Buffer.from('[]') }
      ])
    )
    unpackZip(zipPath, outDir)
    expect(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf8')).toBe('{}')
    expect(fs.readFileSync(path.join(outDir, 'data', 'notes.json'), 'utf8')).toBe('[]')
  })
})
