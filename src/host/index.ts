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
 * Images can be uploaded or placed in the asset directory. Deleting an image
 * clears every assignment to it. Avatar operations serialize file changes and
 * publish the assignment map only after its atomic write.
 */

import { lstat, mkdir, readdir, readFile, realpath, rename, unlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { basename, dirname, join, resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
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
    /** No live Agent holds the named subagent session. */
    'teamPanel/not-live': { readonly sessionId: string }
    /** The parent session needed to wake a cold member is not live. */
    'teamPanel/parent-not-live': { readonly sessionId: string; readonly parentSessionId: string }
    /** The requested provider/model route is not resolvable. */
    'teamPanel/route-unavailable': { readonly provider: string; readonly model: string }
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    agents: import('@deepseek-ai/dsh-agent').AgentRegistry
    llm: import('@deepseek-ai/dsh-llm').LlmRuntime
    workspaceRegistry: import('@deepseek-ai/dsh-workspace').WorkspaceRegistry
    subagents: import('@deepseek-ai/dsh-subagent').SubagentRuntime
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
  /** User-added images that may be deleted from the library. */
  deletableAssets: string[]
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
const BUILTIN_ASSETS = new Set(['lead.png', 'member.png'])
/** Upload cap in decoded bytes. */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isImageFile(name: string): boolean {
  const dot = name.lastIndexOf('.')
  return dot > 0 && IMAGE_EXTENSIONS.has(name.slice(dot).toLowerCase())
}

function storageError(action: string, cause: unknown): RemoteError<'teamPanel/storage-error'> {
  const message = `${action} failed: ${String(cause)}`
  return new RemoteError('teamPanel/storage-error', message, { message }, { cause })
}

export class TeamPanelAvatarService extends TypertRemoteService {
  static inject = ['typertGateway', 'agents', 'llm', 'workspaceRegistry', 'subagents']

  private readonly dataDir: string
  private cache: AvatarMap | undefined
  private avatarOperations: Promise<void> = Promise.resolve()
  /** One queued route change per waking member, applied inside the child's agent/created listeners. */
  private readonly wakeSelections = new Map<string, { provider: string; model: string; reasoningEffort?: never }>()

  private withAvatars<T>(run: () => Promise<T>): Promise<T> {
    const result = this.avatarOperations.then(run)
    this.avatarOperations = result.then(() => undefined, () => undefined)
    return result
  }

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
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('expected an avatar assignment object')
      }
      const entries: [string, string][] = []
      for (const [id, asset] of Object.entries(parsed)) {
        if (typeof asset !== 'string') throw new Error('expected avatar file names as strings')
        entries.push([id, asset])
      }
      this.cache = Object.fromEntries(entries)
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') this.cache = {}
      else throw storageError('reading avatar assignments', error)
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
    return this.withAvatars(async () => {
      const assets: string[] = []
      const assetsDir = join(this.dataDir, 'assets')
      if (existsSync(assetsDir)) {
        for (const entry of await readdir(assetsDir, { withFileTypes: true })) {
          if (entry.isFile() && isImageFile(entry.name)) assets.push(entry.name)
        }
      }
      assets.sort()
      return { assignments: await this.readMap(), assets, deletableAssets: assets.filter(asset => !BUILTIN_ASSETS.has(asset)) }
    })
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
    return this.withAvatars(async () => {
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
        Object.defineProperty(current, request.sessionId, { value: basename(request.asset), enumerable: true, configurable: true, writable: true })
      }
      try {
        await this.writeMap(current)
      } catch (error) {
        throw storageError('writing avatar assignments', error)
      }
      return { assignments: current }
    })
  }

  /**
   * Delete a user-added image and clear all member assignments to it.
   * @param request - exact file name from the avatar library.
   * @returns the committed assignment map after deletion.
   * @throws if the name is invalid, reserved, missing, or the change cannot be committed.
   */
  @Remote('deleteAvatar')
  async deleteAvatar(request: { asset: string }): Promise<{ assignments: AvatarMap }> {
    const asset = request?.asset
    if (!nonEmpty(asset) || asset !== basename(asset) || /[\\\\/\u0000-\u001f]/u.test(asset)
      || !isImageFile(asset) || BUILTIN_ASSETS.has(asset)) {
      throw new RemoteError('teamPanel/invalid-request', 'expected a deletable avatar file name', {})
    }
    return this.withAvatars(async () => {
      const previous = await this.readMap()
      const current = Object.fromEntries(Object.entries(previous).filter(([, file]) => file !== asset))
      const assetsDir = resolve(this.dataDir, 'assets')
      const file = join(assetsDir, asset)
      const staged = resolve(this.dataDir, `.avatar-delete-${randomUUID()}`)
      try {
        const root = await realpath(this.dataDir)
        if (await realpath(assetsDir) !== join(root, 'assets') || !(await lstat(file)).isFile()) {
          throw new RemoteError('teamPanel/unknown-asset', 'avatar is not a regular library file', { asset })
        }
        await rename(file, staged)
      } catch (error) {
        if (error instanceof RemoteError) throw error
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
          throw new RemoteError('teamPanel/unknown-asset', 'avatar is not in the library', { asset })
        }
        throw storageError('staging avatar deletion', error)
      }
      try {
        if (Object.keys(current).length !== Object.keys(previous).length) await this.writeMap(current)
      } catch (error) {
        try {
          await rename(staged, file)
        } catch (rollbackError) {
          throw storageError('saving avatar deletion and restoring the image', new AggregateError([error, rollbackError]))
        }
        throw storageError('clearing avatar assignments', error)
      }
      try {
        await unlink(staged)
      } catch (error) {
        this.ctx.logger.warn('team-panel: avatar removed from the library but its staged file could not be cleaned up: %s', String(error))
      }
      return { assignments: current }
    })
  }

  /**
   * Store a browser upload under a unique asset URL, even after re-uploading a deleted name.
   * @param request - desired file name and base64 image bytes.
   * @returns the stored file name; existing files are never overwritten.
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
    const filename = basename(request.name).replace(/[^\w.-]+/g, '_')
    const dot = filename.lastIndexOf('.')
    const stored = `${filename.slice(0, dot).slice(0, 180)}-${randomUUID().slice(0, 12)}${filename.slice(dot).toLowerCase()}`
    return this.withAvatars(async () => {
      const assetsDir = join(this.dataDir, 'assets')
      try {
        await mkdir(assetsDir, { recursive: true })
        await writeFile(join(assetsDir, stored), bytes, { flag: 'wx' })
      } catch (error) {
        throw storageError('writing uploaded avatar', error)
      }
      return { asset: stored, overwritten: false }
    })
  }

  /**
   * Build the panel's model catalog: the same provider/model data the
   * composer's model menu shows (`llm.listProviders` → `listModels` →
   * `resolveModelInfo`), filtered to providers whose catalog loaded.
   * @returns provider-grouped routable models with display metadata.
   */
  @Remote('modelCatalog')
  async modelCatalog(): Promise<{
    groups: Array<{ id: string; name: string; models: Array<{ id: string; name: string; reasoningEfforts?: string[] }> }>
    failures: Array<{ id: string; message: string }>
  }> {
    const providers = this.ctx.llm.listProviders()
    const groups: Array<{ id: string; name: string; models: Array<{ id: string; name: string; reasoningEfforts?: string[] }> }> = []
    const failures: Array<{ id: string; message: string }> = []
    await Promise.all(providers.map(async (provider) => {
      try {
        const models = await this.ctx.llm.listModels(provider.id)
        const entries = await Promise.all(models.map(async (model) => {
          const resolved = await this.ctx.llm.resolveModelInfo(provider.id, model.id)
          const reasoningEfforts = resolved.reasoning?.efforts.map(effort => effort.id)
          return {
            id: model.id,
            name: model.name ?? model.id,
            ...(reasoningEfforts !== undefined && reasoningEfforts.length > 0 ? { reasoningEfforts } : {}),
          }
        }))
        if (entries.length > 0) groups.push({ id: provider.id, name: provider.name, models: entries })
      } catch (error) {
        failures.push({ id: provider.id, message: String(error) })
      }
    }))
    return { groups, failures }
  }

  /**
   * Switch one member's model route in place by recording a `model/selection`
   * event on that member's Session — the same mechanism the
   * subagent-model-switch plugin exposes as `subagentRoute/switch`.
   *
   * Works for the lead session and any live/resident child. A cold continuable
   * child with a live parent (request `parentSessionId`) is first woken through
   * the same subagent delivery the composer uses — the wake prompt is one
   * visible `[model changed: …]` notice — because opening a child view never
   * materializes its Agent. Children without a live parent, and one-shot or
   * external ids that no delivery can wake, stay refused.
   * @param request - member session id, the target route, and the direct parent for wake delivery.
   * @returns the applied selection and the member's previous route.
   */
  @Remote('switchModel')
  async switchModel(request: {
    sessionId: string
    provider: string
    model: string
    reasoningEffort?: string
    parentSessionId?: string
  }): Promise<{
    applied: { provider: string; model: string; reasoningEffort?: string }
    lastUsed?: { provider: string; model: string }
  }> {
    if (!nonEmpty(request?.sessionId) || !nonEmpty(request?.provider) || !nonEmpty(request?.model)) {
      throw new RemoteError(
        'teamPanel/invalid-request',
        'switchModel requires sessionId, provider, and model as non-empty strings',
        {},
      )
    }
    let agent = this.ctx.agents.get(request.sessionId as never)
    if (agent === undefined && nonEmpty(request.parentSessionId)) {
      agent = await this.wakeChildForMember({
        sessionId: request.sessionId,
        provider: request.provider,
        model: request.model,
        ...request.reasoningEffort === undefined ? {} : { reasoningEffort: request.reasoningEffort },
        parentSessionId: request.parentSessionId,
      })
    }
    if (agent === undefined) {
      throw new RemoteError(
        'teamPanel/not-live',
        `no live Agent for session "${request.sessionId}"; the member must be running, resident, or woken through its live parent session`,
        { sessionId: request.sessionId },
      )
    }
    // Preflight the route exactly like session/selectModel does before append.
    await this.ctx.llm.resolveCallConfig({
      provider: request.provider,
      model: request.model,
      ...request.reasoningEffort === undefined ? {} : { reasoningEffort: request.reasoningEffort as never },
    })
    const header = agent.session.requestHeader()?.config
    agent.model.select({
      provider: request.provider,
      model: request.model,
      ...request.reasoningEffort === undefined ? {} : { reasoningEffort: request.reasoningEffort as never },
    })
    return {
      applied: {
        provider: request.provider,
        model: request.model,
        ...request.reasoningEffort === undefined ? {} : { reasoningEffort: request.reasoningEffort },
      },
      ...(header === undefined ? {} : { lastUsed: { provider: header.provider, model: header.model } }),
    }
  }

  /**
   * List the sessions removed from team rosters: the intersection of the
   * lead's durable subagent catalog with the Workspace registry's global
   * archive set. Removing a member archives its Session (with work stopped),
   * so this is exactly the hidden-from-roster set.
   * @param request - the lead session whose direct children are filtered.
   * @returns child session ids currently archived.
   */
  @Remote('archivedChildren')
  async archivedChildren(request: { sessionId: string }): Promise<{ archived: string[] }> {
    if (!nonEmpty(request?.sessionId)) {
      throw new RemoteError(
        'teamPanel/invalid-request',
        'archivedChildren requires a non-empty sessionId',
        {},
      )
    }
    const children = await this.ctx.subagents.listChildren(request.sessionId as never)
    const archived = new Set(this.ctx.workspaceRegistry.archivedSessionIds)
    return { archived: children.filter(child => archived.has(child.id)).map(child => child.id) }
  }

  /**
   * Wake one cold continuable child through the same delivery the composer
   * uses, so opening a read-only child view is never a prerequisite for a
   * model switch. The wake prompt is a single visible notice phrased like the
   * harness' own model-change notice, so the child log stays truthful about
   * the route change; delivery itself materializes the Agent (cold resume).
   *
   * The target route is recorded BEFORE delivery and applied from a global
   * `agent/created` listener: those listeners run serially before the child's
   * queued inbox work is released, so the first wake step already prepares on
   * the new route instead of racing the switch (a lost race replays the dead
   * route the wake was meant to replace).
   * @param request - child id, target route, and the live direct parent id.
   * @returns the materialized child Agent, or undefined when the wake did not publish one.
   */
  private async wakeChildForMember(request: {
    readonly sessionId: string
    readonly provider: string
    readonly model: string
    readonly reasoningEffort?: string
    readonly parentSessionId: string
  }): Promise<Agent | undefined> {
    const parent = this.ctx.agents.get(request.parentSessionId as never)
    if (parent === undefined) {
      throw new RemoteError(
        'teamPanel/parent-not-live',
        `parent session "${request.parentSessionId}" is not live; open the parent conversation before switching this member's model`,
        { sessionId: request.sessionId, parentSessionId: request.parentSessionId },
      )
    }
    const wakeSelection: { provider: string; model: string; reasoningEffort?: never } = {
      provider: request.provider,
      model: request.model,
    }
    const applyWakeSelection = (): undefined => {
      const queued = this.wakeSelections.get(request.sessionId)
      if (queued === undefined) return undefined
      this.wakeSelections.delete(request.sessionId)
      this.ctx.agents.get(request.sessionId as never)?.model.select(queued)
      return undefined
    }
    this.wakeSelections.set(request.sessionId, wakeSelection)
    const listener = this.ctx.on('agent/created', applyWakeSelection, { global: true })
    try {
      const route = `${request.provider}/${request.model}`
      const notice = `[model changed: the session continues with ${route}]`
      // The composer's own delivery path: the SubagentRuntime remote validates
      // the address, requires the live direct parent, cold-resumes the child,
      // and accepts the notice into its inbox.
      await this.ctx.subagents.prompt({
        requestId: randomUUID() as never,
        parentSessionId: request.parentSessionId as never,
        childSessionId: request.sessionId as never,
        mode: 'continuable',
        delivery: 'queue',
        content: [{ type: 'text', text: notice }],
      }, new AbortController().signal)
      // prompt resolves at inbox acceptance; the agent/created listener has
      // normally applied the selection already (creation precedes release of
      // queued work). Poll only for the Agent handle the caller records from.
      for (let attempt = 0; attempt < 50; attempt++) {
        const agent = this.ctx.agents.get(request.sessionId as never)
        if (agent !== undefined) {
          applyWakeSelection()
          return agent
        }
        await new Promise(resolve => { setTimeout(resolve, 100) })
      }
      return this.ctx.agents.get(request.sessionId as never)
    } finally {
      listener()
      this.wakeSelections.delete(request.sessionId)
    }
  }
}

