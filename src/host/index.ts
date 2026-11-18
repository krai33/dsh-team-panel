/**
 * Host service: member avatar assignments for the Team panel.
 *
 * The panel renders a roster of the lead session and its subagent children;
 * each row can carry a user-chosen avatar image. Storage is two plain files
 * inside the plugin's data directory (default: the plugin package's own
 * `data/`):
 *
 * - `data/avatars.json` — `{ [sessionId]: "<file name>" }`, last write wins
 * - `data/assets/<file>` — the image files themselves, also served to the
 *   browser through the client-modules package-asset route
 *   (`/plugins/dsh-team-panel/assets/<file>`, requires the package
 *   `exports["./assets/*"]`), so the same file serves both the picker and
 *   the member card.
 *
 * Images are pre-provisioned by the operator (drop files into
 * `data/assets/`); assignment is the only write path. The mapping file is
 * written atomically (tmp + rename) and cached in memory between writes.
 */

import { readFile, rename, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { basename, dirname, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { RemoteErrorDetailsMap } from '@deepseek-ai/dsh-typert-protocol'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** Request validation refused the call; fields are missing or empty. */
    'teamPanel/invalid-request': {}
    /** The named asset file does not exist in the plugin data directory. */
    'teamPanel/unknown-asset': { readonly asset: string }
    /** Reading or writing the mapping file failed. */
    'teamPanel/storage-error': { readonly message: string }
    /** Uploaded image content exceeds the size limit. */
    'teamPanel/asset-too-large': { readonly bytes: number; readonly maxBytes: number }
  }
}

/** One row of the avatar assignment map (session id → asset file name). */
export type AvatarMap = Readonly<Record<string, string>>

/** Response of `list`: assignments plus the available image files. */
export interface AvatarListValue {
  /** Current session-id → file-name assignments. */
  assignments: AvatarMap
  /** File names available in the plugin's `data/assets/` directory. */
  assets: string[]
}

/** Request body of `assign`. */
export interface AvatarAssignRequest {
  /** Session whose member card carries the avatar. */
  sessionId: string
  /** File name below `data/assets/`; empty clears the assignment. */
  asset: string
}

/** Request body of `upload`: one browser-picked image file. */
export interface AvatarUploadRequest {
  /** Desired file name below `data/assets/`; sanitized server-side. */
  name: string
  /** Image bytes, base64-encoded. */
  data: string
}

/** Response of `upload`. */
export interface AvatarUploadValue {
  /** The stored file name (sanitized; may differ from the request). */
  asset: string
  /** Whether an existing file with that name was overwritten. */
  overwritten: boolean
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'])
/** Upload size cap: avatars render at ~22px; generous for any real image. */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isImageFile(name: string): boolean {
  const dot = name.lastIndexOf('.')
  return dot > 0 && IMAGE_EXTENSIONS.has(name.slice(dot).toLowerCase())
}

export class TeamPanelAvatarService extends TypertRemoteService {
  static inject = ['typertGateway']

  private readonly dataDir: string
  private cache: AvatarMap | undefined

  constructor(ctx: Context, config: { dataDir?: string } = {}) {
    super(ctx, 'teamPanel', { namespace: 'teamPanel' })
    // Default data dir: the installed plugin package root's `data/`. This
    // module is the package's host entry at lib/host/index.js, so the
    // package.json sits two directories up.
    const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
    this.dataDir = nonEmpty(config?.dataDir) ? config.dataDir : join(pkgRoot, 'data')
  }

  /**
   * Read the assignment map, serving subsequent reads from memory.
   * @returns the current session-id → asset-file map.
   */
  private async readMap(): Promise<AvatarMap> {
    if (this.cache !== undefined) return this.cache
    try {
      const raw = await readFile(join(this.dataDir, 'avatars.json'), 'utf8')
      const parsed: unknown = JSON.parse(raw)
      this.cache = typeof parsed === 'object' && parsed !== null ? parsed as AvatarMap : {}
    } catch {
      this.cache = {}
    }
    return this.cache
  }

  /**
   * Persist the assignment map atomically and refresh the memory cache.
   * @param next - the complete replacement map.
   */
  private async writeMap(next: Record<string, string>): Promise<void> {
    const file = join(this.dataDir, 'avatars.json')
    const tmp = `${file}.tmp`
    await writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
    await rename(tmp, file)
    this.cache = next
  }

