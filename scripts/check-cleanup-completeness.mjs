#!/usr/bin/env node
/**
 * src/main/db/schema/*.ts 의 모든 sqliteTable export가
 * src/main/__tests__/setup.ts 의 TABLES_FK_ORDER 배열에 포함되어 있는지 검증.
 *
 * 새 테이블 추가 후 cleanup 누락을 CI에서 자동 차단하기 위한 가드.
 */
import { readFileSync, readdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SCHEMA_DIR = path.join(ROOT, 'src/main/db/schema')
const SETUP_PATH = path.join(ROOT, 'src/main/__tests__/setup.ts')

const tables = []
for (const file of readdirSync(SCHEMA_DIR)) {
  if (file === 'index.ts') continue
  if (!file.endsWith('.ts')) continue
  const src = readFileSync(path.join(SCHEMA_DIR, file), 'utf-8')
  const match = src.match(/^export const (\w+) = sqliteTable/m)
  if (match) tables.push(match[1])
}

const setupSrc = readFileSync(SETUP_PATH, 'utf-8')
const missing = tables.filter((t) => !setupSrc.includes(`'${t}'`))

if (missing.length > 0) {
  console.error(`✗ TABLES_FK_ORDER 누락: ${missing.join(', ')}`)
  console.error('  src/main/__tests__/setup.ts 의 TABLES_FK_ORDER 배열에 추가하세요.')
  process.exit(1)
}

console.log(`✓ 전체 ${tables.length}개 테이블이 cleanup 순서에 포함되어 있음`)
