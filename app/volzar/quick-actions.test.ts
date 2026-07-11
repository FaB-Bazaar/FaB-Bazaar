/**
 * Unit tests for the quick-action formatters — the zero-token deterministic
 * path in the Volzar chat, the binder drill-down lines, and the lazy context
 * hand-off to the next AI turn.
 */

import { describe, it, expect } from 'vitest';
import {
  sortRowsForStrips,
  harvestCardsFromDataItem,
  sumPersonalGames,
  deckShapeSummary,
  splitSectionsByPitch,
  prettifyCardText,
  summarizeBinders,
  summarizeWantsCards,
  toShorthand,
  summarizeDecks,
  summarizeBinderCards,
  summarizeDeckContents,
  summarizeComparison,
  buildMessageWithContext,
  parseSearchResults,
  harvestCardsFromStructured,
  summarizeGameResults,
  buildAnalyzeGameMessage,
  summarizeHeroKit,
  summarizeArchetypeConsensus,
  summarizeToBeatDecks,
  mergeEventSummaries,
  recentYearMonths,
  isoDateMonthsAgo,
  printingToSwapOption,
  shouldOpenInWorkspace,
  advanceWorkspace,
  adjustItemRowQty, swapItemRowPrinting, refreshDataItem, collectMutationTargets, WRITE_TOOLS,
} from './quick-actions';

describe('printingToSwapOption', () => {
  const dto = {
    printing_id: 'PID_ALPHA_123456789ab',
    card_unique_id: 'CUID_00000000000000000',
    set: 'WTR',
    foiling: 'R',
    rarity: 'M',
    edition: 'F',
    collector_number: 'WTR009',
    is_extended_art: true,
    tcg_low: 0.71,
    tcg_market: 0.92,
    tcgplayer_url: 'https://www.tcgplayer.com/product/123',
    image_url: 'https://imagedelivery.net/x/PID_ALPHA_123456789ab/public',
  };

  it('maps a search/core printing row to an option + full rail preview', () => {
    const opt = printingToSwapOption(dto, 'Sand Sketched Plan');
    expect(opt.printingId).toBe('PID_ALPHA_123456789ab');
    expect(opt.set).toBe('WTR');
    expect(opt.foiling).toBe('R');
    expect(opt.collector).toBe('WTR009');
    expect(opt.isExtendedArt).toBe(true);
    expect(opt.priceLow).toBe(0.71);
    expect(opt.priceMarket).toBe(0.92);
    // The nested preview is what feeds the rail (image, prices, TCG link, add actions)
    expect(opt.preview).toMatchObject({
      name: 'Sand Sketched Plan',
      printingId: 'PID_ALPHA_123456789ab',
      priceLow: 0.71,
      priceMarket: 0.92,
      tcgplayerUrl: 'https://www.tcgplayer.com/product/123',
    });
    expect(opt.preview.imageUrl).toContain('PID_ALPHA_123456789ab');
  });

  it('coerces string prices and tolerates missing optional fields', () => {
    const opt = printingToSwapOption(
      { printing_id: 'PID_BETA_9876543210zyx', set: 'ARC', tcg_low: '2.50', tcg_market: null },
      'Eye of Ophidia',
    );
    expect(opt.priceLow).toBe(2.5);
    expect(opt.priceMarket).toBeUndefined();
    expect(opt.isExtendedArt).toBe(false);
    expect(opt.preview.tcgplayerUrl).toBeUndefined();
    expect(opt.preview.imageUrl).toContain('PID_BETA_9876543210zyx');
  });
});

describe('summarizeBinders', () => {
  it('produces drillable lines carrying binder id and name', () => {
    const result = summarizeBinders([
      { _id: 'b1', name: 'Pirate', slug: 'pirate' },
      { _id: 'b2', name: 'No Slug Binder', slug: null },
    ]);
    expect(result.title).toBe('Your binders (2)');
    expect(result.lines[0]).toEqual({ text: 'Pirate (pirate)', drill: { kind: 'binder', id: 'b1', name: 'Pirate' } });
    expect(result.lines[1]).toEqual({ text: 'No Slug Binder', drill: { kind: 'binder', id: 'b2', name: 'No Slug Binder' } });
    expect(result.context).toContain('Pirate [pirate]');
  });

  it('handles the empty state', () => {
    const result = summarizeBinders([]);
    expect(result.lines).toEqual(['No binders yet.']);
    expect(result.context).toContain('none');
  });
});

describe('toShorthand (Discord copy format)', () => {
  const row = (o: Partial<any>) => ({ qty: 1, name: 'X', preview: {} as any, ...o });
  it('formats qty (omit when 1), EA, foil, Marvel, then name', () => {
    expect(toShorthand(row({ qty: 3, extendedArt: true, foiling: 'r', name: 'Sigil of Brilliance' }))).toBe('3x EA RF Sigil of Brilliance');
    expect(toShorthand(row({ qty: 3, foiling: 'r', name: 'Null // Shock' }))).toBe('3x RF Null // Shock');
    expect(toShorthand(row({ qty: 1, foiling: 'c', name: 'Savage Claw' }))).toBe('CF Savage Claw');
    expect(toShorthand(row({ qty: 1, marvel: true, name: 'Oscilio, Constella Intelligence' }))).toBe('Marvel Oscilio, Constella Intelligence');
    expect(toShorthand(row({ qty: 2, name: 'Plain Card' }))).toBe('2x Plain Card'); // non-foil omitted
  });
});

describe('summarizeWantsCards', () => {
  it('formats the legacy wants cards shape defensively, with hover previews', () => {
    const result = summarizeWantsCards([
      { display_name: 'Vigorous Smashup (Red)', quantity: 2, priority: 'high' },
      { name: 'Pummel' }, // missing quantity/priority must not crash
    ]);
    expect(result.lines[0]).toMatchObject({
      text: '2× Vigorous Smashup (Red) (high)',
      preview: { name: 'Vigorous Smashup (Red)' },
    });
    expect((result.lines[0] as any).preview.imageUrl).toBeTruthy();
    expect(result.lines[1]).toMatchObject({ text: '1× Pummel' });
    expect(result.title).toBe('Your wants (2)');
  });

  it('handles the empty state', () => {
    expect(summarizeWantsCards([]).lines).toEqual(['Your wants list is empty.']);
  });

  it('shows collector number, foiling, price and a pitch gem per want', () => {
    const result = summarizeWantsCards([
      { display_name: 'Sink Below', quantity: 1, priority: 'high', foiling: 's', pitch: 3,
        printingDetails: { collector_number: 'CRU050', tcg_low: 0.25 } } as any,
    ]);
    const line = result.lines[0] as any;
    expect(line.text).toContain('CRU050'); // collector number (not just set)
    expect(line.text).toContain('NF');     // non-foil
    expect(line.text).toContain('$0.25');  // price
    expect(line.text).toContain('(high)');
    expect(line.pitch).toBe(3);
  });

  it('emits table rows + a copy header for the UI table / Discord copy', () => {
    const result = summarizeWantsCards([
      { display_name: 'Sigil of Brilliance', quantity: 3, foiling: 'r', is_extended_art: true, rarity: 'm',
        printingDetails: { collector_number: 'ROS022', tcg_low: 25.97, pitch: 2 } } as any,
    ]);
    expect(result.copyHeader).toMatch(/wants/i);
    const r = result.tableRows?.[0] as any;
    expect(r).toMatchObject({ qty: 3, name: 'Sigil of Brilliance', foiling: 'r', extendedArt: true, collector: 'ROS022', pitch: 2 });
    expect(toShorthand(r)).toBe('3x EA RF Sigil of Brilliance');
  });

  it('prefers display_name from printingDetails over the lowercase top-level name', () => {
    // The /api/wants route puts display_name only inside printingDetails; the
    // top-level `name` is the lowercase internal name.
    const result = summarizeWantsCards([
      { name: 'command and conquer', quantity: 1, printingDetails: { display_name: 'Command and Conquer' } } as any,
    ]);
    expect((result.lines[0] as any).text).toBe('1× Command and Conquer');
    expect(result.context).toContain('Command and Conquer');
  });
});

