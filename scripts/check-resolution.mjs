/**
 * Reproduce the Desktop Host's module resolution for this plugin, in a child
 * process, without touching the running application.
 *
 * `installProfilePackageResolver()` installs one process-wide Node resolve hook
 * that every Loader import goes through. The plugin's Host half is imported by
 * package name from the profile, which reaches the "install fallback" branch, so
 * this checks that branch for real instead of guessing.
 *
 * Run: node scripts/check-resolution.mjs
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { PROFILE_DIR, appLibFile, skip } from './lib/env.mjs'

const resolverFile = appLibFile(/^module-resolution-.*\.js$/)
if (resolverFile === null) skip('DSH Desktop app not found — set DSH_APP_ROOT or install DSH Desktop')
const ENTRY = pathToFileURL(resolverFile).href
if (PROFILE_DIR === null) skip('no DSH profile directory found — set DSH_HOME')
const PROFILE_URL = pathToFileURL(join(PROFILE_DIR, 'package.json')).href
const pluginPath = join(PROFILE_DIR, 'node_modules', 'dsh-novel-companion')
if (!existsSync(pluginPath)) skip('this plugin is not installed in the DSH profile — install it first')
const PLUGIN_DIR = pathToFileURL(pluginPath).href

let installProfilePackageResolver
try {
  const mod = await import(ENTRY)
  installProfilePackageResolver = mod.installProfilePackageResolver ?? mod.t
} catch (error) {
  console.error(`cannot load the Desktop resolver: ${error?.message ?? error}`)
  process.exit(2)
}
if (typeof installProfilePackageResolver !== 'function') {
  console.error(`the Desktop resolver exposes no installer (exports: ${Object.keys(await import(ENTRY)).join(', ')})`)
  process.exit(2)
}

const release = installProfilePackageResolver(PROFILE_URL)

/** Run one import and report the error code instead of throwing. */
async function attempt(label, specifier) {
  try {
    const namespace = await import(specifier)
    console.log(`ok   ${label}`)
    return namespace
  } catch (error) {
    console.log(`FAIL ${label}: ${error?.code ?? 'Error'} — ${String(error?.message ?? error).split('\n')[0]}`)
    return undefined
  }
}

const byPackage = await attempt('bare "dsh-novel-companion" (what the Loader imports)', 'dsh-novel-companion')
const byEntry = await attempt('Host half by absolute path', `${PLUGIN_DIR}/lib/index.js`)
const byClient = await attempt('Client half by absolute path', `${PLUGIN_DIR}/lib/client.js`)
const byState = await attempt('relative ./state.js from the Host half', `${PLUGIN_DIR}/lib/state.js`)

if (byPackage !== undefined) console.log('host exports:', Object.keys(byPackage).join(', '))
if (byClient !== undefined) {
  const ok = typeof globalThis.window === 'undefined'
  console.log(`client half is browser-only (defines __ModuleLoader__): ${ok ? 'skipped, no window' : 'window present'}`)
}
void byEntry
void byState

release()
