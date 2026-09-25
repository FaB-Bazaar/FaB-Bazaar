// app/api/mcp/tool/marketFeed/marketFeed.ts
// Superadmin market-feed tools: a curated, anonymous daily feed of buy/sell
// prices seen in Facebook groups (shown on /feed). Thin wrappers over
// /api/feed — POST enforces the superadmin role.
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';
import { FEED_REGIONS, FEED_REGION_LABELS, isFeedRegion } from '@/lib/market-feed/region';

const REGION_PARAM = {
  type: 'string',
  enum: [...FEED_REGIONS],
  description: 'Regional feed: "na" (North America, default), "eu" (Europe) or "apac" (Asia-Pacific) — the region of the Facebook group.',
};

type MarketFeedToolResult = { success: boolean; data?: any; message?: string; error?: string };

const PITCH_NAMES: Record<number, string> = { 1: 'red', 2: 'yellow', 3: 'blue' };

const failure = async (response: any, what: string): Promise<MarketFeedToolResult> => {
  if (response.status === 403) {
    return { success: false, error: 'Access denied: Super Admin role required.' };
  }
  const text = await response.text().catch(() => '');
  let detail = text;
  try {
    detail = JSON.parse(text)?.error ?? text;
  } catch {
    // plain-text body
  }
  return { success: false, error: `Failed to ${what} (HTTP ${response.status}): ${detail}` };
};

