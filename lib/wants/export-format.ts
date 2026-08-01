// Plain-text export lines for wants lists (owner-page Export button).
// Format: `2x Silverwind Shuriken (red) (OUT093, First Edition, Majestic, Rainbow Foil, Extended Art)`
// — pitch color only when the card has one; edition only when it disambiguates
// (Alpha / First Edition / Unlimited); collector number falls back to the set code.
import { FOILING_MAP, RARITY_MAP, EDITION_MAP } from '@/lib/fab-constants';

const PITCH_COLORS: Record<number, string> = { 1: 'red', 2: 'yellow', 3: 'blue' };

function capitalizeWords(name: string): string {
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatWantsExportLine(card: any): string {
  const p = card.printingDetails ?? {};

  const name = p.display_name || capitalizeWords(card.name || '');
  const color = p.color || (p.pitch != null ? PITCH_COLORS[p.pitch] : undefined);

  const reference = p.collector_number || (p.set ? String(p.set).toUpperCase() : '');
  const edition = p.edition
    ? EDITION_MAP[String(p.edition).toLowerCase() as keyof typeof EDITION_MAP]
    : undefined;
  const rarity = p.rarity
    ? RARITY_MAP[String(p.rarity).toLowerCase() as keyof typeof RARITY_MAP] || p.rarity
    : undefined;
  const foiling = p.foiling
    ? FOILING_MAP[String(p.foiling).toLowerCase() as keyof typeof FOILING_MAP] || p.foiling
    : undefined;

  const details = [
    reference,
    edition && edition !== 'Normal' ? edition : undefined,
    rarity,
    foiling,
    card.is_extended_art ? 'Extended Art' : undefined,
  ].filter(Boolean);

  const colorPart = color ? ` (${color})` : '';
  const detailsPart = details.length ? ` (${details.join(', ')})` : '';
  return `${card.quantity}x ${name}${colorPart}${detailsPart}`;
}

export function formatWantsExport(cards: any[]): string {
  return cards.map(formatWantsExportLine).join('\n');
}
