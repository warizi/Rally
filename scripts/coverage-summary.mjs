#!/usr/bin/env node
/**
 * coverage/{node,web}/coverage-summary.json 을 읽어 콘솔 + markdown 표 출력.
 * CI에서 $GITHUB_STEP_SUMMARY 에 리다이렉트하면 PR 페이지에 표시됨.
 */
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

function summarize(label, jsonPath) {
  const full = path.join(ROOT, jsonPath)
  if (!existsSync(full)) {
    console.log(`${label}: (no coverage)`)
    return null
  }
  const data = JSON.parse(readFileSync(full, 'utf-8'))
  const total = data.total
  const fmt = (m) => `${m.pct.toFixed(1)}% (${m.covered}/${m.total})`
  console.log(`${label}:`)
  console.log(`  lines      ${fmt(total.lines)}`)
  console.log(`  functions  ${fmt(total.functions)}`)
  console.log(`  branches   ${fmt(total.branches)}`)
  console.log(`  statements ${fmt(total.statements)}`)
  return total
}

console.log('=== Coverage Summary ===')
const node = summarize('Node (main + preload)', 'coverage/node/coverage-summary.json')
const web = summarize('Web (renderer)', 'coverage/web/coverage-summary.json')

console.log('\n=== Markdown ===')
console.log('| Area | Lines | Functions | Branches | Statements |')
console.log('|---|---|---|---|---|')
if (node) {
  console.log(
    `| Node | ${node.lines.pct.toFixed(1)}% | ${node.functions.pct.toFixed(1)}% | ${node.branches.pct.toFixed(1)}% | ${node.statements.pct.toFixed(1)}% |`
  )
}
if (web) {
  console.log(
    `| Web | ${web.lines.pct.toFixed(1)}% | ${web.functions.pct.toFixed(1)}% | ${web.branches.pct.toFixed(1)}% | ${web.statements.pct.toFixed(1)}% |`
  )
}
