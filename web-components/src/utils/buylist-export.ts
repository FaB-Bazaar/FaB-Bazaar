/**
 * Buy-list export builders.
 *
 * Pure text formatting over the rolled-up buy list the component receives
 * from /api/buylist/rollup — no fetching, no DOM. Tested from
 * web-components/src/utils/buylist-export.test.ts (vitest node project).
 *
 * Two formats:
 *  - Mass Entry: bare "<qty> <name>" lines for TCGplayer's Mass Entry page
 *    (https://www.tcgplayer.com/massentry accepts pasted lines in this shape).
 *    One line per printing, order preserved — same-name printings (e.g. red
 *    and blue pitch) stay separate lines and get disambiguated on their end.
 *  - Plain text: the whole structured list (tiers, groups, prices) for
 *    pasting into Discord, notes, or an LGS email.
 */

interface Range {
  min: number;
  max: number;
}

interface ExportCard {
  printingId: string;
  qty: Range;
  unitPrice: number | null;
  subtotal: Range;
  needed: Range;
}

interface ExportGroup {
  label: string;
  cards: ExportCard[];
}

interface ExportTier {
  label: string;
  groups: ExportGroup[];
  totals: { cost: Range };
}

interface ExportRollup {
  tiers: ExportTier[];
  totals: { cost: Range };
}

interface ExportCardMeta {
  name?: string;
  collector_number?: string;
}

type CardMetaMap = Record<string, ExportCardMeta | undefined>;

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

function moneyRange(range: Range): string {
  return range.min === range.max
    ? money(range.min)
    : `${money(range.min)} – ${money(range.max)}`;
}

function qtyText(range: Range): string {
  return range.min === range.max ? `${range.min}x` : `${range.min}-${range.max}x`;
}

function cardName(card: ExportCard, cards: CardMetaMap): string {
  return cards[card.printingId]?.name ?? card.printingId;
}

function eachCard(rollup: ExportRollup): ExportCard[] {
  return rollup.tiers.flatMap(tier => tier.groups).flatMap(group => group.cards);
}

export interface MassEntryOptions {
  /** Emit only still-needed copies (needed.max) instead of the full list. */
  onlyNeeded?: boolean;
}

export function buildMassEntryText(
  rollup: ExportRollup,
  cards: CardMetaMap,
  options: MassEntryOptions = {}
): string {
  return eachCard(rollup)
    .map(card => {
      const quantity = options.onlyNeeded ? card.needed.max : card.qty.max;
      return quantity > 0 ? `${quantity} ${cardName(card, cards)}` : null;
    })
    .filter((line): line is string => line !== null)
    .join('\n');
}

export function buildPlainTextExport(
  heading: string,
  rollup: ExportRollup,
  cards: CardMetaMap
): string {
  const lines: string[] = [`${heading} (${moneyRange(rollup.totals.cost)})`];

  for (const tier of rollup.tiers) {
    lines.push('', `${tier.label} (${moneyRange(tier.totals.cost)})`);

    for (const group of tier.groups) {
      lines.push(`  ${group.label}`);

      for (const card of group.cards) {
        const meta = cards[card.printingId];
        const collector = meta?.collector_number
          ? ` (${meta.collector_number.toUpperCase()})`
          : '';
        const price = card.unitPrice == null ? 'no price' : moneyRange(card.subtotal);
        lines.push(`  ${qtyText(card.qty)} ${cardName(card, cards)}${collector} — ${price}`);
      }
    }
  }

  return lines.join('\n');
}