describe('summarizeDecks', () => {
  it('makes decks drillable by publicId, falling back to lowercase heroName', () => {
    const result = summarizeDecks([
      { publicId: 'pub1', name: 'CC Gravy', format: 'cc', heroDisplayName: 'Gravy Bones' },
      { name: 'Teklosaucen', format: 'Classic Constructed', heroName: 'teklovossen, esteemed magnate' },
    ]);
    expect(result.lines[0]).toEqual({
      text: 'CC Gravy — Gravy Bones (cc)',
      drill: { kind: 'deck', id: 'pub1', name: 'CC Gravy' },
    });
    // no publicId → plain line, no drill
    expect(result.lines[1]).toBe('Teklosaucen — teklovossen, esteemed magnate (Classic Constructed)');
  });

  it('excludes system + featured (Decks to Beat) decks — "My decks" is personal only', () => {
    const result = summarizeDecks([
      { publicId: 'mine', name: 'My CC deck', format: 'cc', heroName: 'gravy bones' },
      { publicId: 'sys1', name: 'SYS: Fai', format: 'cc', heroName: 'fai', isSystemDeck: true },
      { publicId: 'feat1', name: 'DTB: Oldhim', format: 'cc', heroName: 'oldhim', featured: true },
      // a deck can be both — still excluded
      { publicId: 'both', name: 'DTB+SYS', format: 'cc', heroName: 'kano', featured: true, isSystemDeck: true },
    ]);
    expect(result.title).toBe('Your decks (1)');
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toMatchObject({ drill: { id: 'mine', name: 'My CC deck' } });
    expect(result.context).not.toContain('DTB');
    expect(result.context).not.toContain('SYS');
  });
});

describe('prettifyCardText', () => {
  it('sentence-cases the first word and after terminators', () => {
    expect(prettifyCardText('when this hits a hero, destroy an item. instant - discard this: draw a card.'))
      .toBe('When this hits a hero, destroy an item. Instant - discard this: Draw a card.');
  });

  it("capitalizes the card's own name mid-sentence (full + pre-comma segment)", () => {
    expect(prettifyCardText('if beast within is put into a graveyard, banish the top card.', 'Beast Within'))
      .toBe('If Beast Within is put into a graveyard, banish the top card.');
    expect(prettifyCardText('as an additional cost to play teklovossen, discard.', 'Teklovossen, Esteemed Magnate'))
      .toBe('As an additional cost to play Teklovossen, discard.');
  });

  it('leaves {p}/{h}/{r} token markup untouched', () => {
    expect(prettifyCardText('if it has 6 or more {p}, lose 1{h}.'))
      .toBe('If it has 6 or more {p}, lose 1{h}.');
  });

  it('returns undefined for empty/missing text', () => {
    expect(prettifyCardText(undefined)).toBeUndefined();
    expect(prettifyCardText('')).toBeUndefined();
  });
});

describe('summarizeDeckContents', () => {
  const card = (name: string, quantity: number, pitch?: number) => ({
    quantity,
    printingDetails: { display_name: name, pitch, image_url: `https://img/${name}` },
  });

  it('sections hero/equipment/maindeck with totals, pitch fields, and compact context', () => {
    const result = summarizeDeckContents({
      name: 'Teklosaucen',
      format: 'Classic Constructed',
      heroName: 'teklovossen, esteemed magnate',
      hero: [card('Teklovossen', 1)],
      equipment: [card('Teklo Leveler', 1)],
      maindeck: [card('Overcrowded', 3, 3)],
    });

    expect(result.title).toBe('Deck: Teklosaucen (Classic Constructed)');
    expect(result.lines).toContain('— Hero (1) —');
    expect(result.lines).toContainEqual(expect.objectContaining({ text: '1× Teklovossen', preview: expect.objectContaining({ name: 'Teklovossen' }) }));
    expect(result.lines).toContain('— Equipment (1) —');
    expect(result.lines).toContain('— Maindeck (3) —');
    expect(result.lines).toContainEqual(expect.objectContaining({ text: '3× Overcrowded', pitch: 3 }));
    expect(result.context).toContain('deck "Teklosaucen"');
    expect(result.context).toContain('Maindeck: 3x Overcrowded (p3)');
  });

  it('leads with a maindeck color breakdown (the instant "how many blue cards" answer)', () => {
    const result = summarizeDeckContents({
      name: 'Victor',
      maindeck: [card('Cranial Crush', 3, 3), card('Pummel', 3, 1), card('Remembrance', 3, 2)],
    });
    // First line summarizes the color curve, weighted by quantity.
    expect(result.lines[0]).toBe('🎨 Maindeck colors: 3 red · 3 yellow · 3 blue');
    // …and it's queued into the AI context too.
    expect(result.context).toContain('3 red');
  });

  it('marks the result editable only when the API says canEdit — gates the "Add card" button to owned decks', () => {
    const base = { name: 'Victor', publicId: 'pub-1', maindeck: [card('Pummel', 3, 1)] };

    expect(summarizeDeckContents({ ...base, canEdit: true }).deckEditable).toBe(true);
    // Decks-to-Beat / other users' decks: no canEdit → no editable flag
    expect(summarizeDeckContents(base).deckEditable).toBeUndefined();
    expect(summarizeDeckContents({ ...base, canEdit: false }).deckEditable).toBeUndefined();
  });

  it('exposes a cards[] array across sections for the deck-view overlay', () => {
    const result = summarizeDeckContents({
      name: 'Victor',
      equipment: [{ ...card('Aurum Aegis', 1), printingId: 'pid_aa' }],
      maindeck: [{ ...card('Cranial Crush', 3, 3), printingId: 'pid_cc' }],
    } as any);
    expect(result.cards?.find((c) => c.name === 'Cranial Crush')).toMatchObject({ printingId: 'pid_cc', quantity: 3, pitch: 3 });
    expect(result.cards?.find((c) => c.name === 'Aurum Aegis')).toMatchObject({ printingId: 'pid_aa', quantity: 1 });
  });

  it('prepends a collection-compare drill and exposes publicId when the deck has one', () => {
    const result = summarizeDeckContents({
      publicId: 'pub1',
      name: 'Teklosaucen',
      maindeck: [card('Overcrowded', 3, 3)],
    });
    expect(result.lines).toContainEqual(expect.objectContaining({
      drill: { kind: 'deck-compare', id: 'pub1', name: 'Teklosaucen' },
    }));
    // publicId rides the result so the UI can render "Add to my decks".
    expect(result.publicId).toBe('pub1');
  });

  it('omits publicId for a deck without one (no Add-to-my-decks button)', () => {
    const result = summarizeDeckContents({ name: 'Local', maindeck: [card('Overcrowded', 3, 3)] });
    expect(result.publicId).toBeUndefined();
  });

  it('emits section-grouped table rows (Hero/Equipment/Maindeck) for the striped table', () => {
    const result = summarizeDeckContents({
      name: 'Teklosaucen',
      hero: [card('Teklovossen', 1)],
      equipment: [card('Teklo Leveler', 1)],
      maindeck: [card('Overcrowded', 3, 3), card('Pummel', 3, 1)],
    });
    expect(result.tableSections?.map((s) => [s.title, s.count])).toEqual([
      ['Hero', 1],
      ['Equipment', 1],
      ['Maindeck', 6],
    ]);
    const maindeck = result.tableSections?.find((s) => s.title === 'Maindeck');
    expect(maindeck?.rows).toContainEqual(expect.objectContaining({ name: 'Overcrowded', qty: 3, pitch: 3 }));
  });

  it('includes the Inventory (sideboard) section — matchup side-ins live there', () => {
    const result = summarizeDeckContents({
      name: 'Teklosaucen',
      maindeck: [card('Overcrowded', 3, 3)],
      inventory: [card('Unmovable', 2, 3)],
    });
    expect(result.lines).toContain('— Inventory (2) —');
    expect(result.context).toContain('Inventory: 2x Unmovable (p3)');
    expect(result.tableSections?.map((s) => [s.title, s.count])).toEqual([
      ['Maindeck', 3],
      ['Inventory', 2],
    ]);
  });

  it('omits tableSections for an empty deck', () => {
    expect(summarizeDeckContents({ name: 'Empty' }).tableSections).toBeUndefined();
  });

  it('handles an empty deck', () => {
    expect(summarizeDeckContents({ name: 'Empty' }).lines).toEqual(['This deck is empty.']);
  });
});

