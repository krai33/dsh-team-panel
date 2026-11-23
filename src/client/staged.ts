/**
 * Client-side staged-route store: model routes recorded for cold members that
 * take effect at each member's next conversation. Backed by the host
 * `teamPanel/stagedSelections` RPC; the switch action records through
 * `teamPanel/switchModel`, which returns `staged: true` for cold members.
 */

export interface StagedRoute {
  readonly provider: string
  readonly model: string
  readonly reasoningEffort?: string
}

export interface StagedSnapshot {
  /** member session id → staged route. */
  readonly byMember: Readonly<Record<string, StagedRoute>>
  /** Whether the initial load settled (either way). */
  readonly loaded: boolean
}

const listeners = new Set<() => void>()
let rpcCounter = 0
let snapshot: StagedSnapshot = { byMember: {}, loaded: false }
let inflight: Promise<void> | undefined

function publish(next: StagedSnapshot): void {
  snapshot = next
  for (const listener of listeners) listener()
}

/** POST one Connection RPC envelope to the plugin's host namespace. */
async function call<T>(method: string, args: Record<string, unknown>): Promise<T> {
  rpcCounter += 1
  const response = await fetch(`api/teamPanel/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `team-panel-staged-${rpcCounter}`,
      method: `teamPanel/${method}`,
      payload: { args },
    }),
  })
  if (!response.ok) throw new Error(`transport failure: HTTP ${response.status}`)
  const envelope = await response.json() as { result?: { ok: boolean; value?: T; error?: { code?: string; message?: string } } }
  const result = envelope.result
  if (result === undefined || !result.ok) {
    throw new Error(result?.error?.message ?? result?.error?.code ?? 'Request failed')
  }
  return result.value as T
}

/** Load the staged-route map once per plugin lifetime (deduplicated in flight). */
export function loadStaged(): void {
  if (inflight !== undefined || snapshot.loaded) return
  inflight = call<{ selections: Record<string, StagedRoute> }>('stagedSelections', {})
    .then(value => {
      publish({ byMember: value.selections, loaded: true })
    })
    .catch(() => {
      // Absent data never overrides a durable route; treat as empty.
      publish({ byMember: {}, loaded: true })
    })
    .finally(() => { inflight = undefined })
}

/**
 * Record one staged route after a successful cold-member switch.
 * @param member - member session id.
 * @param route - the route the member's next conversation uses.
 */
export function markStaged(member: string, route: StagedRoute): void {
  publish({ byMember: { ...snapshot.byMember, [member]: route }, loaded: true })
}

/**
 * Retire a member's staged route — the projection is now authoritative.
 * @param member - member session id whose staged route was applied.
 */
export function markStagedApplied(member: string): void {
  if (!(member in snapshot.byMember)) return
  const { [member]: _drop, ...rest } = snapshot.byMember
  publish({ byMember: rest, loaded: snapshot.loaded })
}

/** Subscribe hook backing React's `useSyncExternalStore`. */
export function subscribeStaged(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  return () => { listeners.delete(onStoreChange) }
}

/** Current snapshot getter for `useSyncExternalStore`. */
export function getStagedSnapshot(): StagedSnapshot {
  return snapshot
}
