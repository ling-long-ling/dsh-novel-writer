/**
 * Self-test for `audit-css.mjs`: a guard that never fails is not a guard.
 *
 * Builds two samples around the real stylesheet — one with the original
 * invisible-label rule restored, one clean — and asserts the auditor rejects the
 * first and accepts the second. The audit runs in-process, so this works with
 * no child processes and no temporary files.
 *
 * Run: node scripts/self-check-css-audit.mjs
 */
import { readFileSync } from 'node:fs'

import { ROOT } from './lib/env.mjs'
import { auditCss } from './audit-css.mjs'

const built = readFileSync(`${ROOT}/lib/client.js`, 'utf8')

const GOOD = '.nv-btn[data-primary="true"]{background:transparent;border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);font-weight:600}'
const BAD = '.nv-btn[data-primary="true"]{background:var(--dsw-alias-brand-primary);border-color:transparent;color:var(--dsw-alias-bg-base)}'

if (!built.includes(GOOD)) {
  console.error('FAIL  the current build does not contain the audited primary-button rule')
  process.exit(1)
}

let failures = 0
const check = (label, ok, detail) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail === undefined ? '' : ` — ${detail}`}`)
  if (!ok) failures += 1
}

const clean = auditCss(built)
check('the auditor accepts the current stylesheet', clean.ok, clean.ok ? undefined : clean.report.slice(-3).join(' '))

const broken = auditCss(built.replace(GOOD, BAD))
check('the auditor rejects a background token used as text colour', broken.ok === false)

const brokenReport = broken.report.join('\n')
check(
  'the rejection names the offending token',
  brokenReport.includes('BACKGROUND TOKEN USED AS TEXT COLOUR') && brokenReport.includes('--dsw-alias-bg-base'),
  broken.report.find((line) => line.includes('BACKGROUND TOKEN')) ?? 'no diagnostic line',
)

console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
