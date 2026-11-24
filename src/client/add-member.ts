/**
 * Human-authorized member creation: the `teamPanel/addMember` RPC over the
 * browser `/api` Connection channel. The host maps the requested depth tier to
 * an Agent Preset, so this module sends only the tier number.
 */

/** Error carrying the host's failure code beside its message. */
export class AddMemberError extends Error {
  readonly detail: string
  constructor(message: string, detail: string) {
    super(message)
    this.name = 'AddMemberError'
    this.detail = detail
  }
}

/** Request of one member creation: where to add it, what it starts doing, and its depth tier. */
export interface AddMemberRequest {
  /** Lead session the member joins. */
  sessionId: string
  /** Initial task delivered as the member's first message. */
  prompt: string
  /** Display label; absent, the host derives one from the task's first line. */
  label?: string
  /** Delegation-depth tier (1–3); default 1. */
  depth?: number
}

/**
 * Create one roster member under the lead session.
 * @param request - member identity and task fields.
 * @returns the created member's session id.
 * @throws {AddMemberError} on transport failure or a failed RPC result.
 */
export async function addMember(request: AddMemberRequest): Promise<{ childId: string }> {
  const response = await fetch('api/teamPanel/addMember', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `team-panel-add-${String(Date.now())}`,
      method: 'teamPanel/addMember',
      payload: { args: { request } },
    }),
  })
  if (!response.ok) {
    throw new AddMemberError(`transport failure: HTTP ${String(response.status)}`, String(response.status))
  }
  const envelope = await response.json() as {
    type: string
    result: { ok: true; value?: { childId: string } } | { ok: false; error: { code: string; message: string } }
  }
  const result = envelope.result
  if (result === undefined || !result.ok) {
    const code = result?.error?.code ?? 'teamPanel/transport'
    throw new AddMemberError(result?.error?.message ?? code, code)
  }
  return result.value ?? { childId: '' }
}
