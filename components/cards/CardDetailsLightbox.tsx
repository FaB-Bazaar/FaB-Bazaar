"use client";

/**
 * Card-details lightbox — shared by the deck editor's QuickAddCardDialog
 * (magnifier on a search tile) and the /opt · /search image results (Expand
 * button on a tile). Enlarged image + name/type/pitch/stats, rules text with a
 * keyword-reminder glossary, illustrator, format legality (deck verdict when a
 * deckFormat is given), "In this deck" (when inDeckCount is given), "In your
 * binders" (signed-in only), grouped printings priced with tcg_low, and the
 * Wants-style TCGplayer purchase link. ←/→ step through results when the
 * caller wires onPrev/onNext.
 */

import React, { useState, useEffect } from "react";
import { Check, Loader2, ChevronLeft, ChevronRight, Info, X, Ban, AlertTriangle } from "lucide-react";
import { formatLegalityRows, deckLegalityVerdict, type LegalityStatus } from "@/lib/cards/card-legality";
import { keywordGlossary } from "@/lib/cards/keyword-glossary";
import { buildPrintingRows, groupPrintingRows } from "@/lib/cards/lightbox-printings";
import { renderPurchaseLink } from "@/components/wants/utils";
import { getBindersByCard, type BinderCardHit } from "@/lib/client/binders-client";
import { cn } from "@/lib/utils";
import { parseRulesText, type RulesSegment } from "@/lib/cards/rules-text";
import { RULE_TOKEN_ICON } from "@/app/volzar/rule-glyphs";
import { fetchPrintingsForCard, type PrintingResult } from "@/lib/client/hero-pool-cache";

export const PITCH_STYLE: Record<number, { border: string; badge: string; label: string }> = {
  1: { border: "border-l-red-500",    badge: "bg-red-500 text-white",       label: "Pitch 1" },
  2: { border: "border-l-yellow-400", badge: "bg-yellow-400 text-gray-900", label: "Pitch 2" },
  3: { border: "border-l-blue-500",   badge: "bg-blue-500 text-white",      label: "Pitch 3" },
};

function collectorLabel(p: PrintingResult): string {
  return p.collector_number || (p.set || "").toUpperCase() || "—";
}

// ─── Rules text (details lightbox) ───────────────────────────────────────────

// {g} is CardVault's life token in rendered text ({h} appears too); both map
// to the health glyph. Unrepresented tokens ({t} tap, {c} chi, …) fall through
// as literal text.
const LIGHTBOX_TOKEN_ICON: Record<string, { src: string; alt: string }> = {
  ...RULE_TOKEN_ICON,
  g: RULE_TOKEN_ICON.h,
};

function renderRulesSegment(seg: RulesSegment, i: number): React.ReactNode {
  switch (seg.type) {
    case 'text':
      return <span key={i}>{seg.value}</span>;
    case 'icon': {
      const icon = LIGHTBOX_TOKEN_ICON[seg.token];
      return icon
        // eslint-disable-next-line @next/next/no-img-element
        ? <img key={i} src={icon.src} alt={icon.alt} title={icon.alt} className="inline-block h-3.5 w-3.5 mx-px align-[-0.125em]" />
        : <span key={i}>{`{${seg.token}}`}</span>;
    }
    case 'bold':
      return <strong key={i} className="font-semibold text-gray-100">{seg.children.map(renderRulesSegment)}</strong>;
    case 'italic':
      return <em key={i} className="text-gray-300">{seg.children.map(renderRulesSegment)}</em>;
  }
}

/** Single-paragraph rules markup (glyph tokens + emphasis) rendered inline. */
function RulesInline({ text }: { text: string }) {
  const paras = parseRulesText(text);
  return <>{paras.flat().map(renderRulesSegment)}</>;
}

function RulesText({ text }: { text: string }) {
  const paras = parseRulesText(text);
  if (paras.length === 0) return null;
  return (
    <div className="space-y-1.5 text-sm leading-snug text-gray-200">
      {paras.map((segs, i) => (
        <p key={i}>{segs.map(renderRulesSegment)}</p>
      ))}
    </div>
  );
}

