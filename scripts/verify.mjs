/**
 * Run every static check for this plugin and summarise the result.
 *
 * None of these start the app, enable the bundle, or touch the profile: they
 * import the Host half in a child process, use the real Typert package and the
 * real Desktop resolver, and exercise the same calls the panel and the tool make.
 *
 * Checks that need the local DSH Desktop installation print `SKIP …` and are
 * reported as skipped instead of failing, so the suite also runs on a machine
 * that only has the source checkout.
 *
 * Run: node scripts/verify.mjs
 */
import { execFileSync } from 'node:child_process'
import { ROOT } from './lib/env.mjs'

// The generated copies in .selftest/ are staged once, before any check imports them.
execFileSync(process.execPath, [`${ROOT}/.selftest/prepare.mjs`], { stdio: 'pipe', cwd: ROOT })

const STEPS = [
  // Must run before the build step: the build always succeeds, so only a
  // comparison against the committed bundle catches a stale `lib/client.js`.
  ['Client bundle matches its sources', 'scripts/check-client-fresh.mjs'],
  ['build the Client half', 'scripts/build-client.mjs'],
  ['Host syntax', null, 'lib/index.js'],
  ['Client syntax', null, 'lib/client.js'],
  ['Host invariants', 'scripts/check-host-invariants.mjs'],
  // The tool schema is shipped to the model provider unchanged, so a malformed
  // one kills every turn that carries the tool ("Invalid schema for function
  // 'novel'"). Validate it the way the provider does.
  ['Tool JSON Schema', 'scripts/check-tool-schema.mjs'],
  // The step that catches activation bugs: the earlier offline simulations all
  // passed while the real Host could not load at all, because none of them used
  // a real Cordis Context.
  ['Host activation (real Cordis Context)', 'scripts/check-host-activation.mjs'],
  ['Host mount/unmount lifecycle', 'scripts/check-host-lifecycle.mjs'],
  // Renders the Client half with a minimal React and a fake page context: the
  // only step that can catch a panel that builds fine and still shows nothing.
  ['Panel render (Client, no DOM)', 'scripts/check-panel-render.mjs'],
  ['Client ↔ theme tokens', 'scripts/audit-css.mjs'],
  // A guard that can never fail is not a guard: prove the CSS auditor rejects
  // the invisible-label rule that motivated it.
  ['CSS audit self-test', 'scripts/self-check-css-audit.mjs'],
  ['Remote contract (real Typert)', 'scripts/check-remote-contract.mjs'],
  ['Module resolution (real Desktop resolver)', 'scripts/check-resolution.mjs'],
  ['Shared validator', '.selftest/normalize.mjs'],
  ['Host self-test', '.selftest/run.mjs'],
  ['Panel simulation', 'scripts/simulate-panel.mjs'],
  ['Tool action simulation', 'scripts/simulate-tool.mjs'],
]

const results = []

for (const [label, script, file] of STEPS) {
  const started = Date.now()
  try {
    if (file !== undefined) {
      execFileSync(process.execPath, ['--check', `${ROOT}/${file}`], { stdio: 'pipe' })
      results.push({ ok: true, skipped: false, label, ms: Date.now() - started, output: '' })
      continue
    }
    const stdout = execFileSync(process.execPath, [`${ROOT}/${script}`], { stdio: 'pipe', cwd: ROOT }).toString()
    const skipped = stdout.trimStart().startsWith('SKIP')
    results.push({ ok: true, skipped, label, ms: Date.now() - started, output: stdout })
  } catch (error) {
    const output = String(error.stdout ?? '') + String(error.stderr ?? '')
    results.push({ ok: false, skipped: false, label, ms: Date.now() - started, output })
  }
}

const failures = results.filter((result) => !result.ok).length
let skipped = 0

console.log('')
for (const result of results) {
  if (result.ok && result.skipped) skipped += 1
  const status = result.ok ? (result.skipped ? 'SKIP' : 'PASS') : 'FAIL'
  console.log(`${status}  ${result.label}  (${result.ms} ms)`)
  if (!result.ok && result.output) {
    for (const line of result.output.split('\n').slice(-12)) console.log(`      ${line}`)
  }
}
if (skipped > 0) {
  console.log(`\n${skipped} check(s) skipped: the local DSH Desktop installation was not found (set DSH_HOME / DSH_APP_ROOT to enable them).`)
}
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
