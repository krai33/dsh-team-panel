/**
 * Client-side removed-member store: which subagent children of each lead are
 * archived (hidden from the roster). Backed by the host `teamPanel/archivedChildren`
 * RPC; the remove action itself goes through the stock workspace archive RPC
 * (`uiWorkspace.archiveSession` with `stopActivity`), so this module only tracks
 * visibility and refreshes after each action.
 */

export interface RemovedSnapshot {
  /** lead session id → archived direct-child session ids. */
  readonly byLead: Readonly<Record<string, readonly string[]>>
  /** Whether the initial load for the current leads settled (either way). */
  readonly loaded: boolean
}

const listeners = new Set<() => void>()
let rpcCounter = 0
let snapshot: RemovedSnapshot = { byLead: {}, loaded: false }
const inflight = new Map<string, Promise<void>>()

function publish(next: RemovedSnapshot): void {
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
      rpcId: `team-panel-removed-${rpcCounter}`,
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

/**
 * Load the archived-children set for one lead (deduplicated in flight).
 * @param leadId - lead session whose direct children are filtered.
 */
export function loadRemoved(leadId: string): void {
  if (inflight.has(leadId)) return
  const operation = call<{ archived: string[] }>('archivedChildren', { request: { sessionId: leadId } })
    .then(value => {
      publish({ byLead: { ...snapshot.byLead, [leadId]: value.archived }, loaded: true })
    })
    .catch(() => {
      // Absent data never hides members; treat as an empty set.
      publish({ byLead: { ...snapshot.byLead, [leadId]: [] }, loaded: true })
    })
    .finally(() => { inflight.delete(leadId) })
  inflight.set(leadId, operation)
}

/** Drop one lead's cached set (e.g. after switching sessions). */
export function forgetRemoved(leadId: string): void {
  if (!(leadId in snapshot.byLead)) return
  const { [leadId]: _drop, ...rest } = snapshot.byLead
  publish({ byLead: rest, loaded: snapshot.loaded })
}

/**
 * Record one member as removed after a successful archive.
 * @param leadId - lead session id.
 * @param childId - archived direct child.
 */
export function markRemoved(leadId: string, childId: string): void {
  const current = snapshot.byLead[leadId] ?? []
  if (current.includes(childId)) return
  publish({ byLead: { ...snapshot.byLead, [leadId]: [...current, childId] }, loaded: true })
}

/**
 * Record one member as restored after a successful unarchive.
 * @param leadId - lead session id.
 * @param childId - unarchived direct child.
 */
export function markRestored(leadId: string, childId: string): void {
  const current = snapshot.byLead[leadId]
  if (current === undefined || !current.includes(childId)) return
  publish({ byLead: { ...snapshot.byLead, [leadId]: current.filter(id => id !== childId) }, loaded: true })
}

/** Subscribe hook backing React's `useSyncExternalStore`. */
export function subscribeRemoved(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  return () => { listeners.delete(onStoreChange) }
}

/** Current snapshot getter for `useSyncExternalStore`. */
export function getRemovedSnapshot(): RemovedSnapshot {
  return snapshot
}

/**
 * POST the stock workspace archive/unarchive RPC the sidebar uses
 * (`workspaceController`, wire namespace `workspace`).
 * @param method - `workspace/archiveSession` or `workspace/unarchiveSession`.
 * @param sessionId - target session id.
 */
async function workspaceCall(method: 'archiveSession' | 'unarchiveSession', sessionId: string, stopActivity: boolean): Promise<void> {
  rpcCounter += 1
  const response = await fetch(`api/workspace/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `team-panel-remove-${rpcCounter}`,
      method: `workspace/${method}`,
      payload: { args: { request: { sessionId, ...(stopActivity ? { stopActivity: true } : {}) } } },
    }),
  })
  if (!response.ok) throw new Error(`transport failure: HTTP ${response.status}`)
  const envelope = await response.json() as { result?: { ok: boolean; error?: { code?: string; message?: string } } }
  const result = envelope.result
  if (result === undefined || !result.ok) {
    throw new Error(result?.error?.message ?? result?.error?.code ?? 'Request failed')
  }
}

/**
 * Remove one member: stop its work and archive its session through the
 * stock workspace registry, then mark it hidden.
 * @param leadId - lead session id for roster bookkeeping.
 * @param childId - member session to remove.
 * @throws when the archive RPC fails.
 */
export async function removeMember(leadId: string, childId: string): Promise<void> {
  await workspaceCall('archiveSession', childId, true)
  markRemoved(leadId, childId)
}

/**
 * Restore one removed member by unarchiving its session.
 * @param leadId - lead session id for roster bookkeeping.
 * @param childId - member session to restore.
 * @throws when the unarchive RPC fails.
 */
export async function restoreMember(leadId: string, childId: string): Promise<void> {
  await workspaceCall('unarchiveSession', childId, false)
  markRestored(leadId, childId)
}
