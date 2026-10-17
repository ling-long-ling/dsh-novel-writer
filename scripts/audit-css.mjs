/**
 * Audit the CSS in `lib/client.js` against the live theme tokens.
 *
 * Client styles must use only `--dsw-alias-*` (and `--dsw-specific-*`) tokens;
 * any other custom property would silently resolve to nothing in the page.
 *
 * Run: node scripts/audit-css.mjs [path-to-built-client.js]
 *
 * The audit itself is exported so `self-check-css-audit.mjs` can exercise the
 * guard in-process — a guard that can never fail is not a guard.
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { ROOT } from './lib/env.mjs'

export const TOKENS = new Set([
  '--dsw-alias-bg-base',
  '--dsw-alias-bg-layer-1',
  '--dsw-alias-bg-layer-2',
  '--dsw-alias-bg-overlay',
  '--dsw-alias-border-l1',
  '--dsw-alias-border-l2',
  '--dsw-alias-brand-primary',
  '--dsw-alias-label-primary',
  '--dsw-alias-label-secondary',
  '--dsw-alias-state-error-primary',
  '--dsw-alias-state-idle-primary',
  '--dsw-alias-state-success-primary',
  '--dsw-alias-state-warn-primary',
  '--dsw-specific-sidebar-fill',
])

// A background token used as a TEXT colour is invisible whenever a skin makes
// that surface transparent — which is exactly how a filled primary button turned
// into a blank coloured block. Only `color:` declarations are inspected.
const BACKGROUND_TOKENS = new Set([
  '--dsw-alias-bg-base',
  '--dsw-alias-bg-layer-1',
  '--dsw-alias-bg-layer-2',
  '--dsw-alias-bg-overlay',
])

/** Slice the `const CSS = \`…\`` template out of a built Client bundle. */
export function extractCss(clientSource) {
  const start = clientSource.indexOf('const CSS = `')
  if (start < 0) return null
  const end = clientSource.indexOf('`', start + 'const CSS = `'.length)
  if (end < 0) return null
  return clientSource.slice(start + 'const CSS = `'.length, end)
}

/** Audit one built Client bundle; returns `{ ok, report }`. */
export function auditCss(clientSource) {
  const css = extractCss(clientSource)
  if (css === null) return { ok: false, report: ['cannot locate the CSS template in the built Client bundle'] }

  const used = new Set([...css.matchAll(/var\((--[a-z0-9-]+)/gi)].map((match) => match[1]))
  const unknown = [...used].filter((name) => !TOKENS.has(name))

  // Hard-coded colours are not theme-aware; list every literal colour value.
  const literals = [...css.matchAll(/#[0-9a-f]{3,8}\b|\brgba?\([^)]*\)|\bhsla?\([^)]*\)/gi)].map((match) => match[0])

  const textOnBackground = []
  for (const rule of css.matchAll(/\{([^{}]*)\}/g)) {
    const declarations = rule[1]
    for (const property of declarations.matchAll(/(^|;)\s*(?:-[a-z]+-)?color\s*:\s*var\((--[a-z0-9-]+)/gi)) {
      if (BACKGROUND_TOKENS.has(property[2])) textOnBackground.push(property[2])
    }
  }

  // Balanced braces inside the stylesheet catch a truncated paste.
  const opens = (css.match(/\{/g) ?? []).length
  const closes = (css.match(/\}/g) ?? []).length

  const report = [
    `CSS length: ${css.length} bytes, ${used.size} distinct tokens`,
    `tokens: ${[...used].sort().join(', ')}`,
    unknown.length === 0 ? 'OK: every token exists' : `UNKNOWN TOKENS: ${unknown.join(', ')}`,
    literals.length === 0 ? 'OK: no literal colours' : `LITERAL COLOURS: ${literals.join(', ')}`,
    textOnBackground.length === 0
      ? 'OK: no text painted with a background token'
      : `BACKGROUND TOKEN USED AS TEXT COLOUR: ${textOnBackground.join(', ')}`,
    opens === closes ? `OK: braces balanced (${opens})` : `UNBALANCED BRACES: ${opens} vs ${closes}`,
  ]

  const ok = unknown.length === 0 && literals.length === 0 && opens === closes && textOnBackground.length === 0
  return { ok, report }
}

// Command-line entry: audit the built bundle (or the file given as the argument).
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = process.argv[2] ?? `${ROOT}/lib/client.js`
  const { ok, report } = auditCss(readFileSync(target, 'utf8'))
  for (const line of report) console.log(line)
  process.exit(ok ? 0 : 1)
}
