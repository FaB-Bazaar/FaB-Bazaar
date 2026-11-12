// The partner API's response shapes. Internal DTOs change with the app; these
// are the contract described in the OpenAPI spec, so a field is only ever
// added here — never renamed or removed within a version.
import type { BinderWithStatsDTO, InventoryCardDTO } from '@/lib/services/contracts/IBinderService';
import type { DeckDTO, DeckPrintingDTO, DeckSummaryDTO } from '@/lib/services/contracts/IDeckService';

export interface PartnerCard {
  printing_id: string;
  card_unique_id: string;
  name: string;
  pitch: number | null;
  set: string;
  collector_number: string;
  edition: string;
  foiling: string;
  rarity: string;
  language: string;
  image_url: string | null;
  /** TCGplayer low, in USD. null when we have no low price. */
  price_usd: number | null;
}

interface CardSource {
  printing_id: string;
  card_unique_id?: string;
  name?: string;
  display_name?: string;
  pitch?: number | null;
  set?: string;
  collector_number?: string;
  edition?: string;
  foiling?: string;
  rarity?: string;
  language?: string;
  image_url?: string | null;
  tcg_low?: number | null;
}

export function toPartnerCard(p: CardSource): PartnerCard {
  return {
    printing_id: p.printing_id,
    card_unique_id: p.card_unique_id ?? '',
    name: p.display_name || p.name || '',
    pitch: p.pitch ?? null,
    set: p.set ?? '',
    collector_number: p.collector_number ?? '',
    edition: p.edition ?? '',
    foiling: p.foiling ?? '',
    rarity: p.rarity ?? '',
    language: (p.language ?? 'en').toLowerCase(),
    image_url: p.image_url || null,
    price_usd: typeof p.tcg_low === 'number' ? p.tcg_low : null,
  };
}

const iso = (d?: Date | string | null) => (d ? new Date(d).toISOString() : null);

export function toPartnerBinder(b: BinderWithStatsDTO) {
  return {
    id: b._id,
    name: b.name,
    slug: b.slug ?? null,
    visibility: b.visibility?.level ?? (b.isPublic ? 'public' : 'private'),
    total_quantity: b.stats?.totalQuantity ?? 0,
    total_value_usd: b.stats?.totalValue?.tcg_low ?? 0,
    updated_at: iso(b.updatedAt),
  };
}

export function toPartnerBinderItem(c: InventoryCardDTO) {
  return {
    item_id: c._id,
    quantity: c.quantity,
    condition: c.condition,
    for_trade: c.forTrade,
    card: toPartnerCard({ ...c, printing_id: c.printingId }),
  };
}

export function toPartnerDeckSummary(d: DeckSummaryDTO | DeckDTO) {
  return {
    id: d.publicId,
    name: d.name,
    format: d.format,
    hero: ('heroDisplayName' in d && d.heroDisplayName) || d.heroName || null,
    visibility: d.visibility,
    total_cards: d.totalCards ?? 0,
    estimated_value_usd: d.estimatedValue ?? 0,
    updated_at: iso(d.updatedAt),
  };
}

function toZone(entries: DeckPrintingDTO[] | undefined) {
  return (entries ?? []).map(entry => ({
    printing_id: entry.printingId,
    quantity: entry.quantity ?? 1,
    card: entry.printingDetails
      ? toPartnerCard({ ...entry.printingDetails, printing_id: entry.printingId })
      : null,
  }));
}

export function toPartnerDeck(d: DeckDTO) {
  return {
    ...toPartnerDeckSummary(d),
    // `inventory` is the sideboard; `benched` is a maybe-pile outside the deck.
    zones: {
      hero: toZone(d.hero),
      equipment: toZone(d.equipment),
      maindeck: toZone(d.maindeck),
      inventory: toZone(d.inventory),
      benched: toZone(d.benched),
      tokens: toZone(d.tokens),
    },
  };
}