describe('summarizeComparison', () => {
  it('sections missing (with cost) and partial, with an owned summary line', () => {
    const result = summarizeComparison('CC Gravy', {
      owned: [{ printingId: 'a', cardName: 'Owned Card', needed: 3, owned: 3 }],
      partial: [{ printingId: 'b', cardName: 'Half Card', needed: 3, owned: 1 }],
      missing: [{ printingId: 'c', cardName: 'Gone Card', needed: 2, tcgMarket: 5.5 }],
    });

    expect(result.title).toBe('You vs. CC Gravy');
    expect(result.lines[0]).toBe('— Missing (1 cards · ~$11.00) —');
    expect(result.lines[1]).toMatchObject({ text: '2× Gone Card · $5.50', preview: { printingId: 'c' } });
    expect(result.lines[2]).toBe('— Partial (1) —');
    expect(result.lines[3]).toMatchObject({ text: 'Half Card — own 1/3' });
    expect(result.lines[4]).toBe('✓ Fully owned: 1 cards');
    expect(result.context).toContain('missing 2x Gone Card');
    expect(result.context).toContain('~$11.00');
  });

  it('celebrates a fully owned deck', () => {
    const result = summarizeComparison('Deck', { owned: [{ printingId: 'a', cardName: 'X', needed: 1, owned: 1 }] });
    expect(result.lines[0]).toContain('You own everything');
    expect(result.tableSections).toBeUndefined(); // nothing to tabulate
  });

  it('emits Missing/Partial table sections with an Owned tail column (consistent card-table UI)', () => {
    const result = summarizeComparison('CC Gravy', {
      owned: [{ printingId: 'a', cardName: 'Owned Card', needed: 3, owned: 3 }],
      partial: [{ printingId: 'b', cardName: 'Half Card', needed: 3, owned: 1, pitch: 2, tcgLow: 1.2 }],
      missing: [{ printingId: 'c', cardName: 'Gone Card', needed: 2, tcgMarket: 5.5, pitch: 3 }],
    });
    expect(result.tableSections?.map((s) => [s.title, s.count])).toEqual([
      ['Missing — ~$11.00', 1],
      ['Partial', 1],
    ]);
    const gone = result.tableSections![0].rows[0];
    expect(gone).toMatchObject({ qty: 2, name: 'Gone Card', pitch: 3, price: 5.5, note: '0/2' });
    expect(gone.image).toBeTruthy();
    expect(gone.preview.printingId).toBe('c');
    const half = result.tableSections![1].rows[0];
    expect(half).toMatchObject({ qty: 3, name: 'Half Card', pitch: 2, price: 1.2, note: '1/3' });
    expect(result.tableNoteHeader).toBe('Owned');
  });

  it('carries pitch on missing/partial lines and a cards[] of what you still need', () => {
    const result = summarizeComparison('Victor', {
      partial: [{ printingId: 'b', cardName: 'Half Card', needed: 3, owned: 1, pitch: 2 }],
      missing: [{ printingId: 'c', cardName: 'Gone Card', needed: 2, tcgMarket: 5, pitch: 3 }],
    });
    // pitch flows onto the rendered lines (for the gem)
    expect(result.lines).toContainEqual(expect.objectContaining({ text: expect.stringContaining('Gone Card'), pitch: 3 }));
    expect(result.lines).toContainEqual(expect.objectContaining({ text: expect.stringContaining('Half Card'), pitch: 2 }));
    // overlay cards = missing (needed) + partial (shortage), with pitch + printingId
    const gone = result.cards?.find((c) => c.name === 'Gone Card');
    expect(gone).toMatchObject({ printingId: 'c', quantity: 2, pitch: 3 });
    const half = result.cards?.find((c) => c.name === 'Half Card');
    expect(half).toMatchObject({ printingId: 'b', quantity: 2, pitch: 2 }); // shortage 3-1=2
    // overlay is clearly labelled as the missing cards, not a full deck
    expect(result.cardsSubtitle).toMatch(/missing/i);
  });

  it('exposes a wantsAdd payload (missing needed + partial shortfall, all medium priority)', () => {
    const result = summarizeComparison('Victor', {
      owned: [{ printingId: 'a', cardName: 'Owned', needed: 1, owned: 1 }],
      partial: [{ printingId: 'b', cardName: 'Half Card', needed: 3, owned: 1, pitch: 2 }],
      missing: [{ printingId: 'c', cardName: 'Gone Card', needed: 2, tcgMarket: 5, pitch: 3 }],
    });
    // The curated deck printings, ready for wantsClient.bulkAddWants — no per-card search.
    expect(result.wantsAdd).toEqual([
      { printingId: 'c', quantity: 2, priority: 'medium' }, // missing → full needed
      { printingId: 'b', quantity: 2, priority: 'medium' }, // partial → shortfall (3-1)
    ]);
  });

  it('omits wantsAdd when nothing is needed (fully owned deck)', () => {
    const result = summarizeComparison('Deck', { owned: [{ printingId: 'a', cardName: 'X', needed: 1, owned: 1 }] });
    expect(result.wantsAdd).toBeUndefined();
  });
});

describe('summarizeBinderCards', () => {
  it('formats contents with for-trade markers, previews, and a total line', () => {
    const result = summarizeBinderCards('Pirate', [
      { display_name: 'Gravy Bones, Shipwrecked Looter', quantity: 1 },
      { name: 'Salt the Wound', quantity: 3, forTrade: true },
    ], 56);
    expect(result.title).toBe('Binder: Pirate');
    expect(result.lines[0]).toMatchObject({
      text: '1× Gravy Bones, Shipwrecked Looter',
      preview: { name: 'Gravy Bones, Shipwrecked Looter' },
    });
    expect(result.lines[1]).toMatchObject({ text: '3× Salt the Wound · for trade' });
    expect(result.lines[2]).toBe('Total: 56 cards');
    expect(result.context).toContain('"Pirate"');
    expect(result.context).toContain('[for trade]');
  });

  it('handles an empty binder', () => {
    expect(summarizeBinderCards('Empty', [], 0).lines).toEqual(['This binder is empty.']);
  });

  it('shows set, foiling and a pitch gem per card', () => {
    const result = summarizeBinderCards('Pirate', [
      { display_name: 'Command and Conquer', quantity: 2, set: 'wtr', foiling: 'r', pitch: 1, forTrade: true } as any,
    ], 2);
    const line = result.lines[0] as any;
    expect(line.text).toContain('WTR');   // set, uppercased
    expect(line.text).toContain('RF');    // rainbow foil
    expect(line.text).toContain('for trade');
    expect(line.pitch).toBe(1);           // drives the pitch gem
  });

  it('emits table rows + a copy header (with binder name)', () => {
    const result = summarizeBinderCards('Pirate', [
      { display_name: 'Teklo Pounder', quantity: 1, foiling: 'c', set: 'arc', collector_number: 'ARC110', pitch: 0, forTrade: true } as any,
    ], 1);
    expect(result.copyHeader).toMatch(/Pirate/);
    const r = result.tableRows?.[0] as any;
    expect(r).toMatchObject({ qty: 1, name: 'Teklo Pounder', foiling: 'c', collector: 'ARC110', forTrade: true });
    expect(toShorthand(r)).toBe('CF Teklo Pounder');
  });

  it('surfaces card type on table rows (from type_text_display, flat or nested)', () => {
    const flat = summarizeBinderCards('Generics', [
      { display_name: 'Remembrance', quantity: 1, type_text_display: 'Generic Instant' } as any,
    ], 1);
    expect((flat.tableRows?.[0] as any).type).toBe('Generic Instant');

    const nested = summarizeBinderCards('Generics', [
      { display_name: 'Command and Conquer', quantity: 1, printingDetails: { type_text_display: 'Generic Instant' } } as any,
    ], 1);
    expect((nested.tableRows?.[0] as any).type).toBe('Generic Instant');
  });

  it('surfaces card rules text and thumbnail image on table rows', () => {
    const result = summarizeBinderCards('Generics', [
      { display_name: 'Remembrance', quantity: 1, card_text: 'Shuffle up to 3 action cards from your graveyard into your deck.', image_url: 'https://img/remembrance.png' } as any,
    ], 1);
    const r = result.tableRows?.[0] as any;
    expect(r.text).toContain('Shuffle up to 3 action cards');
    expect(r.image).toBe('https://img/remembrance.png');
  });
});

