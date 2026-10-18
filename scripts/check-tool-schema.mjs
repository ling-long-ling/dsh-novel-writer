/**
 * Validate the `novel` tool's JSON Schema the way a model provider does.
 *
 * `ctx.tools.register` ships `parameters` to the provider as-is, so a schema
 * shaped like a parameter map is rejected on every request that carries the
 * tool and the whole turn dies before the model can answer:
 *
 *   Invalid schema for function 'novel':
 *   {"type":"string","description":"create 或 appendChapter 的章节标题。"}
 *   is not of type "string"
 *
 * (A property named `title` lands where the meta-schema expects the string
 * keyword `title`.) This check asserts the compiled schema is a proper
 * object-rooted document, and that no description picked up mojibake.
 *
 * Run: node scripts/check-tool-schema.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { ROOT } from './lib/env.mjs'

const STAGE = `${ROOT}/.selftest/tool-schema-index.mjs`

let source = readFileSync(`${ROOT}/lib/index.js`, 'utf8')
source = source
  .replace("require('./state.js')", "require('./state.mjs')")
  .replace("require('./demo.js')", "require('./demo.mjs')")
writeFileSync(STAGE, source, 'utf8')
writeFileSync(`${ROOT}/.selftest/state.mjs`, readFileSync(`${ROOT}/lib/state.js`, 'utf8'), 'utf8')
writeFileSync(`${ROOT}/.selftest/demo.mjs`, readFileSync(`${ROOT}/lib/demo.js`, 'utf8'), 'utf8')

const host = await import(pathToFileURL(STAGE).href)
const tool = host.novelTool(Promise.resolve(undefined))

let failures = 0
function check(label, ok, detail) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail === undefined ? '' : ` — ${detail}`}`)
  if (!ok) failures += 1
}

check('tool is named novel', tool.name === 'novel', tool.name)
check('tool description is a string', typeof tool.description === 'string')

const schema = tool.parameters
check('parameters root is an object schema', schema?.type === 'object', JSON.stringify(schema?.type))
check('parameters has a properties map', schema?.properties !== null && typeof schema?.properties === 'object')
check('parameters is not a bare parameter map', !('description' in schema) || typeof schema.description === 'string')
check('required is an array of names', Array.isArray(schema?.required), JSON.stringify(schema?.required))

// The property that used to break the request.
check('no `title` keyword collision at the root', typeof schema?.title !== 'object')

const MOJIBAKE = /[\u9354\u93b4\u9518\u5d4e\u9428\u6d93\u93c1\ufffd]/
const allowedKeys = new Set(['type', 'description', 'enum', 'items', 'properties', 'required', 'default', 'const'])
for (const [name, definition] of Object.entries(schema?.properties ?? {})) {
  if (definition === null || typeof definition !== 'object' || Array.isArray(definition)) {
    check(`property "${name}" is a schema object`, false, JSON.stringify(definition))
    continue
  }
  check(`property "${name}" declares a type`, typeof definition.type === 'string', JSON.stringify(definition.type))
  if (definition.description !== undefined && typeof definition.description !== 'string') {
    check(`property "${name}" description is a string`, false)
  }
  if (definition.enum !== undefined && !Array.isArray(definition.enum)) {
    check(`property "${name}" enum is an array`, false)
  }
  // `required: true` is authoring shorthand and must be lifted to the root.
  if ('required' in definition) check(`property "${name}" has no leaked required flag`, false)
  const unknown = Object.keys(definition).filter((key) => !allowedKeys.has(key))
  if (unknown.length > 0) check(`property "${name}" uses only schema keywords`, false, unknown.join(','))
  if (MOJIBAKE.test(definition.description ?? '')) {
    check(`property "${name}" description is not mojibake`, false, definition.description)
  }
}

check('tool description is not mojibake', !MOJIBAKE.test(tool.description ?? ''))

check(
  'action enum lists every action runNovelAction handles',
  JSON.stringify(schema?.properties?.action?.enum) ===
    JSON.stringify(['list', 'get', 'create', 'stage', 'block', 'outline', 'chapter', 'appendChapter', 'search']),
)
check(
  'chapterIndex is offered as the id fallback',
  schema?.properties?.chapterIndex?.type === 'integer',
  JSON.stringify(schema?.properties?.chapterIndex),
)
check(
  'context offers every prose mode',
  JSON.stringify(schema?.properties?.context?.enum) === JSON.stringify(['prev', 'recent', 'all', 'none']),
  JSON.stringify(schema?.properties?.context?.enum),
)

console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
