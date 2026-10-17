/**
 * Locate the repository root and the local DSH Desktop installation.
 *
 * Nothing here is machine specific: every path is derived from this file's own
 * location, or from an environment variable, so the checks run unchanged on any
 * machine:
 *
 *   DSH_HOME       DSH home directory            (default: ~/.dsh)
 *   DSH_PROFILE    profile name                  (default: desktop)
 *   DSH_APP_ROOT   DSH Desktop app directory     (default: the usual install paths)
 *
 * Checks that need a DSH package return `null` from the helpers below and their
 * script prints `SKIP …` instead of failing — the plugin itself does not depend
 * on any of this, only the optional Host-level checks do.
 */
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const normalize = (value) => value.replaceAll('\\', '/').replace(/\/+$/, '')

/** Repository root (the directory above `scripts/`). */
export const ROOT = normalize(fileURLToPath(new URL('../..', import.meta.url)))

/** DSH home directory (`~/.dsh` unless DSH_HOME is set). */
export const DSH_HOME = normalize(process.env.DSH_HOME ?? join(homedir(), '.dsh'))

/** Profile name that carries this plugin. */
export const PROFILE = process.env.DSH_PROFILE ?? 'desktop'

/** The selected profile directory, falling back to the shared profiles root. */
export const PROFILE_DIR = [
  join(DSH_HOME, 'profiles', PROFILE),
  join(DSH_HOME, 'profiles'),
].map(normalize).find((candidate) => existsSync(candidate)) ?? null

/** DSH Desktop application directory (the one that contains `package.json`). */
export const APP_ROOT = [
  process.env.DSH_APP_ROOT,
  join(process.env.LOCALAPPDATA ?? '', 'Programs', 'DSH Desktop', 'resources', 'app'),
  join(process.env.PROGRAMFILES ?? '', 'DSH Desktop', 'resources', 'app'),
]
  .filter((candidate) => typeof candidate === 'string' && candidate.length > 0)
  .map(normalize)
  .find((candidate) => existsSync(candidate)) ?? null

/**
 * Resolve `<node_modules>/<specifier>/<relative>` from the profile first, then
 * from the application's own `node_modules`. Returns a `file:` URL or `null`.
 */
export function packageFile(specifier, relative) {
  const candidates = [
    PROFILE_DIR === null ? null : join(PROFILE_DIR, 'node_modules', specifier, relative),
    join(DSH_HOME, 'profiles', 'node_modules', specifier, relative),
    APP_ROOT === null ? null : join(APP_ROOT, 'node_modules', specifier, relative),
  ].filter((candidate) => typeof candidate === 'string')
  const hit = candidates.map(normalize).find((candidate) => existsSync(candidate))
  return hit === undefined ? null : pathToFileURL(hit).href
}

/**
 * Find the first file in the application's `lib/` whose name matches `pattern`
 * — DSH ships some modules under content-hashed names.
 */
export function appLibFile(pattern) {
  if (APP_ROOT === null) return null
  const libDir = join(APP_ROOT, 'lib')
  if (!existsSync(libDir)) return null
  const hit = readdirSync(libDir)
    .filter((name) => pattern.test(name))
    .sort()[0]
  return hit === undefined ? null : normalize(join(libDir, hit))
}

/** `file:` URL for a path inside this repository. */
export function repoUrl(relative) {
  return pathToFileURL(join(ROOT, relative)).href
}

/** Exit successfully with a clear reason: the optional DSH bits are not installed. */
export function skip(reason) {
  console.log(`SKIP ${reason}`)
  process.exit(0)
}
