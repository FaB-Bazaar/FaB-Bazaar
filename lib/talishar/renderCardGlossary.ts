/**
 * renderCardGlossary — formats resolved card metadata into a compact "what each
 * card does" reference appended to get_results, so the model never has to look
 * cards up itself. One line per unique (name, pitch); deduped and sorted.
 */

export interface CardMeta {
  name: string;
  pitch?: number | null;
  typeText?: string | null;
  cost?: number | null;
  power?: number | null;
  defense?: number | null;
  keywords?: string[] | null;
  text?: string | null;
}

const PITCH_NAME: Record<number, string> = { 1: 'red', 2: 'yellow', 3: 'blue' };

export function renderCardGlossary(cards: CardMeta[]): string {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const c of cards) {
    if (!c?.name) continue;
    const key = `${c.name.toLowerCase()}|${c.pitch ?? 0}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const pitchLabel = c.pitch ? ` (${PITCH_NAME[c.pitch] ?? `pitch ${c.pitch}`})` : '';
    const bits: string[] = [];
    if (c.typeText) bits.push(c.typeText);
    if (c.cost != null) bits.push(`cost ${c.cost}`);
    if (c.power != null) bits.push(`pwr ${c.power}`);
    if (c.defense != null) bits.push(`def ${c.defense}`);
    if (c.keywords?.length) bits.push(`[${c.keywords.join(', ')}]`);

    let line = `- ${c.name}${pitchLabel}${bits.length ? ` — ${bits.join(' · ')}` : ''}`;
    if (c.text) line += ` — ${c.text.replace(/\s+/g, ' ').trim()}`;
    lines.push(line);
  }

  if (lines.length === 0) return '';
  lines.sort();
  return `Card glossary (what each card does):\n${lines.join('\n')}`;
}
