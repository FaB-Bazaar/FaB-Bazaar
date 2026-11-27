// Sending decks to connected apps (partner game clients such as Cintari),
// migration 0135. A deck's Settings list the apps that can receive decks; the
// partner play API (/api/partner/v1/play) serves only the decks sent to it.

import { classifyScopeRequest } from '@/lib/oauth/consent';
import { hasScope, parseScopes, type PartnerScope } from '@/lib/partner-api/scopes';
import type { AuthorizedAppDTO } from '@/lib/services/contracts/IOAuthService';

/** Turning on an app that is not (or no longer) registered. */
export const DECK_PARTNER_APP_NOT_FOUND = 'That app is not connected';

export interface PlayApp {
  client_id: string;
  name: string;
  /** The app's site host, for telling apps apart. */
  site: string | null;
}

function hostOf(uri: string | undefined): string | null {
  if (!uri) return null;
  try {
    return new URL(uri).host;
  } catch {
    return null;
  }
}

/**
 * The connected apps a deck can be sent to: those holding a PARTNER grant with
 * deck access. A full-account grant (MCP clients such as Claude) is left out —
 * the partner API refuses those tokens, so sending them a deck would do nothing.
 */
export function appsThatCanPlay(apps: AuthorizedAppDTO[]): PlayApp[] {
  return apps
    .filter(app => {
      const partnerScopes = new Set<PartnerScope>();
      for (const grant of app.scopes.map(classifyScopeRequest)) {
        if (grant.kind === 'partner') for (const scope of parseScopes(grant.scope)) partnerScopes.add(scope);
      }
      return hasScope(partnerScopes, 'decks:read');
    })
    .map(app => ({ client_id: app.client_id, name: app.client_name, site: hostOf(app.client_uri) }));
}
