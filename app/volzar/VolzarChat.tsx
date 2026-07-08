'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Loader2, CheckCircle2, XCircle, AlertTriangle, Send, Square, RotateCcw, Zap, ExternalLink,
  Heart, FolderPlus, Copy, Check, Repeat, Swords, ArrowUp, ArrowDown, ChevronDown, Plus,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ViewPrintingsDialog from '@/components/dialogs/cards/view-printings-dialog';
import CardSearchDialog from '@/components/dialogs/cards/card-search-dialog';
import { volzarClient, wantsClient, bindersClient, decksClient } from '@/lib/client';
import { TcgAffiliateLink } from '@/components/tracking';
import type { AgentEvent, ChatMessage, ToolCall } from '@/lib/ai/types';
import {
  QUICK_ACTIONS, buildMessageWithContext, buildAnalyzeGameMessage, runDrill, parseSearchResults, harvestCardsFromStructured,
  fetchToBeatHeroes, runArchetypeConsensus, toShorthand, printingToSwapOption,
  fetchToBeatEvents, runToBeatByHero, runToBeatByEvent, TO_BEAT_MONTHS,
  fetchKitHeroes, runHeroKit,
  addSearchSelectionToBinder, addSearchSelectionToWants,
  type CardLine, type CardPreview, type SearchResultsCard, type DrillTarget, type HarvestedCard, type ToBeatHero, type ToBeatEvent, type CardRow, type GameResultRow, type KitHero,
} from './quick-actions';
import { MarkdownMessage } from './MarkdownMessage';
import { buildTurnMessages, shouldSendOnEnter } from './chat-turn';
import { buildCardNameIndex } from './card-linkify';
import { DeckCardsOverlay } from './DeckCardsOverlay';
import { RULE_TOKEN_ICON } from './rule-glyphs';
import { matchupDisplayName, aggregateSwaps, turnOrderLabel, matchupsToContext, buildSwapLookup, type SwapEntry, type SwapCardInfo } from './deck-matchups';
import type { DeckMatchup } from '@/types/deck';
import type { DeckViewCard } from '@/lib/deck/analytics';
import { LayoutGrid } from 'lucide-react';

const PITCH_GEM: Record<number, { bg: string; label: string }> = {
  1: { bg: 'bg-red-600', label: 'red' },
  2: { bg: 'bg-amber-400', label: 'yellow' },
  3: { bg: 'bg-blue-600', label: 'blue' },
};

/**
 * Leading pitch marker for a card line — a solid dot in the pitch color
 * (red/yellow/blue), so the left column reads as a scannable color stripe.
 * Non-pitched cards (equipment, hero) get a smaller neutral dot; title/aria
 * carry the pitch for non-visual users.
 */
function PitchGem({ pitch }: { pitch?: number }) {
  const gem = pitch && PITCH_GEM[pitch];
  return (
    <span className="w-5 shrink-0 inline-flex justify-center" aria-hidden={gem ? undefined : true}>
      {gem ? (
        <span
          title={`Pitch ${pitch} (${gem.label})`}
          aria-label={`pitch ${pitch}, ${gem.label}`}
          className={`inline-block h-3.5 w-3.5 rounded-full ring-1 ring-black/10 dark:ring-white/20 ${gem.bg}`}
        />
      ) : (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
      )}
    </span>
  );
}

/**
 * One side of a matchup's sideboard plan ("Side in" / "Side out") — aggregated
 * swap ids with pitch gems and counts, mirroring the deck page's delta view.
 * `lookup` (built from the deck card's table rows) supplies each card's
 * thumbnail, type line, and hover preview; unknown ids fall back to text-only.
 */