  /**
   * List assignments and the available avatar image files.
   * @returns assignments plus asset file names.
   */
  @Remote('list')
  async list(): Promise<AvatarListValue> {
    const assets: string[] = []
    const assetsDir = join(this.dataDir, 'assets')
    if (existsSync(assetsDir)) {
      const { readdir } = await import('node:fs/promises')
      for (const entry of await readdir(assetsDir, { withFileTypes: true })) {
        if (entry.isFile() && isImageFile(entry.name)) assets.push(entry.name)
      }
    }
    assets.sort()
    return { assignments: await this.readMap(), assets }
  }

  /**
   * Assign (or clear, with an empty asset) one member's avatar.
   * @param request - session id and the asset file name.
   * @returns the assignment map after the write.
   */
  @Remote('assign')
  async assign(request: AvatarAssignRequest): Promise<{ assignments: AvatarMap }> {
    if (!nonEmpty(request?.sessionId)) {
      throw new RemoteError(
        'teamPanel/invalid-request',
        'assign requires sessionId as a non-empty string',
        {},
      )
    }
    if (typeof request?.asset !== 'string') {
      throw new RemoteError(
        'teamPanel/invalid-request',
        'assign requires asset as a string (empty clears the assignment)',
        {},
      )
    }
    const current = { ...await this.readMap() }
    if (request.asset === '') {
      delete current[request.sessionId]
    } else {
      const file = join(this.dataDir, 'assets', basename(request.asset))
      if (!existsSync(file) || !isImageFile(file)) {
        throw new RemoteError(
          'teamPanel/unknown-asset',
          `asset "${request.asset}" is not an image file under data/assets/`,
          { asset: request.asset },
        )
      }
      current[request.sessionId] = basename(request.asset)
    }
    try {
      await this.writeMap(current)
    } catch (error) {
      throw new RemoteError(
        'teamPanel/storage-error',
        `writing avatars.json failed: ${String(error)}`,
        { message: String(error) },
      )
    }
    return { assignments: current }
  }

  /**
   * Store one uploaded image into `data/assets/` and refresh the asset list.
   *
   * The name is sanitized to its basename, forced lowercase extension from
   * the allowlist, and given a short random suffix when it would overwrite
   * an existing different file — the asset route caches by file name, so
   * content changes must change names to reach the browser.
   * @param request - desired file name and base64 image bytes.
   * @returns the stored file name and whether an existing name was replaced.
   */
  @Remote('upload')
  async upload(request: AvatarUploadRequest): Promise<AvatarUploadValue> {
    if (!nonEmpty(request?.name) || typeof request?.data !== 'string' || request.data.length === 0) {
      throw new RemoteError(
        'teamPanel/invalid-request',
        'upload requires name and data (base64 image) as non-empty strings',
        {},
      )
    }
    if (!isImageFile(request.name)) {
      throw new RemoteError(
        'teamPanel/invalid-request',
        `upload name "${request.name}" must end with one of: ${[...IMAGE_EXTENSIONS].join(' ')}`,
        {},
      )
    }
    let bytes: Buffer
    try {
      bytes = Buffer.from(request.data, 'base64')
    } catch {
      throw new RemoteError('teamPanel/invalid-request', 'upload data is not valid base64', {})
    }
    if (bytes.length === 0 || bytes.length > MAX_UPLOAD_BYTES) {
      throw new RemoteError(
        'teamPanel/asset-too-large',
        `upload decoded to ${bytes.length} bytes; limit is ${MAX_UPLOAD_BYTES}`,
        { bytes: bytes.length, maxBytes: MAX_UPLOAD_BYTES },
      )
    }
    const assetsDir = join(this.dataDir, 'assets')
    await mkdir(assetsDir, { recursive: true })
    let stored = basename(request.name).replace(/[^\w.-]+/g, '_')
    let overwritten = false
    if (existsSync(join(assetsDir, stored))) {
      overwritten = true
      const dot = stored.lastIndexOf('.')
      stored = `${stored.slice(0, dot)}-${Math.random().toString(36).slice(2, 6)}${stored.slice(dot)}`
    }
    try {
      await writeFile(join(assetsDir, stored), bytes)
    } catch (error) {
      throw new RemoteError(
        'teamPanel/storage-error',
        `writing ${stored} failed: ${String(error)}`,
        { message: String(error) },
      )
    }
    return { asset: stored, overwritten }
  }
}

export const name = 'dsh-team-panel'
export const inject = TeamPanelAvatarService.inject

export function apply(ctx: Context, config: { dataDir?: string } = {}): void {
  ctx.plugin(TeamPanelAvatarService, config)
}
