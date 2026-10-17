/**
 * Fail when `lib/client.js` is not the exact output of `state.js` + `client.js.tpl`.
 *
 * `verify` used to "build the Client half" by regenerating the bundle, which
 * always succeeds: a stale `client.js` was silently replaced and the committed
 * file could drift from its sources without any check noticing. This step
 * compares before the build step runs, so drift fails the suite instead of
 * being papered over.
 *
 * Run: node scripts/check-client-fresh.mjs
 */
import { readFileSync } from 'node:fs'
import { renderClient } from './build-client.mjs'
import { ROOT } from './lib/env.mjs'

const expected = renderClient()
const actual = readFileSync(`${ROOT}/lib/client.js`, 'utf8')

if (actual === expected) {
  console.log(`ok   lib/client.js matches its sources (${actual.length} bytes)`)
  process.exit(0)
}

// Report the first differing line: that is usually the helper that changed in
// `state.js` without the bundle being rebuilt.
const expectedLines = expected.split('\n')
const actualLines = actual.split('\n')
let first = 0
while (first < expectedLines.length && first < actualLines.length && expectedLines[first] === actualLines[first]) first += 1
console.error(`FAIL lib/client.js is stale: rebuild it with "node scripts/build-client.mjs"`)
console.error(`     first difference at line ${first + 1}:`)
console.error(`     expected: ${JSON.stringify(expectedLines[first] ?? '<end of file>')}`)
console.error(`     on disk : ${JSON.stringify(actualLines[first] ?? '<end of file>')}`)
process.exit(1)
