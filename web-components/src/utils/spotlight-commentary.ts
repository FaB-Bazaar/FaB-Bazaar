import { marked } from 'marked';

/**
 * Spotlight commentary → ONE HTML string. `**Card Name**` mentions become
 * inline thumbnail + name spans (clicks are delegated by the element via
 * `data-card-img`). The mentions are substituted INTO the rendered HTML — the
 * old version cut the HTML at each mention and inserted the pieces separately,
 * which left every piece with half a paragraph, so the browser closed the <p>
 * early and each mention started a new block. Mention markup carries no
 * surrounding whitespace, so "Legs." never renders as "Legs .".
 */

type MentionCard = { image_url?: string | null };

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * `**Card Name**`, or `**shown words|Card Name**` to tag any wording ("Hyper
 * Drivers", "Assembly") with a card: the part after the bar is looked up, the
 * part before it is what readers see. Null when it's ordinary bold text.
 */
function parseMention(raw: string): { label: string; name: string } | null {
  const bar = raw.lastIndexOf('|');
  const label = (bar >= 0 ? raw.slice(0, bar) : raw).trim();
  const name = (bar >= 0 ? raw.slice(bar + 1) : raw).trim();
  if (!name || !label) return null;
  // Heuristic: card names have a capital or an apostrophe; lowercase bold is emphasis.
  return /[A-Z]/.test(name) || name.includes("'") ? { label, name } : null;
}

function mentionHtml(label: string, name: string, card: MentionCard | undefined, loading: boolean): string {
  const safeLabel = escapeHtml(label);
  const safeName = escapeHtml(name);
  if (card?.image_url) {
    const src = escapeHtml(card.image_url);
    return `<span class="inline-card-wrapper" role="button" tabindex="0" data-card-name="${safeName}" data-card-img="${src}" title="Click to view full size">`
      + `<img class="inline-card-thumbnail" src="${src}" alt="${safeName}" loading="lazy" />`
      + `<span class="inline-card-name">${safeLabel}</span></span>`;
  }
  if (loading) {
    return `<span class="inline-card-wrapper"><span class="inline-card-loading"></span><span class="inline-card-name">${safeLabel}</span></span>`;
  }
  return `<span class="card-mention">${safeLabel}</span>`;
}

/** Card names in the commentary: bold text that looks like a card name (has a capital or an apostrophe). */
export function commentaryMentions(text: string): string[] {
  const names: string[] = [];
  for (const m of text.matchAll(/\*\*([^*]+)\*\*/g)) {
    const mention = parseMention(m[1]);
    if (mention) names.push(mention.name);
  }
  return names;
}

export function buildCommentaryHtml(
  text: string,
  cards: Map<string, MentionCard>,
  loading: Set<string>,
): string {
  if (!text) return '';
  const mentions: Array<{ label: string; name: string }> = [];
  const withPlaceholders = text.replace(/\*\*([^*]+)\*\*/g, (match, raw: string) => {
    const mention = parseMention(raw);
    if (!mention) return match; // plain bold
    mentions.push(mention);
    return `{{CARDMENTION${mentions.length - 1}}}`;
  });
  const html = marked.parse(withPlaceholders, { breaks: true, gfm: true }) as string;
  return html.replace(/\{\{CARDMENTION(\d+)\}\}/g, (_m, i: string) => {
    const { label, name } = mentions[Number(i)];
    return mentionHtml(label, name, cards.get(name), loading.has(name));
  });
}

const EDITIONS: Record<string, string> = { a: 'Alpha', f: '1st Edition', u: 'Unlimited', n: '', normal: '' };

/** Edition code → words; Normal edition shows nothing. */
export function editionLabel(code?: string): string {
  if (!code) return '';
  const key = code.toLowerCase();
  return key in EDITIONS ? EDITIONS[key] : code.toUpperCase();
}

// Mirrors RARITY_MAP in lib/fab-constants/rarities.ts (the bundle can't import app code).
const RARITIES: Record<string, string> = {
  c: 'Common', r: 'Rare', s: 'Super Rare', m: 'Majestic', l: 'Legendary',
  f: 'Fabled', t: 'Token', b: 'Basic', v: 'Marvel', p: 'Promo',
};

/** Rarity code → the site's word for it. */
export function rarityLabel(code?: string): string {
  if (!code) return '';
  return RARITIES[code.toLowerCase()] ?? code.toUpperCase();
}
