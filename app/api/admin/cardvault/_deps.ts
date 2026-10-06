import { cardVaultService } from '@/lib/services';
import type { CardVaultJobDeps } from '@/lib/import/cardvault-job';

/** Real-world wiring for a CardVault ingest job (service, network, Cloudflare). */
export function cardVaultJobDeps(): CardVaultJobDeps {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  return {
    store: cardVaultService,
    fetch: (...args) => fetch(...args),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    cloudflare: accountId && apiToken ? { accountId, apiToken } : null,
  };
}

export const cloudflareConfigured = () =>
  Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