describe('parseSearchResults', () => {
  const printing = (name: string, price?: number) => ({
    printing_id: `id-${name}`,
    name,
    collector_number: 'WTR167',
    set: 'wtr',
    rarity: 'r',
    pitch: 1,
    price,
  });

  it('renders card-table rows with rail previews from structured search results', () => {
    const parsed = parseSearchResults({
      results: [{ total: 4, printings: [
        { ...printing('Snatch', 0.73), types: ['generic', 'action', 'attack'], foiling: 's' },
        printing('Snag'),
      ] }],
    });
    expect(parsed?.total).toBe(4);
    expect(parsed?.shown).toBe(2);
    const first = parsed?.tableRows[0] as any;
    // Same CardRow shape the binder/deck tables render — consistent UI.
    expect(first).toMatchObject({
      name: 'Snatch',
      pitch: 1,
      collector: 'WTR167',
      foiling: 's',
      type: 'Generic Action Attack',
      price: 0.73,
    });
    expect(typeof first.image).toBe('string');
    expect(first.qty).toBeUndefined(); // search hits carry no owned quantity
    expect(first.preview).toMatchObject({ name: 'Snatch', printingId: 'id-Snatch', priceLow: 0.73 });
    // no price → undefined, no crash
    expect((parsed?.tableRows[1] as any).price).toBeUndefined();
  });

  it('caps rows at maxRows and reports the real total', () => {
    const parsed = parseSearchResults({
      results: [{ total: 500, printings: Array.from({ length: 30 }, (_, i) => printing(`Card${i}`)) }],
    }, 20);
    expect(parsed?.shown).toBe(20);
    expect(parsed?.total).toBe(500);
  });

  it('threads tcgplayer_url into the row preview — powers the affiliate price link', () => {
    const parsed = parseSearchResults({
      results: [{ total: 2, printings: [
        { ...printing('Snatch', 0.73), tcgplayer_url: 'https://www.tcgplayer.com/product/12345' },
        printing('Snag', 1.5),
      ] }],
    });
    expect((parsed?.tableRows[0] as any).preview.tcgplayerUrl).toBe('https://www.tcgplayer.com/product/12345');
    expect((parsed?.tableRows[1] as any).preview.tcgplayerUrl).toBeUndefined();
  });

  it('returns null for non-search or empty structured payloads', () => {
    expect(parseSearchResults({ title: 'x', url: 'y' })).toBeNull();
    expect(parseSearchResults({ results: [{ total: 0, printings: [] }] })).toBeNull();
    expect(parseSearchResults(undefined)).toBeNull();
  });

  it('surfaces printing_count as printingCount on a grouped representative row', () => {
    const parsed = parseSearchResults({
      results: [{ total: 1, printings: [{ ...printing('Maximum Velocity', 0.37), printing_count: 4 }] }],
    });
    expect((parsed?.tableRows[0] as any).printingCount).toBe(4);
  });

  it('omits printingCount when the card has a single printing', () => {
    const parsed = parseSearchResults({
      results: [{ total: 1, printings: [{ ...printing('Solo Card', 1), printing_count: 1 }] }],
    });
    expect((parsed?.tableRows[0] as any).printingCount).toBeUndefined();
  });
});

describe('harvestCardsFromStructured', () => {
  const byName = (cards: ReturnType<typeof harvestCardsFromStructured>, name: string) =>
    cards.find((c) => c.name === name);

  it('harvests search_printings results across every card group (not just the first)', () => {
    const cards = harvestCardsFromStructured({
      results: [
        { printings: [{ printing_id: 'p1', name: 'Pummel', pitch: 1 }] },
        { printings: [{ printing_id: 'p2', name: 'Sink Below', pitch: 3 }] },
      ],
    });
    expect(byName(cards, 'Pummel')?.preview.printingId).toBe('p1');
    expect(byName(cards, 'Sink Below')?.pitch).toBe(3);
  });

  it('harvests get_deck cards from hero, equipment and category sections', () => {
    const cards = harvestCardsFromStructured({
      deck: {
        heroCard: { printingId: 'h1', name: 'Victor Goldmane, High and Mighty', pitch: 0 },
        weapon: { printingId: 'w1', name: 'Titan Hammer', pitch: 0 },
        equipment: { head: [{ printingId: 'e1', name: 'Crown of Dominion', pitch: 0 }], other: [] },
        categories: {
          maindeck: [{ printingId: 'm1', name: 'Disable', pitch: 3 }, { printingId: 'm2', name: 'Pummel', pitch: 1 }],
          inventory: [], benched: [], tokens: [],
        },
      },
    });
    expect(byName(cards, 'Disable')?.preview.printingId).toBe('m1');
    expect(byName(cards, 'Disable')?.pitch).toBe(3);
    expect(byName(cards, 'Crown of Dominion')?.preview.printingId).toBe('e1');
    expect(byName(cards, 'Victor Goldmane, High and Mighty')).toBeTruthy();
  });

  it('harvests get_binder cards[] (printingId + name, no pitch)', () => {
    const cards = harvestCardsFromStructured({
      cards: [{ printingId: 'b1', name: 'Command and Conquer' }],
    });
    expect(byName(cards, 'Command and Conquer')?.preview.printingId).toBe('b1');
  });

  it('carries tcgplayer_url into previews — the rail buy link for cards named in AI replies', () => {
    const cards = harvestCardsFromStructured({
      results: [{ printings: [
        { printing_id: 'p1', name: 'Gauntlet of Sword and Sorcery', tcgplayer_url: 'https://www.tcgplayer.com/product/555' },
        { printing_id: 'p2', name: 'Snag' },
      ] }],
      cards: [{ printingId: 'b1', name: 'Pummel', printingDetails: { tcgplayer_url: 'https://www.tcgplayer.com/product/777' } }],
    });
    expect(byName(cards, 'Gauntlet of Sword and Sorcery')?.preview.tcgplayerUrl).toBe('https://www.tcgplayer.com/product/555');
    expect(byName(cards, 'Pummel')?.preview.tcgplayerUrl).toBe('https://www.tcgplayer.com/product/777');
    expect(byName(cards, 'Snag')?.preview.tcgplayerUrl).toBeUndefined();
  });

  it('harvests get_wants cards[] with snake-case printing_id and display_name only', () => {
    const cards = harvestCardsFromStructured({
      cards: [{ printing_id: 'wt1', display_name: 'Enlightened Strike' }],
    });
    expect(byName(cards, 'Enlightened Strike')?.preview.printingId).toBe('wt1');
  });

  it('gives every harvested card a non-empty preview image and name', () => {
    const cards = harvestCardsFromStructured({ cards: [{ printingId: 'x1', name: 'Snatch' }] });
    expect(cards[0].preview.imageUrl.length).toBeGreaterThan(0);
    expect(cards[0].preview.name).toBe('Snatch');
  });

  it('returns [] for undefined / cardless payloads', () => {
    expect(harvestCardsFromStructured(undefined)).toEqual([]);
    expect(harvestCardsFromStructured({ title: 'x', url: 'y' })).toEqual([]);
  });
});

