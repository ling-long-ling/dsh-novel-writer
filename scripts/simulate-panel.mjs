/**
 * End-to-end simulation of the Client → Gateway → Remote → storage path.
 *
 * It reproduces what the Gateway does before dispatch (descriptor discovery,
 * exact-argument validation, binding validation) using the real Typert package
 * and the plugin's real service class, then drives the same call sequence the
 * panel makes on first open and on every edit.
 *
 * Run: node scripts/simulate-panel.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { ROOT, packageFile, repoUrl, skip } from './lib/env.mjs'

const typertFile = packageFile('@deepseek-ai/dsh-typert-protocol', 'lib/index.js')
if (typertFile === null) skip('@deepseek-ai/dsh-typert-protocol not found — set DSH_HOME / DSH_APP_ROOT or install DSH Desktop')
const PROTOCOL = typertFile

// Stage the host module with extension-resolved relative specifiers.
writeFileSync(`${ROOT}/.selftest/state.mjs`, readFileSync(`${ROOT}/lib/state.js`, 'utf8'))
writeFileSync(`${ROOT}/.selftest/demo.mjs`, readFileSync(`${ROOT}/lib/demo.js`, 'utf8'))
const staged = readFileSync(`${ROOT}/lib/index.js`, 'utf8')
  .replace("require('./state.js')", "require('./state.mjs')")
  .replace("require('./demo.js')", "require('./demo.mjs')")
writeFileSync(`${ROOT}/.selftest/sim-index.mjs`, staged, 'utf8')

const { remoteMethods, isTypertRemoteSegment } = await import(PROTOCOL)
const host = await import(repoUrl('.selftest/sim-index.mjs'))

let failures = 0
const check = (label, condition, detail) => {
  if (condition) console.log(`ok   ${label}`)
  else {
    failures += 1
    console.error(`FAIL ${label}${detail === undefined ? '' : ` — ${detail}`}`)
  }
}

/** An in-memory storage table with the same surface as the real one. */
function memoryTable() {
  const rows = new Map()
  return {
    get: (key) => rows.get(key),
    entries: () => rows.entries(),
    keys: () => rows.keys(),
    get size() {
      return rows.size
    },
    async put(key, value) {
      rows.set(key, JSON.parse(JSON.stringify(value)))
    },
    async update(key, mutator) {
      const next = mutator(rows.get(key))
      rows.set(key, JSON.parse(JSON.stringify(next)))
      return next
    },
    async delete(key) {
      return rows.delete(key)
    },
  }
}

// Build the service exactly as apply() does, against an in-memory store.
const table = memoryTable()
const cache = new host.ProjectCache(new host.ProjectStore(table))
await cache.refresh()
const service = host.__createNovelServiceForTest(cache)

// ---- What the Gateway does before dispatch -------------------------------
const methods = remoteMethods(service)
check('gateway discovers every Remote method', methods.length === 6, `${methods.length}`)
check(
  'all methods are direct unary',
  methods.every((entry) => entry.invocation.kind === 'direct'),
)
check('namespace is a valid RPC segment', isTypertRemoteSegment(service.typertRemote.namespace))
check(
  'binding is self-consistent',
  service.typertRemote.service === service && service.typertRemote.serviceKey === service.typertRemote.namespace,
)

/** Validate args the way `assertExactArguments` does for an SRC descriptor. */
function assertExact(name, args) {
  const implementation = Object.getPrototypeOf(service)[name]
  const source = Function.prototype.toString.call(implementation)
  const open = source.indexOf('(')
  const close = source.indexOf(')', open + 1)
  const expected = source
    .slice(open + 1, close)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  const extra = Object.keys(args).filter((key) => !expected.includes(key))
  const missing = expected.filter((key) => !Object.hasOwn(args, key))
  if (extra.length > 0 || missing.length > 0) {
    throw new Error(`gateway/arguments-invalid: extra=[${extra}] missing=[${missing}]`)
  }
}

// ---- The panel's first-open sequence -------------------------------------
const empty = await service.list()
check('list on an empty store returns []', Array.isArray(empty) && empty.length === 0)

const demo = await service.importDemo()
check('importDemo returns a document', demo && typeof demo.id === 'string')
check('demo id matches the panel key grammar', /^[a-z0-9][a-z0-9-]{0,63}$/.test(demo.id), demo.id)
check('demo carries six blocks', demo.blocks.length === 6)
check('demo carries two chapters', demo.chapters.length === 2)
check('demo is persisted', (await service.list()).length === 1)
check('get returns the same document', (await service.get(demo.id))?.title === demo.title)

const created = await service.create('测试新书')
check('create returns a document', created && created.id !== demo.id)
check('create uses the requested title', created.title === '测试新书', created.title)
assertExact('create', { title: 'ok' })

// ---- The panel's edit + autosave sequence --------------------------------
const loaded = await service.get(created.id)
loaded.blocks.find((block) => block.id === 'core').content = '一句话内核'
loaded.blocks.find((block) => block.id === 'core').status = 'final'
assertExact('save', { value: loaded })
const saved = await service.save(loaded)
check('save keeps the edited block', saved.blocks.find((block) => block.id === 'core').content === '一句话内核')
check('save keeps the block status', saved.blocks.find((block) => block.id === 'core').status === 'final')
check('save writes through to storage', (table.get(created.id)).blocks[0].content === '一句话内核')

// A second save must not duplicate the row. The panel always saves the
// document the Host returned last, because it carries the new revision.
const again = await service.save(saved)
check('repeated saves keep one row', (await service.list()).length === 2)
check('save bumps the revision', again.rev === saved.rev + 1, `${saved.rev} -> ${again.rev}`)

// Whole-document saves make a stale copy dangerous: it would revert whatever
// the agent wrote in the meantime, so the Host must refuse it.
let stale = false
try {
  await service.save(saved)
} catch (error) {
  stale = /已被更新/.test(String(error.message))
}
check('a stale copy is refused instead of reverting storage', stale)
check(
  'the refused save changed nothing',
  (await service.get(created.id))?.rev === again.rev,
  String((await service.get(created.id))?.rev),
)

// Chapters survive a save round-trip.
again.chapters = [
  { id: 'chapter-1', index: 1, title: '开端', status: 'outline', outline: '1. 场景', draft: '', updatedAt: Date.now() },
]
const withChapter = await service.save(again)
check('chapters persist', withChapter.chapters.length === 1 && withChapter.chapters[0].title === '开端')
check('chapter indexes are normalised', withChapter.chapters[0].index === 1)

// ---- Failure paths the panel must survive -------------------------------
let rejected = false
try {
  await service.save({ ...loaded, id: 'INVALID ID!' })
} catch {
  rejected = true
}
check('save rejects an invalid id instead of corrupting storage', rejected)

let badArgs = false
try {
  assertExact('get', {})
} catch {
  badArgs = true
}
check('gateway-style argument validation rejects missing args', badArgs)

await service.remove(created.id)
check('remove drops the document', (await service.list()).every((entry) => entry.id !== created.id))
check('remove leaves the demo intact', (await service.list()).length === 1)

console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
