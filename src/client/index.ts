/** Browser entry registering the Team panel conversation-header action. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { registerTeamPanelUi } from './mount.ts'

export { inject } from './mount.ts'
export type { TeamActionInjected, TeamActionProps } from './TeamAction.tsx'
export type { TeamKey } from './locales.ts'

/**
 * Register the Team panel locale dictionaries and header action on the Client Context.
 * @param ctx - Client Context with the declared `inject` services available.
 */
export function apply(ctx: ClientContext): void {
  registerTeamPanelUi(ctx)
}
