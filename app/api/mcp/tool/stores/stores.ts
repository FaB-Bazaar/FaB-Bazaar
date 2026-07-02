// app/api/mcp/tool/stores/stores.ts
// Store/location MCP tools: list_stores + get_store (public reference data)
// and create_store (superadmin; POST /api/locations enforces the role).
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

const authHeaders = (token?: string): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

async function fail(response: any, what: string) {
  if (response.status === 403) {
    return { success: false, error: 'Access denied: Super Admin role required.' };
  }
  if (response.status === 404) {
    return { success: false, error: `Not found: ${what}.` };
  }
  const errorText = await response.text().catch(() => '');
  return { success: false, error: `Failed to ${what} (HTTP ${response.status}): ${errorText}` };
}

export const listStoresTool = {
  name: 'list_stores',
  description: `🏪 LIST STORES/VENUES: Browse FaB Bazaar's location directory (game stores and event venues).

Filter by free-text search (name), country/state codes, and category ("store" or "venue").
Returns location summaries with ids — use get_store for full detail, or pass a location's id
as locationId to create_event.`,

  parameters: {
    type: 'object',
    properties: {
      search: { type: 'string', description: 'Free-text name search.' },
      country: { type: 'string', description: 'Country code filter, e.g. "US".' },
      state: { type: 'string', description: 'State/region code filter, e.g. "TX".' },
      category: { type: 'string', enum: ['store', 'venue'], description: 'Location category filter.' },
      page: { type: 'number', description: 'Page number (default 1).' },
      limit: { type: 'number', description: 'Results per page (default 20, max 100).' },
    },
    required: [],
  },

  async handler(params: any, authenticatedUser?: any, token?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();
    try {
      const tokenToUse = authenticatedUser?.mcpToken || token;
      const qs = new URLSearchParams();
      if (params?.search) qs.set('search', params.search);
      if (params?.country) qs.set('country', params.country);
      if (params?.state) qs.set('state', params.state);
      if (params?.category) qs.set('category', params.category);
      if (params?.page) qs.set('page', String(params.page));
      if (params?.limit) qs.set('limit', String(params.limit));

      const response = await mcpFetch(`${API_BASE_URL}/api/locations?${qs}`, {
        headers: authHeaders(tokenToUse),
      });
      if (!response.ok) return fail(response, 'list locations');
      const json = await response.json();
      if (!json.success) return { success: false, error: json.error || 'API returned an error.' };

      const { locations = [], total = 0 } = json.data ?? {};
      const lines = locations.map(
        (l: any) => `• ${l.name} — ${[l.addressCity, l.addressState, l.addressCountry].filter(Boolean).join(', ')} (id: ${l.id})`
      );
      const message = total === 0
        ? 'No locations matched.'
        : `Found ${locations.length} of ${total} location(s):\n${lines.join('\n')}`;

      return { success: true, data: json.data, message };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to list stores.' };
    }
  },
};

export const getStoreTool = {
  name: 'get_store',
  description: `🏪 GET STORE/VENUE: Fetch one location's full details (address, contact info, category) by id.
Harvest ids from list_stores.`,

  parameters: {
    type: 'object',
    properties: {
      locationId: { type: 'string', description: 'Location id (from list_stores).' },
    },
    required: ['locationId'],
  },

  async handler(params: any, authenticatedUser?: any, token?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();
    try {
      const tokenToUse = authenticatedUser?.mcpToken || token;
      if (!params?.locationId) {
        return { success: false, error: 'Missing required parameter: locationId (from list_stores).' };
      }

      const response = await mcpFetch(`${API_BASE_URL}/api/locations/${encodeURIComponent(params.locationId)}`, {
        headers: authHeaders(tokenToUse),
      });
      if (!response.ok) return fail(response, `location ${params.locationId}`);
      const json = await response.json();
      if (!json.success) return { success: false, error: json.error || 'API returned an error.' };

      const l = json.data;
      const message = `**${l.name}** (${l.category ?? 'store'}) — ${[l.addressLine1, l.addressCity, l.addressState, l.addressCountry].filter(Boolean).join(', ')} (id: ${l.id})`;

      return { success: true, data: l, message };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to get store.' };
    }
  },
};

export const createStoreTool = {
  name: 'create_store',
  description: `🏪 CREATE STORE/VENUE (superadmin only): Add a location to the directory without an event attached.

Category defaults to "store" — pass "venue" for convention centers and other event-only sites.
Before creating, run list_stores with a name search to avoid duplicates.
For "new venue + new event" in one step, prefer create_event (it find-or-creates the venue).`,

  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Location name.' },
      category: { type: 'string', enum: ['store', 'venue'], description: 'Defaults to "store".' },
      addressLine1: { type: 'string', description: 'Street address.' },
      addressCity: { type: 'string', description: 'City.' },
      addressState: { type: 'string', description: 'State/region (optional).' },
      addressPostalCode: { type: 'string', description: 'Postal code (optional).' },
      addressCountry: { type: 'string', description: 'Country code, e.g. "US".' },
      contactPhone: { type: 'string', description: 'Phone (optional).' },
      contactEmail: { type: 'string', description: 'Email (optional; stored encrypted).' },
      contactWebsite: { type: 'string', description: 'Website URL (optional).' },
      discordInviteUrl: { type: 'string', description: 'Discord invite (optional).' },
    },
    required: ['name', 'addressLine1', 'addressCity', 'addressCountry'],
  },

  async handler(params: any, authenticatedUser?: any, token?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();
    try {
      const tokenToUse = authenticatedUser?.mcpToken || token;
      if (!tokenToUse) {
        return { success: false, error: 'Authentication required: no token found.' };
      }
      if (!params?.name) {
        return { success: false, error: 'Missing required parameter: name.' };
      }
      if (!params?.addressLine1 || !params?.addressCity || !params?.addressCountry) {
        return { success: false, error: 'Missing required address fields: addressLine1 + addressCity + addressCountry.' };
      }

      const body: Record<string, any> = {
        category: params.category ?? 'store',
        name: params.name,
        addressLine1: params.addressLine1,
        addressCity: params.addressCity,
        addressCountry: params.addressCountry,
      };
      if (params.addressState) body.addressState = params.addressState;
      if (params.addressPostalCode) body.addressPostalCode = params.addressPostalCode;
      if (params.contactPhone) body.contactPhone = params.contactPhone;
      if (params.contactEmail) body.contactEmail = params.contactEmail;
      if (params.contactWebsite) body.contactWebsite = params.contactWebsite;
      if (params.discordInviteUrl) body.discordInviteUrl = params.discordInviteUrl;

      const response = await mcpFetch(`${API_BASE_URL}/api/locations`, {
        method: 'POST',
        headers: authHeaders(tokenToUse),
        body: JSON.stringify(body),
      });
      if (!response.ok) return fail(response, 'create location');
      const json = await response.json();
      if (!json.success) return { success: false, error: json.error || 'API returned an error.' };

      const message = `✅ Created ${body.category} **${params.name}** in ${params.addressCity}, ${params.addressCountry} (id: ${json.data.id}).`;
      return { success: true, data: json.data, message };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to create store.' };
    }
  },
};
