/**
 * Render the Client half outside the browser to find why the panel comes out
 * blank, and fail the build if it ever throws again.
 *
 * The panel renders to nothing in the app but the sidebar icon works, so the
 * fault is inside the panel's render or effect path. React DOM is not installed,
 * so this file ships a deliberately small React: just `createElement` and the
 * five hooks the Client half actually uses. It then renders the registered panel
 * once, runs the effects the way a commit would, and reports the first throw.
 *
 * Run: node scripts/check-panel-render.mjs
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { ROOT } from './lib/env.mjs'
const BUNDLE = `${ROOT}/lib/client.js`

let failures = 0
function check(label, ok, detail) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail === undefined ? '' : ` — ${detail}`}`)
  if (!ok) failures += 1
}

// --- a minimal React -------------------------------------------------------
const effectQueue = []
let currentComponent = null

const React = {
  createElement(type, props, ...children) {
    const nextProps = props === null || props === undefined ? {} : { ...props }
    if (children.length === 1) nextProps.children = children[0]
    else if (children.length > 1) nextProps.children = children
    return { type, props: nextProps }
  },
  useState(initial) {
    const state = currentComponent
    const index = state.index++
    if (!(index in state.hooks)) {
      state.hooks[index] = typeof initial === 'function' ? initial() : initial
    }
    return [state.hooks[index], () => {}]
  },
  useRef(initial) {
    const state = currentComponent
    const index = state.index++
    if (!(index in state.hooks)) state.hooks[index] = { current: initial }
    return state.hooks[index]
  },
  useCallback(fn) {
    const state = currentComponent
    const index = state.index++
    if (!(index in state.hooks)) state.hooks[index] = fn
    return state.hooks[index]
  },
  useEffect(fn) {
    const state = currentComponent
    state.index++
    effectQueue.push(fn)
  },
}

const renderErrors = []
let renderedHostElements = 0

function renderNode(node) {
  if (node === null || node === undefined || node === false || node === true) return
  if (Array.isArray(node)) {
    for (const child of node) renderNode(child)
    return
  }
  if (typeof node !== 'object') return
  const { type, props } = node
  if (typeof type === 'function') {
    const parent = currentComponent
    currentComponent = { hooks: [], index: 0 }
    let output
    try {
      output = type(props)
    } catch (error) {
      renderErrors.push(error)
      currentComponent = parent
      return
    }
    currentComponent = parent
    renderNode(output)
    return
  }
  renderedHostElements += 1
  renderNode(props?.children)
}

// --- the page environment --------------------------------------------------
const styleTags = []
globalThis.window = {
  __ModuleLoader__: {
    load(spec) {
      globalThis.__clientFactory = spec.factory
    },
  },
}
globalThis.document = {
  createElement: () => ({ dataset: {}, textContent: '', remove() {} }),
  head: { appendChild: (tag) => styleTags.push(tag) },
}

const requireShim = (id) => {
  if (id === 'react') return React
  throw new Error(`unexpected require(${JSON.stringify(id)})`)
}

await import(pathToFileURL(BUNDLE).href)
const factory = globalThis.__clientFactory
check('client bundle registers a factory', typeof factory === 'function')

const moduleExports = factory(requireShim)
check('client module exports inject + apply', Array.isArray(moduleExports?.inject) && typeof moduleExports?.apply === 'function')

// --- a fake context --------------------------------------------------------
const registrations = new Map()
const remoteCalls = []

/**
 * Stand-in for `connection.rpc.call('/api', '<ns>/<method>', { args })`, which is
 * what the Client half really uses. It answers the gateway's envelope shape, so
 * the panel exercises the same unwrapping path as in the app.
 */
async function rpcCall(channel, endpoint, payload) {
  if (channel !== '/api') throw new Error(`unexpected channel ${channel}`)
  const [namespace, method] = String(endpoint).split('/')
  if (namespace !== 'novels') throw new Error(`unexpected namespace ${namespace}`)
  const args = payload?.args ?? {}
  remoteCalls.push(`${method}(${JSON.stringify(args)})`)
  switch (method) {
    case 'list':
      return { ok: true, value: [] }
    case 'get':
      return { ok: true, value: null }
    case 'save':
      return { ok: true, value: args.value }
    case 'create':
      return {
        ok: true,
        value: { id: 'novel-test', title: String(args.title ?? ''), stage: 'interview', blocks: [], chapters: [] },
      }
    case 'importDemo':
      return { ok: true, value: { id: 'novel-demo', title: '示例', stage: 'interview', blocks: [], chapters: [] } }
    case 'remove':
      return { ok: true, value: true }
    default:
      return { ok: false, error: { code: 'gateway/invocation-unavailable', message: `no such method ${method}` } }
  }
}

