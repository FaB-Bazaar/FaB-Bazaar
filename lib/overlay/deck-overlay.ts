import type { DeckDTO } from '@/lib/services/contracts/IDeckService';

export type OverlayDeckInput = Pick<
  DeckDTO,
  'name' | 'format' | 'heroName' | 'visibility' | 'metafyGuideId' | 'hero' | 'equipment' | 'maindeck'
> & Partial<Pick<DeckDTO, 'inventory'>>;

export interface OverlayCard {
  name: string;
  quantity: number;
  pitch: number | null;
  imageUrl: string | null;
}

export interface OverlayPitchGroup {
  pitch: 1 | 2 | 3 | null;
  label: 'Red' | 'Yellow' | 'Blue' | 'No pitch';
  count: number;
  cards: OverlayCard[];
}

export interface DeckOverlayModel {
  name: string;
  format: string;
  heroName: string | null;
  hero: OverlayCard | null;
  equipment: OverlayCard[];
  pitchGroups: OverlayPitchGroup[];
  maindeckCount: number;
  /** The sideboard (deck zone `inventory`), pitchless equipment left out. */
  inventoryGroups: OverlayPitchGroup[];
  inventoryCount: number;
  spotlight: OverlayCard[];
}

type DeckEntry = DeckDTO['maindeck'][number];

const PITCH_GROUPS: { pitch: OverlayPitchGroup['pitch']; label: OverlayPitchGroup['label'] }[] = [
  { pitch: 1, label: 'Red' },
  { pitch: 2, label: 'Yellow' },
  { pitch: 3, label: 'Blue' },
  { pitch: null, label: 'No pitch' },
];

/**
 * Overlays are fetched by OBS with no session, so they only ever show decks that are
 * viewable by anyone with the link. Metafy-gated decks are paid guide content and never
 * render, even when their visibility is public.
 */
export function isOverlayVisible(deck: OverlayDeckInput): boolean {
  return deck.visibility !== 'private' && !deck.metafyGuideId;
}

function normalizePitch(pitch: unknown): 1 | 2 | 3 | null {
  return pitch === 1 || pitch === 2 || pitch === 3 ? pitch : null;
}

/**
 * Equipment/weapons can be stored in the maindeck or inventory zone depending on how they
 * were added (see app/decks/[deckId]/CLAUDE.md). Pitchless ones are gear; pitched ones are
 * Evos, which are played from the deck and stay with the cards.
 */
function isGear(entry: DeckEntry): boolean {
  const details = entry.printingDetails ?? {};
  const types: string[] = details.types ?? [];
  return normalizePitch(details.pitch) === null && (types.includes('equipment') || types.includes('weapon'));
}

function toPitchGroups(cards: OverlayCard[]): OverlayPitchGroup[] {
  return PITCH_GROUPS.map(({ pitch, label }) => {
    const inGroup = cards.filter(c => c.pitch === pitch);
    return { pitch, label, cards: inGroup, count: inGroup.reduce((sum, c) => sum + c.quantity, 0) };
  }).filter(group => group.cards.length > 0);
}

const sumCounts = (groups: OverlayPitchGroup[]) => groups.reduce((sum, g) => sum + g.count, 0);

/** Collapses printings of the same card + pitch into one row; the first printing's art wins. */
function toCards(entries: DeckEntry[] = []): OverlayCard[] {
  const byKey = new Map<string, OverlayCard>();
  for (const entry of entries) {
    const details = entry.printingDetails ?? {};
    // deck printingDetails.name is the lowercase lookup key; display_name is the printed name
    const name = details.display_name ?? details.name;
    if (!name) continue;
    const pitch = normalizePitch(details.pitch);
    const key = `${name}|${pitch}`;
    const quantity = entry.quantity ?? 1;
    const existing = byKey.get(key);
    if (existing) {
      existing.quantity += quantity;
      existing.imageUrl ??= details.image_url ?? null;
    } else {
      byKey.set(key, { name, quantity, pitch, imageUrl: details.image_url ?? null });
    }
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function buildDeckOverlayModel(deck: OverlayDeckInput): DeckOverlayModel {
  const hero = toCards(deck.hero)[0] ?? null;
  const maindeckEntries = deck.maindeck ?? [];
  const equipment = toCards([...(deck.equipment ?? []), ...maindeckEntries.filter(isGear)]);
  const pitchGroups = toPitchGroups(toCards(maindeckEntries.filter(e => !isGear(e))));
  const inventoryGroups = toPitchGroups(toCards((deck.inventory ?? []).filter(e => !isGear(e))));

  const spotlight = [hero, ...equipment, ...pitchGroups.flatMap(g => g.cards)].filter(
    (c): c is OverlayCard => !!c?.imageUrl
  );

  return {
    name: deck.name,
    format: deck.format,
    heroName: deck.heroName ?? null,
    hero,
    equipment,
    pitchGroups,
    maindeckCount: sumCounts(pitchGroups),
    inventoryGroups,
    inventoryCount: sumCounts(inventoryGroups),
    spotlight,
  };
}