describe('summarizeArchetypeConsensus', () => {
  const data = {
    heroName: 'victor goldmane, high and mighty',
    format: 'cc',
    months: 3,
    consensus: {
      deckCount: 10,
      core: [
        { name: 'Cranial Crush', pitch: 3, decks: 10, typicalQty: 3, printingId: 'pid_cc' },
        { name: 'Aurum Aegis', decks: 10, typicalQty: 1, printingId: 'pid_aa' },
      ],
      flex: [
        { name: 'Disable', pitch: 3, decks: 9, typicalQty: 3, printingId: 'pid_dis' },
        { name: 'Pummel', pitch: 1, decks: 8, typicalQty: 3, printingId: 'pid_pum' },
      ],
      colorCurve: { red: 30, yellow: 12, blue: 30 },
    },
    decks: [],
  };

  it('titles with hero, deck count and window', () => {
    const r = summarizeArchetypeConsensus(data);
    expect(r.title).toMatch(/victor goldmane/i);
    expect(r.title).toMatch(/10 decks/);
    expect(r.title).toMatch(/3 mo/);
  });

  it('leads with the average color curve', () => {
    const r = summarizeArchetypeConsensus(data);
    expect(r.lines[0]).toBe('🎨 Avg colors: 30 red · 12 yellow · 30 blue');
  });

  it('renders core cards with quantity and pitch, and flex cards with adoption ratio', () => {
    const r = summarizeArchetypeConsensus(data);
    expect(r.lines).toContainEqual(expect.objectContaining({ text: '3× Cranial Crush', pitch: 3 }));
    // flex shows how many of the N decks run it — the real outlier signal
    expect(r.lines).toContainEqual(expect.objectContaining({ text: '3× Disable — 9/10 decks', pitch: 3 }));
  });

  it('gives consensus cards a rail preview via their representative printingId', () => {
    const r = summarizeArchetypeConsensus(data);
    const cc = r.lines.find((l) => typeof l !== 'string' && l.text === '3× Cranial Crush') as any;
    expect(cc.preview).toMatchObject({ name: 'Cranial Crush', printingId: 'pid_cc' });
    expect(cc.preview.imageUrl).toBeTruthy();
  });

  it('exposes a cards[] array (printingId, qty, pitch, image) for the deck-view overlay', () => {
    const r = summarizeArchetypeConsensus(data);
    const cc = r.cards?.find((c) => c.name === 'Cranial Crush');
    expect(cc).toMatchObject({ printingId: 'pid_cc', quantity: 3, pitch: 3 });
    expect(cc?.imageUrl).toBeTruthy();
    // core + flex both included
    expect(r.cards?.some((c) => c.name === 'Disable')).toBe(true);
  });

  it('handles an empty result set', () => {
    const r = summarizeArchetypeConsensus({ ...data, consensus: { deckCount: 0, core: [], flex: [], colorCurve: { red: 0, yellow: 0, blue: 0 } } });
    expect(r.lines.join(' ')).toMatch(/no featured/i);
  });

  it('emits Core/Flex table sections with adoption riding the note column', () => {
    const r = summarizeArchetypeConsensus(data);
    expect(r.tableSections?.map((s) => [s.title, s.count])).toEqual([
      ['Core — in all 10 decks', 2],
      ['Flex — varies by build', 2],
    ]);
    const cc = r.tableSections![0].rows[0];
    expect(cc).toMatchObject({ qty: 3, name: 'Cranial Crush', pitch: 3 });
    expect(cc.image).toBeTruthy();
    expect(cc.note).toBeUndefined(); // core is in every deck — no ratio noise
    const dis = r.tableSections![1].rows[0];
    expect(dis).toMatchObject({ qty: 3, name: 'Disable', note: '9/10 decks' });
    // The note column gets a real header in the shared table.
    expect(r.tableNoteHeader).toBe('Decks');
  });
});

describe('buildMessageWithContext', () => {
  it('passes the message through when nothing is queued', () => {
    expect(buildMessageWithContext([], 'hello')).toBe('hello');
  });

  it('prepends queued context blocks before the user text', () => {
    const message = buildMessageWithContext(
      ["The user's binders (name, slug): Pirate [pirate]"],
      'which of these is worth the most?',
    );
    expect(message).toContain('[Context');
    expect(message).toContain('Pirate [pirate]');
    expect(message.endsWith('which of these is worth the most?')).toBe(true);
  });
});

describe('summarizeToBeatDecks (hero / event scoped)', () => {
  const decks = [
    { publicId: 'p1', name: 'Winner Deck', placing: 1, eventName: 'Calling: Bologna', heroName: 'dorinthea' },
    { publicId: 'p2', name: 'Second Deck', placing: 2, eventName: 'Calling: Bologna', heroName: 'dorinthea' },
    { publicId: 'p3', name: 'Other Deck' },
  ];

  it('titles with the scope and deck count', () => {
    const result = summarizeToBeatDecks('Dorinthea · last 3 mo', decks);
    expect(result.title).toBe('Decks to beat — Dorinthea · last 3 mo (3)');
  });

  it('renders medal + event text with a deck drill target per line', () => {
    const result = summarizeToBeatDecks('x', decks);
    const first = result.lines[0] as { text: string; drill?: unknown };
    expect(first.text).toBe('🥇 Winner Deck — Calling: Bologna');
    expect(first.drill).toEqual({ kind: 'deck', id: 'p1', name: 'Winner Deck' });
    const third = result.lines[2] as { text: string };
    expect(third.text).toBe('Other Deck');
  });

  it('context carries the scope plus hero and placing per deck', () => {
    const result = summarizeToBeatDecks('Dorinthea · last 3 mo', decks);
    expect(result.context).toContain('Dorinthea · last 3 mo');
    expect(result.context).toContain('Winner Deck [dorinthea] (#1)');
  });

  it('empty result → friendly message, no drills', () => {
    const result = summarizeToBeatDecks('Dorinthea · last 3 mo', []);
    expect(result.lines).toEqual(['No decks to beat found for Dorinthea · last 3 mo.']);
    expect(result.context).toContain('none');
  });
});

describe('mergeEventSummaries (event picker options)', () => {
  it('merges monthly batches, dedupes by event+date, collects formats, sorts newest first', () => {
    const merged = mergeEventSummaries([
      [
        { eventName: 'Calling: Bologna', eventDate: '2026-06-14', format: 'cc', count: 8 },
        { eventName: 'Calling: Bologna', eventDate: '2026-06-14', format: 'blitz', count: 4 },
      ],
      [
        { eventName: 'Nationals: Japan', eventDate: '2026-05-02', format: 'cc', count: 8 },
      ],
    ]);
    expect(merged).toEqual([
      { eventName: 'Calling: Bologna', eventDate: '2026-06-14', formats: ['cc', 'blitz'], count: 12 },
      { eventName: 'Nationals: Japan', eventDate: '2026-05-02', formats: ['cc'], count: 8 },
    ]);
  });

  it('empty batches → empty list', () => {
    expect(mergeEventSummaries([[], []])).toEqual([]);
  });
});

describe('recentYearMonths / isoDateMonthsAgo (rolling window helpers)', () => {
  it('lists current month first, walking backwards across a year boundary', () => {
    expect(recentYearMonths(3, new Date(2026, 0, 15))).toEqual([
      { year: 2026, month: 1 },
      { year: 2025, month: 12 },
      { year: 2025, month: 11 },
    ]);
  });

  it('isoDateMonthsAgo formats YYYY-MM-DD n months back', () => {
    expect(isoDateMonthsAgo(3, new Date(2026, 6, 5))).toBe('2026-04-05');
  });
});

describe('summarizeGameResults', () => {
  const raw = [
    { id: 'r1', deckPublicId: 'pub1', deckName: 'Dash', format: '1', playerHero: 'dash_io', opponentHero: 'kassai_of_the_golden_sand', result: 'loss' as const, playedAt: '2026-07-01T12:00:00Z' },
    { id: 'r2', deckPublicId: 'pub1', deckName: 'Dash', playerHero: 'dash_io', opponentHero: 'fai_rising_rebellion', result: 'win' as const, playedAt: '2026-06-30T09:00:00Z' },
  ];

  it('builds a table row per game with title-cased heroes, YYYY-MM-DD date, and result', () => {
    const res = summarizeGameResults(raw);
    expect(res.title).toBe('Game results');
    expect(res.resultRows).toHaveLength(2);
    expect(res.resultRows![0]).toMatchObject({
      deckName: 'Dash', playerHero: 'Dash Io', opponentHero: 'Kassai Of The Golden Sand',
      result: 'loss', date: '2026-07-01', resultId: 'r1',
    });
    expect(res.resultRows![1]).toMatchObject({ opponentHero: 'Fai Rising Rebellion', result: 'win', date: '2026-06-30' });
  });

  it('queues context with deckName + resultId per game so the model can call get_results', () => {
    const res = summarizeGameResults(raw);
    expect(res.context).toContain('resultId r1');
    expect(res.context).toContain('deckName "Dash"');
    expect(res.context).toMatch(/get_results/);
  });

  it('handles no games without a table', () => {
    const res = summarizeGameResults([]);
    expect(res.resultRows).toBeUndefined();
    expect(res.lines).toEqual(['No recorded games yet.']);
  });

  it('hint line points at the per-row Analyze click, not at typing a request', () => {
    const res = summarizeGameResults(raw);
    expect(res.lines[0]).toMatch(/click .*analyze/i);
  });
});

