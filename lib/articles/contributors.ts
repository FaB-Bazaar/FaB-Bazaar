/**
 * Article contributors — co-author credits (deck creator, strategy inventor,
 * guest writer) stored as JSONB on articles.
 *
 * `normalizeContributors` is the single validation gate: every service-layer
 * write passes through it. Pure module — safe to import anywhere.
 */

export interface ArticleContributor {
  /** Attribution prefix, e.g. "Deck by", "Strategy by". Renderer defaults when absent. */
  role?: string;
  name: string;
  /** Profile/social link. Absolute http(s) URL or internal path starting with "/". */
  link?: string;
}

const MAX_CONTRIBUTORS = 10;

export type NormalizeContributorsResult =
  | { ok: true; contributors: ArticleContributor[] }
  | { ok: false; error: string };

export function normalizeContributors(raw: unknown): NormalizeContributorsResult {
  if (!Array.isArray(raw)) {
    return { ok: false, error: 'Contributors must be an array' };
  }
  if (raw.length > MAX_CONTRIBUTORS) {
    return { ok: false, error: `At most ${MAX_CONTRIBUTORS} contributors allowed` };
  }

  const contributors: ArticleContributor[] = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return { ok: false, error: `Contributor ${i}: must be an object` };
    }

    const { name, role, link } = entry as Record<string, unknown>;
    if (typeof name !== 'string' || !name.trim()) {
      return { ok: false, error: `Contributor ${i}: name is required` };
    }

    const contributor: ArticleContributor = { name: name.trim() };

    if (role !== undefined && role !== null) {
      if (typeof role !== 'string') {
        return { ok: false, error: `Contributor ${i}: role must be a string` };
      }
      const trimmed = role.trim();
      if (trimmed) contributor.role = trimmed;
    }

    if (link !== undefined && link !== null) {
      if (typeof link !== 'string') {
        return { ok: false, error: `Contributor ${i}: link must be a string` };
      }
      const trimmed = link.trim();
      if (trimmed) {
        if (!/^https?:\/\//.test(trimmed) && !trimmed.startsWith('/')) {
          return { ok: false, error: `Contributor ${i}: link must be an http(s) URL or internal path` };
        }
        contributor.link = trimmed;
      }
    }

    contributors.push(contributor);
  }

  return { ok: true, contributors };
}

/**
 * Map contributors to Next.js Metadata `authors`. Internal paths are dropped
 * from `url` (metadata authors expect absolute URLs).
 */
export function contributorsToMetadataAuthors(
  contributors: ArticleContributor[] | undefined
): { name: string; url?: string }[] {
  return (contributors ?? []).map(c =>
    c.link && /^https?:\/\//.test(c.link) ? { name: c.name, url: c.link } : { name: c.name }
  );
}
