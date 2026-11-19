import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { IconChevronDownOutlineRegular, StateDot, useAnchoredPosition, useDismissOnOutsidePointer }
  from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { NS } from './locales.ts'
import css from './styles.ts'

/** One provider and its models as served by `teamPanel/modelCatalog`. */
interface CatalogGroup {
  readonly id: string
  readonly name: string
  readonly models: ReadonlyArray<{ id: string; name: string; reasoningEfforts?: string[] }>
}

/** Client cache of the host catalog; fetched once, shared by every card. */
let catalogCache: ReadonlyArray<CatalogGroup> | null = null
let catalogInflight: Promise<void> | undefined
const catalogListeners = new Set<() => void>()

function publishCatalog(value: ReadonlyArray<CatalogGroup> | null): void {
  catalogCache = value
  for (const listener of catalogListeners) listener()
}

async function rpc<T>(method: string, args: Record<string, unknown>): Promise<T> {
  const response = await fetch(`api/teamPanel/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `team-panel-model-${method}-${Math.random().toString(36).slice(2, 8)}`,
      method: `teamPanel/${method}`,
      payload: { args },
    }),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const envelope = await response.json() as { result: { ok: boolean; value?: T; error?: { message?: string; code?: string } } }
  if (!envelope.result?.ok) throw new Error(envelope.result?.error?.message ?? envelope.result?.error?.code ?? 'Request failed')
  return envelope.result.value as T
}

/** Load the model catalog once per page (deduplicated in flight). */
export function loadModelCatalog(): void {
  if (catalogInflight !== undefined || catalogCache !== null) return
  catalogInflight = rpc<{ groups: CatalogGroup[] }>('modelCatalog', {})
    .then(value => { publishCatalog(value.groups) })
    .catch(() => { publishCatalog([]) })
    .finally(() => { catalogInflight = undefined })
}

function subscribeCatalog(onChange: () => void): () => void {
  catalogListeners.add(onChange)
  return () => { catalogListeners.delete(onChange) }
}

function getCatalog(): ReadonlyArray<CatalogGroup> | null {
  return catalogCache
}

/** Props of the member-card model switch seat. */
export interface ModelSeatProps {
  /** Member session id whose route is switched. */
  sessionId: string
  /** Current model id (display-only; the projection row already shows it). */
  currentModel: string | undefined
  /** Localized copy accessor. */
  t: TranslateNS<typeof NS>
}

/**
 * The member card's model-switch control: a compact trigger showing the
 * current model that opens an anchored menu of provider-grouped models
 * (with reasoning-effort sub-rows where the model offers them).
 *
 * The switch records a `model/selection` event on the member's Session; it
 * applies at that member's next step boundary, and the card's model line
 * updates from the `modelSelection` projection on its own.
 */
export function ModelSeat({ sessionId, currentModel, t }: ModelSeatProps) {
  const catalog = useSyncExternalStore(subscribeCatalog, getCatalog, getCatalog)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState<string | null>(null)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const rootRef = useRef<HTMLSpanElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const position = useAnchoredPosition({ open, anchorRef: rootRef, panelRef: menuRef, gap: 6, margin: 12 })

  useEffect(() => { loadModelCatalog() }, [])
  useEffect(() => { if (!open) setError(null) }, [open])

  useDismissOnOutsidePointer(rootRef, open, setOpen, menuRef)

  useEffect(() => {
    if (!open) return
    const dismiss = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
    }
    document.addEventListener('keydown', dismiss)
    return () => { document.removeEventListener('keydown', dismiss) }
  }, [open])

  const apply = async (provider: string, model: string, reasoningEffort?: string): Promise<void> => {
    if (applying !== null) return
    setApplying(`${provider}/${model}${reasoningEffort === undefined ? '' : `@${reasoningEffort}`}`)
    setError(null)
    try {
      await rpc('switchModel', { request: { sessionId, provider, model, ...reasoningEffort === undefined ? {} : { reasoningEffort } } })
      setOpen(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setApplying(null)
    }
  }

  return (
    <span ref={rootRef} className={css.modelSeat} data-model-seat>
      <button
        type="button"
        className={css.modelButton}
        aria-label={t('model.switch')}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={applying !== null}
        onClick={(event) => { event.stopPropagation(); setOpen(current => !current) }}
      >
        <span className={css.modelButtonText}>{applying ?? currentModel ?? t('model.none')}</span>
        <IconChevronDownOutlineRegular size={10} className={open ? css.expandToggleOpen : undefined} />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className={css.modelMenu}
          style={position ?? { visibility: 'hidden', left: 0, top: 0 }}
          role="menu"
          data-model-menu
          onPointerDown={(event) => { event.stopPropagation() }}
          onClick={(event) => { event.stopPropagation() }}
        >
          {error !== null && (
            <div className={css.error} role="alert"><StateDot state="error" />{error}</div>
          )}
          {catalog === null && (
            <div className={css.notice} role="status"><StateDot state="ongoing" />{t('model.loading')}</div>
          )}
          {catalog !== null && catalog.length === 0 && (
            <div className={css.notice} role="status"><StateDot state="warning" />{t('model.none')}</div>
          )}
          {catalog?.map(group => (
            <div key={group.id} className={css.modelGroup}>
              <button
                type="button"
                role="menuitem"
                className={css.modelGroupHead}
                aria-expanded={expandedGroup === group.id}
                onClick={() => { setExpandedGroup(current => current === group.id ? null : group.id) }}
              >
                {group.name}
                <IconChevronDownOutlineRegular size={10} className={expandedGroup === group.id ? css.expandToggleOpen : undefined} />
              </button>
              {expandedGroup === group.id && group.models.map(model => (
                <div key={model.id} className={css.modelItemWrap}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={currentModel === model.id}
                    className={currentModel === model.id ? `${css.modelItem} ${css.modelItemActive}` : css.modelItem}
                    disabled={applying !== null}
                    onClick={() => { void apply(group.id, model.id) }}
                  >
                    {model.name}
                  </button>
                  {model.reasoningEfforts?.map(effort => (
                    <button
                      key={effort}
                      type="button"
                      role="menuitemradio"
                      className={css.modelEffort}
                      disabled={applying !== null}
                      onClick={() => { void apply(group.id, model.id, effort) }}
                    >
                      {effort}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ))}
          <div className={css.modelHint}>{t('model.hint')}</div>
        </div>,
        document.body,
      )}
    </span>
  )
}
