#!/usr/bin/env node
/** Client typecheck gate: passes when no error touches this plugin's own sources.
 *
 * tsconfig.client.json pulls the extracted rc.1 dependency sources through
 * `paths`; those trees carry their own dev-only errors (missing CSS-module
 * types, shiki/clsx deps). This plugin's contract is only its own files.
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const tsc = join(here, '..', 'node_modules-sibling', 'typescript', 'bin', 'tsc')
const result = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.client.json', '--noEmit'], {
  cwd: join(here, '..'),
  encoding: 'utf8',
})
const ownErrors = (result.stdout + result.stderr)
  .split('\n')
  .filter(line => /^src\/client\//.test(line))
if (ownErrors.length > 0) {
  console.error(ownErrors.join('\n'))
  process.exit(1)
}
console.log('client typecheck OK (own sources clean; dev-dep noise suppressed)')
