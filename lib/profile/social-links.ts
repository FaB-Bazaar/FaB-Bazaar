// lib/profile/social-links.ts
//
// Social handles a user can show on their public profile. We store HANDLES
// only (users.social_links, { platformKey: handle }) and build every link from
// the platform's own URL template, so a stored value can never point at
// another site or carry a script URL. A pasted profile link is accepted on
// input and reduced to its handle.
//
// The one exception is `website` (a personal or store site): a full address
// the user chooses, so it is held to a plain http(s) URL on a public domain
// and re-checked every time it is rendered.
//
// Pure module: used by the API route, the edit form and the profile page.

export interface SocialPlatform {
  key: string;
  label: string;
  placeholder: string;
  /** Hostnames a pasted profile link may use (www. is ignored). */
  hosts: string[];
  /** A valid handle, anchored. */
  pattern: RegExp;
  /** Handles that are really pages of the site, not profiles. */
  reserved?: string[];
  url: (handle: string) => string;
}

// Display order everywhere: Nanza (the Flesh and Blood social) leads.
export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  {
    key: 'nanza',
    label: 'Nanza',
    placeholder: 'username',
    hosts: ['nanza.app'],
    pattern: /^[A-Za-z0-9_.-]{1,40}$/,
    // nanza.app routes profiles at /:username; these are its own pages.
    reserved: ['about', 'collect', 'create', 'fair-market', 'get', 'privacy-policy', 'refund-and-return-policy', 'support', 'terms', 'trade'],
    url: (h) => `https://nanza.app/${h}`,
  },
  {
    key: 'youtube',
    label: 'YouTube',
    placeholder: '@channel',
    hosts: ['youtube.com', 'm.youtube.com'],
    pattern: /^[A-Za-z0-9_.-]{3,30}$/,
    url: (h) => `https://www.youtube.com/@${h}`,
  },
  {
    key: 'instagram',
    label: 'Instagram',
    placeholder: 'username',
    hosts: ['instagram.com'],
    pattern: /^[A-Za-z0-9_.]{1,30}$/,
    url: (h) => `https://www.instagram.com/${h}`,
  },
  {
    key: 'bluesky',
    label: 'Bluesky',
    placeholder: 'name.bsky.social',
    hosts: ['bsky.app'],
    pattern: /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*$/,
    // A Bluesky handle is a domain; a bare name means the default host.
    url: (h) => `https://bsky.app/profile/${h.includes('.') ? h : `${h}.bsky.social`}`,
  },
  {
    key: 'facebook',
    label: 'Facebook',
    placeholder: 'username',
    hosts: ['facebook.com', 'm.facebook.com', 'fb.com'],
    pattern: /^[A-Za-z0-9.-]{1,50}$/,
    url: (h) => `https://www.facebook.com/${h}`,
  },
  {
    key: 'x',
    label: 'X',
    placeholder: 'username',
    hosts: ['x.com', 'twitter.com'],
    pattern: /^[A-Za-z0-9_]{1,15}$/,
    url: (h) => `https://x.com/${h}`,
  },
];

const BY_KEY = new Map(SOCIAL_PLATFORMS.map((p) => [p.key, p]));

export const WEBSITE_KEY = 'website';
const WEBSITE_MAX_LENGTH = 200;

/** Every input on the Socials form, in order: the platforms, then the website. */
export const SOCIAL_FIELDS: { key: string; label: string; placeholder: string }[] = [
  ...SOCIAL_PLATFORMS.map(({ key, label, placeholder }) => ({ key, label, placeholder })),
  { key: WEBSITE_KEY, label: 'Website', placeholder: 'yourstore.com' },
];

export type WebsiteResult = { ok: true; url: string } | { ok: false; error: string };

