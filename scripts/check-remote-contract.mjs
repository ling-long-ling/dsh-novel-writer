/**
 * Contract check for the Remote service against the real Typert package.
 *
 * This reproduces exactly what the Gateway does when it dispatches a call:
 *   - `remoteMethods(original)` must list every method the panel calls;
 *   - `readBinding` requires `{ service: <original>, serviceKey, namespace }`;
 *   - `methodParameterNames` reads the marked method off the owning prototype.
 *
 * Run: node scripts/check-remote-contract.mjs
 */
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { ROOT, packageFile, repoUrl, skip } from './lib/env.mjs'

const typertFile = packageFile('@deepseek-ai/dsh-typert-protocol', 'lib/index.js')
if (typertFile === null) skip('@deepseek-ai/dsh-typert-protocol not found — set DSH_HOME / DSH_APP_ROOT or install DSH Desktop')
const PROTOCOL = new URL(typertFile)

// Stage a copy the way `.selftest/prepare.mjs` does, but as CommonJS-friendly ESM.
let source = readFileSync(`${ROOT}/lib/index.js`, 'utf8')
source = source.replace("require('./state.js')", "require('./state.mjs')").replace("require('./demo.js')", "require('./demo.mjs')")
writeFileSync(`${ROOT}/.selftest/contract-index.mjs`, source, 'utf8')
writeFileSync(`${ROOT}/.selftest/state.mjs`, readFileSync(`${ROOT}/lib/state.js`, 'utf8'), 'utf8')
writeFileSync(`${ROOT}/.selftest/demo.mjs`, readFileSync(`${ROOT}/lib/demo.js`, 'utf8'), 'utf8')

const { remoteMethods, isTypertRemoteSegment } = await import(PROTOCOL.href)
const host = await import(repoUrl('.selftest/contract-index.mjs'))
console.log('host exports:', Object.keys(host).join(', '))

// The Gateway's helper symbols (see dsh-api-gateway lib/index.js).
const REMOTE_METHODS = '@deepseek-ai/dsh-typert-protocol/remote-methods'

// Build the service exactly as `apply` does, then check what the Gateway sees.
const original = host.__createNovelServiceForTest({
  refresh: async () => [],
  store: { get: async () => null },
})

const methods = remoteMethods(original)
console.log('remoteMethods:', methods.map((entry) => `${entry.method}:${entry.invocation.kind}`).join(', '))

const expected = ['list', 'get', 'save', 'create', 'importDemo', 'remove']
const missing = expected.filter((name) => !methods.some((entry) => entry.method === name))
const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(original), REMOTE_METHODS)?.value

console.log('descriptor version:', descriptor?.version)
console.log('every descriptor name is a prototype method:', methods.every((entry) => typeof Object.getPrototypeOf(original)[entry.method] === 'function'))
console.log('namespace is an RPC segment:', isTypertRemoteSegment(original.typertRemote.namespace))
console.log(
  'binding is consistent:',
  original.typertRemote.service === original &&
    original.typertRemote.serviceKey === original.typertRemote.namespace,
)
console.log(missing.length === 0 ? 'OK: all panel methods are exposed' : `MISSING METHODS: ${missing.join(', ')}`)

// Parameter names must be readable from the marked prototype methods.
for (const entry of methods) {
  const fn = Object.getPrototypeOf(original)[entry.method]
  const text = Function.prototype.toString.call(fn)
  const open = text.indexOf('(')
  const close = text.indexOf(')', open + 1)
  console.log(`  ${entry.method}(${text.slice(open + 1, close)})`)
}

process.exit(missing.length === 0 ? 0 : 1)
