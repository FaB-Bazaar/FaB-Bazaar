// app/discord-v2/utils/paginateDeckContents.ts

function getColorDot(pd: any): string {
  // Check pitch value (1=red, 2=yellow, 3=blue)
  const pitch = pd.pitch ?? pd.pitch_value;
  if (pitch === 1 || pitch === '1') return ' 🔴';
  if (pitch === 2 || pitch === '2') return ' 🟡';
  if (pitch === 3 || pitch === '3') return ' 🔵';

  // Fallback: check color field
  const color = String(pd.color || '').toLowerCase().trim();
  if (color === 'red'    || color === 'r') return ' 🔴';
  if (color === 'yellow' || color === 'y') return ' 🟡';
  if (color === 'blue'   || color === 'b') return ' 🔵';

  return '';
}

function isWeapon(pd: any): boolean {
  const types: string[] = pd.types ?? [];
  const typeText: string = pd.type_text ?? '';
  return types.some((t: string) => t.toLowerCase() === 'weapon')
    || typeText.toLowerCase().includes('weapon');
}

/**
 * Group DeckPrintingDTO entries by card_unique_id (naturally color-aware in FaB),
 * summing quantities. Stores first printingId found for linking. Returns sorted array.
 */
function groupByCard(
  printings: any[]
): Array<{ name: string; colorDot: string; quantity: number; printingId: string | null }> {
  const map = new Map<string, { name: string; colorDot: string; quantity: number; printingId: string | null }>();

  for (const p of printings) {
    const pd = p.printingDetails || {};
    // card_unique_id is per-card-per-color in FaB — perfect grouping key
    const key = pd.card_unique_id || pd.display_name || pd.name || p.printingId || 'unknown';
    const name = pd.display_name || pd.name || 'Unknown';
    const colorDot = getColorDot(pd);
    const qty = p.quantity ?? 1;
    const printingId = p.printingId || pd.printing_id || null;

    if (map.has(key)) {
      map.get(key)!.quantity += qty;
    } else {
      map.set(key, { name, colorDot, quantity: qty, printingId });
    }
  }

  // Sort alphabetically, then by color dot so red/yellow/blue stay together
  return Array.from(map.values()).sort((a, b) => {
    const nameCmp = a.name.localeCompare(b.name);
    return nameCmp !== 0 ? nameCmp : a.colorDot.localeCompare(b.colorDot);
  });
}

function fmt(card: { name: string; colorDot: string; quantity: number; printingId: string | null }): string {
  const label = `**${card.name}**${card.colorDot}`;
  const linked = card.printingId
    ? `[${label}](${process.env.NEXT_PUBLIC_APP_URL}/printing/${card.printingId})`
    : label;
  return `${card.quantity}x ${linked}`;
}

/**
 * Paginate a full deck's contents for Discord.
 *
 * Page 0          — Hero + Weapon + Equipment
 * Pages 1 .. N    — Maindeck (MAINDECK_PAGE_SIZE cards per page)
 * Page N+1        — Inventory (if any cards exist)
 */
export function paginateDeckContents(deck: any, discordId: string, page = 0) {
  const MAINDECK_PAGE_SIZE = 12;

  const heroCards      = groupByCard(deck.hero      ?? []);
  const equipmentRaw   = deck.equipment ?? [];
  const weaponCards    = groupByCard(equipmentRaw.filter((p: any) => isWeapon(p.printingDetails ?? {})));
  const equipCards     = groupByCard(equipmentRaw.filter((p: any) => !isWeapon(p.printingDetails ?? {})));
  const maindeckCards  = groupByCard(deck.maindeck  ?? []);
  const inventoryCards = groupByCard(deck.inventory ?? []);

  const maindeckPages  = Math.max(1, Math.ceil(maindeckCards.length / MAINDECK_PAGE_SIZE));
  const hasInventory   = inventoryCards.length > 0;
  const totalPages     = 1 + maindeckPages + (hasInventory ? 1 : 0);
  // page 0          = Hero/Weapon/Equipment
  // pages 1..mPages = Maindeck
  // last page       = Inventory (optional)

  const deckUrl = `${process.env.NEXT_PUBLIC_APP_URL}/decks/${deck.publicId}`;
  const format  = deck.format || '';
  const pageInfo = `(Page ${page + 1}/${totalPages})`;
  const header   = `[**${deck.name}**](${deckUrl}) — ${format} ${pageInfo}`;

  let lines: string[];

  if (page === 0) {
    // ── Hero + Weapon + Equipment ──────────────────────────────────────────
    lines = [];
    if (heroCards.length) {
      lines.push('**Hero:**');
      heroCards.forEach(c => lines.push(fmt(c)));
    }
    if (weaponCards.length) {
      if (lines.length) lines.push('');
      lines.push(`**Weapons (${weaponCards.length}):**`);
      weaponCards.forEach(c => lines.push(fmt(c)));
    }
    if (equipCards.length) {
      if (lines.length) lines.push('');
      lines.push(`**Equipment (${equipCards.length}):**`);
      equipCards.forEach(c => lines.push(fmt(c)));
    }
    if (!lines.length) lines.push('No hero, weapon or equipment cards.');

  } else if (hasInventory && page === totalPages - 1) {
    // ── Inventory (last page) ──────────────────────────────────────────────
    lines = [`**Inventory (${inventoryCards.length} unique)**`, ...inventoryCards.map(fmt)];

  } else {
    // ── Maindeck ───────────────────────────────────────────────────────────
    const mdPage = page - 1;
    const start  = mdPage * MAINDECK_PAGE_SIZE;
    const slice  = maindeckCards.slice(start, start + MAINDECK_PAGE_SIZE);
    const totalMdQty = (deck.maindeck ?? []).reduce(
      (s: number, p: any) => s + (p.quantity ?? 1), 0
    );
    lines = [
      `**Maindeck (${maindeckCards.length} unique, ${totalMdQty} cards) — part ${mdPage + 1}/${maindeckPages}**`,
      ...slice.map(fmt),
    ];
    if (slice.length === 0) lines.push('No maindeck cards.');
  }

  const content = `${header}\n${lines.join('\n')}`;

  // ── Navigation buttons ─────────────────────────────────────────────────
  const components: any[] = [];
  if (totalPages > 1) {
    components.push({
      type: 1,
      components: [
        {
          type: 2,
          label: 'Previous',
          style: 2,
          custom_id: `deck_contents_page:${discordId}:${deck.publicId}:${page - 1}`,
          disabled: page === 0,
        },
        {
          type: 2,
          label: `${page + 1}/${totalPages}`,
          style: 2,
          custom_id: `deck_contents_indicator_${Date.now()}`,
          disabled: true,
        },
        {
          type: 2,
          label: 'Next',
          style: 1,
          custom_id: `deck_contents_page:${discordId}:${deck.publicId}:${page + 1}`,
          disabled: page + 1 >= totalPages,
        },
      ],
    });
  }

  return { content, components };
}