// ─── Card details lightbox ───────────────────────────────────────────────────

/** What the lightbox needs: the printing row (search rows carry the card
 *  fields — text, type line, stats) plus the card name for the header. */
export interface LightboxCard {
  printing: PrintingResult;
  name: string;
}

function statEntries(p: PrintingResult): Array<{ label: string; value: string }> {
  const entries: Array<{ label: string; value: string }> = [];
  const push = (label: string, v: unknown) => {
    if (v !== null && v !== undefined && v !== '') entries.push({ label, value: String(v) });
  };
  push('Cost', p.cost);
  push('Power', p.power);
  push('Defense', p.defense);
  push('Arcane', (p as Record<string, unknown>).arcane);
  return entries;
}

/** Foil badge vocabulary shared by the grid tiles and the lightbox printing chips. */
const FOIL_BADGE: Record<string, { label: string; className: string; style?: React.CSSProperties }> = {
  s: { label: 'NF', className: 'bg-gray-700 text-gray-200 border border-gray-600' },
  r: { label: 'RF', className: 'text-white', style: { background: 'linear-gradient(90deg, #f43f5e, #a855f7, #3b82f6)' } },
  c: { label: 'CF', className: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' },
  g: { label: 'GF', className: 'bg-amber-400/20 text-amber-300 border border-amber-400/40' },
};

export function FoilBadge({ code, className }: { code: string; className?: string }) {
  const b = FOIL_BADGE[code] ?? { label: code.toUpperCase(), className: 'bg-gray-700 text-gray-200 border border-gray-600' };
  return (
    <span className={cn('rounded px-1 py-px text-[10px] font-bold leading-tight', b.className, className)} style={b.style}>
      {b.label}
    </span>
  );
}

const LEGALITY_STRIP: Record<LegalityStatus, { label: string; cls: string }> = {
  'legal':      { label: 'Legal',      cls: 'text-gray-200' },
  'not-legal':  { label: 'Not legal',  cls: 'text-gray-400 line-through decoration-gray-500' },
  'banned':     { label: 'Banned',     cls: 'text-red-300 line-through decoration-red-400' },
  'suspended':  { label: 'Suspended',  cls: 'text-amber-300' },
  'restricted': { label: 'Restricted', cls: 'text-amber-300' },
};

const VERDICT_STYLE: Record<LegalityStatus, { icon: React.ReactNode; cls: string; phrase: (f: string) => string }> = {
  'legal':      { icon: <Check className="h-3.5 w-3.5" aria-hidden="true" />,    cls: 'text-green-400', phrase: f => `Legal in ${f}` },
  'not-legal':  { icon: <X className="h-3.5 w-3.5" aria-hidden="true" />,        cls: 'text-gray-300',  phrase: f => `Not legal in ${f}` },
  'banned':     { icon: <Ban className="h-3.5 w-3.5" aria-hidden="true" />,      cls: 'text-red-300',   phrase: f => `Banned in ${f}` },
  'suspended':  { icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />, cls: 'text-amber-300', phrase: f => `Suspended in ${f}` },
  'restricted': { icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />, cls: 'text-amber-300', phrase: f => `Restricted in ${f}` },
};

/** Artists are stored lowercase ("nailsen ivanderlie") — title-case for display. */
function artistNames(p: PrintingResult): string {
  const raw = p.artists;
  if (!Array.isArray(raw)) return '';
  return raw
    .filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
    .map(a => a.replace(/\b[a-z]/g, c => c.toUpperCase()))
    .join(', ');
}

function tcgplayerFallbackUrl(name: string): string {
  return `https://www.tcgplayer.com/search/flesh-and-blood-tcg/product?productLineName=flesh-and-blood-tcg&q=${encodeURIComponent(name)}`;
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{children}</span>
);

export function CardDetailsLightbox({
  card,
  onClose,
  onPrev,
  onNext,
  onSelectPrinting,
  deckFormat,
  inDeckCount,
  deckSwap,
}: {
  card: LightboxCard;
  onClose: () => void;
  /** Step to the previous/next search result; omitted = at that end of the list. */
  onPrev?: () => void;
  onNext?: () => void;
  /** User picked another printing from the printings list. */
  onSelectPrinting?: (printing: PrintingResult) => void;
  /** Deck format display string ("Silver Age") — drives the legality verdict line. */
  deckFormat?: string;
  /** Copies of this card already in the deck (all zones). Omit when there is
   *  no deck context (e.g. /opt) — the "In this deck" readout is then hidden. */
  inDeckCount?: number;
  /** Deck context that can CHANGE the deck: which printing the deck holds
   *  (the one the lightbox opened from) and how many copies. When the user
   *  is viewing a different printing, a "Use this printing" control offers
   *  to move 1 … all copies over. Omit on read-only surfaces. */
  deckSwap?: {
    currentPrintingId: string;
    copies: number;
    onSwap: (newPrintingId: string, copies: number) => Promise<boolean>;
  };
}) {
  // "Use this printing" control state — busy while the swap request runs,
  // error text if it fails (the parent retargets the lightbox on success).
  const [swapBusy, setSwapBusy] = useState<number | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  useEffect(() => { setSwapBusy(null); setSwapError(null); }, [card.printing.printing_id]);

  // Arrow-key navigation through the results while the lightbox is up.
  // Capture phase so nothing underneath (dialog, grid) reacts to the keys.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && onPrev) {
        e.preventDefault();
        e.stopPropagation();
        onPrev();
      } else if (e.key === 'ArrowRight' && onNext) {
        e.preventDefault();
        e.stopPropagation();
        onNext();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [onPrev, onNext]);

  // Sibling printings (all languages) — lazy, cached per card by hero-pool-cache.
  const cardUid = card.printing.card_unique_id;
  const [siblings, setSiblings] = useState<PrintingResult[] | null>(null);
  useEffect(() => {
    let live = true;
    setSiblings(null);
    if (!cardUid) return;
    fetchPrintingsForCard(cardUid)
      .then(rows => { if (live) setSiblings(rows as unknown as PrintingResult[]); })
      .catch(() => { if (live) setSiblings([]); });
    return () => { live = false; };
  }, [cardUid]);

  // Which of the viewer's binders hold this card (any printing). null = loading
  // or unavailable (signed out / error) → line hidden; [] = owns none.
  const [binderHits, setBinderHits] = useState<BinderCardHit[] | null>(null);
  useEffect(() => {
    let live = true;
    setBinderHits(null);
    if (!cardUid) return;
    getBindersByCard([cardUid]).then(res => {
      if (live && res.success) setBinderHits(res.data[cardUid] ?? []);
    });
    return () => { live = false; };
  }, [cardUid]);

  const p = card.printing;
  const pitch = typeof p.pitch === 'number' ? PITCH_STYLE[p.pitch] : null;
  const typeLine = (p.type_text_display || p.type_text || '') as string;
  const rulesText = (p.text || '') as string;
  const flavorText = (p.flavor_text || '') as string;
  const stats = statEntries(p);
  const price = p.tcg_low ?? p.tcg_market;
  const legality = formatLegalityRows(p);
  const verdict = deckLegalityVerdict(legality, deckFormat);
  const glossary = keywordGlossary(rulesText, Array.isArray(p.keywords) ? (p.keywords as string[]) : []);
  const artists = artistNames(p);
  const printingRows = siblings ? buildPrintingRows(siblings, p.printing_id) : null;
  const groups = printingRows ? groupPrintingRows(printingRows.rows) : null;
  const tcgUrl = (typeof p.tcgplayer_url === 'string' && p.tcgplayer_url) || tcgplayerFallbackUrl(card.name);
  const backImageUrl = typeof p.other_face_image_url === 'string' && p.other_face_image_url ? p.other_face_image_url : null;
  // Two faces side by side must also fit the 92vw dialog next to the 400px
  // panel (+2 gaps), or the panel gets squeezed: cap the height by the width
  // each face can have at the card's 63:88 ratio.
  const faceHeight = backImageUrl
    ? 'md:h-[min(80vh,762px,calc((92vw-424px)/2*88/63))]'
    : null;

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      data-testid="card-lightbox"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-pointer p-4"
      onClick={onClose}
    >
      {onPrev && (
        <button
          type="button"
          aria-label="Previous card"
          title="Previous card (←)"
          onClick={e => { e.stopPropagation(); onPrev(); }}
          className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-gray-900/80 text-gray-200 transition-colors hover:bg-gray-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {onNext && (
        <button
          type="button"
          aria-label="Next card"
          title="Next card (→)"
          onClick={e => { e.stopPropagation(); onNext(); }}
          className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-gray-900/80 text-gray-200 transition-colors hover:bg-gray-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={card.name}
        className="relative flex flex-col sm:flex-row items-center sm:items-stretch gap-3 max-w-[92vw] max-h-[80vh] sm:max-h-[86vh] cursor-default"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close preview"
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-gray-600 bg-gray-900 text-gray-300 shadow-lg hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        {p.image_url && (
          // Explicit height (not max-h): some older ingests are 300×419, and a
          // max-h alone never scales a small source UP, so those rendered at
          // 2/3 size. 762px cap = native height of the standard 546×762 art.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.image_url}
            alt={card.name}
            className={cn('h-[min(44vh,762px)] sm:h-[min(80vh,762px)] w-auto shrink-0 rounded-xl shadow-2xl border border-gray-600 object-contain', faceHeight)}
            style={{ aspectRatio: '63/88' }}
          />
        )}
        {backImageUrl && (
          // Double-faced card: show the back beside the front.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={backImageUrl}
            alt={(p.other_face_name as string) || `${card.name} (other face)`}
            className={cn('hidden md:block h-[min(80vh,762px)] w-auto shrink-0 rounded-xl shadow-2xl border border-gray-600 object-contain', faceHeight)}
            style={{ aspectRatio: '63/88' }}
          />
        )}
        <div
          data-testid="card-lightbox-details"
          className="flex w-[340px] lg:w-[400px] max-w-full sm:shrink-0 flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900/95 text-left self-center sm:self-auto"
        >
          {/* Scrolling body; the purchase link below is pinned outside it so it
              stays visible however many printings the card has. */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3.5">
            <p className="text-base font-semibold text-gray-100">{card.name}</p>
            {typeLine && <p className="mt-0.5 text-sm text-gray-300">{typeLine}</p>}
            {pitch && (
              <span className={cn('mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium', pitch.badge)}>
                {pitch.label}
              </span>
            )}
            {stats.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {stats.map(s => (
                  <div key={s.label} className="rounded-lg border border-gray-700 bg-gray-800/80 px-2 py-1 text-center">
                    <div className="text-sm font-semibold text-gray-100 tabular-nums">{s.value}</div>
                    <div className="text-xs text-gray-300">{s.label}</div>
                  </div>
                ))}
              </div>
            )}
            {rulesText && (
              <div className="mt-3 border-t border-gray-700 pt-3">
                <RulesText text={rulesText} />
              </div>
            )}
            {glossary.length > 0 && (
              <div role="group" aria-label="Keyword reminders" className="mt-2.5 flex gap-2 rounded-md bg-gray-800/70 px-2.5 py-2 text-xs leading-snug">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                <div className="space-y-1">
                  {glossary.map(g => (
                    <p key={g.key}>
                      <span className="font-semibold text-gray-100">{g.keyword}</span>
                      <span className="text-gray-300"> · <RulesInline text={g.reminder} /></span>
                    </p>
                  ))}
                </div>
              </div>
            )}
            {flavorText && (
              <p className="mt-3 text-sm italic text-gray-300">{flavorText}</p>
            )}
            {artists && (
              <p className="mt-2 text-xs text-gray-400">Illustrated by {artists}</p>
            )}
  
            {(legality.length > 0 || inDeckCount !== undefined || binderHits !== null) && (
              <div role="group" aria-label="Legality" className="mt-3 border-t border-gray-700 pt-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  {verdict ? (
                    <span className={cn('inline-flex items-center gap-1.5 font-medium', VERDICT_STYLE[verdict.status].cls)}>
                      {VERDICT_STYLE[verdict.status].icon}
                      {VERDICT_STYLE[verdict.status].phrase(verdict.format)}
                    </span>
                  ) : (
                    <SectionLabel>Legality</SectionLabel>
                  )}
                  {inDeckCount !== undefined && (
                    <span className="shrink-0 text-xs text-gray-300">
                      In this deck: <span className={cn('font-semibold tabular-nums', inDeckCount > 0 ? 'text-blue-300' : 'text-gray-200')}>{inDeckCount}</span>
                    </span>
                  )}
                </div>
                {binderHits !== null && (
                  <p role="group" aria-label="In your binders" className="mt-1 text-xs text-gray-300">
                    {binderHits.length === 0 ? (
                      <span className="text-gray-400">Not in your binders</span>
                    ) : (
                      <>
                        <span className="text-gray-400">In your binders: </span>
                        {binderHits.map((h, i) => (
                          <span key={h.binderId}>
                            {i > 0 && <span className="text-gray-500"> · </span>}
                            <span className="text-gray-100">{h.name}</span>
                            <span className="ml-0.5 font-semibold tabular-nums text-blue-300">×{h.quantity}</span>
                          </span>
                        ))}
                      </>
                    )}
                  </p>
                )}
                {legality.length > 0 && (
                  <ul aria-label="Other formats" className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-xs">
                    {legality.map(row => (
                      <li
                        key={row.key}
                        data-status={row.status}
                        title={`${row.format}: ${LEGALITY_STRIP[row.status].label}`}
                        className={cn('font-medium', LEGALITY_STRIP[row.status].cls, verdict?.key === row.key && 'underline decoration-dotted underline-offset-2')}
                      >
                        {row.short}
                        <span className="sr-only">: {LEGALITY_STRIP[row.status].label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
  
            <div className="mt-3 border-t border-gray-700 pt-3">
              <div className="flex items-baseline justify-between gap-2">
                <SectionLabel>Printings</SectionLabel>
                <span className="text-[11px] text-gray-400">TCG Low · cheapest in green</span>
              </div>
              {groups === null ? (
                <p className="mt-1.5 text-sm text-gray-300">
                  <span className="font-mono text-gray-400">{collectorLabel(p)}</span>
                  {price != null && price > 0 && <span className="ml-2 text-green-400 font-medium">${price.toFixed(2)}</span>}
                  {cardUid && <Loader2 className="ml-2 inline h-3 w-3 animate-spin text-gray-400" aria-label="Loading printings" />}
                </p>
              ) : (
                <>
                  <ul aria-label="Printings" className="mt-1.5 space-y-1.5">
                    {groups.map(g => {
                      const meta = [g.rarity, g.edition !== 'Normal' ? g.edition : null, g.artVariation, g.year].filter(Boolean).join(' · ');
                      return (
                        <li key={g.key} className="flex items-center justify-between gap-2">
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-gray-100">
                              <span className="font-mono text-gray-400">{g.collector}</span>
                              <span className="ml-1.5">{g.setName}</span>
                            </span>
                            <span className="block truncate text-[11px] text-gray-400">{meta}</span>
                          </span>
                          <span className="flex shrink-0 gap-1">
                            {g.variants.map(v => (
                              <button
                                key={v.printing_id}
                                type="button"
                                aria-pressed={v.isCurrent}
                                aria-label={`${g.collector} ${v.foiling}${v.price != null ? ` $${v.price.toFixed(2)}` : ''}${deckSwap?.currentPrintingId === v.printing_id ? ' (in your deck)' : ''}`}
                                title={[v.isCurrent ? 'Showing this printing' : `Show ${v.foiling} printing`, deckSwap?.currentPrintingId === v.printing_id ? 'In your deck' : null].filter(Boolean).join(' · ')}
                                onClick={() => {
                                  const target = siblings?.find(sb => sb.printing_id === v.printing_id);
                                  if (target && onSelectPrinting) onSelectPrinting(target);
                                }}
                                className={cn(
                                  'inline-flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                                  v.isCurrent
                                    ? 'border-blue-400 bg-blue-500/10 ring-1 ring-blue-400'
                                    : 'border-gray-700 bg-gray-800/60 hover:bg-gray-700',
                                )}
                              >
                                <FoilBadge code={v.foilCode} />
                                <span className={v.isCheapest ? 'font-semibold text-green-400' : 'text-gray-200'}>
                                  {v.price != null ? `$${v.price.toFixed(2)}` : '—'}
                                </span>
                                {deckSwap?.currentPrintingId === v.printing_id && (
                                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                                )}
                              </button>
                            ))}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {printingRows && printingRows.otherLanguages > 0 && (
                    <p className="mt-1.5 text-[11px] text-gray-400">
                      +{printingRows.otherLanguages} other-language printing{printingRows.otherLanguages === 1 ? '' : 's'} not shown
                    </p>
                  )}
                  {deckSwap && p.printing_id !== deckSwap.currentPrintingId && (
                    <div data-testid="lightbox-use-printing" className="mt-2 rounded-md border border-blue-500/40 bg-blue-500/10 p-2">
                      <p className="text-xs text-gray-200">
                        Use this printing in your deck
                        <span className="ml-1.5 font-mono text-gray-400">{collectorLabel(p)}</span>
                        {typeof p.foiling === 'string' && <FoilBadge code={p.foiling.toLowerCase()} className="ml-1.5" />}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {(deckSwap.copies <= 1
                          ? [{ n: 1, label: 'Switch 1 copy' }]
                          : [
                              ...Array.from({ length: deckSwap.copies - 1 }, (_, i) => ({ n: i + 1, label: `${i + 1} ${i === 0 ? 'copy' : 'copies'}` })),
                              { n: deckSwap.copies, label: `All ${deckSwap.copies} copies` },
                            ]
                        ).map(({ n, label }) => (
                          <button
                            key={n}
                            type="button"
                            disabled={swapBusy !== null}
                            aria-label={`${label} → ${collectorLabel(p)}`}
                            onClick={async e => {
                              e.stopPropagation();
                              setSwapBusy(n); setSwapError(null);
                              const ok = await deckSwap.onSwap(p.printing_id, n);
                              setSwapBusy(null);
                              if (!ok) setSwapError('Could not change the printing — try again.');
                            }}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                              n === deckSwap.copies && deckSwap.copies > 1
                                ? 'border-blue-400 bg-blue-500/30 text-white hover:bg-blue-500/40'
                                : 'border-gray-600 bg-gray-800/70 text-gray-100 hover:bg-gray-700',
                              swapBusy !== null && 'opacity-60 cursor-wait',
                            )}
                          >
                            {swapBusy === n && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                            {label}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1 text-[11px] text-gray-400">
                        {deckSwap.copies === 1 ? 'Your 1 copy' : `Your ${deckSwap.copies} copies`} currently use the printing marked
                        <span aria-hidden="true" className="mx-1 inline-block h-1.5 w-1.5 rounded-full bg-blue-400 align-middle" />
                        above.
                      </p>
                      {swapError && <p role="alert" className="mt-1 text-[11px] text-red-300">{swapError}</p>}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          {/* Same affiliate purchase link as the Wants cards. The panel is always
              dark, so force the helper's dark: variants with a `dark` wrapper. */}
          <div className="dark shrink-0 px-3.5 pb-3 [&>div]:mt-0 [&>div]:pt-2.5">{renderPurchaseLink(tcgUrl, 'DeckQuickAddLightbox')}</div>
        </div>
      </div>
    </div>
  );
}

