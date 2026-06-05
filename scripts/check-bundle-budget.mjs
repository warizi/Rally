#!/usr/bin/env node
/**
 * Renderer 번들 budget 게이트.
 *
 * 초기 로드(메인 청크)와 전체 renderer gzip 상한을 강제한다. 한도 초과 시 fail.
 * PR #315(편집기 스택 codemirror/prosemirror lazy 분리)로 줄인 메인 청크가 다시
 * 비대해지는 회귀를 CI 에서 차단한다.
 *
 * 호출: `npm run check:bundle-budget` (빌드 후). CI bundle-chunks job 에서 실행.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const ASSETS_DIR = 'out/renderer/assets'
const INDEX_HTML = 'out/renderer/index.html'

/** index.html 의 entry script(=메인 청크) 파일명을 추출. 여러 index-*.js 중 진짜 entry 식별. */
function entryChunkName() {
  try {
    const html = readFileSync(INDEX_HTML, 'utf-8')
    const m = html.match(/src="[^"]*\/(index-[^"/]+\.js)"/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

// gzip 바이트 한도. 측정 기준(2026-06): main ~373KB, total ~1.90MB. 헤드룸 포함.
// 한도를 올릴 때는 왜 늘었는지 PR 에 근거를 남긴다.
const BUDGETS = {
  // 앱 시작 시 즉시 로드되는 메인 청크 (index-*.js). 현재 ~373KB.
  mainChunkGzip: 430 * 1024,
  // 전체 renderer gzip 합. 현재 ~1.90MB.
  totalGzip: 2.15 * 1024 * 1024
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)}KB`
}

function main() {
  let files
  try {
    files = readdirSync(ASSETS_DIR).filter((f) => f.endsWith('.js'))
  } catch {
    console.error(`❌ ${ASSETS_DIR} 디렉토리가 없습니다. 먼저 \`npm run build\` 실행.`)
    process.exit(1)
  }

  const mainFile = entryChunkName()
  if (!mainFile) {
    console.error(`❌ ${INDEX_HTML} 에서 entry chunk(index-*.js)를 찾지 못했습니다.`)
    process.exit(1)
  }

  let total = 0
  let mainGzip = 0
  for (const f of files) {
    const gz = gzipSync(readFileSync(join(ASSETS_DIR, f))).length
    total += gz
    if (f === mainFile) mainGzip = gz
  }

  const violations = []
  console.log('# Bundle budget (gzip)')
  const check = (label, actual, budget) => {
    const ok = actual <= budget
    console.log(`${ok ? '✅' : '❌'} ${label}: ${kb(actual)} / 한도 ${kb(budget)}`)
    if (!ok) violations.push(`${label} ${kb(actual)} > 한도 ${kb(budget)}`)
  }
  check(`main chunk (${mainFile})`, mainGzip, BUDGETS.mainChunkGzip)
  check('total gzip', total, BUDGETS.totalGzip)

  if (violations.length > 0) {
    console.error(`\n::error::번들 budget 초과 — ${violations.join('; ')}`)
    console.error(
      '무거운 모듈을 lazy 경계(라우트/다이얼로그) 뒤로 밀거나 manualChunks 를 조정하세요.'
    )
    process.exit(1)
  }
  console.log('\n✅ 모든 budget 통과')
}

main()
