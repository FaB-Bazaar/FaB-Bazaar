/**
 * Plan a CardVault set ingest: given the sweep's card families, their cached
 * payloads and the DB's current rows, decide which cards to create or enrich
 * and which printings to insert. Pure — no I/O — so the CLI
 * (scripts/import-new-set.ts) and the /admin/cardvault job share one plan.
 *
 * Rows are PROVISIONAL (fab_cube_* NULL; the 005 adoption pass anchors them).
 * Printings resolve by lss_print_id first, then natural key (fab-cube-first
 * rows); cards by lss_card_id for fronts, talishar_card_id otherwise.
 */
import { nanoid } from 'nanoid';
import {
  pickSetPrints,
  buildProvisionalCard,
  splitFaces,
  buildFaceRows,
  naturalKeyOf,
  parseLssPrintCode,
  type LssApiFace,
  type LssApiPrint,
  type ProvisionalPrintingRow,
} from './cardvault-ingest';
import { toTalisharCardId } from '@/lib/talishar/cardId';

export interface ExistingPrintingRow {
  printing_id: string;
  lss_print_id: string | null;
  other_face_printing_id: string | null;
  set: string;
  collector_number: string;
  edition: string;
  foiling: string;
  language: string;
}

export interface ExistingCardRow {
  card_unique_id: string;
  lss_card_id: string | null;
  talishar_card_id: string | null;
  fab_cube_card_id: string | null;
}

export type PlannedCard = ReturnType<typeof buildProvisionalCard> & { talishar_card_id: string };
export type PlannedPrinting = ProvisionalPrintingRow & { is_front_face?: boolean; other_face_printing_id?: string | null };

export interface SetIngestPlan {
  newCards: PlannedCard[];
  /** Existing PROVISIONAL cards whose derived fields are refreshed. */
  enrichCards: PlannedCard[];
  newPrintings: PlannedPrinting[];
  /** Backs discovered for fronts ingested before face support: link in place. */
  retroLinks: Array<{ frontId: string; backId: string }>;
  counts: { skippedLss: number; skippedNaturalKey: number; skippedFlag: number; backFaces: number };
  /** One line per card family, for the operator. */
  log: string[];
  warnings: string[];
}

export interface PlanSetIngestInput {
  /** Set code as CardVault spells it (upper case, e.g. 'IAR'). */
  set: string;
  setHasFirstEdition: boolean;
  /** CardVault card slugs found by the set sweep. */
  familySlugs: string[];
  /** slug → raw `card_id/<slug>/` response. */
  payloads: Map<string, any>;
  /** Every printing already in the set. */
  existingPrintings: ExistingPrintingRow[];
  /** Cards matching cardLookupKeys() (by lss_card_id OR talishar_card_id). */
  cardRows: ExistingCardRow[];
  /** Collector numbers to leave alone (finish-less promo print_ids). */
  skipCollectors?: Set<string>;
  mintId?: () => string;
}

const pitchOf = (face: LssApiFace): number | null => {
  const n = face.printed_pitch ? parseInt(face.printed_pitch, 10) : null;
  return Number.isFinite(n) ? n : null;
};
const talOf = (face: LssApiFace) => toTalisharCardId((face.printed_name ?? '').trim(), pitchOf(face));

/** The CardVault card record for each swept family, once per family. */
function cardsInPlayOf(familySlugs: string[], payloads: Map<string, any>): Array<{ slug: string; card: any }> {
  const wanted = new Set(familySlugs);
  const out: Array<{ slug: string; card: any }> = [];
  for (const payload of payloads.values()) {
    for (const r of payload.results ?? []) {
      if (wanted.has(r.card_id) && !out.some((c) => c.slug === r.card_id)) out.push({ slug: r.card_id, card: r });
    }
  }
  return out;
}

/** Keys to load ExistingCardRows by before planning. */
export function cardLookupKeys(familySlugs: string[], payloads: Map<string, any>): { lssCardIds: string[]; talisharIds: string[] } {
  const inPlay = cardsInPlayOf(familySlugs, payloads);
  return {
    lssCardIds: inPlay.map((c) => c.card.id),
    talisharIds: inPlay.map(({ card }) => {
      const en = (card.card_prints ?? []).flatMap((p: any) => p.faces ?? [])
        .find((f: any) => f.face_language === 'en' && f.printed_name);
      return en ? talOf(en) : '';
    }).filter(Boolean),
  };
}

