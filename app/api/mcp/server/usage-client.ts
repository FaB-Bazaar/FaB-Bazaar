// The `client` key for mcp_usage_daily. The FULL user-agent (whitespace
// collapsed, capped): cutting at the first space logged every browser-style
// host (e.g. Meta Muse) as the same "Mozilla/5.0". Rows written before
// 2026-09-29 hold that short form, so a client's history splits at that date.
const MAX_CLIENT_CHARS = 200;

export function usageClientFromUserAgent(userAgent: string | null): string {
  const ua = (userAgent ?? '').replace(/\s+/g, ' ').trim();
  return ua ? ua.slice(0, MAX_CLIENT_CHARS) : 'unknown';
}
