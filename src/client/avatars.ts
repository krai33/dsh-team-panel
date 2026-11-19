/**
 * Client-side avatar store: fetch-backed view of the host `teamPanel`
 * namespace over the browser `/api` Connection RPC channel.
 *
 * The same channel the CLI uses (cookie-authenticated POST with the
 * `{type:"client-request",…}` envelope) is reachable from the page, so the
 * plugin needs no generated Typert client artifact. The panel and the
 * settings tab subscribe through `useSyncExternalStore`; confirmed writes
 * update the shared snapshot.
 */

export interface AvatarSnapshot {
  /** session-id → asset file name. */
  readonly assignments: Readonly<Record<string, string>>
  /** Available image file names from the plugin data directory. */
  readonly assets: readonly string[]
  /** User-added images that may be deleted. */
  readonly deletableAssets: readonly string[]
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

type RpcResult<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } }
type AvatarList = Omit<AvatarSnapshot, 'loaded' | 'deletableAssets'> & Pick<Partial<AvatarSnapshot>, 'deletableAssets'>

const listeners = new Set<() => void>()
let rpcCounter = 0

let snapshot: AvatarSnapshot = { assignments: {}, assets: [], deletableAssets: [], loaded: false }
let inflight: Promise<void> | undefined
let operations: Promise<void> = Promise.resolve()

function serialize<T>(run: () => Promise<T>): Promise<T> {
  const next = operations.then(run)
  operations = next.then(() => undefined, () => undefined)
  return next
}

async function refresh(): Promise<void> {
  const { deletableAssets = [], ...value } = await call<AvatarList>('list', {})
  publish({ ...value, deletableAssets, loaded: true })
}

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
    const code = result?.error?.code ?? 'teamPanel/transport'
    throw new AvatarAssignError(result?.error?.message ?? code, code)
  }
  return result.value
}

/**
 * Request the current mapping from the host (deduplicated in flight).
 */
export function loadAvatars(): void {
  if (inflight !== undefined) return
  inflight = serialize(refresh)
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
 * Upload one browser-picked image into the host asset directory.
 * @param file - the picked image file.
 * @returns the stored asset name (sanitized server-side).
 * @throws {AvatarAssignError} when the host rejects the upload.
 */
export async function uploadAvatar(file: File): Promise<string> {
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => { resolve(String(reader.result).split(',')[1] ?? '') }
    reader.onerror = () => { reject(new AvatarAssignError('reading the file failed', 'read-error')) }
    reader.readAsDataURL(file)
  })
  return serialize(async () => {
    const value = await call<{ asset: string }>('upload', { request: { name: file.name, data } })
    await refresh()
    return value.asset
  })
}

/**
 * Write one assignment (empty asset clears) and refresh the snapshot.
 * @param sessionId - member session id.
 * @param asset - asset file name, or '' to clear.
 * @throws {AvatarAssignError} when the host rejects the write.
 */
export async function assignAvatar(sessionId: string, asset: string): Promise<void> {
  return serialize(async () => {
    const { assignments } = await call<Pick<AvatarSnapshot, 'assignments'>>('assign', { request: { sessionId, asset } })
    publish({ ...snapshot, assignments, loaded: true })
  })
}

/** Delete one custom image and publish the confirmed library and assignment changes. */
export function deleteAvatar(asset: string): Promise<void> {
  return serialize(async () => {
    const { assignments } = await call<Pick<AvatarSnapshot, 'assignments'>>('deleteAvatar', { request: { asset } })
    publish({ ...snapshot, assignments, assets: snapshot.assets.filter(name => name !== asset),
      deletableAssets: snapshot.deletableAssets.filter(name => name !== asset), loaded: true })
  })
}
