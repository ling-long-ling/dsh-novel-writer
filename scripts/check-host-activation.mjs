/**
 * End-to-end Host activation against a REAL Cordis Context.
 *
 * The earlier failures were invisible to the offline simulations because none of
 * them used a real Context: `ctx.Service` only throws inside one. This mounts
 * the actual Host half with stub services and asserts that activation completes,
 * that `ctx.novels` resolves, and that the Gateway can discover the Remote
 * methods — the exact things the fatal load failure broke.
 *
 * Run: node scripts/check-host-activation.mjs
 */
import { packageFile, repoUrl, skip } from './lib/env.mjs'

const CORDIS = packageFile('@deepseek-ai/cordis', 'lib/index.js')
if (CORDIS === null) skip('@deepseek-ai/cordis not found — set DSH_HOME / DSH_APP_ROOT or install DSH Desktop')
const TYPERT = packageFile('@deepseek-ai/dsh-typert-protocol', 'lib/index.js')
if (TYPERT === null) skip('@deepseek-ai/dsh-typert-protocol not found — set DSH_HOME / DSH_APP_ROOT or install DSH Desktop')
const HOST = repoUrl('lib/index.js')

const { Context } = await import(CORDIS)
const typert = await import(TYPERT)

let failures = 0
function check(label, ok, detail) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail === undefined ? '' : ` — ${detail}`}`)
  if (!ok) failures += 1
}

// --- stub services the Host half injects -----------------------------------
const tables = new Map()
function makeTable() {
  const store = new Map()
  tables.set('projects', store)
  return {
    get: (key) => store.get(key),
    entries: () => [...store.entries()],
    keys: () => [...store.keys()],
    get size() {
      return store.size
    },
    put: (key, value) => void store.set(key, value),
    update: (key, value) => void store.set(key, value),
    delete: (key) => void store.delete(key),
  }
}
const storageDomain = {
  async open(spec) {
    check('storage domain opened with a name', typeof spec?.name === 'string', spec?.name)
    return {
      table: (name) => makeTable(name),
      close() {},
    }
  },
}
const tools = {
  registered: [],
  register(tool) {
    this.registered.push(tool)
    return () => {}
  },
  schemas() {
    return this.registered
  },
}
const promptSections = []
const systemPrompt = {
  section(section) {
    promptSections.push(section)
    return () => {}
  },
}

const root = new Context()
// Services are provided on the root so the plugin's `inject` is satisfied.
root.provide('storageDomain', storageDomain)
root.provide('tools', tools)
root.provide('systemPrompt', systemPrompt)

const host = await import(HOST)

check('Host half imports', typeof host.apply === 'function')
check(
  'inject declares only real services',
  Array.isArray(host.inject) &&
    host.inject.every((name) => ['tools', 'systemPrompt', 'storageDomain'].includes(name)),
  host.inject?.join(','),
)

// --- activate --------------------------------------------------------------
let activationError
root.plugin({ name: 'novel-companion', inject: host.inject, apply: host.apply }, {})

// Let the async storage open + cache refresh settle.
for (let attempt = 0; attempt < 60; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 20))
  if (root.get('novels') !== undefined) break
}
activationError = undefined

const fibers = [...root.registry.values()].flatMap((runtime) => [...runtime.fibers])
const novelFiber = fibers.find((fiber) => fiber.name === 'novel-companion')
check('plugin fiber activated (state 2 = active)', novelFiber?.state === 2, `state=${novelFiber?.state}`)

// --- the service the whole Client half depends on --------------------------
let service
try {
  service = root.novels
} catch (error) {
  activationError = error
}
check('ctx.novels resolves', service !== undefined && activationError === undefined, activationError?.message)

if (service !== undefined) {
  check('service carries typertRemote', service.typertRemote?.serviceKey === 'novels')
  check('typertRemote.namespace is the Remote namespace', service.typertRemote?.namespace === 'novels')
  check('typertRemote.service is the instance', service.typertRemote?.service === service)

  // This is the check that the first fatal bug broke: the Gateway derives the
  // callable method list from the descriptor. Symbol key => empty list => every
  // panel call fails with gateway/invocation-unavailable.
  const discovered = typert.remoteMethods(service)
  const names = (discovered ?? []).map((entry) => entry.method ?? entry)
  check(
    'Gateway discovers all six Remote methods',
    names.length === 6 && ['list', 'get', 'save', 'create', 'importDemo', 'remove'].every((n) => names.includes(n)),
    names.join(','),
  )
  check(
    'every discovered method is callable on the service',
    names.every((name) => typeof service[name] === 'function'),
  )
  check('bindTypertRemote accepts the service', typeof typert.bindTypertRemote(service) === 'object')
}

check('novel tool registered', tools.registered.length === 1, tools.registered.map((t) => t.name).join(','))
check('prompt section registered', promptSections.length === 1, promptSections.map((s) => s.name).join(','))

// --- a real Remote call round-trips through storage ------------------------
if (service !== undefined) {
  try {
    const created = await service.create('测试小说')
    check('create() writes a project', typeof created?.id === 'string', created?.id)
    const listed = await service.list()
    check('list() sees the new project', Array.isArray(listed) && listed.length === 1)
    const fetched = await service.get(created.id)
    check('get() returns the stored project', fetched?.title === '测试小说')
    await service.save({ ...fetched, premise: '守塔人每夜听见钟声。' })
    const reread = await service.get(created.id)
    check('save() persists an edit', reread?.premise === '守塔人每夜听见钟声。')
  } catch (error) {
    check('Remote calls round-trip', false, error?.message)
  }
}

console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