const ctx = {
  locale: {
    bind: () => (key, vars) => (vars === undefined ? key : `${key}:${JSON.stringify(vars)}`),
    register: () => () => {},
  },
  connection: { rpc: { call: rpcCall } },
  slots: {
    inject(name, callback) {
      callback()
    },
    register(options, component) {
      registrations.set(options.name, { options, component })
      return () => {}
    },
  },
  effect(fn) {
    const dispose = fn()
    return typeof dispose === 'function' ? dispose : () => {}
  },
  on() {
    return () => {}
  },
  get(name) {
    if (name === 'connection') return ctx.connection
    if (name === 'layout') return { selectPanel: () => {} }
    return undefined
  },
}

let applyError
try {
  moduleExports.apply(ctx)
} catch (error) {
  applyError = error
}
check('apply() runs against a fake page context', applyError === undefined, applyError?.message)
check('styles were installed', styleTags.length === 1)
check('sidebar icon registered', registrations.has('sidebar.panellist'))
check('main panel registered', registrations.has('main'))
// The composer dock was deliberately removed: it appeared above the composer in
// every conversation, whether or not the author was writing, and duplicated
// controls the panel already has. Only the panel may own the novel surface.
check('no composer dock registered', !registrations.has('conversation.input.dock'))

// Skins paint an absolutely positioned artwork layer at z-index 0 inside the
// centre column, which covers in-flow content. The panel root must therefore be
// positioned and lifted, or the panel renders invisibly. Nothing in the app
// reports an error for that, so only a check like this catches a regression.
const built = readFileSync(BUNDLE, 'utf8')
check(
  'the panel root is positioned above skin artwork',
  /\.nv-root\{position:relative;z-index:1/.test(built),
)
check(
  'the panel offers a way back to the conversation',
  built.includes('backToConversation') && built.includes("action.back"),
)

// --- render the panel the way the slot owner does --------------------------
const mainRegistration = registrations.get('main')
let panelOutput
let panelError
try {
  panelOutput = mainRegistration.component({ useResource: {}, useWorkspaces: {}, usePanelInfo: {} })
} catch (error) {
  panelError = error
}
check('the main panel entry renders without throwing', panelError === undefined, panelError?.message)

renderErrors.length = 0
renderedHostElements = 0
renderNode(panelOutput)
check('the panel produced DOM elements', renderedHostElements > 0, `${renderedHostElements} host element(s)`)
check(
  'the panel tree rendered without throwing',
  renderErrors.length === 0,
  renderErrors.map((error) => `${error.name}: ${error.message}`).join(' | '),
)

// --- run effects like a commit would --------------------------------------
const effectErrors = []
for (const effect of effectQueue) {
  try {
    effect()
  } catch (error) {
    effectErrors.push(error)
  }
}
check(
  'the panel effects run without throwing',
  effectErrors.length === 0,
  effectErrors.map((error) => `${error.name}: ${error.message}`).join(' | '),
)

// The Client reaches the Host through `connection.rpc.call`, NOT through
// `ctx.remote.novels` — a third-party namespace is never on that generated
// surface, and asking for it produced "Cannot read properties of undefined".
// The loader is deliberately async, so let the queued microtasks settle first.
await new Promise((resolve) => setTimeout(resolve, 0))
check(
  'the panel calls the Host through connection.rpc.call',
  remoteCalls.some((entry) => entry.startsWith('list(')),
  remoteCalls.join(', ') || 'no calls were made',
)
check(
  'no call goes through ctx.remote',
  !/ctx\.remote\.novels\.\w+\(/.test(built),
)

// --- the icon must survive too ---------------------------------------------
const icon = registrations.get('sidebar.panellist')
let iconError
try {
  effectQueue.length = 0
  renderNode(icon.component.call(undefined, { size: 18, active: false }))
} catch (error) {
  iconError = error
}
// `call(undefined, ...)` above would break `this`; re-run properly.
iconError = undefined
try {
  effectQueue.length = 0
  renderNode(icon.component({ size: 18, active: false }))
} catch (error) {
  iconError = error
}
check('the sidebar icon renders without throwing', iconError === undefined, iconError?.message)

console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
