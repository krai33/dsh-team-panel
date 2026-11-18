import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { IconUserOutlineRegular, IconPlusOutlineRegular, StateDot, useAnchoredPosition, useDismissOnOutsidePointer }
  from '@deepseek-ai/dsh-client-ui-primitives'
import { assignAvatar, AvatarAssignError, getSnapshot, loadAvatars, subscribe, uploadAvatar } from './avatars.ts'
import { NS, type TeamKey } from './locales.ts'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import css from './styles.ts'

/** Props of the member-card avatar seat (image or fallback person glyph). */
export interface AvatarSeatProps {
  /** Member session id whose assignment the seat reads. */
  sessionId: string
  /** Localized copy accessor. */
  t: TranslateNS<typeof NS>
}

/**
 * The half-height person glyph with a click-through avatar picker.
 *
 * Renders the assigned image when one exists, otherwise the stock person
 * icon (the official panel's inactive-member glyph). Click opens a small
 * anchored menu listing the configured images (plus a "clear" row); choosing
 * one writes through `teamPanel/assign` and the seat re-renders immediately.
 */
export function AvatarSeat({ sessionId, t }: AvatarSeatProps) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const position = useAnchoredPosition({ open, anchorRef: rootRef, panelRef, gap: 6, margin: 12 })

  useEffect(() => { loadAvatars() }, [])

  useEffect(() => {
    if (!open) setError(null)
  }, [open])

  useDismissOnOutsidePointer(rootRef, open, setOpen, panelRef)

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

  const file = state.assignments[sessionId]
  const busy = state.assets.length === 0 && !state.loaded

  const choose = async (asset: string): Promise<void> => {
    try {
      await assignAvatar(sessionId, asset)
      setOpen(false)
    } catch (reason) {
      setError(reason instanceof AvatarAssignError ? reason.message : String(reason))
    }
  }

  const onPickFile = async (picked: File | undefined): Promise<void> => {
    if (picked === undefined) return
    setUploading(true)
    setError(null)
    try {
      const stored = await uploadAvatar(picked)
      await assignAvatar(sessionId, stored)
      setOpen(false)
    } catch (reason) {
      setError(reason instanceof AvatarAssignError ? reason.message : String(reason))
    } finally {
      setUploading(false)
    }
  }

  return (
    <span
      ref={rootRef}
      className={`${css.memberDot} ${css.avatarSeat}`}
      data-avatar-seat
    >
      <button
        type="button"
        className={css.avatarButton}
        aria-label={t('avatar.pick')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => { event.stopPropagation(); setOpen(current => !current) }}
      >
        {file === undefined
          ? <IconUserOutlineRegular size={14} className={css.inactiveIcon} />
          : <img
              className={css.avatarImage}
              src={`plugins/dsh-team-panel/assets/${encodeURIComponent(file)}`}
              alt={t('avatar.image')}
              draggable={false}
            />}
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          className={css.avatarMenu}
          style={position ?? { visibility: 'hidden', left: 0, top: 0 }}
          role="menu"
          data-avatar-menu
          // The dismissal hook closes on outside pointerdown; menu-internal
          // pointerdowns must not count (portal places the menu outside the
          // seat root, so React's own capture never reaches it first).
          onPointerDown={(event) => { event.stopPropagation() }}
          onClick={(event) => { event.stopPropagation() }}
        >
          {error !== null && (
            <div className={css.error} role="alert"><StateDot state="error" />{error}</div>
          )}
          {busy && (
            <div className={css.notice} role="status"><StateDot state="ongoing" />{t('avatar.loading')}</div>
          )}
          {!busy && state.assets.length === 0 && (
            <div className={css.notice} role="status"><StateDot state="warning" />{t('avatar.none')}</div>
          )}
          {state.assets.map(asset => (
            <button
              key={asset}
              type="button"
              role="menuitemradio"
              aria-checked={file === asset}
              className={file === asset ? `${css.avatarOption} ${css.avatarOptionActive}` : css.avatarOption}
              onClick={() => { void choose(asset) }}
            >
              <img
                className={css.avatarThumb}
                src={`plugins/dsh-team-panel/assets/${encodeURIComponent(asset)}`}
                alt={asset}
                draggable={false}
              />
              <span className={css.avatarName}>{asset}</span>
            </button>
          ))}
          <label className={css.avatarUpload}>
            <IconPlusOutlineRegular size={12} />
            <span>{uploading ? t('avatar.uploading') : t('avatar.upload')}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
              className={css.avatarUploadInput}
              disabled={uploading}
              onChange={(event) => {
                void onPickFile(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          </label>
          {file !== undefined && (
            <button
              type="button"
              role="menuitem"
              className={css.avatarClear}
              onClick={() => { void choose('') }}
            >
              {t('avatar.clear')}
            </button>
          )}
        </div>,
        document.body,
      )}
    </span>
  )
}
