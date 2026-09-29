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

function mentionHtml(name: string, card: MentionCard | undefined, loading: boolean): string {
  const safeName = escapeHtml(name);
  if (card?.image_url) {
    const src = escapeHtml(card.image_url);
    return `<span class="inline-card-wrapper" role="button" tabindex="0" data-card-name="${safeName}" data-card-img="${src}" title="Click to view full size">`
      + `<img class="inline-card-thumbnail" src="${src}" alt="${safeName}" loading="lazy" />`
      + `<span class="inline-card-name">${safeName}</span></span>`;
  }
  if (loading) {
    return `<span class="inline-card-wrapper"><span class="inline-card-loading"></span><span class="inline-card-name">${safeName}</span></span>`;
  }
  return `<span class="card-mention">${safeName}</span>`;
}

/** Card names in the commentary: bold text that looks like a card name (has a capital or an apostrophe). */
export function commentaryMentions(text: string): string[] {
  const names: string[] = [];
  for (const m of text.matchAll(/\*\*([^*]+)\*\*/g)) {
    if (/[A-Z]/.test(m[1]) || m[1].includes("'")) names.push(m[1]);
  }
  return names;
}

export function buildCommentaryHtml(
  text: string,
  cards: Map<string, MentionCard>,
  loading: Set<string>,
): string {
  if (!text) return '';
  const mentions: string[] = [];
  const withPlaceholders = text.replace(/\*\*([^*]+)\*\*/g, (match, name: string) => {
    if (!/[A-Z]/.test(name) && !name.includes("'")) return match; // plain bold
    mentions.push(name);
    return `{{CARDMENTION${mentions.length - 1}}}`;
  });
  const html = marked.parse(withPlaceholders, { breaks: true, gfm: true }) as string;
  return html.replace(/\{\{CARDMENTION(\d+)\}\}/g, (_m, i: string) => {
    const name = mentions[Number(i)];
    return mentionHtml(name, cards.get(name), loading.has(name));
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