/** One row of `list_agents` output as the model sees it. */
interface AgentListRow {
  readonly kind: string
  readonly id: string
  readonly status?: string
  readonly label?: string
  readonly parent?: string
  readonly depth?: number
}

/** Re-render one filtered `list_agents` result the way the stock tool renders it. */
function renderAgentRows(rows: readonly AgentListRow[]): JsonValue[] {
  return rows.map(row => row as unknown as JsonValue)
}

/**
 * Filter archived (team-removed) subagents out of the model-facing
 * `list_agents` result so agents the human removed stay invisible to the
 * model too. Runs as a `tools/post-execute` listener: only successful
 * `list_agents` calls are rewritten; every other result passes through.
 */
function filterListAgents(ctx: Context): () => void {
  const listener = ctx.on('tools/post-execute', async (exec, result, next) => {
    const rows: readonly AgentListRow[] | undefined = exec.name === 'list_agents' && !result.isError
      && Array.isArray(result.value)
      ? result.value as unknown as readonly AgentListRow[] : undefined
    const archived = rows !== undefined && rows.length > 0
      ? new Set(ctx.workspaceRegistry.archivedSessionIds) : new Set<string>()
    const kept = rows?.filter(row => !archived.has(row.id))
    const rewrite = kept !== undefined && kept.length !== rows?.length
    const decision = await next()
    if (!rewrite || decision.kind !== 'accept' || kept === undefined) return decision
    // Value replacement alone re-renders through the stock tool's own output.render.
    return { kind: 'accept', value: renderAgentRows(kept) }
  })
  return listener
}

/**
 * Refuse `send_message` and `interrupt_agent` calls whose target the human
 * already removed from the team, with a reason naming the removal. Without
 * this the call reaches the delivery layer and fails with an opaque
 * authorization error instead of the actionable one.
 */
function refuseRemovedTargets(ctx: Context): () => void {
  const listener = ctx.on('tools/pre-execute', async (exec, next) => {
    if (exec.name === 'send_message' || exec.name === 'interrupt_agent') {
      const target = (exec.arguments as { agent_id?: unknown } | undefined | null)?.agent_id
      if (typeof target === 'string' && ctx.workspaceRegistry.archivedSessionIds.includes(target as never)) {
        return {
          kind: 'deny',
          reason: `agent ${target} was removed from the team; restore it in the Team panel settings to message it again`,
        }
      }
    }
    return next()
  })
  return listener
}

export const name = 'dsh-team-panel'
export const inject = TeamPanelAvatarService.inject

export function apply(ctx: Context, config: { dataDir?: string } = {}): void {
  ctx.plugin(TeamPanelAvatarService, config)
  ctx.effect(() => filterListAgents(ctx), 'team-panel: list_agents archive filter')
  ctx.effect(() => refuseRemovedTargets(ctx), 'team-panel: removed-target refusal')
}
