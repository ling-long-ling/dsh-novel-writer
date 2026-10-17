/**
 * Build the stubbed copy of the Host half used by `.selftest/run.mjs`: plain
 * Node has no Harness services, so the Cordis `Service` base and the storage
 * table are replaced with in-memory stand-ins. Only the pieces under test are
 * needed; the file is generated, never installed.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { ROOT } from '../scripts/lib/env.mjs'
let source = readFileSync(`${ROOT}/lib/index.js`, 'utf8')

source = source.replace("require('./state.js')", "require('./state.mjs')")
source = source.replace("require('./demo.js')", "require('./demo.mjs')")
writeFileSync(`${ROOT}/.selftest/index.mjs`, source, 'utf8')
writeFileSync(`${ROOT}/.selftest/state.mjs`, readFileSync(`${ROOT}/lib/state.js`, 'utf8'), 'utf8')
writeFileSync(`${ROOT}/.selftest/demo.mjs`, readFileSync(`${ROOT}/lib/demo.js`, 'utf8'), 'utf8')
console.log('stubbed')