describe('buildAnalyzeGameMessage', () => {
  const row = {
    deckName: 'Dash', deckPublicId: 'pub1', resultId: 'res-abc123',
    playerHero: 'Dash Io', opponentHero: 'Kassai Of The Golden Sand',
    result: 'loss' as const, date: '2026-07-01', format: '1',
  };

  it('bakes deckName + resultId into the API content so the model fetches exactly this game', () => {
    const { content } = buildAnalyzeGameMessage(row);
    expect(content).toContain('get_results');
    expect(content).toContain('deckName "Dash"');
    expect(content).toContain('resultId "res-abc123"');
  });

  it('display text is a short human line — matchup + date, no raw resultId', () => {
    const { display } = buildAnalyzeGameMessage(row);
    expect(display).toContain('Dash');
    expect(display).toContain('Kassai Of The Golden Sand');
    expect(display).toContain('2026-07-01');
    expect(display).not.toContain('res-abc123');
  });

  it('content describes the matchup and outcome so the analysis has framing', () => {
    const { content } = buildAnalyzeGameMessage(row);
    expect(content).toMatch(/loss/i);
    expect(content).toContain('Kassai Of The Golden Sand');
  });
});

describe('summarizeHeroKit', () => {
  const lists = [
    {
      name: 'Attack Actions', format: 'Classic Constructed',
      cards: [
        {
          displayName: 'Standing Ovation', printingId: 'p-so', pitch: 3,
          typeTextDisplay: 'Revered Guardian Action - Attack',
          text: 'if 3 or more auras of suspense have left the arena this turn, you get an extra turn.',
          imageUrl: 'https://img/p-so.webp', tcgLow: 1.87,
          collectorNumber: 'MST100', foiling: 's',
        },
      ],
    },
    {
      name: 'Equipment', format: 'Classic Constructed',
      cards: [
        {
          displayName: 'Arcanite Skullcap', printingId: 'p-ask',
          typeTextDisplay: 'Generic Equipment - Head',
          text: 'Arcane Barrier 3. If you have less life than an opponent, this gains +1 defense.',
          imageUrl: 'https://img/p-ask.webp',
        },
      ],
    },
    { name: 'Blitz Stuff', format: 'Blitz', cards: [{ displayName: 'Wrong Format Card', printingId: 'p-n' }] },
  ];

  it('sections per format-matching list, card lines carrying pitch + preview', () => {
    const res = summarizeHeroKit('Pleiades, Superstar', 'Classic Constructed', lists as any);
    expect(res.title).toContain('Pleiades, Superstar');
    const texts = res.lines.map((l) => (typeof l === 'string' ? l : l.text)).join('\n');
    expect(texts).toContain('Attack Actions');
    expect(texts).toContain('Standing Ovation');
    expect(texts).not.toContain('Wrong Format Card');
    const soLine = res.lines.find((l) => typeof l !== 'string' && l.text.includes('Standing Ovation')) as any;
    expect(soLine.pitch).toBe(3);
    expect(soLine.preview.printingId).toBe('p-so');
  });

  it('queues context with type + rules text per card so cheap models recommend without tool calls', () => {
    const res = summarizeHeroKit('Pleiades, Superstar', 'Classic Constructed', lists as any);
    expect(res.context).toContain('Standing Ovation');
    expect(res.context).toContain('Revered Guardian Action - Attack');
    expect(res.context).toContain('auras of suspense');
    expect(res.context).toContain('Arcane Barrier 3');
    expect(res.context).not.toContain('Wrong Format Card');
    expect(res.context).toMatch(/curated kit/i);
  });

  it('emits section-grouped table rows like deck/binder cards (consistent UI)', () => {
    const res = summarizeHeroKit('Pleiades, Superstar', 'Classic Constructed', lists as any);
    expect(res.tableSections?.map((s) => [s.title, s.count])).toEqual([
      ['Attack Actions', 1],
      ['Equipment', 1],
    ]);
    const so = res.tableSections![0].rows[0];
    expect(so).toMatchObject({
      qty: 1,
      name: 'Standing Ovation',
      pitch: 3,
      collector: 'MST100',
      foiling: 's',
      type: 'Revered Guardian Action - Attack',
      image: 'https://img/p-so.webp',
      price: 1.87,
    });
    // Rules text rides the row (sentence-cased for display, like deck drills).
    expect(so.text).toMatch(/^If 3 or more auras of suspense/);
    expect(so.preview.printingId).toBe('p-so');
  });

  it('offers the card-grid overlay for every kit card', () => {
    const res = summarizeHeroKit('Pleiades, Superstar', 'Classic Constructed', lists as any);
    expect(res.cards).toHaveLength(2);
    expect(res.cards![0].printingId).toBe('p-so');
  });

  it('handles a hero with no kits published in the format', () => {
    const res = summarizeHeroKit('Pleiades, Superstar', 'Living Legend', lists as any);
    expect(res.lines).toEqual(['No published kit lists for Pleiades, Superstar in Living Legend.']);
    expect(res.cards).toBeUndefined();
  });
});

describe('shouldOpenInWorkspace', () => {
  it('is true for table-bearing results (deck drills, wants, binder cards)', () => {
    expect(shouldOpenInWorkspace({ lines: [], tableSections: [{ title: 'Maindeck', count: 3, rows: [] }] })).toBe(true);
    expect(shouldOpenInWorkspace({ lines: [], tableRows: [{ name: 'Pummel' } as any] })).toBe(true);
  });

  it('is true for listings — results whose lines drill somewhere (binder/deck lists are pickers)', () => {
    const listing = summarizeBinders([{ _id: 'b1', name: 'Wizard', slug: 'wizard' }]);
    expect(shouldOpenInWorkspace(listing)).toBe(true);
  });

  it('is false for plain informational results (e.g. "Added to binder" confirmations)', () => {
    expect(shouldOpenInWorkspace({ lines: ['2× Enlightened Strike'] })).toBe(false);
    expect(shouldOpenInWorkspace({ lines: [{ text: '1× Pummel', preview: { imageUrl: '', name: 'Pummel' } }] })).toBe(false);
  });
});

describe('advanceWorkspace', () => {
  const item = (title: string) => ({ title }) as any;

  it('a top-level quick action starts a fresh stack (no drilling context to go back to)', () => {
    expect(advanceWorkspace([item('old list')], item('Your decks'), 'decks')).toEqual([item('Your decks')]);
  });

  it('a drill (actionId with ":") pushes onto the stack so Back returns to the list', () => {
    const stack = [item('Your binders')];
    expect(advanceWorkspace(stack, item('Binder: Brute'), 'binder:abc')).toEqual([
      item('Your binders'),
      item('Binder: Brute'),
    ]);
  });

  it('does not mutate the input stack', () => {
    const stack = [item('Your binders')];
    advanceWorkspace(stack, item('Binder: Brute'), 'binder:abc');
    expect(stack).toHaveLength(1);
  });
});

describe('row quantity mutation plumbing', () => {
  it('summarizeBinderCards carries the binder mutation target + per-row inventory itemId', () => {
    const result = summarizeBinderCards('Brute', [
      { id: 'item-1', display_name: 'Pummel', quantity: 3 } as any,
    ], 3, 'binder-9');
    expect(result.mutate).toEqual({ kind: 'binder', binderId: 'binder-9' });
    expect(result.tableRows?.[0].itemId).toBe('item-1');
  });

  it('summarizeWantsCards marks rows as wants-mutable', () => {
    const result = summarizeWantsCards([{ display_name: 'Pummel', quantity: 2 }]);
    expect(result.mutate).toEqual({ kind: 'wants' });
  });

  it('summarizeDeckContents marks rows deck-mutable only when the deck is editable', () => {
    const card = { quantity: 3, printingDetails: { display_name: 'Pummel' } };
    const editable = summarizeDeckContents({ name: 'V', publicId: 'pub-1', canEdit: true, maindeck: [card] });
    expect(editable.mutate).toEqual({ kind: 'deck', publicId: 'pub-1' });
    const readonly = summarizeDeckContents({ name: 'V', publicId: 'pub-1', maindeck: [card] });
    expect(readonly.mutate).toBeUndefined();
  });
});

