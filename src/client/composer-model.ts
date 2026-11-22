/** Reuse the installed model selector; addressed children submit only to live-agent RPC. */
import type { Context } from '@deepseek-ai/cordis'
import type { ReactElement } from 'react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ModelSelectInjected, ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type { PropsLocale, PropsRuntime, PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ModelSelection, ModelCatalog } from '@deepseek-ai/dsh-api-session-controller/types'

/** Call a catalog or live-agent endpoint without activating stored Session history. */
async function modelRpc<T>(method: string, args: object): Promise<RemoteResult<T>> {
  try {
    const response = await fetch(`api/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method, payload: { args } }),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const envelope = await response.json() as { result: RemoteResult<T> }
    if (typeof envelope.result?.ok !== 'boolean') throw new Error('Invalid model selection response')
    return envelope.result
  } catch (error) {
    return { ok: false, error: { code: 'gateway/internal', message: String(error), name: 'RemoteError', details: {}, isDSHRemoteError: true } }
  }
}

type NativeProps = ModelSelectInjected & Pick<PropsRuntime<'conversation.input.model'>, 'locked'>
  & PropsLocale<'model'> & Omit<PropsRenderSlots<'conversation.input.model.label'>, 'SessionProvider' | '__renders'>

/** Register the native component with an addressed-session injection adapter. */
export function registerComposerModel(ctx: Context): void {
  ctx.inject(['modelDirectories'], scope => {
    // The label declaration exists only once the native model entry is registered.
    scope.slots.inject('conversation.input.model.label', () => {
      const original = scope.slots.entries('conversation.input.model').find(entry => entry.locale === 'model')
      if (original?.inject === undefined || typeof original.component !== 'function') {
        throw new Error('Team panel requires the installed native model selector')
      }
      // The registry erases component and injection types; this adapter targets the rc.1 model slot.
      const nativeInject = original.inject as (id: SessionId) => ModelSelectInjected & Record<string, unknown>
      const NativeSelector = original.component as (props: NativeProps) => ReactElement | null
      const faces = new Map<SessionId, ModelSelectInjected>()
      const cleanups = new Set<() => void>()
      scope.effect(() => () => { for (const cleanup of cleanups) cleanup(); cleanups.clear(); faces.clear() }, 'team-panel: model adapters')
      // The right-hand extension sits immediately before the native model seat,
      // which is hidden for addressed children. The main-session seat stays untouched.
      const presentation = {
        locked: false,
        renderSlot: ((_key, _owner, options) => options?.fallback ?? null) as NativeProps['renderSlot'],
      }
      return scope.slots.register({
        name: 'conversation.input.right', id: 'team-panel-child-model', order: 100, locale: 'model',
        inject: (sessionId: SessionId): ModelSelectInjected & typeof presentation => {
          const native = nativeInject(sessionId)
          const address = scope.sessions.subagentAddress(sessionId)
          if (address === undefined) return { ...native, ...presentation, available: false }
          const cached = faces.get(sessionId)
          if (cached !== undefined) return { ...cached, ...presentation }
          const sessionScope = scope.sessions.scope(sessionId)
          if (sessionScope === undefined) throw new Error('Missing child session scope')
          const directory = createSnapshotStore<ModelDirectoryState>(native.directory.getSnapshot())
          let pending: ModelSelection | null = null
          let selectionError: string | null = null
          let disposed = false
          let loading = false
          let catalog: ModelCatalog | null = null
          const sync = (): void => {
            if (disposed) return
            const state = native.directory.getSnapshot()
            const current = state.current ?? catalog?.default ?? null
            const groups = catalog?.groups ?? state.groups
            directory.set({ ...state, current, groups, failures: catalog?.failures ?? state.failures,
              routable: current === null ? null : groups.some(group => group.id === current.provider
                && group.models.some(model => model.id === current.model)),
              pending, error: selectionError ?? (catalog === null ? state.error : null),
              status: pending !== null ? 'selecting' : selectionError !== null ? 'error'
                : loading ? 'loading' : catalog !== null ? 'ready' : state.status })
          }
          const unsubscribe = native.directory.subscribe(() => { catalog = null; sync() })
          const cleanup = (): void => {
            if (disposed) return
            disposed = true
            unsubscribe()
            faces.delete(sessionId)
            cleanups.delete(cleanup)
          }
          cleanups.add(cleanup)
          sessionScope.effect(() => cleanup, 'team-panel: child model directory')
          const face: ModelSelectInjected = {
            ...native, available: address.mode === 'continuable', directory,
            load: () => {
              if (loading || disposed) return
              selectionError = null
              loading = true
              sync()
              // This catalog RPC is Host-wide and never activates a Session.
              // The parent binding need not remain open while browsing a child.
              void modelRpc<ModelCatalog>('session/modelCatalog', {}).then(result => {
                if (disposed) return
                if (result.ok) catalog = result.value
                else selectionError = result.error.message
              }).catch(error => {
                if (!disposed) selectionError = String(error)
              }).finally(() => { loading = false; sync() })
            },
            select: async selection => {
              if (pending !== null || disposed) return undefined
              pending = selection
              selectionError = null
              sync()
              // The address carries the parent id, so a cold child is woken
              // through the composer's own delivery path before the switch.
              const result = await modelRpc<void>('teamPanel/switchModel', {
                request: {
                  sessionId,
                  ...address.mode === 'continuable' ? { parentSessionId: address.parentSessionId } : {},
                  ...selection,
                },
              })
              pending = null
              if (!result.ok) selectionError = result.error.message
              sync()
              return result
            },
          }
          faces.set(sessionId, face)
          return { ...face, ...presentation }
        },
      }, NativeSelector)
    })
  })
}
