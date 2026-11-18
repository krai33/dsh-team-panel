/**
 * Client-side avatar store: fetch-backed view of the host `teamPanel`
 * namespace (`list`/`assign`) over the browser `/api` Connection RPC channel.
 *
 * The same channel the CLI uses (cookie-authenticated POST with the
 * `{type:"client-request",…}` envelope) is reachable from the page, so the
 * plugin needs no generated Typert client artifact. The panel and the
 * settings tab subscribe through `useSyncExternalStore`; writes publish
 * optimistically so member cards re-render immediately.
 */

export interface AvatarSnapshot {
  /** session-id → asset file name. */
  readonly assignments: Readonly<Record<string, string>>
  /** Available image file names from the plugin data directory. */
  readonly assets: readonly string[]
  /** Whether the initial `list` call has settled (either way). */
  readonly loaded: boolean
}

/** One assignment write failed (unknown asset, storage error, transport). */
export class AvatarAssignError extends Error {
  readonly detail: string
  constructor(message: string, detail: string) {
    super(message)
    this.name = 'AvatarAssignError'
    this.detail = detail
  }
}

interface RpcResult<T> {
  ok: boolean
  value?: T
  message?: string
  details?: { code?: string }
}

const listeners = new Set<() => void>()
let rpcCounter = 0

let snapshot: AvatarSnapshot = { assignments: {}, assets: [], loaded: false }
let inflight: Promise<void> | undefined

function publish(next: AvatarSnapshot): void {
  snapshot = next
  for (const listener of listeners) listener()
}

/**
 * POST one Connection RPC envelope to the plugin's host namespace.
 * @param method - remote method below `teamPanel/`.
 * @param args - wire arguments record.
 * @returns the ok-case value.
 * @throws {AvatarAssignError} on transport failure or a failed result.
 */
async function call<T>(method: string, args: Record<string, unknown>): Promise<T> {
  rpcCounter += 1
  const response = await fetch(`api/teamPanel/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `team-panel-${rpcCounter}`,
      method: `teamPanel/${method}`,
      payload: { args },
    }),
  })
  if (!response.ok) {
    throw new AvatarAssignError(`transport failure: HTTP ${response.status}`, String(response.status))
  }
  const envelope = await response.json() as { type: string; result: RpcResult<T> }
  const result = envelope.result
  if (result === undefined || !result.ok) {
    const code = result?.details?.code ?? 'teamPanel/transport'
    throw new AvatarAssignError(result?.message ?? code, code)
  }
  return result.value as T
}

/**
 * Request the current mapping from the host (deduplicated in flight).
 */
export function loadAvatars(): void {
  if (inflight !== undefined) return
  inflight = call<{ assignments: Record<string, string>; assets: string[] }>('list', {})
    .then(value => { publish({ assignments: value.assignments, assets: value.assets, loaded: true }) })
    .catch(() => { publish({ ...snapshot, loaded: true }) })
    .finally(() => { inflight = undefined })
}

/**
 * Subscribe hook backing React's `useSyncExternalStore`.
 * @param onStoreChange - React's change callback.
 * @returns the disposer.
 */
export function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  return () => { listeners.delete(onStoreChange) }
}

/** Current snapshot getter for `useSyncExternalStore`. */
export function getSnapshot(): AvatarSnapshot {
  return snapshot
}

/**
 * Write one assignment (empty asset clears) and refresh the snapshot.
 * @param sessionId - member session id.
 * @param asset - asset file name, or '' to clear.
 * @throws {AvatarAssignError} when the host rejects the write.
 */
export async function assignAvatar(sessionId: string, asset: string): Promise<void> {
  const value = await call<{ assignments: Record<string, string> }>('assign', {
    request: { sessionId, asset },
  })
  publish({ ...snapshot, assignments: value.assignments, loaded: true })
}
