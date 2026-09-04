#!/usr/bin/env node
/**
 * Electron 보안 스캔 CI 게이트 (electronegativity).
 *
 * CLI 텍스트 출력을 grep 하던 방식은 양방향으로 깨진다 — 경고 문구에 같은 토큰이 들어가면 오탐,
 * 출력 포맷이 바뀌면 조용히 0 을 센다 (fsd-boundary-check 에서 실제로 겪음). CSV/SARIF 파일 출력도
 * 못 쓴다: CSV 는 헤더/행을 동시에 비동기로 써서 약 1/3 확률로 깨지고(dist/util/file.js),
 * SARIF 는 severity 를 버린다. 그래서 runner 를 직접 호출해 issue 객체를 받는다.
 *
 * 실측으로 드러난 함정 두 가지:
 * - CLI 의 `-i` 는 반복해도 마지막 값만 쓴다 (commander 단일 옵션). `-i src/main -i src/preload` 는
 *   preload 만 스캔했다 — 2026-05 도입 이후 src/main 은 한 번도 게이트를 지나지 않았다.
 *   여기서는 입력마다 runner 를 따로 돌려 합친다.
 * - Electron 버전을 못 찾으면 v0.1.0 기본값으로 판정한다 (remote 모듈 등 오탐). package.json 의
 *   electron 버전을 electronVersionOverride 로 넘긴다.
 *
 * 사용:
 *   node scripts/security-gate.mjs                    # src/main + src/preload, HIGH 발견 시 exit 1
 *   node scripts/security-gate.mjs --input=issues.json # 스캔 대신 issue 배열(JSON)을 읽어 판정 (테스트용)
 *   node scripts/security-gate.mjs --threshold=medium
 *
 * 제외 (둘 다 window-security.test.ts 가 will-navigate / setWindowOpenHandler 정책을 강제한다):
 * - LIMIT_NAVIGATION_GLOBAL_CHECK — free 버전 false positive
 * - LIMIT_NAVIGATION_JS_CHECK — 내비게이션 제한 핸들러 자체에 "수동 검토" 를 붙이는 TENTATIVE 항목
 *
 * 종료 코드: 0 통과 · 1 임계값 이상 finding · 2 스캐너 실행/입력 파싱 실패
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const require = createRequire(import.meta.url)

const SEVERITY_RANK = { INFORMATIONAL: 0, LOW: 1, MEDIUM: 2, HIGH: 3 }
const BLOCKING_CONFIDENCE = new Set(['CERTAIN', 'FIRM', 'TENTATIVE'])
const SCAN_INPUTS = ['src/main', 'src/preload']
const EXCLUDED_CHECKS = ['LimitNavigationGlobalCheck', 'LimitNavigationJsCheck']

const args = process.argv.slice(2)
const opt = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : dflt
}
const inputPath = opt('input', null)
const threshold = opt('threshold', 'high').toUpperCase()
if (!(threshold in SEVERITY_RANK)) {
  console.error(`✗ unknown threshold: ${threshold}`)
  process.exit(2)
}

/** runner 의 issue 객체를 판정에 필요한 평면 구조로 정규화한다. */
function normalize(issue) {
  return {
    id: issue.id,
    severity: issue.severity?.name ?? issue.severity,
    confidence: issue.confidence?.name ?? issue.confidence,
    file: issue.file ? path.relative(ROOT, issue.file) : 'N/A',
    line: issue.location?.line ?? 0,
    column: issue.location?.column ?? 0,
    description: issue.description ?? ''
  }
}

async function scan() {
  const run = require('@doyensec/electronegativity')
  const electronVersion = require('electron/package.json').version
  const excludeFromScan = EXCLUDED_CHECKS.map((c) => c.toLowerCase())
  const seen = new Set()
  const issues = []
  const errors = []
  for (const input of SCAN_INPUTS) {
    const res = await run(
      {
        input: path.resolve(ROOT, input),
        customScan: [],
        excludeFromScan,
        parserPlugins: [],
        isVerbose: false,
        electronVersionOverride: electronVersion
      },
      false
    )
    errors.push(...(res.errors ?? []))
    for (const raw of res.issues ?? []) {
      const issue = normalize(raw)
      // GLOBAL 체크는 입력마다 반복 보고되므로 동일 finding 은 한 번만
      const key = `${issue.id}|${issue.file}|${issue.line}:${issue.column}`
      if (seen.has(key)) continue
      seen.add(key)
      issues.push(issue)
    }
  }
  return { issues, errors, electronVersion }
}

function validate(issues) {
  if (!Array.isArray(issues)) throw new Error('issues must be an array')
  for (const i of issues) {
    if (!i.id || !(i.severity in SEVERITY_RANK) || typeof i.confidence !== 'string') {
      throw new Error(`malformed issue: ${JSON.stringify(i).slice(0, 120)}`)
    }
  }
  return issues
}

let issues
let errors = []
let electronVersion = null
try {
  if (inputPath) {
    issues = validate(JSON.parse(readFileSync(inputPath, 'utf-8')).map(normalize))
  } else {
    ;({ issues, errors, electronVersion } = await scan())
    validate(issues)
  }
} catch (err) {
  console.error(`✗ security scan failed: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(2)
}

const isCI = !!process.env.GITHUB_ACTIONS
const counts = {}
for (const i of issues) counts[i.severity] = (counts[i.severity] ?? 0) + 1
console.log(
  `electron security gate — threshold: ${threshold} · inputs: ${SCAN_INPUTS.join(', ')}` +
    (electronVersion ? ` · electron ${electronVersion}` : '') +
    ` · findings: ${issues.length}`
)
console.log(
  `  ${Object.keys(SEVERITY_RANK)
    .map((s) => `${s} ${counts[s] ?? 0}`)
    .join(' / ')}`
)
if (errors.length) {
  console.log(`\n! ${errors.length} file(s) could not be parsed by the scanner:`)
  for (const e of errors.slice(0, 10))
    console.log(`  - ${typeof e === 'string' ? e : JSON.stringify(e).slice(0, 160)}`)
}

const fmt = (i) => `${i.id}  [${i.severity} / ${i.confidence}]  ${i.file}:${i.line}:${i.column}`
const blocking = issues.filter(
  (i) =>
    SEVERITY_RANK[i.severity] >= SEVERITY_RANK[threshold] && BLOCKING_CONFIDENCE.has(i.confidence)
)
const below = issues.filter((i) => !blocking.includes(i))

if (below.length) {
  console.log(`\n· ${below.length} below threshold (not blocking):`)
  for (const i of below) console.log(`  - ${fmt(i)}`)
}
if (blocking.length) {
  console.log(`\n✗ ${blocking.length} finding(s) at or above ${threshold}:`)
  for (const i of blocking) {
    console.log(`  - ${fmt(i)}  ${i.description}`)
    if (isCI)
      console.log(
        `::error file=${i.file},line=${i.line}::${i.id} [${i.severity}/${i.confidence}] ${i.description}`
      )
  }
  console.log('\n✗ electron security gate FAILED')
  process.exit(1)
}
console.log('\n✓ electron security gate passed')
