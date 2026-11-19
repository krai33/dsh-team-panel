import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SubagentCatalogEntry } from '@deepseek-ai/dsh-subagent/types'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import { IconPlusOutlineRegular, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { assignAvatar, AvatarAssignError, getSnapshot, loadAvatars, subscribe, uploadAvatar } from './avatars.ts'
import {
  getRemovedSnapshot, loadRemoved, restoreMember, subscribeRemoved,
} from './removed.ts'
import { NS } from './locales.ts'
import css from './styles.ts'

/** Full props of the Plugins-settings tab contributed by this plugin. */
export type TeamPanelTabProps =
  PropsRuntime<'settings.plugins.tab'> & PropsLocale<typeof NS>

/** One member row: label, current avatar thumbnail, and the assignment select. */
function MemberRow({
  sessionId, label, assignedAsset, assets, onChoose, error,
}: {
  sessionId: SessionId
  label: string
  assignedAsset: string | undefined
  assets: readonly string[]
  onChoose: (sessionId: string, asset: string) => void
  error: string | null
}) {
  return (
    <div className={css.settingsRow} data-settings-member={sessionId}>
      <span className={css.settingsLabel}>{label}</span>
      {assignedAsset !== undefined && (
        <img
          className={css.avatarThumb}
          src={`plugins/dsh-team-panel/assets/${encodeURIComponent(assignedAsset)}`}
          alt={assignedAsset}
          draggable={false}
        />
      )}
      <select
        className={css.settingsSelect}
        value={assignedAsset ?? ''}
        aria-label={sessionId}
        onChange={(event) => { onChoose(sessionId, event.target.value) }}
      >
        <option value="">—</option>
        {assets.map(asset => <option key={asset} value={asset}>{asset}</option>)}
      </select>
      {error !== null && <span className={css.settingsError} role="alert">{error}</span>}
    </div>
  )
}

/**
 * The plugin's Plugins-settings tab: pre-configure avatar assignments for
 * roster members (every lead with a subagent catalog plus its children).
 * @param props Settings renderer props (locale + runtime).
 * @returns the settings tab page.
 */
export function TeamPanelTab({ useSessions, t }: TeamPanelTabProps) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({})
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadAvatars() }, [])
  const removedState = useSyncExternalStore(subscribeRemoved, getRemovedSnapshot, getRemovedSnapshot)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)

  // One flattened roster view across every lead that has a catalog: rows for
  // the lead and each local child, labeled from the session list.
  const catalogs = useSessions(store => {
    const map: Array<{ leadId: string; entries: readonly SubagentCatalogEntry[] }> = []
    for (const [id, snapshot] of Object.entries(store.projectionsBySession)) {
      const catalog = snapshot.values.subagentCatalog
      if (catalog !== undefined && catalog.length > 0) map.push({ leadId: id, entries: catalog })
    }
    return map
  })
  const titles = useSessions(store => store.byId as Readonly<Record<string, { displayTitle?: string }>>)

  const labelOf = (leadId: string, childId: string): string => {
    const entry = catalogs.find(group => group.leadId === leadId)?.entries.find(row => row.id === childId)
    return entry?.label ?? titles[childId]?.displayTitle ?? childId
  }

  const onRestore = (leadId: string, childId: string): void => {
    if (restoring !== null) return
    setRestoring(childId)
    setRestoreError(null)
    void restoreMember(leadId, childId)
      .catch((reason: unknown) => { setRestoreError(reason instanceof Error ? reason.message : String(reason)) })
      .finally(() => { setRestoring(null) })
  }

  const removedRows = catalogs.flatMap(({ leadId, entries }) =>
    (removedState.byLead[leadId] ?? [])
      .filter(childId => entries.some(entry => entry.id === childId))
      .map(childId => ({ leadId, childId })))
  useEffect(() => {
    for (const { leadId } of catalogs) {
      if (!(leadId in removedState.byLead) || !removedState.loaded) loadRemoved(leadId)
    }
  })

  const onChoose = (sessionId: string, asset: string): void => {
    void assignAvatar(sessionId, asset)
      .then(() => { setErrors(current => ({ ...current, [sessionId]: '' })) })
      .catch((reason: unknown) => {
        setErrors(current => ({
          ...current,
          [sessionId]: reason instanceof AvatarAssignError ? reason.message : String(reason),
        }))
      })
  }

  const onUpload = (picked: File | undefined): void => {
    if (picked === undefined) return
    setUploading(true)
    void uploadAvatar(picked)
      .catch((reason: unknown) => {
        setErrors(current => ({ ...current, __upload: reason instanceof AvatarAssignError ? reason.message : String(reason) }))
      })
      .finally(() => { setUploading(false) })
  }

  return (
    <div className={css.settingsTab}>
      <p className={css.settingsHint}>{t('settings.hint')}</p>
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
            onUpload(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </label>
      {errors.__upload !== undefined && errors.__upload !== '' && (
        <span className={css.settingsError} role="alert">{errors.__upload}</span>
      )}
      {state.assets.length === 0 && (
        <div className={css.notice} role="status">
          <StateDot state={state.loaded ? 'warning' : 'ongoing'} />
          {t(state.loaded ? 'settings.noAssets' : 'avatar.loading')}
        </div>
      )}
      {catalogs.flatMap(({ leadId, entries }) => [
        <MemberRow
          key={leadId}
          sessionId={leadId as SessionId}
          label={titles[leadId]?.displayTitle ?? leadId}
          assignedAsset={state.assignments[leadId]}
          assets={state.assets}
          onChoose={onChoose}
          error={errors[leadId] ?? null}
        />,
        ...entries
          .filter(entry => entry.mode !== 'external')
          .map(entry => (
            <MemberRow
              key={entry.id}
              sessionId={entry.id}
              label={entry.label ?? entry.id}
              assignedAsset={state.assignments[entry.id]}
              assets={state.assets}
              onChoose={onChoose}
              error={errors[entry.id] ?? null}
            />
          )),
      ])}
      {catalogs.length === 0 && <p className={css.emptyNotice}>{t('settings.empty')}</p>}
      {removedRows.length > 0 && (
        <div className={css.removedSection}>
          <p className={css.settingsHint}>{t('settings.removed')}</p>
          {restoreError !== null && <span className={css.settingsError} role="alert">{restoreError}</span>}
          {removedRows.map(({ leadId, childId }) => (
            <div key={childId} className={css.removedRow}>
              <span className={css.removedLabel}>{labelOf(leadId, childId)}</span>
              <button
                type="button"
                className={css.restoreButton}
                disabled={restoring !== null}
                onClick={() => { onRestore(leadId, childId) }}
              >
                {restoring === childId ? t('remove.pending') : t('settings.restore')}
              </button>
            </div>
          ))}
        </div>
      )}
      {catalogs.length > 0 && removedRows.length === 0 && (
        <p className={css.emptyNotice}>{t('settings.removedEmpty')}</p>
      )}
    </div>
  )
}
