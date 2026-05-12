#!/usr/bin/env node
/**
 * Renderer 번들 크기 측정 — raw / gzip / brotli.
 *
 * 성능-1 Phase 1 — `npm run build:size` 로 호출.
 * baseline 기록 후 추가 PR 에서 -30% 검증 기준으로 사용.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { gzipSync, brotliCompressSync } from 'node:zlib'
import { join } from 'node:path'

const ASSETS_DIR = 'out/renderer/assets'

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function measure() {
  const files = readdirSync(ASSETS_DIR).filter((f) => f.endsWith('.js'))

  const perFile = files.map((f) => {
    const buf = readFileSync(join(ASSETS_DIR, f))
    return {
      file: f,
      raw: buf.length,
      gzip: gzipSync(buf).length,
      brotli: brotliCompressSync(buf).length
    }
  })

  perFile.sort((a, b) => b.gzip - a.gzip)

  const totals = perFile.reduce(
    (acc, x) => {
      acc.raw += x.raw
      acc.gzip += x.gzip
      acc.brotli += x.brotli
      return acc
    },
    { raw: 0, gzip: 0, brotli: 0 }
  )

  // Console 출력
  console.log('# Renderer bundle size')
  console.log(`Files: ${perFile.length}`)
  console.log(`Total raw:    ${formatBytes(totals.raw)} (${totals.raw} bytes)`)
  console.log(`Total gzip:   ${formatBytes(totals.gzip)} (${totals.gzip} bytes)`)
  console.log(`Total brotli: ${formatBytes(totals.brotli)} (${totals.brotli} bytes)`)
  console.log()
  console.log('## Top 15 (by gzip)')
  console.log('file | raw | gzip | brotli')
  console.log('---|---|---|---')
  for (const x of perFile.slice(0, 15)) {
    console.log(
      `${x.file} | ${formatBytes(x.raw)} | ${formatBytes(x.gzip)} | ${formatBytes(x.brotli)}`
    )
  }

  // JSON 출력 (CI / 자동 비교용)
  if (process.env.JSON === '1') {
    console.log('\n## JSON')
    console.log(JSON.stringify({ files: perFile.length, totals, perFile }, null, 2))
  }
}

measure()
