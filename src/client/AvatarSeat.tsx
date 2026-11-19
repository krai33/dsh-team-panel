import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { IconUserOutlineRegular, IconPlusOutlineRegular, IconTrashOutlineRegular, StateDot, Tooltip, useAnchoredPosition, useDismissOnOutsidePointer }
  from '@deepseek-ai/dsh-client-ui-primitives'
import { assignAvatar, AvatarAssignError, deleteAvatar, getSnapshot, loadAvatars, subscribe, uploadAvatar } from './avatars.ts'
import { NS } from './locales.ts'
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
 * Render the member avatar and a picker for assigning or deleting library images.
 */
export function AvatarSeat({ sessionId, t }: AvatarSeatProps) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const deleteTrigger = useRef<string | null>(null)
  const cancelDelete = useRef<HTMLButtonElement>(null)
  const rootRef = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const position = useAnchoredPosition({ open, anchorRef: rootRef, panelRef, gap: 6, margin: 12, layoutKey: deleteTarget ?? undefined })

  useEffect(() => { loadAvatars() }, [])

  const changeOpen = (next: boolean): void => {
    if (deleting) return
    setOpen(next)
    setError(null)
    setDeleteTarget(null)
    deleteTrigger.current = null
    if (next) loadAvatars()
  }
  useDismissOnOutsidePointer(rootRef, open, changeOpen, panelRef)

  useEffect(() => {
    if (deleteTarget !== null) {
      cancelDelete.current?.focus()
    } else if (open && deleteTrigger.current !== null) {
      const button = [...(panelRef.current?.querySelectorAll<HTMLButtonElement>('[data-avatar-delete]') ?? [])]
        .find(candidate => candidate.dataset.avatarDelete === deleteTrigger.current)
      ;(button ?? panelRef.current)?.focus()
      deleteTrigger.current = null
    }
  }, [open, deleteTarget])

  const dismissDelete = (): void => {
    if (deleting) return
    setError(null)
    setDeleteTarget(null)
  }

  useEffect(() => {
    if (!open) return
    const dismiss = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (deleting) return
      if (deleteTarget !== null) {
        setError(null)
        setDeleteTarget(null)
      } else {
        changeOpen(false)
        rootRef.current?.querySelector('button')?.focus()
      }
    }
    document.addEventListener('keydown', dismiss, true)
    return () => { document.removeEventListener('keydown', dismiss, true) }
  }, [open, deleteTarget, deleting])

  const file = state.assignments[sessionId]
  const busy = state.assets.length === 0 && !state.loaded
  const deletable = new Set(state.deletableAssets)

  const confirmDelete = async (): Promise<void> => {
    if (deleteTarget === null || deleting) return
    setDeleting(true)
    setError(null)
    try {
      await deleteAvatar(deleteTarget)
      setDeleteTarget(null)
    } catch (reason) {
      if (reason instanceof AvatarAssignError && reason.detail === 'teamPanel/unknown-asset') loadAvatars()
      setError(t('avatar.deleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

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
      className={css.avatarSeat}
      data-avatar-seat
    >
      <button
        type="button"
        className={css.avatarButton}
        aria-label={t('avatar.pick')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => { event.stopPropagation(); changeOpen(!open) }}
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
          role={deleteTarget === null ? 'menu' : 'dialog'}
          aria-label={t(deleteTarget === null ? 'avatar.pick' : 'avatar.deleteTitle')}
          tabIndex={-1}
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
          {deleteTarget !== null ? (
            <div className={css.avatarConfirm} aria-busy={deleting}>
              <div className={css.confirmTitle}>{t('avatar.deleteTitle')}</div>
              <div className={css.confirmDesc}>{t('avatar.deleteDesc', { asset: deleteTarget })}</div>
              <div className={css.confirmActions}>
                <button ref={cancelDelete} type="button" className={css.confirmCancel} disabled={deleting} onClick={dismissDelete}>
                  {t('remove.cancel')}
                </button>
                <button type="button" className={css.confirmGo} disabled={deleting} onClick={() => { void confirmDelete() }}>
                  {t(deleting ? 'avatar.deleting' : 'avatar.deleteTitle')}
                </button>
              </div>
            </div>
          ) : <>
            {busy && (
              <div className={css.notice} role="status"><StateDot state="ongoing" />{t('avatar.loading')}</div>
            )}
            {!busy && state.assets.length === 0 && (
              <div className={css.notice} role="status"><StateDot state="warning" />{t('avatar.none')}</div>
            )}
            {state.assets.map(asset => (
              <div key={asset} role="presentation" className={css.avatarOptionRow}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={file === asset}
                  className={file === asset ? `${css.avatarOption} ${css.avatarOptionActive}` : css.avatarOption}
                  onClick={() => { void choose(asset) }}
                >
                  <img
                    className={css.avatarThumb}
                    src={`plugins/dsh-team-panel/assets/${encodeURIComponent(asset)}`}
                    alt=""
                    draggable={false}
                  />
                  <span className={css.avatarName}>{asset}</span>
                </button>
                {deletable.has(asset) && (
                  <Tooltip label={t('avatar.deleteTitle')} side="left">
                    <button
                      type="button"
                      role="menuitem"
                      className={css.avatarDelete}
                      aria-label={t('avatar.deleteLabel', { asset })}
                      aria-haspopup="dialog"
                      disabled={uploading}
                      data-avatar-delete={asset}
                      onClick={() => {
                        deleteTrigger.current = asset
                        setError(null)
                        setDeleteTarget(asset)
                      }}
                    >
                      <IconTrashOutlineRegular size={14} />
                    </button>
                  </Tooltip>
                )}
              </div>
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
          </>}
        </div>,
        document.body,
      )}
    </span>
  )
}