export const getMarketFeedTool = {
  name: 'get_market_feed',
  description: `📰 GET MARKET FEED (superadmin only): Read one day of the anonymous Facebook buy/sell price feed shown on fabbazaar.app/feed.

ALWAYS call this before submit_market_feed on a day that may already have listings: submit replaces the WHOLE day for that region, so merge what is already stored with your new finds and submit the combined list. Pass the same region you will submit to.

feedDate is YYYY-MM-DD; omit it for today (US Eastern). Also returns the dates that have listings.`,

  parameters: {
    type: 'object',
    properties: {
      feedDate: { type: 'string', description: 'Day to read (YYYY-MM-DD). Defaults to today, US Eastern.' },
      region: REGION_PARAM,
    },
  },

  async handler(params: any, authenticatedUser?: any, token?: string): Promise<MarketFeedToolResult> {
    const API_BASE_URL = getMcpApiBaseUrl();
    try {
      const tokenToUse = authenticatedUser?.mcpToken || token;
      if (!tokenToUse) return { success: false, error: 'Authentication required: no token found.' };

      const query = new URLSearchParams();
      if (params?.feedDate) query.set('date', params.feedDate);
      if (params?.region) query.set('region', params.region);
      const qs = query.toString() ? `?${query.toString()}` : '';
      const response = await mcpFetch(`${API_BASE_URL}/api/feed${qs}`, {
        headers: { Authorization: `Bearer ${tokenToUse}` },
      });
      if (!response.ok) return failure(response, 'load the market feed');

      const json = await response.json();
      const data = json.data;
      // Clients only show the model the message text, so it must carry the
      // listings — in submit_market_feed's input shape, ready to merge.
      const fields = ['side', 'cardName', 'pitch', 'collectorNumber', 'foiling', 'condition', 'price', 'currency', 'groupName', 'postUrl', 'variant'];
      const listings = data.listings.map((l: Record<string, unknown>) =>
        Object.fromEntries(fields.filter((f) => l[f] != null).map((f) => [f, l[f]]))
      );
      const missingLinks = listings.filter((l: Record<string, unknown>) => !l.postUrl).length;
      const linkNote = missingLinks
        ? ` ${missingLinks} listing(s) have no postUrl — add each post's link when you resubmit.`
        : '';
      return {
        success: true,
        data,
        message: `${listings.length} listing(s) stored for ${data.feedDate}.${linkNote} Include them in your next submit_market_feed for this day or they will be removed:\n${JSON.stringify(listings)}`,
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
};

export const submitMarketFeedTool = {
  name: 'submit_market_feed',
  description: `📰 SUBMIT MARKET FEED (superadmin only): Publish the day's curated buy/sell/trade listings seen in Flesh and Blood Facebook groups to fabbazaar.app/feed — a price reference next to TCGplayer, and signed-in users are shown which cards people want that they own.

REGIONS: set region to the Facebook group's region — "na" (North America, default), "eu" (Europe) or "apac" (Asia-Pacific). Submit each region separately; each has its own feed. Keep prices in the currency the post uses (e.g. EUR for European groups).

DATES: feedDate is the date the posts were made, not the day you scan them. When a scan finds posts from several days, submit one call per date.

REPLACES THE WHOLE DAY (for that region): submitting the same feedDate + region again overwrites it (other days and regions are untouched). If it may already have listings, call get_market_feed first (same date + region) and submit the merged list. An empty listings array clears it.

ALWAYS SEND groupName AND postUrl on every listing — the site shows the group and links "Post" to the original so readers can check the listing. Get the link from the post's timestamp or Share → Copy link.

NO NAMES: never include the poster's name, profile link or anything else that identifies them in any field. The card, the price, the group name and the link to the post are all that is stored.

One listing per card per post:
  • side — "selling" (someone offers the card), "buying" (someone wants to buy it) or "trade" (a card the poster wants in exchange — see TRADE LISTS)
  • cardName — the card's name; add pitch (1 red, 2 yellow, 3 blue) for pitched cards
  • collectorNumber — e.g. "WTR171" when the post names the set/printing (pins the price comparison)
  • foiling — "Rainbow Foil" / "Cold Foil" / "Gold Foil" / "Non-foil" when stated
  • condition — NM, LP, MP, HP or DMG when stated
  • variant — "Marvel", "Extended Art", "Alternate Art" or "Full Art" when the post says so ("Marvel - $325" → variant Marvel). Variants price very differently from the base card, so never leave this out when stated.
  • price + currency (default USD) — the asking or offered price for ONE copy. Required for selling/buying; leave it out on trade listings unless the post gives a trade value.
  • groupName — the Facebook group it was posted in (always)
  • postUrl — the post's link, e.g. https://www.facebook.com/groups/<group>/posts/<post>/ (always; must be an https facebook.com link, tracking parameters are stripped)

TRADE LISTS: a post like "Selling Usurp the Shadow Throne RF $40 — willing to trade for: Dead Threads CF, Eye of Ophidia, Gravy Bones Marvel" becomes one selling listing for the Usurp plus one "trade" listing per card on the want list (Dead Threads foiling Cold Foil; Eye of Ophidia; Gravy Bones variant Marvel), all with the SAME postUrl and groupName. Include every card on the list, including sections like "Treasures" or "Foils/Full Arts".

The reply lists cards that could not be matched to a single card (misspelt, or a pitched card without pitch) — fix and resubmit the day if you can. feedDate is YYYY-MM-DD; omit it for today (US Eastern).`,

  parameters: {
    type: 'object',
    properties: {
      feedDate: { type: 'string', description: 'Date the posts were made (YYYY-MM-DD). Defaults to today, US Eastern.' },
      region: REGION_PARAM,
      listings: {
        type: 'array',
        description: 'The complete list for the day (max 500).',
        items: {
          type: 'object',
          properties: {
            side: { type: 'string', enum: ['selling', 'buying', 'trade'] },
            cardName: { type: 'string' },
            pitch: { type: 'integer', enum: [1, 2, 3] },
            collectorNumber: { type: 'string' },
            foiling: { type: 'string' },
            condition: { type: 'string', enum: ['NM', 'LP', 'MP', 'HP', 'DMG'] },
            variant: { type: 'string', description: 'Marvel / Extended Art / Alternate Art / Full Art, when the post says so.' },
            price: { type: 'number', description: 'Price for one copy. Required for selling/buying; omit on trade listings.' },
            currency: { type: 'string', description: 'ISO 4217 code. Default USD.' },
            groupName: { type: 'string', description: 'Facebook group the post is in. Always send it.' },
            postUrl: { type: 'string', description: 'https facebook.com link to the post (timestamp or Share → Copy link). Always send it; never a profile link.' },
          },
          required: ['side', 'cardName'],
        },
      },
    },
    required: ['listings'],
  },

  async handler(params: any, authenticatedUser?: any, token?: string): Promise<MarketFeedToolResult> {
    const API_BASE_URL = getMcpApiBaseUrl();
    try {
      const tokenToUse = authenticatedUser?.mcpToken || token;
      if (!tokenToUse) return { success: false, error: 'Authentication required: no token found.' };
      if (!Array.isArray(params?.listings)) {
        return { success: false, error: 'Missing required parameter: listings (array; [] clears the day).' };
      }

      if (params.region != null && !isFeedRegion(params.region)) {
        return { success: false, error: 'region must be "na", "eu" or "apac".' };
      }
      const body: Record<string, unknown> = { listings: params.listings };
      if (params.feedDate) body.feedDate = params.feedDate;
      if (params.region) body.region = params.region;

      const response = await mcpFetch(`${API_BASE_URL}/api/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenToUse}` },
        body: JSON.stringify(body),
      });
      if (!response.ok) return failure(response, 'save the market feed');

      const json = await response.json();
      const data = json.data as {
        feedDate: string;
        region?: string;
        count: number;
        unmatched: string[];
        looseMatches?: { cardName: string; matchedName: string }[];
        suggestions?: { cardName: string; candidates: { name: string; pitch: number | null; collectorNumbers: string[] }[] }[];
      };
      const regionLabel = isFeedRegion(data.region) ? FEED_REGION_LABELS[data.region] : FEED_REGION_LABELS.na;
      const lines = [`Saved ${data.count} listing(s) for ${data.feedDate} (${regionLabel}) — replaces anything stored for that day and region.`];
      if (data.looseMatches?.length) {
        lines.push(
          `Matched loosely (check these are right; if not, resubmit with the exact name or collectorNumber): ${data.looseMatches
            .map((m) => `"${m.cardName}" → ${m.matchedName}`)
            .join('; ')}.`,
        );
      }
      if (data.unmatched.length) {
        const suggestionFor = new Map((data.suggestions ?? []).map((s) => [s.cardName, s.candidates]));
        const described = data.unmatched.map((name) => {
          const candidates = suggestionFor.get(name);
          if (!candidates?.length) return `"${name}"`;
          const options = candidates.map((c) => {
            const detail = [c.pitch ? PITCH_NAMES[c.pitch] : null, c.collectorNumbers[0]].filter(Boolean).join(', ');
            return detail ? `${c.name} (${detail})` : c.name;
          });
          return `"${name}" — did you mean: ${options.join(', ')}?`;
        });
        lines.push(
          `Not matched to a card (stored as written): ${described.join('; ')}. Fix the names (or add pitch / collectorNumber) and resubmit the whole day.`,
        );
      }
      return { success: true, data, message: lines.join('\n') };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
};
