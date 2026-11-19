/** Source-safe Team panel browser registration. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import { TeamAction, type TeamActionInjected } from './TeamAction.tsx'
import { TeamPanelTab } from './TeamPanelTab.tsx'
import { TeamPanelPluginItem } from './TeamPanelPluginItem.tsx'
import { registerComposerModel } from './composer-model.ts'
import { en, NS, zh, type TeamKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Team panel roster and task copy. */
    'team-panel': TeamKey
  }
}

/** Required browser services for navigation, slots, settings, and localized copy. */
export const inject = ['sessions', 'uiWorkspace', 'slots', 'locale']

/**
 * Register the Team panel locale dictionaries and the conversation-header action.
 * The panel reads the lead Session's `subagentCatalog` and `todos` projections
 * from the shared Session store; this registration performs no RPC.
 * @param ctx - Client Context carrying the injected navigation, locale, slot, and Session services.
 */
export function registerTeamPanelUi(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'team-panel: dictionaries')
  registerComposerModel(ctx)
  const sessions = ctx.sessions
  const leadSessionId = (sessionId: SessionId): SessionId => {
    const address = sessions.binding(sessionId)?.session.getSnapshot().subagent?.address
    return address?.parentSessionId ?? sessionId
  }

  const actions: TeamActionInjected = {
    openTeammate(sessionId: SessionId, childSessionId: SessionId): void {
      const parentSessionId = leadSessionId(sessionId)
      if ((sessions.retainInfo(sessionId).getSnapshot().retainedBy.mainView ?? 0) === 0) return
      if (childSessionId === parentSessionId) {
        ctx.uiWorkspace.openSession(parentSessionId)
        return
      }
      ctx.uiWorkspace.openSession({
        parentSessionId,
        childSessionId,
        mode: 'continuable',
      })
    },
  }

  ctx.slots.inject(
    'conversation.session.header.actions',
    () => ctx.slots.register({
      name: 'conversation.session.header.actions',
      id: 'team-panel',
      order: -19,
      locale: NS,
      inject: () => actions,
    }, TeamAction),
  )

  ctx.slots.inject(
    'settings.plugins.tab',
    () => ctx.slots.register({
      name: 'settings.plugins.tab',
      id: 'team-panel',
      order: 40,
      label: () => 'Team panel',
      locale: NS,
    }, TeamPanelTab),
  )

  // The Plugins page's Built-in plugin settings list reads `plugins.item`;
  // register the same component there so both surfaces expose the restore list.
  ctx.slots.inject(
    'plugins.item',
    () => ctx.slots.register({
      name: 'plugins.item',
      id: 'team-panel',
      order: 60,
      label: () => 'Team panel',
      locale: NS,
      inject: () => ({ view: 'page' as const }),
    }, TeamPanelPluginItem),
  )
}
