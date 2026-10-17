/**
 * Rebuild lib/client.js from lib/client.js.tpl by inlining the shared document
 * helpers from lib/state.js into the `@shared` marker.
 *
 * The Client bundle is a single plain-JS closure handed to
 * `window.__ModuleLoader__`, so it cannot `import` anything; the shared source
 * must be embedded. Keeping one source of truth avoids the Guest and the Host
 * disagreeing about the document shape.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

let shared = readFileSync(join(root, 'lib', 'state.js'), 'utf8')
// Drop everything above the first declaration: only the helpers travel.
shared = shared.slice(shared.indexOf('/** Project stages'))
// The bundle body has no module scope: turn the exports into plain declarations.
shared = shared.replace(/^export (const|function) /gm, '$1 ')
// Re-indent to sit inside the factory body (one level of two spaces).
shared = shared
  .split('\n')
  .map((line) => line.replace(/^ {2}/, '    '))
  .join('\n')

const template = readFileSync(join(root, 'lib', 'client.js.tpl'), 'utf8')
if (!template.includes('// __SHARED__')) throw new Error('client.js.tpl is missing the __SHARED__ marker')
const output = template.replace('    // __SHARED__', shared.trimEnd())
writeFileSync(join(root, 'lib', 'client.js'), output, 'utf8')
console.log(`built lib/client.js (${output.length} bytes)`)