describe('adjustItemRowQty', () => {
  const row = (printingId: string, qty: number) =>
    ({ qty, name: printingId, preview: { imageUrl: '', name: printingId, printingId } }) as any;

  it('updates the matching flat row without mutating the original item', () => {
    const item = { tableRows: [row('p1', 3), row('p2', 1)] } as any;
    const next = adjustItemRowQty(item, { printingId: 'p1' }, 1);
    expect(next.tableRows[0].qty).toBe(4);
    expect(item.tableRows[0].qty).toBe(3); // untouched
    expect(next).not.toBe(item);
  });

  it('removes the row when quantity reaches zero', () => {
    const item = { tableRows: [row('p1', 1), row('p2', 2)] } as any;
    const next = adjustItemRowQty(item, { printingId: 'p1' }, -1);
    expect(next.tableRows).toHaveLength(1);
    expect(next.tableRows[0].preview.printingId).toBe('p2');
  });

  it('scopes section updates by section title (same printing can sit in Maindeck AND Inventory)', () => {
    const item = {
      tableSections: [
        { title: 'Maindeck', count: 3, rows: [row('p1', 3)] },
        { title: 'Inventory', count: 1, rows: [row('p1', 1)] },
      ],
    } as any;
    const next = adjustItemRowQty(item, { printingId: 'p1', section: 'Maindeck' }, -1);
    expect(next.tableSections[0].rows[0].qty).toBe(2);
    expect(next.tableSections[0].count).toBe(2);
    expect(next.tableSections[1].rows[0].qty).toBe(1); // Inventory untouched
  });

  it('matches binder rows by itemId when present (duplicate printings across conditions)', () => {
    const a = { ...row('p1', 2), itemId: 'i-a' };
    const b = { ...row('p1', 5), itemId: 'i-b' };
    const item = { tableRows: [a, b] } as any;
    const next = adjustItemRowQty(item, { printingId: 'p1', itemId: 'i-b' }, 1);
    expect(next.tableRows[0].qty).toBe(2);
    expect(next.tableRows[1].qty).toBe(6);
  });
});

describe('swapItemRowPrinting', () => {
  const row = (printingId: string, qty: number, over: Record<string, unknown> = {}) =>
    ({ qty, name: 'Pummel', collector: 'OLD001', foiling: 's', price: 1, image: 'old.png',
       preview: { imageUrl: 'old.png', name: 'Pummel', printingId }, ...over }) as any;
  const swap = {
    printingId: 'new1', collector: 'NEW009', foiling: 'r', isExtendedArt: true,
    priceLow: 4.2, priceMarket: 5,
    preview: { imageUrl: 'new.png', name: 'Pummel', printingId: 'new1', priceLow: 4.2 },
  } as any;

  it('replaces the row printing fields (collector/foil/price/image/preview) keeping qty + name', () => {
    const item = { tableRows: [row('old1', 3)] } as any;
    const next = swapItemRowPrinting(item, { printingId: 'old1' }, swap);
    const r = next.tableRows[0];
    expect(r).toMatchObject({ qty: 3, name: 'Pummel', collector: 'NEW009', foiling: 'r', price: 4.2, image: 'new.png', extendedArt: true });
    expect(r.preview.printingId).toBe('new1');
    expect(item.tableRows[0].collector).toBe('OLD001'); // original untouched
  });

  it('merges into an existing row that already has the target printing (qty sums, swapped row dropped)', () => {
    const item = { tableRows: [row('old1', 2), row('new1', 3, { collector: 'NEW009' })] } as any;
    const next = swapItemRowPrinting(item, { printingId: 'old1' }, swap);
    expect(next.tableRows).toHaveLength(1);
    expect(next.tableRows[0].qty).toBe(5);
    expect(next.tableRows[0].preview.printingId).toBe('new1');
  });

  it('scopes deck-section swaps by section title', () => {
    const item = {
      tableSections: [
        { title: 'Maindeck', count: 3, rows: [row('old1', 3)] },
        { title: 'Inventory', count: 1, rows: [row('old1', 1)] },
      ],
    } as any;
    const next = swapItemRowPrinting(item, { printingId: 'old1', section: 'Maindeck' }, swap);
    expect(next.tableSections[0].rows[0].preview.printingId).toBe('new1');
    expect(next.tableSections[1].rows[0].preview.printingId).toBe('old1'); // untouched
  });
});

describe('refreshDataItem', () => {
  it('replaces the displayed content from a fresh drill while keeping the item identity (uid)', () => {
    const item = {
      kind: 'data', uid: 'd7', title: 'Deck: Old (CC)',
      tableSections: [{ title: 'Maindeck', count: 1, rows: [] }],
      mutate: { kind: 'deck', publicId: 'pub-1' },
    } as any;
    const fresh = {
      title: 'Deck: Old (CC)',
      lines: ['🎨 Maindeck colors: 3 red'],
      context: 'ignored',
      tableSections: [{ title: 'Maindeck', count: 4, rows: [] }],
      publicId: 'pub-1',
      deckEditable: true,
      mutate: { kind: 'deck', publicId: 'pub-1' },
    } as any;

    const next = refreshDataItem(item, fresh);

    expect(next.uid).toBe('d7');
    expect(next.kind).toBe('data');
    expect(next.tableSections[0].count).toBe(4);
    expect(next.lines).toEqual(['🎨 Maindeck colors: 3 red']);
    expect(next.deckPublicId).toBe('pub-1');
    expect(next.deckEditable).toBe(true);
  });

  it('clears fields the fresh result no longer carries (no stale tables)', () => {
    const item = { kind: 'data', uid: 'd8', title: 'Your wants (3)', tableRows: [{ name: 'X' }], wantsAdd: [{}] } as any;
    const fresh = { title: 'Your wants (0)', lines: ['Your wants list is empty.'], context: '' } as any;

    const next = refreshDataItem(item, fresh);

    expect(next.title).toBe('Your wants (0)');
    expect(next.tableRows).toBeUndefined();
    expect(next.wantsAdd).toBeUndefined();
  });
});

describe('collectMutationTargets', () => {
  it('dedupes refresh targets across items (a binder shown twice refreshes once)', () => {
    const items = [
      { kind: 'data', mutate: { kind: 'binder', binderId: 'b1' } },
      { kind: 'data', mutate: { kind: 'binder', binderId: 'b1' } },
      { kind: 'data', mutate: { kind: 'binder', binderId: 'b2' } },
      { kind: 'data', mutate: { kind: 'deck', publicId: 'p1' } },
      { kind: 'data', mutate: { kind: 'wants' } },
      { kind: 'data', mutate: { kind: 'wants' } },
      { kind: 'data' }, // no mutate → not a target
      { kind: 'assistant' },
    ] as any[];

    expect(collectMutationTargets(items)).toEqual([
      { destination: 'binder', binderId: 'b1' },
      { destination: 'binder', binderId: 'b2' },
      { destination: 'deck', deckPublicId: 'p1' },
      { destination: 'wants' },
    ]);
  });

  it('returns [] when nothing mutable is on screen', () => {
    expect(collectMutationTargets([{ kind: 'assistant' }] as any[])).toEqual([]);
  });
});

describe('WRITE_TOOLS', () => {
  it('covers the collection-mutating MCP tools and nothing read-only', () => {
    for (const t of ['add_to_binder', 'remove_from_binder', 'add_to_wants', 'remove_from_wants', 'add_cards_to_deck', 'remove_cards_from_deck', 'update_deck', 'create_deck']) {
      expect(WRITE_TOOLS.has(t), t).toBe(true);
    }
    expect(WRITE_TOOLS.has('search_printings')).toBe(false);
    expect(WRITE_TOOLS.has('get_binder')).toBe(false);
  });
});

describe('sortRowsForStrips', () => {
  const row = (name: string, pitch?: number, type?: string) =>
    ({ name, pitch, type, preview: { imageUrl: '', name } }) as any;

  it('clusters by pitch color (red → yellow → blue), pitchless last', () => {
    const rows = [row('Blue Card', 3), row('Gearless', undefined), row('Red Card', 1), row('Yellow Card', 2)];
    expect(sortRowsForStrips(rows).map((r: any) => r.name))
      .toEqual(['Red Card', 'Yellow Card', 'Blue Card', 'Gearless']);
  });

  it('groups by type within a pitch color, then name', () => {
    const rows = [
      row('Zeta Strike', 1, 'Mechanologist Action - Attack'),
      row('Boom Grenade', 1, 'Mechanologist Action - Item'),
      row('Alpha Rampage', 1, 'Mechanologist Action - Attack'),
    ];
    expect(sortRowsForStrips(rows).map((r: any) => r.name))
      .toEqual(['Alpha Rampage', 'Zeta Strike', 'Boom Grenade']);
  });

  it('does not mutate the input array', () => {
    const rows = [row('B', 3), row('A', 1)];
    const copy = [...rows];
    sortRowsForStrips(rows);
    expect(rows).toEqual(copy);
  });
});

