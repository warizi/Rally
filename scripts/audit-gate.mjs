#!/usr/bin/env node
/**
 * npm audit CI 게이트.
 *
 * `npm audit --json` 결과를 임계값(기본 high) 이상 항목만 추려 실패시킨다.
 * 잔여 예외는 .audit-allowlist.json 에 명시 — 항목마다 사유 + 추가일 + 만료일이 필수이고,
 * 만료일이 지나면 예외가 자동으로 무효화되어 게이트가 다시 빨간불이 된다.
 * (만료일 없는 예외는 결국 영구 예외가 된다는 전제. 최대 유예는 MAX_ALLOW_DAYS.)
 *
 * 사용:
 *   node scripts/audit-gate.mjs                    # prod(--omit=dev) · high 이상 차단
 *   node scripts/audit-gate.mjs --include-dev      # devDependencies 포함 — CI 게이트(npm run audit:gate)가 이 모드
 *   node scripts/audit-gate.mjs --report-only      # 출력만, exit 0
 *   node scripts/audit-gate.mjs --threshold=moderate
 *   node scripts/audit-gate.mjs --input=audit.json --allowlist=allow.json   # 테스트/재현용
 *
 * 종료 코드: 0 통과 · 1 차단(취약점 또는 allowlist 형식/만료 오류) · 2 npm audit 실행 실패
 *
 * npm audit 은 lockfile 만으로 동작한다 — CI job 에서 node_modules 설치가 필요 없다.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const SEVERITY_RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 }
const MAX_ALLOW_DAYS = 180
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// ---------------------------------------------------------------------------
// 인자
// ---------------------------------------------------------------------------
const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const opt = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : dflt
}

const includeDev = flag('include-dev')
const reportOnly = flag('report-only')
const threshold = opt('threshold', 'high')
const inputPath = opt('input', null)
const allowlistPath = opt('allowlist', path.join(ROOT, '.audit-allowlist.json'))
const today = opt('today', new Date().toISOString().slice(0, 10))

if (!(threshold in SEVERITY_RANK)) {
  console.error(`✗ unknown threshold: ${threshold}`)
  process.exit(2)
}

// ---------------------------------------------------------------------------
// 입력: npm audit --json
// ---------------------------------------------------------------------------
function loadAudit() {
  if (inputPath) return JSON.parse(readFileSync(inputPath, 'utf-8'))
  const npmArgs = ['audit', '--json']
  if (!includeDev) npmArgs.push('--omit=dev')
  const res = spawnSync('npm', npmArgs, {
    cwd: ROOT,
    encoding: 'utf-8',
    shell: process.platform === 'win32'
  })
  // npm audit 은 취약점이 있으면 exit 1 이지만 stdout 에 JSON 을 낸다. stdout 이 비면 실행 실패.
  if (!res.stdout || !res.stdout.trim()) {
    console.error('✗ npm audit produced no output')
    if (res.stderr) console.error(res.stderr)
    process.exit(2)
  }
  try {
    return JSON.parse(res.stdout)
  } catch {
    console.error('✗ npm audit output is not JSON:')
    console.error(res.stdout.slice(0, 2000))
    process.exit(2)
  }
}

// ---------------------------------------------------------------------------
// allowlist 검증
// ---------------------------------------------------------------------------
function daysBetween(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
}

function loadAllowlist() {
  if (!existsSync(allowlistPath)) return { entries: [], errors: [] }
  const raw = JSON.parse(readFileSync(allowlistPath, 'utf-8'))
  const entries = Array.isArray(raw) ? raw : (raw.entries ?? [])
  const errors = []
  entries.forEach((e, i) => {
    const where = `allowlist[${i}]${e?.package ? ` (${e.package})` : ''}`
    if (!e || typeof e !== 'object') return errors.push(`${where}: not an object`)
    if (!e.package) errors.push(`${where}: "package" required`)
    if (!e.reason || String(e.reason).trim().length < 10)
      errors.push(`${where}: "reason" required (>= 10 chars — why can't this be fixed now?)`)
    for (const k of ['addedAt', 'expires']) {
      if (!e[k]) errors.push(`${where}: "${k}" required (YYYY-MM-DD)`)
      else if (!DATE_RE.test(e[k]) || Number.isNaN(Date.parse(e[k])))
        errors.push(`${where}: "${k}" must be YYYY-MM-DD`)
    }
    if (e.addedAt && e.expires && DATE_RE.test(e.addedAt) && DATE_RE.test(e.expires)) {
      const span = daysBetween(e.addedAt, e.expires)
      if (span <= 0) errors.push(`${where}: "expires" must be after "addedAt"`)
      else if (span > MAX_ALLOW_DAYS)
        errors.push(
          `${where}: exception span ${span}d exceeds ${MAX_ALLOW_DAYS}d — re-add with a fresh review instead`
        )
    }
  })
  return { entries, errors }
}

function isExpired(entry) {
  return entry.expires < today
}

function advisoryIds(vuln) {
  const ids = new Set()
  for (const v of vuln.via ?? []) {
    if (typeof v === 'object' && v.url) {
      const m = /GHSA-[\w-]+/.exec(v.url)
      if (m) ids.add(m[0])
    }
  }
  return ids
}

function matchesAllow(entry, name, vuln) {
  if (entry.package !== name) return false
  if (entry.advisory && !advisoryIds(vuln).has(entry.advisory)) return false
  return true
}

// ---------------------------------------------------------------------------
// 평가
// ---------------------------------------------------------------------------
const audit = loadAudit()
const { entries: allowlist, errors: allowErrors } = loadAllowlist()
const vulns = audit.vulnerabilities ?? {}
const scope = includeDev ? 'prod + dev' : 'prod (--omit=dev)'

const blocked = []
const allowed = []
const below = []
const usedEntries = new Set()

for (const [name, v] of Object.entries(vulns)) {
  const rank = SEVERITY_RANK[v.severity] ?? -1
  if (rank < SEVERITY_RANK[threshold]) {
    below.push({ name, v })
    continue
  }
  const hit = allowlist.find((e) => matchesAllow(e, name, v) && !isExpired(e))
  if (hit) {
    usedEntries.add(hit)
    allowed.push({ name, v, entry: hit })
  } else {
    const expiredHit = allowlist.find((e) => matchesAllow(e, name, v) && isExpired(e))
    blocked.push({ name, v, expired: expiredHit })
  }
}

const unused = allowlist.filter((e) => !usedEntries.has(e) && !isExpired(e))
const expiredUnused = allowlist.filter((e) => !usedEntries.has(e) && isExpired(e))

// ---------------------------------------------------------------------------
// 출력
// ---------------------------------------------------------------------------
const fixHint = (v) =>
  v.fixAvailable === true
    ? 'fix: npm audit fix'
    : v.fixAvailable && typeof v.fixAvailable === 'object'
      ? `fix: ${v.fixAvailable.name}@${v.fixAvailable.version}${v.fixAvailable.isSemVerMajor ? ' (major)' : ''}`
      : 'fix: none'

const isCI = !!process.env.GITHUB_ACTIONS
const annotate = (level, msg) => (isCI ? console.log(`::${level}::${msg}`) : undefined)

const meta = audit.metadata?.vulnerabilities ?? {}
console.log(`npm audit gate — scope: ${scope} · threshold: ${threshold} · today: ${today}`)
console.log(
  `  total: ${meta.total ?? Object.keys(vulns).length}  (critical ${meta.critical ?? '?'} / high ${meta.high ?? '?'} / moderate ${meta.moderate ?? '?'} / low ${meta.low ?? '?'})`
)

if (allowErrors.length) {
  console.log('\n✗ allowlist errors:')
  for (const e of allowErrors) {
    console.log(`  - ${e}`)
    annotate('error', `audit allowlist: ${e}`)
  }
}

if (blocked.length) {
  console.log(
    `\n✗ ${blocked.length} vulnerability(ies) at or above "${threshold}" not covered by allowlist:`
  )
  for (const { name, v, expired } of blocked) {
    const ids = [...advisoryIds(v)].join(', ')
    const tail = expired ? `  ← allowlist entry EXPIRED ${expired.expires}` : ''
    console.log(
      `  - ${name}  [${v.severity}]  ${v.range}  ${fixHint(v)}${ids ? `  ${ids}` : ''}${tail}`
    )
    annotate(
      reportOnly ? 'warning' : 'error',
      `${name} [${v.severity}] ${v.range} — ${fixHint(v)}${tail ? ' (allowlist expired)' : ''}`
    )
  }
}

if (allowed.length) {
  console.log(`\n○ ${allowed.length} allowlisted (expiring):`)
  for (const { name, v, entry } of allowed) {
    console.log(`  - ${name}  [${v.severity}]  until ${entry.expires} — ${entry.reason}`)
    annotate(
      'warning',
      `${name} [${v.severity}] allowlisted until ${entry.expires}: ${entry.reason}`
    )
  }
}

if (below.length) {
  console.log(`\n· ${below.length} below threshold (not blocking):`)
  for (const { name, v } of below) console.log(`  - ${name}  [${v.severity}]  ${fixHint(v)}`)
}

if (unused.length) {
  console.log(`\n· ${unused.length} allowlist entry(ies) no longer match anything — remove them:`)
  for (const e of unused) console.log(`  - ${e.package}${e.advisory ? ` ${e.advisory}` : ''}`)
}
if (expiredUnused.length) {
  console.log(
    `\n· ${expiredUnused.length} expired allowlist entry(ies) with no matching vuln — remove them:`
  )
  for (const e of expiredUnused) console.log(`  - ${e.package} (expired ${e.expires})`)
}

const fail = allowErrors.length > 0 || blocked.length > 0
if (fail && reportOnly) {
  console.log('\n! report-only — not failing the build')
  process.exit(0)
}
if (fail) {
  console.log('\n✗ audit gate FAILED')
  process.exit(1)
}
console.log(`\n✓ audit gate passed (${allowed.length} allowlisted)`)
