/**
 * Assert that every host-side fix is present in `lib/index.js`.
 * Run: node scripts/check-host-invariants.mjs
 */
import { readFileSync } from 'node:fs'

import { ROOT } from './lib/env.mjs'

const FILE = `${ROOT}/lib/index.js`
const source = readFileSync(FILE, 'utf8')
// Prose in comments legitimately names the things the checks forbid.
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^.*?\/\/.*$/gm, '')

const CHECKS = [
  ['Remote descriptor uses the STRING key', /const REMOTE_METHODS = '@deepseek-ai\/dsh-typert-protocol\/remote-methods'/],
  ['no Symbol.for descriptor key', (text) => !text.includes('Symbol.for(')],
  // The fatal regression: a profile bundle cannot reach `ctx.Service`, so reading
  // it aborts the whole Host load ("cannot get property Service without inject").
  ['never reads ctx.Service', (text) => !/ctx\.Service\b/.test(text)],
  ['never imports cordis (unresolvable from a linked bundle)', (text) => !/from '@deepseek-ai\/cordis'/.test(text)],
  ['service published with ctx.provide', /ctx\.provide\(REMOTE_NAMESPACE, createNovelService\(store\)\)/],  ['typertRemote binding present', /this\.typertRemote = Object\.freeze\(/],
  ['binding keyed by the namespace', /serviceKey: REMOTE_NAMESPACE/],
  ['descriptor lists every Remote method', /Object\.keys\(novelBooksMethods\)\.map\(remoteMethodMarker\)/],
  ['every declare/inject name is a real service', (text) => {
    const match = /export const inject = \[([^\]]*)\]/.exec(text)
    if (match === null) return false
    const names = [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1])
    const ALLOWED = new Set(['tools', 'systemPrompt', 'storageDomain'])
    return names.length > 0 && names.every((name) => ALLOWED.has(name))
  }],
  ['fresh ids satisfy PROJECT_ID', /function newProjectId\(\)/],
  ['storage domain declared', /layout: 'single'/],
  ['table value schema', /const PROJECT_SCHEMA = \{/],
  ['tool registered through ctx.tools', /ctx\.tools\.register\(/],
  ['prompt section registered', /systemPrompt/],
  ['demo project externalised', /buildDemoProject/],
  // Data-loss guard: `normalizeProject` repairs on read, but a write must
  // refuse a partial document instead of clearing the book with defaults.
  ['save method refuses a half document', /missingProjectFields\(value\)/],
  ['store refuses a half document', /missingProjectFields\(project\)/],
  ['stage gate honours force', /args\.force !== true/],
  ['search action is registered', /'appendChapter', 'search'/],
  // A whole-document save must not let chapter 501 slip through normalizeProject's
  // silent slice and vanish.
  ['store refuses more than MAX_CHAPTERS', /project\.chapters\.length > MAX_CHAPTERS/],
  [
    'no browser-only globals in the Host half',
    // Strip comments first: prose like "into a document" is not a global usage.
    (text) =>
      !/\b(document|window|localStorage|navigator)\./.test(
        text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^.*?\/\/.*$/gm, ''),
      ),
  ],
  ['no U+FFFD', (text) => !text.includes('\uFFFD')],
]

let failures = 0
for (const [label, test] of CHECKS) {
  const ok = typeof test === 'function' ? test(code) : test.test(code)
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`)
  if (!ok) failures += 1
}
// U+FFFD is an encoding break, so it must be judged on the raw file.
if (source.includes('\uFFFD')) {
  console.log('FAIL raw file contains U+FFFD')
  failures += 1
}
console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