/** A personal/store website: http(s) on a public domain name, no credentials. '' = not set. */
export function normalizeWebsiteUrl(input: string): WebsiteResult {
  const bad: WebsiteResult = { ok: false, error: 'Website: enter a web address like yourstore.com' };
  const value = input.trim();
  if (!value) return { ok: true, url: '' };

  let parsed: URL;
  try {
    // Anything without http(s):// is treated as a bare domain, so a
    // `javascript:` or `data:` value becomes an unparseable host, not a scheme.
    parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return bad;
  }

  const host = parsed.hostname;
  if (
    (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    !/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(host) || // a real domain: no IPs, no localhost
    parsed.href.length > WEBSITE_MAX_LENGTH
  ) {
    return bad;
  }
  return { ok: true, url: parsed.href };
}

export type SocialLinks = Record<string, string>;

export type HandleResult = { ok: true; handle: string } | { ok: false; error: string };

const isValidHandle = (platform: SocialPlatform, handle: string) =>
  handle.length <= 100 && platform.pattern.test(handle) && !platform.reserved?.includes(handle.toLowerCase());

/** Reduce what the user typed (handle, @handle or a profile link) to a handle. '' = not set. */
export function normalizeSocialHandle(key: string, input: string): HandleResult {
  const platform = BY_KEY.get(key);
  if (!platform) return { ok: false, error: 'Unknown platform' };

  let value = input.trim();
  if (!value) return { ok: true, handle: '' };
  const bad: HandleResult = { ok: false, error: `${platform.label}: enter a username or a ${platform.hosts[0]} profile link` };

  // A pasted link: with a scheme, or starting with one of the platform's hosts.
  const stripped = value.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  const host = stripped.split(/[/?#]/)[0].toLowerCase();
  if (/^https?:\/\//i.test(value) || (stripped.includes('/') && platform.hosts.includes(host))) {
    if (!platform.hosts.includes(host)) return bad;
    const segments = stripped.slice(host.length).split(/[?#]/)[0].split('/').filter(Boolean);
    // bsky.app/profile/<handle>; everyone else puts the handle first.
    value = (key === 'bluesky' && segments[0] === 'profile' ? segments[1] : segments[0]) ?? '';
  }

  value = value.replace(/^@/, '');
  return isValidHandle(platform, value) ? { ok: true, handle: value } : bad;
}

export type SanitizeResult = { ok: true; value: SocialLinks } | { ok: false; error: string };

/** Validate a whole { platform: input, website? } object. Empty entries are dropped; unknown keys ignored. */
export function sanitizeSocialLinks(input: unknown): SanitizeResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'socials must be an object' };
  }
  const value: SocialLinks = {};
  for (const platform of SOCIAL_PLATFORMS) {
    const raw = (input as Record<string, unknown>)[platform.key];
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== 'string') return { ok: false, error: `${platform.label}: must be text` };
    const result = normalizeSocialHandle(platform.key, raw);
    if (!result.ok) return result;
    if (result.handle) value[platform.key] = result.handle;
  }

  const website = (input as Record<string, unknown>)[WEBSITE_KEY];
  if (website !== undefined && website !== null) {
    if (typeof website !== 'string') return { ok: false, error: 'Website: must be text' };
    const result = normalizeWebsiteUrl(website);
    if (!result.ok) return result;
    if (result.url) value[WEBSITE_KEY] = result.url;
  }
  return { ok: true, value };
}

export interface SocialLink {
  key: string;
  label: string;
  handle: string;
  url: string;
}

/** Links to render, in display order. Re-validates stored values before building a URL. */
export function socialLinkList(stored: unknown): SocialLink[] {
  if (!stored || typeof stored !== 'object') return [];
  const links: SocialLink[] = [];
  for (const platform of SOCIAL_PLATFORMS) {
    const handle = (stored as Record<string, unknown>)[platform.key];
    if (typeof handle !== 'string' || !isValidHandle(platform, handle)) continue;
    links.push({ key: platform.key, label: platform.label, handle, url: platform.url(handle) });
  }

  // The website goes last, labelled with its domain so visitors see where it leads.
  const website = (stored as Record<string, unknown>)[WEBSITE_KEY];
  if (typeof website === 'string') {
    const result = normalizeWebsiteUrl(website);
    if (result.ok && result.url) {
      const domain = new URL(result.url).hostname.replace(/^www\./, '');
      links.push({ key: WEBSITE_KEY, label: domain, handle: result.url, url: result.url });
    }
  }
  return links;
}
