/** The Plugins-page card body for Team panel: avatar upload summary plus the removed-member restore list. */
import { useEffect, useSyncExternalStore } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SubagentCatalogEntry } from '@deepseek-ai/dsh-subagent/types'
import { getRemovedSnapshot, loadRemoved, restoreMember, subscribeRemoved } from './removed.ts'
import { NS } from './locales.ts'
import css from './styles.ts'

/** Full props of the `plugins.item` entry this plugin contributes; `useSessions` arrives as a global standard prop. */
export type TeamPanelPluginItemProps =
  PropsRuntime<'plugins.item'> & PropsLocale<typeof NS>

/**
 * Render the plugin's own page under Built-in plugin settings: a one-line
 * summary in `summary` view, the restore list in `page` view.
 * @param props - view discriminator + the standard session store seat + locale seat.
 * @returns summary text or the full page.
 */
export function TeamPanelPluginItem({ view, useSessions, t }: TeamPanelPluginItemProps) {
  const removedState = useSyncExternalStore(subscribeRemoved, getRemovedSnapshot, getRemovedSnapshot)
  const catalogs = useSessions(store => {
    const map: Array<{ leadId: string; entries: readonly SubagentCatalogEntry[] }> = []
    for (const [id, snapshot] of Object.entries(store.projectionsBySession)) {
      const catalog = snapshot.values.subagentCatalog
      if (catalog !== undefined && catalog.length > 0) map.push({ leadId: id, entries: catalog })
    }
    return map
  })
  const titles = useSessions(store => store.byId)
  useEffect(() => {
    for (const { leadId } of catalogs) {
      if (!(leadId in removedState.byLead)) loadRemoved(leadId)
    }
  })
  if (view === 'summary') return <>{t('settings.removed')}</>
  const rows = catalogs.flatMap(({ leadId, entries }) =>
    (removedState.byLead[leadId] ?? [])
      .filter(childId => entries.some(entry => entry.id === childId))
      .map(childId => ({
        leadId,
        childId,
        label: entries.find(entry => entry.id === childId)?.label
          ?? (titles as Readonly<Record<string, { displayTitle?: string }>>)[childId]?.displayTitle
          ?? childId,
      })))
  return (
    <div className={css.settingsTab}>
      <p className={css.settingsHint}>{t('settings.removed')}</p>
      {rows.map(row => (
        <div key={row.childId} className={css.removedRow}>
          <span className={css.removedLabel}>{row.label}</span>
          <button
            type="button"
            className={css.restoreButton}
            onClick={() => {
              void restoreMember(row.leadId, row.childId).catch(() => undefined)
            }}
          >
            {t('settings.restore')}
          </button>
        </div>
      ))}
      {rows.length === 0 && <p className={css.emptyNotice}>{t('settings.removedEmpty')}</p>}
    </div>
  )
}