function SwapColumn({ kind, entries, lookup, onHover }: {
  kind: 'in' | 'out';
  entries: SwapEntry[];
  lookup?: Map<string, SwapCardInfo>;
  onHover?: (preview: CardPreview) => void;
}) {
  const isIn = kind === 'in';
  const Icon = isIn ? ArrowUp : ArrowDown;
  const accent = isIn
    ? 'text-emerald-700 dark:text-emerald-400 border-emerald-600/40'
    : 'text-rose-700 dark:text-rose-400 border-rose-600/40';
  const total = entries.reduce((s, e) => s + e.count, 0);
  return (
    <div className={`rounded-md border p-2 ${accent}`}>
      <div className="flex items-center gap-1.5 pb-1 mb-1 border-b border-border">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="text-xs font-bold uppercase tracking-wider">{isIn ? 'Side in' : 'Side out'}</span>
        <span className="ml-auto text-xs font-semibold text-gray-600 dark:text-gray-300 tabular-nums">{isIn ? '+' : '−'}{total}</span>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-300 italic">No {isIn ? 'additions' : 'removals'}.</p>
      ) : (
        <ul className="space-y-1">
          {entries.map((e) => {
            const info = lookup?.get(e.id);
            const preview = info?.preview as CardPreview | undefined;
            const show = preview && onHover ? () => onHover(preview) : undefined;
            return (
              <li key={e.id} onMouseEnter={show} className="flex items-center gap-1.5 text-sm text-foreground">
                {info?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={info.image}
                    alt=""
                    loading="lazy"
                    className="h-11 w-8 shrink-0 rounded-sm object-cover object-top ring-1 ring-black/10 dark:ring-white/15 bg-muted"
                  />
                ) : (
                  <span className="h-11 w-8 shrink-0 rounded-sm bg-muted ring-1 ring-black/10 dark:ring-white/15" aria-hidden="true" />
                )}
                <PitchGem pitch={e.pitch ?? undefined} />
                <span className="min-w-0 flex-1">
                  <span
                    tabIndex={show ? 0 : undefined}
                    onFocus={show}
                    onClick={show}
                    className={`block break-words ${show ? `cursor-default rounded-sm hover:text-blue-700 dark:hover:text-blue-400 ${focusRing}` : ''}`}
                  >
                    {e.name}
                  </span>
                  {info?.type && <span className="block text-xs text-gray-600 dark:text-gray-400">{info.type}</span>}
                  {info?.text && (
                    <span className="block text-xs leading-snug text-gray-500 dark:text-gray-400 line-clamp-2">
                      {renderRulesText(info.text.length > 180 ? `${info.text.slice(0, 180).trimEnd()}…` : info.text)}
                    </span>
                  )}
                </span>
                <span className="ml-auto shrink-0 tabular-nums text-gray-600 dark:text-gray-300">×{e.count}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const FOIL_LABEL: Record<string, string> = { s: 'NF', r: 'RF', c: 'CF', g: 'GF' };

/**
 * The shared striped card table — binder / wants (flat rows), deck drills and
 * hero kits (sections), and AI search results all render through this one
 * component so every card list in the chat looks the same: pitch gem,
 * thumbnail, qty, name, type + rules text, collector number, foil, price.
 * Zebra is computed explicitly (not CSS :nth-child) so interleaved section
 * subheaders don't flip the stripe parity.
 */
function CardTable({ rows, sections, onPreview, noteHeader, maxHeightClass = 'max-h-96', className = '' }: {
  rows?: CardRow[];
  sections?: Array<{ title: string; count: number; rows: CardRow[] }>;
  onPreview: (preview: CardPreview) => void;
  /** Header label for the tail note/trade column (e.g. "Decks"). */
  noteHeader?: string;
  maxHeightClass?: string;
  className?: string;
}) {
  // Adaptive columns: only render a column when some row actually has data
  // for it — a consensus table (no prices/sets) or a search table (no owned
  // qty) shouldn't show empty headers.
  const allRows = rows ?? (sections ?? []).flatMap((s) => s.rows);
  const has = {
    qty: allRows.some((r) => typeof r.qty === 'number'),
    type: allRows.some((r) => r.type || r.text),
    collector: allRows.some((r) => r.collector),
    foiling: allRows.some((r) => r.foiling),
    price: allRows.some((r) => typeof r.price === 'number'),
    tail: allRows.some((r) => r.forTrade || r.priority || r.note),
  };
  const colCount = 3 + Number(has.qty) + Number(has.type) + Number(has.collector) + Number(has.foiling) + Number(has.price) + Number(has.tail);
  const renderRow = (r: CardRow, key: string, striped: boolean) => (
    <tr
      key={key}
      onMouseEnter={() => onPreview(r.preview)}
      className={`border-b border-border/40 last:border-0 hover:bg-primary/[0.06] transition-colors ${striped ? 'bg-muted/30' : ''}`}
    >
      <td className="align-middle w-6"><PitchGem pitch={r.pitch} /></td>
      <td className="align-middle w-9">
        {r.image ? (
          // max-w-none: the global img{max-width:100%} reset lets auto table
          // layout squeeze this cell to 0 when another column demands w-full.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r.image}
            alt=""
            loading="lazy"
            className="h-11 w-8 max-w-none shrink-0 rounded-sm object-cover object-top ring-1 ring-black/10 dark:ring-white/15 bg-muted"
          />
        ) : null}
      </td>
      {has.qty && <td className="align-middle text-right tabular-nums text-gray-500 dark:text-gray-400 whitespace-nowrap">{typeof r.qty === 'number' ? `${r.qty}×` : ''}</td>}
      <td className={`align-middle whitespace-nowrap font-medium ${has.type ? 'w-full md:w-auto' : 'w-full'}`}>
        <span
          tabIndex={0}
          onFocus={() => onPreview(r.preview)}
          onClick={() => onPreview(r.preview)}
          className={`cursor-default rounded-sm hover:text-blue-700 dark:hover:text-blue-400 ${focusRing}`}
        >
          {r.name}
        </span>
        {r.extendedArt && <span className="ml-1 text-[10px] font-semibold text-purple-600 dark:text-purple-400">EA</span>}
        {r.marvel && <span className="ml-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">Marvel</span>}
        {typeof r.printingCount === 'number' && r.printingCount > 1 && (
          <span className="ml-1.5 text-xs font-normal text-gray-500 dark:text-gray-400 whitespace-nowrap">
            +{r.printingCount - 1} {r.printingCount - 1 === 1 ? 'printing' : 'printings'}
          </span>
        )}
      </td>
      {has.type && (
        <td className="hidden md:table-cell md:w-full align-middle py-1">
          {r.type ? <div className="text-xs text-gray-500 dark:text-gray-400">{r.type}</div> : null}
          {r.text ? <div className="text-xs leading-snug text-gray-400 dark:text-gray-500 line-clamp-2">{renderRulesText(r.text.length > 180 ? `${r.text.slice(0, 180).trimEnd()}…` : r.text)}</div> : null}
        </td>
      )}
      {has.collector && <td className="hidden sm:table-cell align-middle text-xs tabular-nums text-gray-500 dark:text-gray-400 whitespace-nowrap">{r.collector ?? ''}</td>}
      {has.foiling && <td className="hidden sm:table-cell align-middle text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{r.foiling ? FOIL_LABEL[r.foiling] : ''}</td>}
      {has.price && <td className="align-middle text-right text-xs tabular-nums text-gray-600 dark:text-gray-300 whitespace-nowrap">{typeof r.price === 'number' ? `$${r.price.toFixed(2)}` : ''}</td>}
      {has.tail && (
        <td className="align-middle text-right whitespace-nowrap">
          {r.forTrade
            ? <span className="inline-block rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">trade</span>
            : (r.priority || r.note)
              ? <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{r.priority || r.note}</span>
              : null}
        </td>
      )}
    </tr>
  );
  return (
    <div className={`${maxHeightClass} overflow-y-auto overflow-x-hidden rounded-md border border-border ${className}`}>
      <table className="w-full text-sm border-collapse [&_td]:px-2.5 [&_td]:py-1.5 [&_th]:px-2.5 [&_th]:py-2 [&_td:first-child]:pl-3 [&_th:first-child]:pl-3 [&_td:last-child]:pr-3 [&_th:last-child]:pr-3">
        <thead>
          <tr className="sticky top-0 z-10 bg-muted/60 backdrop-blur-sm text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 [&_th]:border-b [&_th]:border-border">
            <th className="w-6" aria-label="Pitch" />
            <th className="w-9" aria-label="Card image" />
            {has.qty && <th className="text-right whitespace-nowrap">Qty</th>}
            <th className={has.type ? 'w-full md:w-auto' : 'w-full'}>Card</th>
            {has.type && <th className="hidden md:table-cell md:w-full">Type</th>}
            {has.collector && <th className="hidden sm:table-cell whitespace-nowrap">No.</th>}
            {has.foiling && <th className="hidden sm:table-cell whitespace-nowrap">Foil</th>}
            {has.price && <th className="text-right whitespace-nowrap">Price</th>}
            {has.tail && (noteHeader
              ? <th className="text-right whitespace-nowrap">{noteHeader}</th>
              : <th className="whitespace-nowrap" aria-label="Trade status" />)}
          </tr>
        </thead>
        <tbody>
          {rows
            ? rows.map((r, i) => renderRow(r, String(i), i % 2 === 1))
            : (() => {
                let n = 0;
                return (sections ?? []).flatMap((sec, si) => [
                  <tr key={`h-${si}`} className="bg-muted/70">
                    <td colSpan={colCount} className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 border-y border-border">
                      {sec.title} <span className="text-gray-400 dark:text-gray-500">· {sec.count}</span>
                    </td>
                  </tr>,
                  ...sec.rows.map((r, ri) => renderRow(r, `${si}-${ri}`, n++ % 2 === 1)),
                ]);
              })()}
        </tbody>
      </table>
    </div>
  );
}

// FaB rules-text tokens ({p} power, {h} life, {r} resource, {d} defense,
// {i} intellect) → inline glyphs (RULE_TOKEN_ICON shared with the markdown
// renderer). Unknown tokens fall through as plain text.

/** Render rules text, swapping {x} token markup for its FaB glyph. */
function renderRulesText(text: string) {
  return text.split(/(\{[a-z]\})/gi).map((part, i) => {
    const m = /^\{([a-z])\}$/i.exec(part);
    const icon = m && RULE_TOKEN_ICON[m[1].toLowerCase()];
    return icon
      // eslint-disable-next-line @next/next/no-img-element
      ? <img key={i} src={icon.src} alt={icon.alt} title={icon.alt} className="inline-block h-3 w-3 mx-px align-[-0.125em]" />
      : <span key={i}>{part}</span>;
  });
}

interface StructuredCard {
  title?: string;
  subtitle?: string;
  url?: string;
}

type UiItem =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string; streaming: boolean }
  | { kind: 'tool'; id: string; name: string; status: 'running' | 'ok' | 'error'; ms?: number; card?: StructuredCard; results?: SearchResultsCard; cards?: HarvestedCard[] }
  // Destructive tool call paused server-side awaiting Confirm/Deny.
  // pending → confirmed (tool_start arrives) or denied (failed tool_result
  // arrives without a tool_start). `submitting` disables the buttons while the
  // decision POST is in flight.
  | { kind: 'confirm'; id: string; name: string; args: unknown; status: 'pending' | 'confirmed' | 'denied'; submitting?: boolean }
  | { kind: 'data'; title: string; lines: CardLine[]; cards?: DeckViewCard[]; cardsSubtitle?: string; tableRows?: CardRow[]; tableSections?: Array<{ title: string; count: number; rows: CardRow[] }>; tableNoteHeader?: string; copyHeader?: string; sourceUrl?: string; deckPublicId?: string; resultRows?: GameResultRow[]; wantsAdd?: Array<{ printingId: string; quantity: number; priority: 'high' | 'medium' | 'low' }> };

// $/M-token prices for the session cost readout (mirrors the route allowlist;
// unknown models show token counts only).
const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  'openai/gpt-5-nano': { input: 0.05, output: 0.4 },
  'openai/gpt-oss-120b': { input: 0.03, output: 0.15 },
  'google/gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
  'anthropic/claude-haiku-4.5': { input: 1, output: 5 },
  mock: { input: 0, output: 0 },
};

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400';

/**
 * A labelled dropdown for the instant-action pickers (decks-to-beat, archetype,
 * hero kit). Wraps the app's styled Select (chevron, keyboard nav, themed menu)
 * so the pickers stop rendering raw native <select> boxes. Loading / empty
 * states surface as the trigger placeholder (Radix rejects empty-value items).
 */
function PickerSelect({
  label, wrapperClassName = '', triggerClassName = '', value, onValueChange, disabled, placeholder, children,
}: {
  label: React.ReactNode;
  wrapperClassName?: string;
  triggerClassName?: string;
  value: string;
  onValueChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-300 ${wrapperClassName}`}>
      {label}
      <Select value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className={`h-9 text-sm ${focusRing} ${triggerClassName}`}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

type RailStatus = { wants?: 'busy' | 'done' | 'error'; binder?: 'busy' | 'done' | 'error' };

/**
 * Card preview panel — image, prices, TCGplayer link, add-to-wants/binder.
 * Rendered in the desktop side rail (lg+) and inside the mobile bottom
 * drawer (tap a card name on touch), so both surfaces stay in sync.
 */
function CardPreviewPanel({ card, imageClassName = 'w-full rounded-md', railStatus, onAddToWants, onAddToBinder, onSwapPrinting, swapBusy, binderOptions, targetBinderId, onTargetBinderChange }: {
  card: CardPreview;
  imageClassName?: string;
  railStatus: RailStatus;
  onAddToWants: () => void;
  onAddToBinder: () => void;
  onSwapPrinting?: () => void;
  swapBusy?: boolean;
  binderOptions: Array<{ _id: string; name: string }>;
  targetBinderId: string;
  onTargetBinderChange: (id: string) => void;
}) {
  return (
    <>
      <div className={`rounded-lg border border-border bg-card p-3`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={card.imageUrl}
          alt={card.name}
          className={imageClassName}
        />
        <p className="mt-2 font-semibold text-center">{card.name}</p>
        {(card.priceLow !== undefined || card.priceMarket !== undefined) && (
          <div className="mt-1 flex justify-center gap-4 text-sm tabular-nums">
            {card.priceLow !== undefined && (
              <span>
                <span className="text-gray-600 dark:text-gray-300">Low </span>
                <span className="font-semibold text-green-700 dark:text-green-500">${card.priceLow.toFixed(2)}</span>
              </span>
            )}
            {card.priceMarket !== undefined && (
              <span>
                <span className="text-gray-600 dark:text-gray-300">Market </span>
                <span className="font-semibold text-green-700 dark:text-green-500">${card.priceMarket.toFixed(2)}</span>
              </span>
            )}
          </div>
        )}
        {card.tcgplayerUrl && (
          <div className="text-sm mt-2 pt-2 border-t border-border">
            <TcgAffiliateLink
              tcgplayerUrl={card.tcgplayerUrl}
              feature="volzar"
              className={`flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors ${focusRing} rounded-sm`}
              title="Purchase on TCGPlayer"
            >
              <span>Available for purchase here</span>
              {/* Theme-swapped wordmark: black for light mode, white (CDN) for dark */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/tcgplayer-logo-black.png"
                alt="TCGPlayer"
                className="h-4 w-auto dark:hidden"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/596dace2-8614-4efc-b58d-0b0ebdc0d300/public"
                alt=""
                aria-hidden="true"
                className="h-4 w-auto hidden dark:block"
              />
            </TcgAffiliateLink>
          </div>
        )}
        {card.printingId && onSwapPrinting && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSwapPrinting}
            disabled={swapBusy}
            className={`mt-2 w-full justify-center gap-2 ${focusRing}`}
            title="Choose a different set / foiling / art for this card"
          >
            {swapBusy
              ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              : <Repeat className="h-4 w-4" aria-hidden="true" />}
            Swap printing
          </Button>
        )}
      </div>

      {card.printingId && (
        <div className={`rounded-lg border border-border bg-card p-3 flex flex-col gap-2`}>
          <Button
            variant="outline"
            size="sm"
            onClick={onAddToWants}
            disabled={railStatus.wants === 'busy' || railStatus.wants === 'done'}
            className={`justify-start gap-2 ${focusRing}`}
          >
            {railStatus.wants === 'busy' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              : railStatus.wants === 'done' ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" aria-hidden="true" />
              : railStatus.wants === 'error' ? <XCircle className="h-4 w-4 text-red-600 dark:text-red-500" aria-hidden="true" />
              : <Heart className="h-4 w-4" aria-hidden="true" />}
            {railStatus.wants === 'done' ? 'Added to wants' : 'Add to wants'}
          </Button>

          {binderOptions.length > 0 && (
            <>
              <Select value={targetBinderId} onValueChange={onTargetBinderChange}>
                <SelectTrigger className={`text-sm ${focusRing}`} aria-label="Target binder">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {binderOptions.map((b) => (
                    <SelectItem key={b._id} value={b._id} className="text-sm">{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={onAddToBinder}
                disabled={!targetBinderId || railStatus.binder === 'busy' || railStatus.binder === 'done'}
                className={`justify-start gap-2 ${focusRing}`}
              >
                {railStatus.binder === 'busy' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  : railStatus.binder === 'done' ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" aria-hidden="true" />
                  : railStatus.binder === 'error' ? <XCircle className="h-4 w-4 text-red-600 dark:text-red-500" aria-hidden="true" />
                  : <FolderPlus className="h-4 w-4" aria-hidden="true" />}
                {railStatus.binder === 'done' ? 'Added to binder' : 'Add to binder'}
              </Button>
            </>
          )}
          <p className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1">
            <Zap className="h-3 w-3" aria-hidden="true" /> Instant — no AI
          </p>
        </div>
      )}
    </>
  );
}

function toStructuredCard(structured: unknown): StructuredCard | undefined {
  if (!structured || typeof structured !== 'object') return undefined;
  const s = structured as Record<string, unknown>;
  // Only render http(s) links — closes javascript:/data: smuggling if a tool
  // ever reflects user-authored content into `url`.
  const url = typeof s.url === 'string' && /^https?:\/\//i.test(s.url) ? s.url : undefined;
  const card: StructuredCard = {
    title: typeof s.title === 'string' ? s.title : undefined,
    subtitle: typeof s.subtitle === 'string' ? s.subtitle : undefined,
    url,
  };
  return card.title || card.url ? card : undefined;
}

export function VolzarChat({ username, userId, mockMode, models, isSuperAdmin, initialContext, initialData }: {
  username: string;
  userId: string;
  mockMode: boolean;
  models: string[];
  /** Only superadmins get the model picker; everyone else runs the default
   *  (cheapest) model, which the server also pins regardless of what's sent. */
  isSuperAdmin: boolean;
  /** Pre-queued context (e.g. the Bridge B /opt handoff) — rides the
   *  pendingContext queue with the first free-text message, then clears.
   *  Also the seam a future embedded chat panel seeds. */
  initialContext?: string[];
  /** Visible data card announcing the queued context in the thread. */
  initialData?: { title: string; lines: CardLine[] };
}) {
  // Initializers (not effects) so StrictMode's double mount can't double-seed.
  const [items, setItems] = useState<UiItem[]>(() =>
    initialData ? [{ kind: 'data', title: initialData.title, lines: initialData.lines }] : []);
  const [apiMessages, setApiMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState(models[0]);
  const [busy, setBusy] = useState(false);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  // Public id of the deck currently being copied via "Add to my decks".
  const [addingDeckId, setAddingDeckId] = useState<string | null>(null);
  // Per-comparison-card "Add missing to wants" feedback, keyed by item index.
  const [wantsAddStatus, setWantsAddStatus] = useState<Record<number, 'busy' | 'done' | 'error'>>({});
  // Card preview: desktop side rail (hover/focus) or mobile bottom drawer (tap)
  const [previewCard, setPreviewCard] = useState<CardPreview | null>(null);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  // "Swap printing" reuses the deck page's ViewPrintingsDialog, which fetches by
  // card_unique_id — resolve it from the previewed printing before opening.
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapBusy, setSwapBusy] = useState(false);
  const [swapCardUniqueId, setSwapCardUniqueId] = useState('');
  const isMobile = useIsMobile();

  // Hover-capable devices preview in the rail; touch devices open the drawer
  // on tap (mouseenter/focus both fire on tap, so every card line works).
  const showPreview = useCallback((preview: CardPreview) => {
    setPreviewCard(preview);
    if (typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches) {
      setMobilePreviewOpen(true);
    }
  }, []);

  // "View as cards" grid overlay for a deck / consensus data card.
  const [deckView, setDeckView] = useState<{ title: string; subtitle?: string; cards: DeckViewCard[] } | null>(null);

  // Archetype comparison picker (instant, no-AI cross-deck consensus).
  const [archetypeOpen, setArchetypeOpen] = useState(false);
  const [heroes, setHeroes] = useState<ToBeatHero[]>([]);
  const [heroesLoading, setHeroesLoading] = useState(false);
  const [selectedHero, setSelectedHero] = useState('');
  const [archetypeMonths, setArchetypeMonths] = useState(3);

  // Hero-kit picker — deterministic curated kit pool (types + rules text),
  // seeded as context so deck-building follow-ups need zero tool calls.
  const [kitOpen, setKitOpen] = useState(false);
  const [kitFormat, setKitFormat] = useState('Classic Constructed');
  const [kitHeroes, setKitHeroes] = useState<KitHero[]>([]);
  const [kitHeroesLoading, setKitHeroesLoading] = useState(false);
  const [kitHero, setKitHero] = useState('');

  // Decks-to-beat picker — the unscoped list is too long, so scope by hero
  // (rolling window) or by event before fetching.
  const [toBeatOpen, setToBeatOpen] = useState(false);
  const [toBeatMode, setToBeatMode] = useState<'hero' | 'event'>('hero');
  const [toBeatHero, setToBeatHero] = useState('');
  const [toBeatEvents, setToBeatEvents] = useState<ToBeatEvent[]>([]);
  const [toBeatEventsLoading, setToBeatEventsLoading] = useState(false);
  const [toBeatEvent, setToBeatEvent] = useState('');

  // Every card any search_printings call surfaced this session, keyed by name,
  // so card names in Volzar's markdown answers can hover-preview in the rail.
  const cardIndex = useMemo(() => {
    const cards: HarvestedCard[] = [];
    for (const it of items) {
      if (it.kind === 'tool' && it.cards) cards.push(...it.cards);
    }
    return buildCardNameIndex(cards);
  }, [items]);
  const previewsByPid = useMemo(() => {
    const m = new Map<string, CardPreview>();
    for (const entries of cardIndex.values()) {
      for (const e of entries) if (e.preview.printingId) m.set(e.preview.printingId, e.preview);
    }
    return m;
  }, [cardIndex]);
  // printing_id → card name, so confirmation cards can show "1× Avast Ye!"
  // instead of a meaningless nanoid. Aggregates every card this session has
  // surfaced: search / get_deck tool results (via previewsByPid) plus deck-drill
  // data cards (Decks to Beat). Falls back to the id when a name isn't known.
  const cardNameByPid = useMemo(() => {
    const m = new Map<string, string>();
    for (const [pid, preview] of previewsByPid) if (preview.name) m.set(pid, preview.name);
    for (const it of items) {
      if (it.kind === 'data' && it.cards) {
        for (const c of it.cards) if (c.printingId && c.name) m.set(c.printingId, c.name);
      }
    }
    return m;
  }, [previewsByPid, items]);
  // Rail actions: binder picker options + per-card action feedback
  const [binderOptions, setBinderOptions] = useState<Array<{ _id: string; name: string }>>([]);
  const [targetBinderId, setTargetBinderId] = useState<string>('');
  const [railStatus, setRailStatus] = useState<{ wants?: 'busy' | 'done' | 'error'; binder?: 'busy' | 'done' | 'error' }>({});
  // Card-search add flow (split buttons on My binders / My wants). Adds made
  // while the dialog is open accumulate here and flush into one data card +
  // one context entry when it closes.
  const [addDialog, setAddDialog] = useState<{ destination: 'binder' | 'wants'; binderId?: string; binderName?: string } | null>(null);
  const addedCardsRef = useRef<string[]>([]);
  // Cumulative session usage (accumulated from done events)
  const [sessionUsage, setSessionUsage] = useState({ input: 0, output: 0, cost: 0 });
  const modelRef = useRef(models[0]);
  useEffect(() => { modelRef.current = model; });
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // One instant call to populate the add-to-binder picker
    bindersClient.getUserBinders().then((result) => {
      if (result.success) {
        const binders = (result.data as any)?.binders ?? [];
        setBinderOptions(binders);
        if (binders.length > 0) setTargetBinderId(binders[0]._id);
      }
    });
  }, []);

  // New hovered card → fresh action states
  useEffect(() => {
    setRailStatus({});
  }, [previewCard?.printingId]);

  // Zero-token context queue: quick-action results wait here and ride along
  // with the NEXT free-text message, then clear. Tokens are spent only if an
  // AI question actually follows the button press.
  const pendingContextRef = useRef<string[]>(initialContext ?? []);

  // Working state for the in-flight AI turn. `committed` flips once the turn
  // has been folded into apiMessages (done/error event, or the abort
  // finalizer in performTurn) so it can never be committed twice.
  const turnRef = useRef<{
    assistantText: string;
    toolCalls: ToolCall[];
    toolResults: Array<{ id: string; content: string }>;
    committed: boolean;
  }>({ assistantText: '', toolCalls: [], toolResults: [], committed: true });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [items]);

  const handleEvent = useCallback((event: AgentEvent) => {
    switch (event.type) {
      case 'token':
        turnRef.current.assistantText += event.text;
        setItems((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.kind === 'assistant' && last.streaming) {
            next[next.length - 1] = { ...last, text: last.text + event.text };
          } else {
            next.push({ kind: 'assistant', text: event.text, streaming: true });
          }
          return next;
        });
        break;

      case 'confirmation_request':
        // The loop pushes this call into the assistant message whether it is
        // later confirmed or denied — mirror it now so the reconstructed
        // apiMessages stay consistent (tool_start dedupes below).
        turnRef.current.toolCalls.push({
          id: event.id,
          type: 'function',
          function: { name: event.name, arguments: JSON.stringify(event.args ?? {}) },
        });
        setItems((prev) => [...prev, { kind: 'confirm', id: event.id, name: event.name, args: event.args, status: 'pending' }]);
        break;

      case 'tool_start':
        if (!turnRef.current.toolCalls.some((c) => c.id === event.id)) {
          turnRef.current.toolCalls.push({
            id: event.id,
            type: 'function',
            function: { name: event.name, arguments: JSON.stringify(event.args ?? {}) },
          });
        }
        setItems((prev) => [
          ...prev.map((item) =>
            item.kind === 'confirm' && item.id === event.id ? { ...item, status: 'confirmed' as const } : item,
          ),
          { kind: 'tool', id: event.id, name: event.name, status: 'running' },
        ]);
        break;

      case 'tool_result': {
        turnRef.current.toolResults.push({
          id: event.id,
          content: event.ok ? event.content : `Error: ${event.content}`,
        });
        const card = toStructuredCard(event.structured);
        const results = parseSearchResults(event.structured) ?? undefined;
        // Every card any tool surfaced feeds the name→rail index for markdown
        // linkification — decks and binders too, not just searches.
        const cards = harvestCardsFromStructured(event.structured);
        setItems((prev) => prev.map((item) => {
          if (item.kind === 'tool' && item.id === event.id) {
            return { ...item, status: event.ok ? ('ok' as const) : ('error' as const), ms: event.ms, card, results, cards };
          }
          // A result landing on a still-pending confirm card is the deny path
          // (denied calls never get a tool_start).
          if (item.kind === 'confirm' && item.id === event.id && item.status === 'pending') {
            return { ...item, status: 'denied' as const };
          }
          return item;
        }));
        break;
      }

      case 'done':
      case 'error': {
        if (event.type === 'done' && event.usage) {
          const usage = event.usage;
          const price = MODEL_PRICES[modelRef.current];
          setSessionUsage((prev) => ({
            input: prev.input + usage.prompt_tokens,
            output: prev.output + usage.completion_tokens,
            cost: prev.cost + (price ? (usage.prompt_tokens * price.input + usage.completion_tokens * price.output) / 1e6 : 0),
          }));
        }
        const turn = turnRef.current;
        turn.committed = true;
        setApiMessages((prev) => [...prev, ...buildTurnMessages(turn)]);
        setItems((prev) => prev.map((item) =>
          item.kind === 'assistant' && item.streaming ? { ...item, streaming: false } : item,
        ));
        if (event.type === 'error') setErrorBanner(event.message);
        break;
      }
    }
  }, []);

  const runInstant = useCallback(async (actionId: string, run: () => Promise<{ title: string; lines: CardLine[]; context: string; cards?: DeckViewCard[]; cardsSubtitle?: string; tableRows?: CardRow[]; tableSections?: Array<{ title: string; count: number; rows: CardRow[] }>; tableNoteHeader?: string; copyHeader?: string; publicId?: string; resultRows?: GameResultRow[]; wantsAdd?: Array<{ printingId: string; quantity: number; priority: 'high' | 'medium' | 'low' }> }>) => {
    if (busy || runningAction) return;
    setErrorBanner(null);
    setRunningAction(actionId);
    try {
      const result = await run();
      // The shareable page URL for a wants list / a specific binder drill.
      const base = process.env.NEXT_PUBLIC_APP_URL || 'https://fabbazaar.app';
      const sourceUrl = actionId === 'wants'
        ? `${base}/wants/${userId}`
        : actionId.startsWith('binder:')
          ? `${base}/binder/${actionId.slice('binder:'.length)}`
          : undefined;
      setItems((prev) => [...prev, { kind: 'data', title: result.title, lines: result.lines, cards: result.cards, cardsSubtitle: result.cardsSubtitle, tableRows: result.tableRows, tableSections: result.tableSections, tableNoteHeader: result.tableNoteHeader, copyHeader: result.copyHeader, sourceUrl, deckPublicId: result.publicId, resultRows: result.resultRows, wantsAdd: result.wantsAdd }]);
      pendingContextRef.current.push(result.context);
    } catch (error) {
      setErrorBanner(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setRunningAction(null);
    }
  }, [busy, runningAction, userId]);

  // Copy a wants/binder card list as Discord-friendly shorthand + link.
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const copyList = useCallback((idx: number, header: string | undefined, rows: CardRow[], url?: string) => {
    const text = [
      header,
      ...rows.map(toShorthand),
      ...(url ? ['', url] : []),
    ].filter((l) => l !== undefined).join('\n');
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((c) => (c === idx ? null : c)), 1500);
    });
  }, []);

  const runQuickAction = useCallback((actionId: string) => {
    const action = QUICK_ACTIONS.find((a) => a.id === actionId);
    if (action) void runInstant(action.id, action.run);
  }, [runInstant]);

  const drill = useCallback((target: DrillTarget) => {
    void runInstant(`${target.kind}:${target.id}`, () => runDrill(target));
  }, [runInstant]);

  // Shared hero list (Decks-to-Beat heroes) — used by both the archetype
  // picker and the decks-to-beat by-hero picker; loaded once on demand.
  const ensureHeroes = useCallback(async () => {
    if (heroes.length > 0 || heroesLoading) return;
    setHeroesLoading(true);
    try {
      const list = await fetchToBeatHeroes();
      setHeroes(list);
      if (list.length > 0) {
        setSelectedHero((h) => h || list[0].heroName);
        setToBeatHero((h) => h || list[0].heroName);
      }
    } catch (error) {
      setErrorBanner(error instanceof Error ? error.message : 'Failed to load heroes');
    } finally {
      setHeroesLoading(false);
    }
  }, [heroes.length, heroesLoading]);

  // Pickers are mutually exclusive (opening one closes the rest) and close
  // when their action runs — stacked open panels eat the whole thread height.
  const toggleArchetype = useCallback(() => {
    const opening = !archetypeOpen;
    setArchetypeOpen(opening);
    if (opening) {
      setToBeatOpen(false);
      setKitOpen(false);
      void ensureHeroes();
    }
  }, [archetypeOpen, ensureHeroes]);

  const runArchetype = useCallback(() => {
    if (!selectedHero) return;
    setArchetypeOpen(false);
    void runInstant('archetype', () => runArchetypeConsensus(selectedHero, archetypeMonths));
  }, [selectedHero, archetypeMonths, runInstant]);

  const ensureToBeatEvents = useCallback(async () => {
    if (toBeatEvents.length > 0 || toBeatEventsLoading) return;
    setToBeatEventsLoading(true);
    try {
      const list = await fetchToBeatEvents();
      setToBeatEvents(list);
      if (list.length > 0) setToBeatEvent((e) => e || list[0].eventName);
    } catch (error) {
      setErrorBanner(error instanceof Error ? error.message : 'Failed to load events');
    } finally {
      setToBeatEventsLoading(false);
    }
  }, [toBeatEvents.length, toBeatEventsLoading]);

  const toggleToBeat = useCallback(() => {
    const opening = !toBeatOpen;
    setToBeatOpen(opening);
    if (opening) {
      setArchetypeOpen(false);
      setKitOpen(false);
      void ensureHeroes();
      if (toBeatMode === 'event') void ensureToBeatEvents();
    }
  }, [toBeatOpen, toBeatMode, ensureHeroes, ensureToBeatEvents]);

  const setToBeatModeAndLoad = useCallback((mode: 'hero' | 'event') => {
    setToBeatMode(mode);
    if (mode === 'event') void ensureToBeatEvents();
  }, [ensureToBeatEvents]);

  const runToBeat = useCallback(() => {
    if (toBeatMode === 'hero') {
      if (!toBeatHero) return;
      const hero = heroes.find((h) => h.heroName === toBeatHero);
      setToBeatOpen(false);
      void runInstant('to-beat', () => runToBeatByHero(toBeatHero, hero?.displayName ?? toBeatHero));
    } else {
      if (!toBeatEvent) return;
      setToBeatOpen(false);
      void runInstant('to-beat', () => runToBeatByEvent(toBeatEvent));
    }
  }, [toBeatMode, toBeatHero, toBeatEvent, heroes, runInstant]);

  // Hero-kit picker plumbing: heroes load per format, on open and on change.
  const loadKitHeroes = useCallback(async (format: string) => {
    setKitHeroesLoading(true);
    try {
      const list = await fetchKitHeroes(format);
      setKitHeroes(list);
      setKitHero((h) => (list.some((x) => x.heroName === h) ? h : (list[0]?.heroName ?? '')));
    } catch (error) {
      setErrorBanner(error instanceof Error ? error.message : 'Failed to load kit heroes');
    } finally {
      setKitHeroesLoading(false);
    }
  }, []);

  const toggleKit = useCallback(() => {
    const opening = !kitOpen;
    setKitOpen(opening);
    if (opening) {
      setToBeatOpen(false);
      setArchetypeOpen(false);
      if (kitHeroes.length === 0) void loadKitHeroes(kitFormat);
    }
  }, [kitOpen, kitHeroes.length, kitFormat, loadKitHeroes]);

  const setKitFormatAndLoad = useCallback((format: string) => {
    setKitFormat(format);
    void loadKitHeroes(format);
  }, [loadKitHeroes]);

  const runKit = useCallback(() => {
    if (!kitHero) return;
    const hero = kitHeroes.find((h) => h.heroName === kitHero);
    setKitOpen(false);
    void runInstant('hero-kit', () => runHeroKit(kitHero, hero?.displayName ?? kitHero, kitFormat));
  }, [kitHero, kitHeroes, kitFormat, runInstant]);

  const performTurn = useCallback(async (messagesToSend: ChatMessage[], modelToUse: string) => {
    setErrorBanner(null);
    setBusy(true);
    turnRef.current = { assistantText: '', toolCalls: [], toolResults: [], committed: false };

    const abortController = new AbortController();
    abortRef.current = abortController;

    const result = await volzarClient.streamChat({
      messages: messagesToSend,
      model: modelToUse,
      signal: abortController.signal,
      onEvent: handleEvent,
    });

    // Stop / dropped connection: no done or error event arrives, so fold the
    // partial turn into history here (buildTurnMessages drops dangling tool
    // calls) — otherwise the model never sees the reply the user is reading.
    // Also settle the UI: stop the streaming cursor, and mark confirmations
    // the abort orphaned as denied (the server loop is gone; nothing ran).
    const turn = turnRef.current;
    if (!turn.committed) {
      turn.committed = true;
      setApiMessages((prev) => [...prev, ...buildTurnMessages(turn)]);
      setItems((prev) => prev.map((item) => {
        if (item.kind === 'assistant' && item.streaming) return { ...item, streaming: false };
        if (item.kind === 'confirm' && item.status === 'pending') return { ...item, status: 'denied' as const };
        return item;
      }));
    }

    if (!result.success) setErrorBanner(result.error);
    setBusy(false);
    abortRef.current = null;
  }, [handleEvent]);

  // Send one user turn. `display` is what the user's chat bubble shows;
  // `rawContent` is what the model receives (plus any queued quick-action
  // context, which is attached here and then cleared). They differ for
  // programmatic turns like the Game-results Analyze button, where the
  // content carries deckName/resultId the bubble doesn't need to show.
  const sendTurn = useCallback(async (display: string, rawContent: string) => {
    if (busy) return;
    const content = buildMessageWithContext(pendingContextRef.current, rawContent);
    pendingContextRef.current = [];

    const nextMessages: ChatMessage[] = [...apiMessages, { role: 'user', content }];
    setApiMessages(nextMessages);
    setItems((prev) => [...prev, { kind: 'user', text: display }]);

    await performTurn(nextMessages, model);
  }, [busy, apiMessages, model, performTurn]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    await sendTurn(text, text);
  }, [input, busy, sendTurn]);

  // One-click game analysis from a Game-results row (uses AI: one chat turn).
  const analyzeGame = useCallback((row: GameResultRow) => {
    const { display, content } = buildAnalyzeGameMessage(row);
    void sendTurn(display, content);
  }, [sendTurn]);

  // Re-run the last user turn (optionally on a different model): trims any
  // partial assistant/tool messages from the failed attempt so the payload
  // ends with the user message again (the route requires it).
  const retryLastTurn = useCallback(async (modelOverride?: string) => {
    if (busy) return;
    const lastUserIndex = apiMessages.map((m) => m.role).lastIndexOf('user');
    if (lastUserIndex === -1) return;
    const trimmed = apiMessages.slice(0, lastUserIndex + 1);
    setApiMessages(trimmed);
    const useModel = modelOverride ?? model;
    if (modelOverride) setModel(modelOverride);
    await performTurn(trimmed, useModel);
  }, [busy, apiMessages, model, performTurn]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  // Confirm/Deny for a paused destructive tool call. The POST releases the
  // server-side agent loop; the outcome (tool_start or a declined tool_result)
  // arrives over the still-open stream, which is what flips the card's status.
  const decideConfirmation = useCallback(async (id: string, decision: 'confirm' | 'deny') => {
    setItems((prev) => prev.map((item) =>
      item.kind === 'confirm' && item.id === id ? { ...item, submitting: true } : item,
    ));
    const result = await volzarClient.resolveConfirmation({ id, decision });
    if (!result.success) {
      setErrorBanner(result.error);
      setItems((prev) => prev.map((item) =>
        item.kind === 'confirm' && item.id === id ? { ...item, submitting: false } : item,
      ));
    }
  }, []);

  // "Add to my decks" — deterministic, session-authed copy of a deck (e.g. a
  // Deck to Beat) into the user's account. No AI: one call to the copy endpoint,
  // which duplicates the full decklist server-side. On success we append a card
  // linking to the new deck; leaving the name blank lets the server title it
  // "Copy of <deck>".
  const addDeckToMine = useCallback(async (publicId: string) => {
    if (addingDeckId) return;
    setAddingDeckId(publicId);
    setErrorBanner(null);
    try {
      const result = await decksClient.copyDeck(publicId, '');
      if (result.success) {
        const newId = (result.data as { publicId?: string } | undefined)?.publicId;
        const name = (result.data as { name?: string } | undefined)?.name ?? 'the deck';
        setItems((prev) => [...prev, {
          kind: 'data',
          title: '✓ Added to your decks',
          lines: [`"${name}" is now in your decks.`],
          ...(newId ? { sourceUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://fabbazaar.app'}/decks/${newId}` } : {}),
        }]);
      } else {
        setErrorBanner(result.error || 'Could not add the deck to your account.');
      }
    } catch (error) {
      setErrorBanner(error instanceof Error ? error.message : 'Could not add the deck to your account.');
    } finally {
      setAddingDeckId(null);
    }
  }, [addingDeckId]);

  // "View matchups" — deterministic, no AI. Fetches the deck's configured
  // matchup sideboard plans (deck metadata) once per card and toggles an
  // in-card panel: one button per matchup, expanding to the pre-game Talishar
  // checklist (turn order, notes, side in/out). Keyed by item index; a compact
  // summary also rides the context queue so follow-up questions are grounded.
  const [matchupPanels, setMatchupPanels] = useState<Record<number, { status: 'loading' | 'done' | 'error'; matchups: DeckMatchup[]; open: string | null }>>({});
  const toggleMatchups = useCallback(async (index: number, publicId: string, deckName: string) => {
    if (matchupPanels[index]) {
      setMatchupPanels((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      return;
    }
    setMatchupPanels((prev) => ({ ...prev, [index]: { status: 'loading', matchups: [], open: null } }));
    const result = await decksClient.getDeckMatchups(publicId);
    setMatchupPanels((prev) => {
      if (!prev[index]) return prev; // hidden again while the fetch was in flight
      const matchups = result.success ? result.data.matchups : [];
      return {
        ...prev,
        [index]: {
          status: result.success ? 'done' : 'error',
          matchups,
          // A lone matchup opens itself — no second click for the common case.
          open: matchups.length === 1 ? matchups[0].heroId : null,
        },
      };
    });
    if (result.success && result.data.matchups.length > 0) {
      pendingContextRef.current.push(matchupsToContext(deckName, result.data.matchups));
    }
  }, [matchupPanels]);
  // Opening/expanding a matchup panel grows the card without adding a chat
  // item (which is what the main auto-scroll keys on) — pin the chat to the
  // end so the revealed content lands on screen instead of below the fold.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [matchupPanels]);

  // "Add missing to wants" — deterministic, no AI. Bulk-adds the deck's curated
  // printings for every card the comparison says you still need (missing +
  // partial shortfall). The printing can be swapped later from the rail.
  const addMissingToWants = useCallback(async (index: number, cards: Array<{ printingId: string; quantity: number; priority: 'high' | 'medium' | 'low' }>) => {
    if (!cards.length || wantsAddStatus[index] === 'busy' || wantsAddStatus[index] === 'done') return;
    setWantsAddStatus((s) => ({ ...s, [index]: 'busy' }));
    setErrorBanner(null);
    const result = await wantsClient.bulkAddWants(cards);
    setWantsAddStatus((s) => ({ ...s, [index]: result.success ? 'done' : 'error' }));
    if (!result.success) setErrorBanner(result.error);
  }, [wantsAddStatus]);

  const reset = useCallback(() => {
    // Mark the in-flight turn committed BEFORE aborting: New chat discards it,
    // and the abort finalizer in performTurn must not resurrect it into the
    // freshly cleared history.
    turnRef.current.committed = true;
    abortRef.current?.abort();
    setItems([]);
    setApiMessages([]);
    setErrorBanner(null);
    setBusy(false);
    pendingContextRef.current = [];
    setSessionUsage({ input: 0, output: 0, cost: 0 });
    setWantsAddStatus({});
    setAddDialog(null);
    addedCardsRef.current = [];
  }, []);

  const addPreviewToWants = useCallback(async () => {
    if (!previewCard?.printingId) return;
    setRailStatus((s) => ({ ...s, wants: 'busy' }));
    const result = await wantsClient.addWantsItem(previewCard.printingId, 1);
    setRailStatus((s) => ({ ...s, wants: result.success ? 'done' : 'error' }));
    if (!result.success) setErrorBanner(result.error);
  }, [previewCard]);

  // Resolve the previewed printing's card_unique_id, then open the deck-page
  // printing picker (ViewPrintingsDialog) scoped to that card.
  const openSwap = useCallback(async () => {
    if (!previewCard?.printingId || swapBusy) return;
    setSwapBusy(true);
    setErrorBanner(null);
    try {
      const res = await fetch(`/api/search/core?printingId=${encodeURIComponent(previewCard.printingId)}&limit=1`);
      const data = await res.json();
      const cuid = data?.data?.printings?.[0]?.card_unique_id;
      if (cuid) {
        setSwapCardUniqueId(cuid);
        setSwapOpen(true);
      } else {
        setErrorBanner('Could not load other printings for this card.');
      }
    } catch {
      setErrorBanner('Could not load other printings for this card.');
    } finally {
      setSwapBusy(false);
    }
  }, [previewCard, swapBusy]);

  // Picked a different printing → swap the rail preview (image, prices, TCG
  // link, and the printingId the add-to-wants/binder actions use).
  const onSwapPicked = useCallback((p: any) => {
    const name = p?.display_name || p?.name || previewCard?.name || 'card';
    setPreviewCard(printingToSwapOption(p, name).preview);
    setRailStatus({});
  }, [previewCard]);

  // Split-button add flow. The dialog closes itself synchronously after a
  // single "Add to X" (onSelectCard → onOpenChange(false) in the same tick),
  // so the added-card label is recorded optimistically BEFORE the request
  // resolves — otherwise the close-time flush would miss the last card.
  const openAddToBinder = useCallback((binderId: string) => {
    const binder = binderOptions.find((b) => b._id === binderId);
    setTargetBinderId(binderId); // remember as the new default target
    setAddDialog({ destination: 'binder', binderId, binderName: binder?.name });
  }, [binderOptions]);

  const flushAddDialog = useCallback(() => {
    if (addDialog && addedCardsRef.current.length > 0) {
      const dest = addDialog.destination === 'binder'
        ? `binder “${addDialog.binderName ?? 'Binder'}”`
        : 'wants list';
      const lines = addedCardsRef.current;
      setItems((prev) => [...prev, { kind: 'data', title: `Added to ${dest}`, lines }]);
      pendingContextRef.current.push(`Via card search the user just added to their ${dest}: ${lines.join('; ')}`);
      addedCardsRef.current = [];
    }
    setAddDialog(null);
  }, [addDialog]);

  const handleAddCardSelect = useCallback((selection: any) => {
    const target = addDialog;
    if (!target) return;
    const label = `${selection?.quantity ?? 1}× ${selection?.printing?.display_name || selection?.card?.name || 'card'}`;
    addedCardsRef.current.push(label);
    const run = target.destination === 'binder' && target.binderId
      ? addSearchSelectionToBinder(target.binderId, selection)
      : addSearchSelectionToWants(selection);
    run.then((outcome) => {
      if (!outcome.ok) {
        // Retract one occurrence if not yet flushed into the chat; the banner
        // covers the rest ("Add and Continue" can queue duplicate labels).
        const i = addedCardsRef.current.lastIndexOf(label);
        if (i !== -1) addedCardsRef.current.splice(i, 1);
        setErrorBanner(`Could not add ${label}: ${outcome.error}`);
      }
    });
  }, [addDialog]);

  const addPreviewToBinder = useCallback(async () => {
    if (!previewCard?.printingId || !targetBinderId) return;
    setRailStatus((s) => ({ ...s, binder: 'busy' }));
    const result = await bindersClient.addCardsToBinder(targetBinderId, [
      { printingId: previewCard.printingId, quantity: 1 } as any,
    ]);
    setRailStatus((s) => ({ ...s, binder: result.success ? 'done' : 'error' }));
    if (!result.success) setErrorBanner(result.error);
  }, [previewCard, targetBinderId]);

  return (
    <div className="flex gap-4 items-stretch h-full min-h-0">
    <div className="flex-1 min-w-0 flex flex-col min-h-0">
      <div className="flex flex-col gap-2 sm:gap-3 flex-1 min-h-0">
        {/* Header row: title + model picker + reset on one line; badges wrap below */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {/* Volzar, the Lightning Rod card art (cropped) — the page's mark.
                Same crop as app/volzar/icon.png (the tab favicon). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/volzar-icon.png"
              alt=""
              aria-hidden="true"
              className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-border"
            />
            <span className="font-bold text-lg mr-1 shrink-0">Volzar</span>
            {/* Model picker is superadmin-only (bake-offs). Everyone else runs
                the default model — hidden here and pinned server-side. */}
            {isSuperAdmin && (
              <Select value={model} onValueChange={setModel} disabled={busy}>
                <SelectTrigger className={`flex-1 min-w-0 sm:w-64 sm:flex-none text-base ${focusRing}`} aria-label="Model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m} value={m} className="text-base">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={reset}
              className={`ml-auto shrink-0 gap-1.5 ${focusRing}`}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> New chat
            </Button>
          </div>
          {(mockMode || sessionUsage.input > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              {mockMode && (
                <Badge className="gap-1.5 border-amber-500 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  Mock mode — no API key configured
                </Badge>
              )}
              {sessionUsage.input > 0 && (
                <Badge variant="secondary" className="gap-1 font-normal tabular-nums" title="Cumulative LLM usage this chat">
                  {(sessionUsage.input / 1000).toFixed(1)}k in · {(sessionUsage.output / 1000).toFixed(1)}k out
                  {sessionUsage.cost > 0 && <> · ${sessionUsage.cost.toFixed(4)}</>}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Quick actions — deterministic reads, zero AI tokens. One scrollable
            strip on mobile (chips don't wrap); wraps normally at sm+. */}
        <div
          className="flex items-center gap-2 overflow-x-auto -mx-3 px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-x-visible"
          role="group"
          aria-label="Instant actions (no AI)"
        >
          <span className="inline-flex shrink-0 items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
            <Zap className="h-3.5 w-3.5" aria-hidden="true" /> Instant:
          </span>
          {QUICK_ACTIONS.map((action) => {
            // My binders / My wants are split buttons: the label runs the
            // instant listing; the attached side button opens the card-search
            // dialog to ADD cards (binder side picks the target binder first).
            const addSide = action.id === 'binders' ? 'binder' : action.id === 'wants' ? 'wants' : null;
            const main = (
              <Button
                key={addSide ? undefined : action.id}
                variant="secondary"
                size="sm"
                disabled={busy || runningAction !== null}
                onClick={() => runQuickAction(action.id)}
                className={`shrink-0 gap-1.5 ${focusRing} ${addSide ? 'rounded-r-none' : ''}`}
                title="Runs directly against your data — no AI involved"
              >
                {runningAction === action.id && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                {action.label}
              </Button>
            );
            if (!addSide) return main;
            return (
              <span key={action.id} className="inline-flex shrink-0">
                {main}
                {addSide === 'binder' ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy || runningAction !== null || binderOptions.length === 0}
                        className={`rounded-l-none border-l border-border px-2 ${focusRing}`}
                        aria-label="Add cards to a binder"
                        title="Search cards and add them to a binder"
                      >
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuLabel>Add cards to…</DropdownMenuLabel>
                      {binderOptions.map((b) => (
                        <DropdownMenuItem key={b._id} onSelect={() => openAddToBinder(b._id)} className="text-base">
                          {b._id === targetBinderId ? '✓ ' : ''}{b.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy || runningAction !== null}
                    onClick={() => setAddDialog({ destination: 'wants' })}
                    className={`rounded-l-none border-l border-border px-2 ${focusRing}`}
                    aria-label="Add a card to your wants list"
                    title="Search cards and add them to your wants list"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </span>
            );
          })}
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || runningAction !== null}
            onClick={toggleToBeat}
            aria-expanded={toBeatOpen}
            className={`shrink-0 gap-1.5 ${focusRing}`}
            title="Featured tournament decks, scoped by hero or event — no AI"
          >
            Decks to beat
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || runningAction !== null}
            onClick={toggleArchetype}
            aria-expanded={archetypeOpen}
            className={`shrink-0 gap-1.5 ${focusRing}`}
            title="Compare all Decks to Beat of a hero — deterministic, no AI"
          >
            Compare archetype
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || runningAction !== null}
            onClick={toggleKit}
            aria-expanded={kitOpen}
            className={`shrink-0 gap-1.5 ${focusRing}`}
            title="A hero's curated card pool with types + rules text — no AI, and deck questions after it need no tool calls"
          >
            Hero kit
          </Button>
        </div>

        {/* Decks-to-beat picker — scope by hero (last N months) or by event */}
        {toBeatOpen && (
          <div className={`flex flex-wrap items-end gap-3 rounded-md border border-border bg-muted/30 dark:bg-muted p-3`}>
            <div className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-300">
              Browse by
              <div className="flex overflow-hidden rounded-md border border-border" role="group" aria-label="Browse decks to beat by">
                {(['hero', 'event'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setToBeatModeAndLoad(mode)}
                    aria-pressed={toBeatMode === mode}
                    className={`px-3 py-1.5 text-sm ${focusRing} ${
                      toBeatMode === mode
                        ? 'bg-primary font-semibold text-primary-foreground'
                        : 'bg-background hover:bg-muted'
                    }`}
                  >
                    {toBeatMode === mode ? '✓ ' : ''}{mode === 'hero' ? 'Hero' : 'Event'}
                  </button>
                ))}
              </div>
            </div>
            {toBeatMode === 'hero' ? (
              <PickerSelect
                label={`Hero (last ${TO_BEAT_MONTHS} months)`}
                wrapperClassName="w-full sm:w-auto"
                triggerClassName="w-full sm:min-w-[16rem]"
                value={toBeatHero}
                onValueChange={setToBeatHero}
                disabled={heroesLoading}
                placeholder={heroesLoading ? 'Loading heroes…' : heroes.length === 0 ? 'No featured decks found' : 'Select a hero'}
              >
                {heroes.map((h) => (
                  <SelectItem key={h.heroName} value={h.heroName} className="text-sm">
                    {h.displayName}{h.formats.length ? ` · ${h.formats.join('/')}` : ''}
                  </SelectItem>
                ))}
              </PickerSelect>
            ) : (
              <PickerSelect
                label={`Event (last ${TO_BEAT_MONTHS} months)`}
                wrapperClassName="w-full sm:w-auto"
                triggerClassName="w-full sm:min-w-[16rem]"
                value={toBeatEvent}
                onValueChange={setToBeatEvent}
                disabled={toBeatEventsLoading}
                placeholder={toBeatEventsLoading ? 'Loading events…' : toBeatEvents.length === 0 ? 'No events found' : 'Select an event'}
              >
                {toBeatEvents.map((e) => (
                  <SelectItem key={`${e.eventName}|${e.eventDate}`} value={e.eventName} className="text-sm">
                    {e.eventName} · {e.eventDate}{e.count ? ` · ${e.count} decks` : ''}
                  </SelectItem>
                ))}
              </PickerSelect>
            )}
            <Button
              size="sm"
              disabled={(toBeatMode === 'hero' ? !toBeatHero : !toBeatEvent) || busy || runningAction !== null}
              onClick={runToBeat}
              className={`gap-1.5 ${focusRing}`}
            >
              {runningAction === 'to-beat' && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Show decks
            </Button>
          </div>
        )}

        {/* Archetype comparison picker — instant, no-AI cross-deck consensus */}
        {archetypeOpen && (
          <div className={`flex flex-wrap items-end gap-3 rounded-md border border-border bg-muted/30 dark:bg-muted p-3`}>
            <PickerSelect
              label="Hero (Decks to Beat)"
              wrapperClassName="w-full sm:w-auto"
              triggerClassName="w-full sm:min-w-[16rem]"
              value={selectedHero}
              onValueChange={setSelectedHero}
              disabled={heroesLoading}
              placeholder={heroesLoading ? 'Loading heroes…' : heroes.length === 0 ? 'No featured decks found' : 'Select a hero'}
            >
              {heroes.map((h) => (
                <SelectItem key={h.heroName} value={h.heroName} className="text-sm">
                  {h.displayName}{h.formats.length ? ` · ${h.formats.join('/')}` : ''}
                </SelectItem>
              ))}
            </PickerSelect>
            <PickerSelect
              label="Window"
              triggerClassName="w-40"
              value={String(archetypeMonths)}
              onValueChange={(v) => setArchetypeMonths(Number(v))}
            >
              <SelectItem value="1" className="text-sm">Last 1 month</SelectItem>
              <SelectItem value="3" className="text-sm">Last 3 months</SelectItem>
              <SelectItem value="6" className="text-sm">Last 6 months</SelectItem>
              <SelectItem value="12" className="text-sm">Last 12 months</SelectItem>
            </PickerSelect>
            <Button
              size="sm"
              disabled={!selectedHero || busy || runningAction !== null}
              onClick={runArchetype}
              className={`gap-1.5 ${focusRing}`}
            >
              {runningAction === 'archetype' && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Compare
            </Button>
          </div>
        )}

        {/* Hero-kit picker — the curated pool for one hero + format */}
        {kitOpen && (
          <div className={`flex flex-wrap items-end gap-3 rounded-md border border-border bg-muted/30 dark:bg-muted p-3`}>
            <PickerSelect
              label="Format"
              triggerClassName="w-52"
              value={kitFormat}
              onValueChange={setKitFormatAndLoad}
            >
              <SelectItem value="Classic Constructed" className="text-sm">Classic Constructed</SelectItem>
              <SelectItem value="Silver Age" className="text-sm">Silver Age</SelectItem>
              <SelectItem value="Blitz" className="text-sm">Blitz</SelectItem>
              <SelectItem value="Living Legend" className="text-sm">Living Legend</SelectItem>
              <SelectItem value="Commoner" className="text-sm">Commoner</SelectItem>
            </PickerSelect>
            <PickerSelect
              label="Hero"
              wrapperClassName="w-full sm:w-auto"
              triggerClassName="w-full sm:min-w-[16rem]"
              value={kitHero}
              onValueChange={setKitHero}
              disabled={kitHeroesLoading}
              placeholder={kitHeroesLoading ? 'Loading heroes…' : kitHeroes.length === 0 ? 'No kits in this format' : 'Select a hero'}
            >
              {kitHeroes.map((h) => (
                <SelectItem key={h.heroName} value={h.heroName} className="text-sm">
                  {h.displayName}{h.kitCount ? ` · ${h.kitCount} list${h.kitCount === 1 ? '' : 's'}` : ''}
                </SelectItem>
              ))}
            </PickerSelect>
            <Button
              size="sm"
              disabled={!kitHero || busy || runningAction !== null}
              onClick={runKit}
              className={`gap-1.5 ${focusRing}`}
            >
              {runningAction === 'hero-kit' && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Show kit
            </Button>
          </div>
        )}

        {/* Thread */}
        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-label={`Chat with Volzar as ${username}`}
          className="flex-1 min-h-0 overflow-y-auto py-2 flex flex-col gap-3"
        >
          {items.length === 0 && (
            <p className="text-gray-600 dark:text-gray-300 text-sm m-auto text-center max-w-sm">
              Use the ⚡ instant buttons for your lists, or ask Volzar something that needs thinking —
              searches, suggestions, adding cards.
              {mockMode && ' (Mock mode: AI replies follow a fixed script; binder questions show the tool loop.)'}
            </p>
          )}
          {items.map((item, index) => {
            if (item.kind === 'user') {
              return (
                <div key={index} className="self-end max-w-[85%] rounded-lg bg-primary text-primary-foreground px-3.5 py-2 whitespace-pre-wrap">
                  {item.text}
                </div>
              );
            }
            if (item.kind === 'assistant') {
              return (
                <div key={index} className={`self-start max-w-[85%] rounded-lg bg-card border border-border px-3.5 py-2`}>
                  <MarkdownMessage
                    text={item.text}
                    index={cardIndex}
                    previewsByPid={previewsByPid}
                    onHoverCard={showPreview}
                  />
                  {item.streaming && <span className="animate-pulse" aria-hidden="true">▍</span>}
                </div>
              );
            }
            if (item.kind === 'data') {
              // The instant, no-AI action cluster. Rendered at BOTH the top and
              // bottom of the card so a tall result (long comparison / deck)
              // never scrolls its buttons out of reach after the auto-scroll.
              const cardActions = (
                <>
                  {item.tableRows && item.tableRows.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => copyList(index, item.copyHeader, item.tableRows!, item.sourceUrl)}
                        className={`inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted ${focusRing}`}
                        title="Copy as text (for Discord / trade posts)"
                      >
                        {copiedIdx === index
                          ? <><Check className="h-3.5 w-3.5 text-green-600" aria-hidden="true" />Copied</>
                          : <><Copy className="h-3.5 w-3.5" aria-hidden="true" />Copy</>}
                      </button>
                      {item.sourceUrl && (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-blue-700 dark:text-blue-400 hover:bg-muted ${focusRing}`}
                          title="Open on FaB Bazaar"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          Open
                        </a>
                      )}
                    </>
                  )}
                  {item.cards && item.cards.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDeckView({ title: item.title, subtitle: item.cardsSubtitle, cards: item.cards! })}
                      className={`inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-blue-700 dark:text-blue-400 hover:bg-muted ${focusRing}`}
                      title="View these cards as a grid"
                    >
                      <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                      View as cards
                    </button>
                  )}
                  {item.wantsAdd && item.wantsAdd.length > 0 && (
                    <button
                      type="button"
                      onClick={() => addMissingToWants(index, item.wantsAdd!)}
                      disabled={wantsAddStatus[index] === 'busy' || wantsAddStatus[index] === 'done'}
                      className={`inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-rose-700 dark:text-rose-400 hover:bg-muted disabled:opacity-60 ${focusRing}`}
                      title="Add every card you still need to your wants list — instant, no AI"
                    >
                      {wantsAddStatus[index] === 'busy' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        : wantsAddStatus[index] === 'done' ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-500" aria-hidden="true" />
                        : wantsAddStatus[index] === 'error' ? <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-500" aria-hidden="true" />
                        : <Heart className="h-3.5 w-3.5" aria-hidden="true" />}
                      {wantsAddStatus[index] === 'done' ? 'Added to wants' : `Add missing to wants (${item.wantsAdd.length})`}
                    </button>
                  )}
                  {item.deckPublicId && (
                    <button
                      type="button"
                      onClick={() => addDeckToMine(item.deckPublicId!)}
                      disabled={addingDeckId === item.deckPublicId}
                      className={`inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-emerald-700 dark:text-emerald-400 hover:bg-muted disabled:opacity-60 ${focusRing}`}
                      title="Copy this deck into your account"
                    >
                      {addingDeckId === item.deckPublicId
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        : <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />}
                      Add to my decks
                    </button>
                  )}
                  {item.deckPublicId && (
                    <button
                      type="button"
                      onClick={() => toggleMatchups(index, item.deckPublicId!, item.title)}
                      aria-expanded={!!matchupPanels[index]}
                      className={`inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-violet-700 dark:text-violet-400 hover:bg-muted ${focusRing}`}
                      title="Show this deck's configured matchup sideboard plans — instant, no AI"
                    >
                      {matchupPanels[index]?.status === 'loading'
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        : <Swords className="h-3.5 w-3.5" aria-hidden="true" />}
                      {matchupPanels[index] ? 'Hide matchups' : 'View matchups'}
                    </button>
                  )}
                </>
              );
              const hasActions = (item.tableRows?.length ?? 0) > 0
                || (item.cards?.length ?? 0) > 0
                || (item.wantsAdd?.length ?? 0) > 0
                || !!item.deckPublicId;
              return (
                <div key={index} className={`self-start w-full max-w-full rounded-lg border border-border bg-card px-3 py-2.5 sm:px-3.5`}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Zap className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    <span className="font-semibold min-w-0 truncate">{item.title}</span>
                    <span className="hidden sm:inline text-sm text-gray-600 dark:text-gray-300 shrink-0">· instant, no AI</span>
                    <div className="ml-auto shrink-0 flex items-center gap-1.5">
                      {cardActions}
                    </div>
                  </div>
                  {item.tableRows && item.tableRows.length > 0 && (
                    <CardTable rows={item.tableRows} onPreview={showPreview} noteHeader={item.tableNoteHeader} />
                  )}
                  {/* Non-table results render as wrapping lines (min-w-0/break-words)
                      so nothing is clipped and all text stays available for the AI
                      context; overflow-auto scrolls only if a token exceeds width. */}
                  {!(item.tableRows && item.tableRows.length > 0) && (
                  <ul className={`text-sm space-y-0.5 ${item.lines.length > 12 ? 'sm:columns-2 sm:gap-x-6' : ''}`}>
                    {item.lines.map((line, lineIndex) => {
                      // When a section table renders the cards (deck drills), drop
                      // the now-redundant card rows + section-header strings here,
                      // keeping only notes (color summary) + drill buttons (compare).
                      if (item.tableSections && item.tableSections.length > 0) {
                        if (typeof line === 'string') {
                          if (line.startsWith('—')) return null;
                        } else if (line.preview) {
                          return null;
                        }
                      }
                      if (typeof line === 'string') {
                        // Section headers ("— Maindeck (28) —") vs plain notes.
                        const isHeader = line.startsWith('—');
                        if (isHeader) {
                          return (
                            <li key={lineIndex} className="break-inside-avoid font-semibold text-gray-700 dark:text-gray-200 mt-1.5 first:mt-0 list-none">
                              {line}
                            </li>
                          );
                        }
                        // Non-header note (e.g. color summary): indent to align with card names.
                        return (
                          <li key={lineIndex} className="break-inside-avoid list-none flex items-baseline gap-1.5">
                            <span className="w-5 shrink-0" aria-hidden="true" />
                            <span className="min-w-0 break-words">{line}</span>
                          </li>
                        );
                      }
                      if (line.drill) {
                        const target = line.drill;
                        return (
                          <li key={lineIndex} className="break-inside-avoid list-none flex items-center gap-1.5">
                            <PitchGem pitch={line.pitch} />
                            <button
                              type="button"
                              onClick={() => drill(target)}
                              disabled={busy || runningAction !== null}
                              title={target.kind === 'deck-compare'
                                ? 'Compare this deck against your whole collection — instant, no AI'
                                : `Show contents of ${target.name} — instant, no AI`}
                              className={`min-w-0 break-words text-left underline underline-offset-2 text-blue-700 dark:text-blue-400 hover:text-blue-500 disabled:opacity-50 ${focusRing} rounded-sm`}
                            >
                              {line.text}
                            </button>
                          </li>
                        );
                      }
                      if (line.preview) {
                        const preview = line.preview;
                        return (
                          <li key={lineIndex} className="break-inside-avoid list-none flex items-center gap-1.5">
                            <PitchGem pitch={line.pitch} />
                            <span
                              tabIndex={0}
                              onMouseEnter={() => showPreview(preview)}
                              onFocus={() => showPreview(preview)}
                              onClick={() => showPreview(preview)}
                              className={`min-w-0 break-words cursor-default rounded-sm hover:text-blue-700 dark:hover:text-blue-400 ${focusRing}`}
                            >
                              {line.text}
                            </span>
                          </li>
                        );
                      }
                      return (
                        <li key={lineIndex} className="break-inside-avoid list-none flex items-center gap-1.5">
                          <PitchGem pitch={line.pitch} />
                          <span className="min-w-0 break-words">{line.text}</span>
                        </li>
                      );
                    })}
                  </ul>
                  )}
                  {item.tableSections && item.tableSections.length > 0 && (
                    <CardTable sections={item.tableSections} onPreview={showPreview} noteHeader={item.tableNoteHeader} maxHeightClass="max-h-[32rem]" className="mt-1" />
                  )}
                  {item.resultRows && item.resultRows.length > 0 && (
                    <div className="mt-1 max-h-96 overflow-y-auto overflow-x-auto">
                      <table className="w-full text-sm border-separate border-spacing-x-2 border-spacing-y-0.5">
                        <thead>
                          <tr className="text-left text-xs text-gray-600 dark:text-gray-400">
                            <th className="font-medium text-right">#</th>
                            <th className="font-medium">Deck</th>
                            <th className="font-medium">Opponent</th>
                            <th className="font-medium whitespace-nowrap">Date</th>
                            <th className="font-medium">Result</th>
                            <th><span className="sr-only">Analyze</span></th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.resultRows.map((r, i) => (
                            <tr key={i}>
                              <td className="align-middle text-right tabular-nums text-gray-500 dark:text-gray-400">{i + 1}</td>
                              <td className="align-middle break-words">{r.deckName}<span className="ml-1 text-xs text-gray-500 dark:text-gray-400">({r.playerHero})</span></td>
                              <td className="align-middle break-words">{r.opponentHero}</td>
                              <td className="align-middle tabular-nums whitespace-nowrap text-gray-600 dark:text-gray-400">{r.date}</td>
                              <td className="align-middle">
                                <span className={`font-semibold ${r.result === 'win' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                                  {r.result === 'win' ? 'WIN' : 'LOSS'}
                                </span>
                              </td>
                              <td className="align-middle whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => analyzeGame(r)}
                                  disabled={busy || runningAction !== null}
                                  title={`Volzar analyzes this game — uses AI (1 message)`}
                                  className={`inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-sm text-violet-700 dark:text-violet-400 hover:bg-muted disabled:opacity-50 ${focusRing}`}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src="/volzar-icon.png" alt="" aria-hidden="true" className="h-3.5 w-3.5 rounded-full object-cover" />
                                  Analyze
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {/* "View matchups" panel — the deck's configured sideboard
                      plans, expanded per-matchup into the pre-game Talishar
                      checklist (turn order, notes, side in/out). */}
                  {matchupPanels[index] && item.deckPublicId && (() => {
                    const panel = matchupPanels[index];
                    const openMatchup = panel.matchups.find((m) => m.heroId === panel.open) ?? null;
                    return (
                      <div data-testid="matchup-panel" className="mt-2 rounded-md border border-border p-2">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          <Swords className="h-3.5 w-3.5 shrink-0 text-violet-700 dark:text-violet-400" aria-hidden="true" />
                          <span className="text-sm font-semibold">Matchups{panel.status === 'done' ? ` · ${panel.matchups.length}` : ''}</span>
                          <a
                            href={`${process.env.NEXT_PUBLIC_APP_URL || 'https://fabbazaar.app'}/decks/${item.deckPublicId}/matchups`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`ml-auto inline-flex items-center gap-1 text-xs text-blue-700 dark:text-blue-400 hover:underline ${focusRing} rounded-sm`}
                          >
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            Matchups page
                          </a>
                        </div>
                        {panel.status === 'loading' && (
                          <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Loading matchups…
                          </div>
                        )}
                        {panel.status === 'error' && (
                          <p className="text-sm text-red-700 dark:text-red-400">Couldn&apos;t load matchups for this deck.</p>
                        )}
                        {panel.status === 'done' && panel.matchups.length === 0 && (
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            No matchups configured for this deck yet — add them on the matchups page.
                          </p>
                        )}
                        {panel.matchups.length > 0 && (
                          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Configured matchups">
                            {panel.matchups.map((m) => {
                              const active = panel.open === m.heroId;
                              return (
                                <button
                                  key={m.heroId}
                                  type="button"
                                  aria-pressed={active}
                                  onClick={() => setMatchupPanels((prev) => (prev[index]
                                    ? { ...prev, [index]: { ...prev[index], open: active ? null : m.heroId } }
                                    : prev))}
                                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm hover:bg-muted ${focusRing} ${active
                                    ? 'border-violet-500 bg-violet-500/10 font-semibold text-violet-800 dark:text-violet-300'
                                    : 'border-border'}`}
                                >
                                  {active && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                                  {matchupDisplayName(m.heroId)}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {openMatchup && (
                          <div className="mt-2 rounded-md border border-border bg-muted/30 p-2.5">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                              <span className="text-sm font-semibold">vs {matchupDisplayName(openMatchup.heroId)}</span>
                              {turnOrderLabel(openMatchup.preferredTurnOrder) && (
                                <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-800 dark:text-violet-300">
                                  {turnOrderLabel(openMatchup.preferredTurnOrder)}
                                </span>
                              )}
                            </div>
                            {openMatchup.notes && (
                              <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap mb-2">{openMatchup.notes}</p>
                            )}
                            {openMatchup.sideboard.in.length === 0 && openMatchup.sideboard.out.length === 0 ? (
                              <p className="text-sm text-gray-600 dark:text-gray-300 italic">No sideboard swaps — play the list as-is.</p>
                            ) : (() => {
                              const swapLookup = buildSwapLookup(item.tableSections ?? []);
                              return (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <SwapColumn kind="in" entries={aggregateSwaps(openMatchup.sideboard.in)} lookup={swapLookup} onHover={showPreview} />
                                  <SwapColumn kind="out" entries={aggregateSwaps(openMatchup.sideboard.out)} lookup={swapLookup} onHover={showPreview} />
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {/* Same actions repeated at the bottom — a tall card lands
                      scrolled to its end, so the header buttons are off-screen. */}
                  {hasActions && (
                    <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5 border-t border-border pt-2">
                      {cardActions}
                    </div>
                  )}
                </div>
              );
            }
            if (item.kind === 'confirm') {
              const argEntries = item.args && typeof item.args === 'object'
                ? Object.entries(item.args as Record<string, unknown>)
                : [];
              return (
                <div
                  key={index}
                  className="self-start w-full max-w-[85%] rounded-lg border border-amber-500/60 bg-amber-500/10 px-3.5 py-2.5"
                  role="group"
                  aria-label={`Confirmation required: ${item.name}`}
                >
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    Volzar wants to run {item.name}
                  </div>
                  {argEntries.length > 0 && (
                    <dl className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                      {argEntries.map(([key, value]) => {
                        // Resolve printing ids to card names so the user confirms
                        // "1× Avast Ye!", not a nanoid. Two arg shapes: an array of
                        // { printingId, quantity, category } (deck ops) or a bare
                        // string[] of printing ids (wants/binder removes).
                        const nameFor = (pid: unknown) =>
                          (typeof pid === 'string' && cardNameByPid.get(pid)) || (typeof pid === 'string' ? pid : 'card');
                        const rows = key === 'printings' && Array.isArray(value)
                          ? value.map((p: any) => `${p?.quantity ?? 1}× ${nameFor(p?.printingId)}${p?.category ? ` · ${p.category}` : ''}`)
                          : key === 'printingIds' && Array.isArray(value)
                            ? value.map((pid: unknown) => nameFor(pid))
                            : key === 'printingId'
                              ? [nameFor(value)]
                              : null;
                        if (rows) {
                          return (
                            <div key={key} className="flex flex-col gap-0.5">
                              <dt className="text-gray-600 dark:text-gray-300">cards:</dt>
                              <dd>
                                <ul className="ml-1 list-disc list-inside marker:text-amber-600 dark:marker:text-amber-400">
                                  {rows.map((r, i) => <li key={i} className="break-words">{r}</li>)}
                                </ul>
                              </dd>
                            </div>
                          );
                        }
                        return (
                          <div key={key} className="flex gap-1.5">
                            <dt className="text-gray-600 dark:text-gray-300">{key}:</dt>
                            <dd className="break-words">{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
                          </div>
                        );
                      })}
                    </dl>
                  )}
                  {item.status === 'pending' ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={item.submitting}
                        onClick={() => decideConfirmation(item.id, 'confirm')}
                        className={`gap-1.5 ${focusRing}`}
                      >
                        {item.submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                        Confirm
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={item.submitting}
                        onClick={() => decideConfirmation(item.id, 'deny')}
                        className={focusRing}
                      >
                        Deny
                      </Button>
                      <span className="text-xs text-gray-600 dark:text-gray-300">
                        This changes your collection — nothing runs until you decide.
                      </span>
                    </div>
                  ) : (
                    <div className="mt-1.5 flex items-center gap-1.5 text-sm">
                      {item.status === 'confirmed' ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" aria-hidden="true" />
                          Confirmed
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-red-600 dark:text-red-500" aria-hidden="true" />
                          Denied — nothing was removed
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            }
            // tool chip (+ optional structured card from the token-bypass channel)
            return (
              <div key={index} className="self-start flex flex-col gap-1.5">
                <Badge variant="secondary" className="gap-1.5 font-normal w-fit">
                  {item.status === 'running' && (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      Running {item.name}…
                    </>
                  )}
                  {item.status === 'ok' && (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-500" aria-hidden="true" />
                      {item.name} · {item.ms}ms
                    </>
                  )}
                  {item.status === 'error' && (
                    <>
                      <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-500" aria-hidden="true" />
                      {item.name} — failed
                    </>
                  )}
                </Badge>
                {(item.card || item.results) && (
                  <div className={`rounded-md border border-border bg-card px-3 py-2 text-sm w-full ${item.results ? '' : 'max-w-xl'}`}>
                    {item.card?.title && <div className="font-semibold">{item.card.title}</div>}
                    {item.card?.subtitle && <div className="text-gray-600 dark:text-gray-300">{item.card.subtitle}</div>}
                    {item.results && item.results.tableRows.length > 0 && (
                      // Same striped card table as binder/deck/kit cards —
                      // search results are cards too, keep them consistent.
                      <CardTable rows={item.results.tableRows} onPreview={showPreview} maxHeightClass="max-h-80" className="mt-1.5" />
                    )}
                    {item.card?.url && (
                      <a
                        href={item.card.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 underline underline-offset-2 mt-1.5 ${focusRing}`}
                      >
                        {item.results && item.results.total > item.results.shown
                          ? `+${item.results.total - item.results.shown} more — open in card search`
                          : 'Open in card search'}
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Thinking indicator — covers the silence between tool results and
            the model's next tokens (streaming text has its own cursor) */}
        {busy
          && !(items.at(-1)?.kind === 'assistant' && (items.at(-1) as any).streaming)
          && !(items.at(-1)?.kind === 'confirm' && (items.at(-1) as any).status === 'pending') && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 px-1" aria-live="polite">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Waiting for {model}…
          </div>
        )}

        {/* Error banner with one-click recovery */}
        {errorBanner && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-red-700 dark:text-red-400" role="alert">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <span className="text-sm break-words">
                {errorBanner.length > 220 ? `${errorBanner.slice(0, 220)}…` : errorBanner}
              </span>
              {!busy && apiMessages.some((m) => m.role === 'user') && (
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => retryLastTurn()} className={focusRing}>
                    Retry
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Composer */}
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (shouldSendOnEnter(e)) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={isMobile ? 'Ask Volzar…' : 'Ask Volzar… (Enter to send, Shift+Enter for a new line)'}
            aria-label="Message Volzar"
            rows={2}
            disabled={busy}
            className={`text-base resize-none ${focusRing}`}
          />
          {busy ? (
            <Button variant="outline" onClick={stop} aria-label="Stop" className={`h-11 rounded-full px-5 gap-2 shadow-sm ${focusRing}`}>
              <Square className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Stop</span>
            </Button>
          ) : (
            <Button
              onClick={send}
              disabled={!input.trim()}
              aria-label="Send"
              className={`h-11 rounded-full px-6 gap-2 font-medium shadow-sm transition-transform hover:-translate-y-px active:translate-y-0 disabled:shadow-none ${focusRing}`}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Send</span>
            </Button>
          )}
        </div>
      </div>
    </div>

    {/* Desktop card preview + action rail */}
    <div className="hidden lg:flex flex-col gap-3 w-64 shrink-0 overflow-y-auto">
      {previewCard ? (
        <CardPreviewPanel
          card={previewCard}
          railStatus={railStatus}
          onAddToWants={addPreviewToWants}
          onAddToBinder={addPreviewToBinder}
          onSwapPrinting={openSwap}
          swapBusy={swapBusy}
          binderOptions={binderOptions}
          targetBinderId={targetBinderId}
          onTargetBinderChange={setTargetBinderId}
        />
      ) : (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-gray-600 dark:text-gray-300">
          Hover a card in a list to preview it here
        </div>
      )}
    </div>

    {/* Mobile card preview — bottom sheet, opened by tapping a card name */}
    <Drawer open={mobilePreviewOpen && !!previewCard} onOpenChange={setMobilePreviewOpen}>
      <DrawerContent className="max-h-[92dvh]">
        <DrawerTitle className="sr-only">{previewCard?.name ?? 'Card preview'}</DrawerTitle>
        {previewCard && (
          <div className="overflow-y-auto px-4 pt-2 pb-[max(env(safe-area-inset-bottom),1rem)] flex flex-col gap-3">
            <CardPreviewPanel
              card={previewCard}
              imageClassName="max-h-[45dvh] w-auto mx-auto rounded-md"
              railStatus={railStatus}
              onAddToWants={addPreviewToWants}
              onAddToBinder={addPreviewToBinder}
              onSwapPrinting={openSwap}
              swapBusy={swapBusy}
              binderOptions={binderOptions}
              targetBinderId={targetBinderId}
              onTargetBinderChange={setTargetBinderId}
            />
          </div>
        )}
      </DrawerContent>
    </Drawer>
    {deckView && (
      <DeckCardsOverlay title={deckView.title} subtitle={deckView.subtitle} cards={deckView.cards} onClose={() => setDeckView(null)} />
    )}
    {previewCard?.printingId && swapCardUniqueId && (
      <ViewPrintingsDialog
        open={swapOpen}
        onOpenChange={setSwapOpen}
        cardName={previewCard.name}
        cardUniqueId={swapCardUniqueId}
        currentPrintingId={previewCard.printingId}
        onSelectPrinting={onSwapPicked}
      />
    )}
    <CardSearchDialog
      open={!!addDialog}
      onOpenChange={(open) => { if (!open) flushAddDialog(); }}
      onSelectCard={handleAddCardSelect}
      destination={addDialog?.destination ?? 'binder'}
    />
    </div>
  );
}
