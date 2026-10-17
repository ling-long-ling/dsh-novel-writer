/**
 * Lifecycle check: mounting and unmounting the Host half must be clean.
 *
 * A profile bundle that throws during activation takes the whole DSH Host down
 * with it (`DSH Host exited (1)`), so every release path is worth asserting: the
 * storage domain must close, the Remote service must unregister, the tool must
 * disappear, and nothing may throw while unwinding.
 *
 * Run: node scripts/check-host-lifecycle.mjs
 */
import { packageFile, repoUrl, skip } from './lib/env.mjs'

const CORDIS = packageFile('@deepseek-ai/cordis', 'lib/index.js')
if (CORDIS === null) skip('@deepseek-ai/cordis not found — set DSH_HOME / DSH_APP_ROOT or install DSH Desktop')
const HOST = repoUrl('lib/index.js')

const { Context } = await import(CORDIS)

let failures = 0
function check(label, ok, detail) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail === undefined ? '' : ` — ${detail}`}`)
  if (!ok) failures += 1
}

const counters = { opened: 0, closed: 0 }
const toolDisposers = []
const registeredTools = []
const promptDisposers = []
const promptNames = []

const root = new Context()
root.provide('storageDomain', {
  async open() {
    counters.opened += 1
    const store = new Map()
    return {
      table: () => ({
        get: (key) => store.get(key),
        entries: () => [...store.entries()],
        keys: () => [...store.keys()],
        get size() {
          return store.size
        },
        put: (key, value) => void store.set(key, value),
        update: (key, value) => void store.set(key, value),
        delete: (key) => void store.delete(key),
      }),
      close() {
        counters.closed += 1
      },
    }
  },
})
root.provide('tools', {
  register(tool) {
    registeredTools.push(tool.name)
    const dispose = () => {
      const index = registeredTools.indexOf(tool.name)
      if (index >= 0) registeredTools.splice(index, 1)
    }
    toolDisposers.push(dispose)
    return dispose
  },
  schemas() {
    return []
  },
})
root.provide('systemPrompt', {
  section(section) {
    promptNames.push(section.name)
    const dispose = () => {
      const index = promptNames.indexOf(section.name)
      if (index >= 0) promptNames.splice(index, 1)
    }
    promptDisposers.push(dispose)
    return dispose
  },
})

const host = await import(HOST)

let applyError
try {
  root.plugin({ name: 'novel-companion', inject: host.inject, apply: host.apply }, {})
} catch (error) {
  applyError = error
}
check('apply() does not throw', applyError === undefined, applyError?.message)

for (let attempt = 0; attempt < 60; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 20))
  if (root.get('novels') !== undefined) break
}
check('activation completed', root.get('novels') !== undefined)
check('tool registered while active', registeredTools.includes('novel'), registeredTools.join(','))

// Unmount the whole plugin as an HMR reload or a profile change would.
let unmountError
try {
  const fibers = [...root.registry.values()].flatMap((runtime) => [...runtime.fibers])
  const fiber = fibers.find((entry) => entry.name === 'novel-companion')
  await fiber?.dispose?.()
  await new Promise((resolve) => setTimeout(resolve, 120))
} catch (error) {
  unmountError = error
}
check('unmount() does not throw', unmountError === undefined, unmountError?.message)
check('storage domain closed', counters.opened === 1 && counters.closed === 1, `opened=${counters.opened} closed=${counters.closed}`)

let afterUnmount
try {
  afterUnmount = root.novels
} catch {
  afterUnmount = undefined
}
check('Remote service unregistered', afterUnmount === undefined)
check('tool unregistered', !registeredTools.includes('novel'), registeredTools.join(','))

console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