export function planSetIngest(input: PlanSetIngestInput): SetIngestPlan {
  const mintId = input.mintId ?? nanoid;
  const skip = input.skipCollectors ?? new Set<string>();
  const { setHasFirstEdition } = input;

  const byLssPrint = new Map(
    input.existingPrintings.filter((r) => r.lss_print_id).map((r) => [r.lss_print_id!, r]));
  const knownNaturalKeys = new Set(input.existingPrintings.map((r) => naturalKeyOf(r)));

  // lss_card_id is NOT unique: a named back's card shares its front's UUID.
  const cardsByLss = new Map<string, ExistingCardRow[]>();
  for (const r of input.cardRows) {
    if (!r.lss_card_id) continue;
    cardsByLss.set(r.lss_card_id, [...(cardsByLss.get(r.lss_card_id) ?? []), r]);
  }
  const cardByTal = new Map(
    input.cardRows.filter((r) => r.talishar_card_id).map((r) => [r.talishar_card_id!, r.card_unique_id]));
  const provisionalCardIds = new Set(input.cardRows.filter((r) => !r.fab_cube_card_id).map((r) => r.card_unique_id));

  const plan: SetIngestPlan = {
    newCards: [], enrichCards: [], newPrintings: [], retroLinks: [],
    counts: { skippedLss: 0, skippedNaturalKey: 0, skippedFlag: 0, backFaces: 0 },
    log: [], warnings: [],
  };
  const { counts } = plan;

  // Resolve (or create/enrich) one card row; shared by front and named-back faces.
  const resolveCard = (face: LssApiFace, lssCardId: string): { id: string; via: string } => {
    const tal = talOf(face);
    let id = cardByTal.get(tal);
    let via = id ? 'talishar' : '';
    if (!id) {
      id = mintId();
      cardByTal.set(tal, id);
      plan.newCards.push({ ...buildProvisionalCard(face, { cardUniqueId: id, lssCardId }), talishar_card_id: tal });
      via = 'NEW';
    } else if (provisionalCardIds.has(id)) {
      plan.enrichCards.push({ ...buildProvisionalCard(face, { cardUniqueId: id, lssCardId }), talishar_card_id: tal });
      via = `${via}+enrich`;
    }
    return { id, via };
  };

  for (const { card } of cardsInPlayOf(input.familySlugs, input.payloads)) {
    const prints = pickSetPrints(card.card_prints ?? [], input.set, 'en') as LssApiPrint[];
    if (!prints.length) continue;
    const s0 = splitFaces(prints[0], 'en');
    const frontFace = s0.front ?? prints[0].faces?.[0];
    if (!frontFace?.printed_name?.trim()) { plan.warnings.push(`no EN name for ${card.card_id} — skipped`); continue; }
    const namedBackFace = prints.map((p) => splitFaces(p, 'en')).find((s) => s.namedBack)?.back ?? null;

    // lss-first resolution applies only to the FRONT card. Among the cards
    // sharing this UUID, take the one named like the front; a sole candidate
    // is accepted (a CardVault rename) unless it is the named back's card.
    const frontTal = talOf(frontFace);
    const backTal = namedBackFace ? talOf(namedBackFace) : null;
    const candidates = cardsByLss.get(card.id) ?? [];
    const lssMatch = candidates.find((c) => c.talishar_card_id === frontTal)
      ?? (candidates.length === 1 && candidates[0].talishar_card_id !== backTal ? candidates[0] : undefined);
    let frontCardId = lssMatch?.card_unique_id;
    let frontVia = frontCardId ? 'lss' : '';
    if (frontCardId && provisionalCardIds.has(frontCardId)) {
      plan.enrichCards.push({ ...buildProvisionalCard(frontFace, { cardUniqueId: frontCardId, lssCardId: card.id }), talishar_card_id: frontTal });
      frontVia = 'lss+enrich';
    }
    if (!frontCardId) {
      const r = resolveCard(frontFace, card.id);
      frontCardId = r.id; frontVia = r.via;
    }

    // Named back = its own card (e.g. 'Viserai, Usurper'), resolved LAZILY —
    // only once a print in this family actually needs a row. Eager resolution
    // minted an orphan card for a family skipped in full by natural key.
    let backCard: { id: string; via: string } | null = null;
    const getBackCard = () => (backCard ??= resolveCard(namedBackFace!, card.id));

    for (const print of prints) {
      const sf = splitFaces(print, 'en');
      if (skip.has(parseLssPrintCode(print.print_id, { setHasFirstEdition }).collector.toUpperCase())) { counts.skippedFlag++; continue; }
      const frontExisting = byLssPrint.get(print.id);
      const backLssId = sf.back?.id ?? `${print.id}#back`;
      const backExisting = sf.back ? byLssPrint.get(backLssId) : undefined;

      if (frontExisting && (!sf.back || backExisting)) { counts.skippedLss++; continue; }

      const frontId = frontExisting?.printing_id ?? mintId();
      const backId = sf.back ? (backExisting?.printing_id ?? mintId()) : undefined;
      const faceIds = { frontPrintingId: frontId, frontCardId, backPrintingId: backId };
      if (!frontExisting) {
        // Whole pair presumed present when the natural key already exists
        // (fab-cube-first rows). Probe BEFORE resolving the back card.
        const probe = buildFaceRows(print, { ...faceIds, backCardId: frontCardId }, { setHasFirstEdition }).front;
        if (knownNaturalKeys.has(naturalKeyOf(probe))) { counts.skippedNaturalKey++; continue; }
      }
      const { front, back } = buildFaceRows(print, {
        ...faceIds, backCardId: sf.namedBack ? getBackCard().id : frontCardId,
      }, { setHasFirstEdition });

      if (!frontExisting) {
        knownNaturalKeys.add(naturalKeyOf(front));
        plan.newPrintings.push(front);
      }
      if (back && !backExisting) {
        plan.newPrintings.push(back);
        counts.backFaces++;
        if (frontExisting) plan.retroLinks.push({ frontId, backId: backId! });
      }
    }
    const backNote = namedBackFace
      ? ` // ${namedBackFace.printed_name} (${(backCard as { via: string } | null)?.via ?? 'not needed'})` : '';
    plan.log.push(`${frontFace.printed_name.trim()} (${frontVia})${backNote} — ${prints.length} en prints`);
  }
  return plan;
}

/** The CLI's one-line plan summary; the admin page shows the same numbers. */
export function summarizePlan(p: SetIngestPlan): string {
  return `${p.newCards.length} new cards, ${p.newPrintings.length} new printings ` +
    `(${p.counts.backFaces} back faces, ${p.retroLinks.length} retro-links onto existing fronts), ` +
    `${p.enrichCards.length} provisional cards to enrich; ` +
    `skipped ${p.counts.skippedLss} already-ingested (lss), ${p.counts.skippedNaturalKey} already-present (natural key)` +
    (p.counts.skippedFlag ? `, ${p.counts.skippedFlag} via --skip-collectors` : '');
}