describe('splitSectionsByPitch', () => {
  const row = (name: string, pitch?: number, qty = 1, type?: string) =>
    ({ name, pitch, qty, type, preview: { imageUrl: '', name } }) as any;

  it('splits a mixed-pitch section into deck-page style color subsections (red → yellow → blue → colorless)', () => {
    const out = splitSectionsByPitch([{
      title: 'Maindeck',
      count: 7,
      rows: [row('B1', 3, 3), row('Y1', 2, 1), row('R1', 1, 2), row('N1', undefined, 1)],
    }]);
    expect(out.map((s) => s.title)).toEqual([
      'Maindeck — Red', 'Maindeck — Yellow', 'Maindeck — Blue', 'Maindeck — Colorless',
    ]);
    expect(out.map((s) => s.accent)).toEqual(['red', 'yellow', 'blue', undefined]);
    expect(out.map((s) => s.count)).toEqual([2, 1, 3, 1]); // qty sums
  });

  it('keeps single-pitch and pitchless sections intact (Hero, Equipment)', () => {
    const out = splitSectionsByPitch([
      { title: 'Hero', count: 1, rows: [row('Bravo')] },
      { title: 'Equipment', count: 2, rows: [row('Anothos'), row('Crown')] },
    ]);
    expect(out.map((s) => s.title)).toEqual(['Hero', 'Equipment']);
    expect(out[1].rows.map((r: any) => r.name)).toEqual(['Anothos', 'Crown']);
  });

  it('sorts rows within a subsection by type then name', () => {
    const out = splitSectionsByPitch([{
      title: 'Maindeck',
      count: 3,
      rows: [
        row('Zeta', 1, 1, 'Action - Attack'),
        row('Boom', 1, 1, 'Action - Item'),
        row('Alpha', 1, 1, 'Action - Attack'),
        row('Blue Thing', 3, 1),
      ],
    }]);
    expect(out[0].rows.map((r: any) => r.name)).toEqual(['Alpha', 'Zeta', 'Boom']);
  });
});

describe('deckShapeSummary (the df.describe() line)', () => {
  const card = (qty: number, type?: string, cost?: number | null) =>
    ({ quantity: qty, printingDetails: { type_text_display: type, cost } }) as any;

  it('summarizes type buckets (qty-weighted, desc) and the cost curve in plain english', () => {
    const s = deckShapeSummary([
      card(3, 'Mechanologist Action - Attack', 2),
      card(3, 'Mechanologist Action - Attack', 0),
      card(2, 'Mechanologist Action - Item', 1),
      card(1, 'Generic Instant', 0),
    ]);
    expect(s).toContain('6× Attack');
    expect(s).toContain('2× Item');
    expect(s).toContain('1× Instant');
    expect(s.indexOf('6× Attack')).toBeLessThan(s.indexOf('2× Item'));
    // avg cost = (3*2 + 3*0 + 2*1 + 1*0) / 9 = 8/9 ≈ 0.9
    expect(s).toContain('avg cost 0.9');
    expect(s).toContain('4 zero-cost');
  });

  it('returns empty string for an empty maindeck', () => {
    expect(deckShapeSummary([])).toBe('');
  });

  it('caps the bucket list and counts the rest', () => {
    const types = ['Attack', 'Item', 'Instant', 'Aura', 'Ally', 'Action', 'Equipment', 'Reaction'];
    const s = deckShapeSummary(types.map((t, i) => card(8 - i, `Generic ${t}`, 1)));
    expect(s).toContain('+ 2 more');
  });
});

describe('summarizeDeckContents — self-sufficient AI context (no tool call needed)', () => {
  const rich = (name: string, quantity: number, extra: Record<string, unknown>) => ({
    quantity,
    printingDetails: { display_name: name, image_url: `https://img/${name}`, ...extra },
  }) as any;

  it('context lines carry pitch, cost, and the printed type so the model never guesses card roles', () => {
    const result = summarizeDeckContents({
      name: 'Teklosaucen',
      maindeck: [
        rich('Command and Conquer', 3, { pitch: 1, cost: 2, type_text_display: 'Generic Action - Attack' }),
        rich('Sink Below', 3, { pitch: 1, cost: 0, type_text_display: 'Generic Defense Reaction' }),
      ],
    });
    expect(result.context).toContain('3x Command and Conquer (p1, cost 2, Generic Action - Attack)');
    expect(result.context).toContain('3x Sink Below (p1, cost 0, Generic Defense Reaction)');
  });

  it('degrades gracefully when cost/type are absent (legacy payloads keep the old shape)', () => {
    const result = summarizeDeckContents({
      name: 'Old',
      maindeck: [rich('Overcrowded', 3, { pitch: 3 })],
    });
    expect(result.context).toContain('3x Overcrowded (p3)');
  });

  it("includes the hero's actual rules text in context — game-plan answers hinge on it", () => {
    const result = summarizeDeckContents({
      name: 'Teklosaucen',
      hero: [rich('Teklovossen, Esteemed Magnate', 1, {
        type_text_display: 'Mechanologist Hero',
        text: 'you may play evos from your banished zone.',
      })],
      maindeck: [rich('Overcrowded', 3, { pitch: 3 })],
    });
    expect(result.context).toContain('you may play evos from your banished zone');
  });
});

describe('splitSectionsByPitch — sourceTitle for write plumbing', () => {
  it('carries the unsplit section title so ±/swap/move resolve the right category and rows', () => {
    const row = (name: string, pitch: number) => ({ name, pitch, preview: { imageUrl: '', name } }) as any;
    const out = splitSectionsByPitch([
      { title: 'Maindeck', count: 2, rows: [row('R', 1), row('B', 3)] },
      { title: 'Equipment', count: 1, rows: [row('E', 0)] },
    ]);
    expect(out.find((s) => s.title === 'Maindeck — Red')?.sourceTitle).toBe('Maindeck');
    expect(out.find((s) => s.title === 'Equipment')?.sourceTitle).toBe('Equipment');
  });
});

describe('summarizeDeckContents — Bench section', () => {
  it('includes benched cards as their own section (move-to-bench must not make cards vanish)', () => {
    const card = (name: string, quantity: number) =>
      ({ quantity, printingDetails: { display_name: name, image_url: `https://img/${name}` } }) as any;
    const result = summarizeDeckContents({
      name: 'Teklosaucen',
      maindeck: [card('Overcrowded', 3)],
      benched: [card('Meganetic Protocol', 1)],
    } as any);
    expect(result.lines).toContain('— Bench (1) —');
    expect(result.tableSections?.map((s) => s.title)).toContain('Bench');
    expect(result.context).toContain('Bench: 1x Meganetic Protocol');
  });
});

describe('sumPersonalGames (rail Game-results badge)', () => {
  it('counts games only for unflagged personal decks — system/Decks-to-Beat games are excluded', () => {
    const perf = [
      { deckPublicId: 'mine-1', games: 4 },
      { deckPublicId: 'mine-2', games: 3 },
      { deckPublicId: 'system-deck', games: 10 },
      { deckPublicId: undefined, games: 2 },
      { deckPublicId: 'mine-1' }, // no games field
    ];
    expect(sumPersonalGames(perf, new Set(['mine-1', 'mine-2']))).toBe(7);
  });

  it('returns 0 for empty inputs', () => {
    expect(sumPersonalGames([], new Set())).toBe(0);
  });
});

describe('harvestCardsFromDataItem (hover previews for instant-drill cards)', () => {
  const row = (name: string, pitch?: number) =>
    ({ name, pitch, preview: { imageUrl: `https://img/${name}`, name, printingId: `pid-${name}`, priceLow: 1 } }) as any;

  it('collects rows from tableSections AND tableRows so chat replies can hover-link them', () => {
    const out = harvestCardsFromDataItem({
      tableSections: [
        { title: 'Maindeck', count: 2, rows: [row('Command and Conquer', 1), row('Sink Below', 1)] },
      ],
      tableRows: [row('Ragamuffin’s Hat')],
    });
    expect(out.map((c) => c.name)).toEqual(['Command and Conquer', 'Sink Below', 'Ragamuffin’s Hat']);
    expect(out[0].preview.printingId).toBe('pid-Command and Conquer');
    expect(out[0].pitch).toBe(1);
  });

  it('skips rows without a preview image (nothing to show on hover)', () => {
    const bare = { name: 'X', preview: { imageUrl: '', name: 'X' } } as any;
    expect(harvestCardsFromDataItem({ tableRows: [bare] })).toEqual([]);
  });

  it('returns [] for items with no card rows', () => {
    expect(harvestCardsFromDataItem({})).toEqual([]);
  });
});
