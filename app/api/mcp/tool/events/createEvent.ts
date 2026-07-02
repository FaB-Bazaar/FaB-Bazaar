// app/api/mcp/tool/events/createEvent.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

export const createEventTool = {
  name: 'create_event',
  description: `📅 CREATE EVENT (superadmin only): Register a FaB organized-play event tied to a venue or store.

Typical flow: the user pastes an event announcement (or URL contents) — extract the event name, type, format, dates, registration URL, and venue address, then call this tool once.

VENUE (find-or-create): pass EITHER
  • locationId — an existing location's id (use when the user names a known store/venue), OR
  • venueName + venueAddressLine1 + venueCity + venueCountry (+ optional venueState/venuePostalCode)
    — the tool first searches existing locations by name and reuses one whose name AND city match
    (case-insensitive); otherwise it creates a new location with category "venue".

TYPES: calling | pro_tour | national | open | store_champ | other (default other).
Dates are ISO (YYYY-MM-DD); endDate defaults to startDate for one-day events.

Echo the created event + venue back to the user so they can verify before announcing.`,

  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Event name, e.g. "The Calling: Bologna".' },
      type: {
        type: 'string',
        enum: ['calling', 'pro_tour', 'national', 'open', 'store_champ', 'other'],
        description: 'Event type. Defaults to "other".',
      },
      format: { type: 'string', description: 'Play format, e.g. "Classic Constructed".' },
      startDate: { type: 'string', description: 'ISO start date (YYYY-MM-DD).' },
      endDate: { type: 'string', description: 'ISO end date. Defaults to startDate.' },
      registrationUrl: { type: 'string', description: 'Registration / announcement URL.' },
      notes: { type: 'string', description: 'Optional notes shown with the event.' },
      locationId: { type: 'string', description: 'Existing location id — skips venue find-or-create.' },
      venueName: { type: 'string', description: 'Venue name (find-or-create when no locationId).' },
      venueAddressLine1: { type: 'string', description: 'Venue street address.' },
      venueCity: { type: 'string', description: 'Venue city.' },
      venueState: { type: 'string', description: 'Venue state/region (optional).' },
      venuePostalCode: { type: 'string', description: 'Venue postal code (optional).' },
      venueCountry: { type: 'string', description: 'Venue country code, e.g. "IT" or "US".' },
    },
    required: ['name', 'startDate'],
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
      if (!params?.startDate) {
        return { success: false, error: 'Missing required parameter: startDate (ISO date).' };
      }
      if (params.endDate && new Date(params.endDate) < new Date(params.startDate)) {
        return { success: false, error: `endDate (${params.endDate}) is before startDate (${params.startDate}) — check the parsed dates.` };
      }

      const hasVenueFields =
        params.venueName && params.venueAddressLine1 && params.venueCity && params.venueCountry;
      if (!params.locationId && !hasVenueFields) {
        return {
          success: false,
          error:
            'Provide either locationId (existing location) or the full venue fields: venueName + venueAddressLine1 + venueCity + venueCountry.',
        };
      }

      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenToUse}` };
      const fail = async (response: any, what: string) => {
        if (response.status === 403) {
          return { success: false, error: 'Access denied: Super Admin role required.' };
        }
        const errorText = await response.text().catch(() => '');
        return { success: false, error: `Failed to ${what} (HTTP ${response.status}): ${errorText}` };
      };

      // ── Resolve the venue ────────────────────────────────────────────
      let locationId: string = params.locationId;
      let venueLabel = '';
      let venueCreated = false;

      if (!locationId) {
        const searchRes = await mcpFetch(
          `${API_BASE_URL}/api/locations?search=${encodeURIComponent(params.venueName)}&limit=20`,
          { headers }
        );
        if (!searchRes.ok) return fail(searchRes, 'search locations');
        const searchJson = await searchRes.json();
        const candidates: any[] = searchJson?.data?.locations ?? [];
        const match = candidates.find(
          (l) =>
            l.name?.toLowerCase() === params.venueName.toLowerCase() &&
            l.addressCity?.toLowerCase() === params.venueCity.toLowerCase()
        );

        if (match) {
          locationId = match.id;
          venueLabel = `${match.name}, ${match.addressCity} (existing)`;
        } else {
          const createBody: Record<string, any> = {
            category: 'venue',
            name: params.venueName,
            addressLine1: params.venueAddressLine1,
            addressCity: params.venueCity,
            addressCountry: params.venueCountry,
          };
          if (params.venueState) createBody.addressState = params.venueState;
          if (params.venuePostalCode) createBody.addressPostalCode = params.venuePostalCode;

          const createRes = await mcpFetch(`${API_BASE_URL}/api/locations`, {
            method: 'POST',
            headers,
            body: JSON.stringify(createBody),
          });
          if (!createRes.ok) return fail(createRes, 'create venue');
          const createJson = await createRes.json();
          if (!createJson.success) {
            return { success: false, error: createJson.error || 'Venue creation returned an error.' };
          }
          locationId = createJson.data.id;
          venueCreated = true;
          venueLabel = `${params.venueName}, ${params.venueCity} (created)`;
        }
      }

      // ── Create the event ─────────────────────────────────────────────
      const eventBody: Record<string, any> = {
        name: params.name,
        type: params.type ?? 'other',
        startDate: params.startDate,
        endDate: params.endDate || params.startDate,
      };
      if (params.format) eventBody.format = params.format;
      if (params.registrationUrl) eventBody.registrationUrl = params.registrationUrl;
      if (params.notes) eventBody.notes = params.notes;

      const eventRes = await mcpFetch(`${API_BASE_URL}/api/stores/${locationId}/events`, {
        method: 'POST',
        headers,
        body: JSON.stringify(eventBody),
      });
      if (!eventRes.ok) return fail(eventRes, 'create event');
      const eventJson = await eventRes.json();
      if (!eventJson.success) {
        return { success: false, error: eventJson.error || 'Event creation returned an error.' };
      }

      const dates =
        eventBody.endDate !== eventBody.startDate
          ? `${eventBody.startDate} → ${eventBody.endDate}`
          : eventBody.startDate;
      const message = `✅ Created event **${params.name}** (${eventBody.type}, ${dates})${
        venueLabel ? ` at ${venueLabel}` : ''
      }.`;

      return {
        success: true,
        data: { event: eventJson.data, locationId, venueCreated },
        message,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to create event.' };
    }
  },
};
