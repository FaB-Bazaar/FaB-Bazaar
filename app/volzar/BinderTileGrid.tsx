'use client';

import Link from 'next/link';
import { Minus, Plus, ExternalLink, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { RarityIcon } from '@/components/shared/RarityIcon';
import { TcgAffiliateLink } from '@/components/tracking';
import type { CardRow, CardPreview } from './quick-actions';

// The chat column's binder view: 2-per-row tiles that mirror the binder
// page's BinderCard interface (image, name, collector/edition, type, the
// Market/High/Mid/Low price block, purchase link, rarity gem + foil pill,
// For Trade toggle, and the −/qty/+ · printing link · trash footer) — fed by
// CardRow data and the chat's own mutation plumbing instead of the binder
// page's dialogs.

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400';

// Foil pill treatment — mirrors BinderCard.getFoilingInfo (codes lowercase).
const FOIL_PILL: Record<string, { name: string; className: string }> = {
  r: { name: 'Rainbow Foil', className: 'bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 text-white' },
  c: { name: 'Cold Foil', className: 'bg-blue-600 text-white' },
  g: { name: 'Gold Foil', className: 'bg-yellow-500 text-black' },
  s: { name: 'Non-foil', className: 'bg-gray-500 text-white' },
};

const EDITION_NAME: Record<string, string> = { a: 'Alpha', f: '1st', u: 'UNL', n: '' };

function PriceLine({ label, value, qty, low = false }: { label: string; value?: number; qty: number; low?: boolean }) {
  const has = typeof value === 'number';
  return (
    <div className={`flex items-center justify-between text-xs ${low && has ? 'font-semibold text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
      <span className="text-gray-500 dark:text-gray-300">{label}:</span>
      <span className={!has ? 'text-gray-400 dark:text-gray-500' : undefined}>
        {!has ? 'N/A' : qty > 1 ? `$${value.toFixed(2)} × ${qty} = $${(value * qty).toFixed(2)}` : `$${value.toFixed(2)}`}
      </span>
    </div>
  );
}

export function BinderTileGrid({ rows, editable, onPreview, onImageClick, onAdjustQty, onToggleForTrade, onRemoveAll, onSwapPrinting, isRowBusy }: {
  rows: CardRow[];
  /** Row mutations available (own binder) — renders the toggle/stepper/trash. */
  editable: boolean;
  onPreview: (preview: CardPreview) => void;
  /** Card image click → the tile action menu (parity with the table thumbnails). */
  onImageClick?: (row: CardRow, e: React.MouseEvent) => void;
  onAdjustQty?: (row: CardRow, delta: 1 | -1) => void;
  onToggleForTrade?: (row: CardRow, forTrade: boolean) => void;
  onRemoveAll?: (row: CardRow) => void;
  /** Foil pill click — opens the printing swap picker (BinderCard parity). */
  onSwapPrinting?: (row: CardRow) => void;
  isRowBusy?: (row: CardRow) => boolean;
}) {
  return (
    <ul data-testid="chat-binder-tiles" className="grid grid-cols-2 gap-2 py-0.5">
      {rows.map((r, i) => {
        const show = () => onPreview(r.preview);
        const qty = r.qty ?? 1;
        const busy = isRowBusy?.(r) ?? false;
        const foil = r.foiling ? FOIL_PILL[r.foiling.toLowerCase()] : undefined;
        const edition = r.edition ? (EDITION_NAME[r.edition.toLowerCase()] ?? r.edition.toUpperCase()) : '';
        return (
          <li
            key={`${r.itemId ?? r.preview.printingId ?? r.name}-${i}`}
            data-binder-tile
            className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-gray-300 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800"
          >
            {/* Image — hover feeds the rail preview; click opens the action menu */}
            <div className="relative w-full bg-gray-50 p-2 dark:bg-gray-800" style={{ aspectRatio: '5/7' }}>
              <button
                type="button"
                data-strip-tile
                onMouseEnter={show}
                onFocus={show}
                onClick={(e) => { show(); onImageClick?.(r, e); }}
                aria-label={`Actions for ${r.name}`}
                title={onImageClick ? `${r.name} — click for actions` : r.name}
                className={`block h-full w-full rounded ${focusRing}`}
              >
                {r.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image} alt={r.name} loading="lazy" className="mx-auto h-full w-auto max-w-full object-contain" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-muted text-center text-xs text-gray-600 dark:text-gray-300">{r.name}</span>
                )}
              </button>
              {qty > 1 && (
                <span aria-label={`${qty} copies`} className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/80 px-2.5 py-1 text-xs font-bold text-white">
                  {qty}x
                </span>
              )}
            </div>

            {/* Info panel */}
            <div className="flex flex-1 flex-col p-2.5 text-gray-900 dark:text-gray-100">
              <div className="mb-1.5 text-sm font-semibold leading-tight">{r.name}</div>
              <div className="flex-1" />
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex min-w-0 items-center gap-1.5">
                    {r.collector && <span className="font-mono uppercase tracking-wide text-blue-600 dark:text-blue-400">{r.collector}</span>}
                    {edition && <span className="uppercase text-gray-500 dark:text-gray-300">• {edition}</span>}
                  </div>
                  {r.forTrade && <span className="shrink-0 font-semibold text-green-600 dark:text-green-400">For Trade</span>}
                </div>
                {r.type && <div className="truncate text-xs text-gray-500 dark:text-gray-300">{r.type}</div>}
                <div className="space-y-0.5">
                  <PriceLine label="Market" value={r.priceMarket} qty={qty} />
                  <PriceLine label="High" value={r.priceHigh} qty={qty} />
                  <PriceLine label="Mid" value={r.priceMid} qty={qty} />
                  <PriceLine label="Low" value={r.priceLow} qty={qty} low />
                </div>
                {r.preview.tcgplayerUrl && (
                  <div className="border-t border-gray-100 pt-1.5 text-xs dark:border-gray-600">
                    <TcgAffiliateLink
                      tcgplayerUrl={r.preview.tcgplayerUrl}
                      feature="VolzarBinderTile"
                      onClick={(e) => e.stopPropagation()}
                      className={`flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 ${focusRing}`}
                      title="Purchase on TCGPlayer"
                    >
                      <span>Available for purchase here</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/596dace2-8614-4efc-b58d-0b0ebdc0d300/public" alt="TCGPlayer" className="h-4 w-auto" />
                    </TcgAffiliateLink>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {r.rarity && <RarityIcon rarityCode={r.rarity} size="sm" />}
                  {foil && (
                    <button
                      type="button"
                      onClick={() => { if (editable) onSwapPrinting?.(r); }}
                      disabled={!editable || !onSwapPrinting}
                      title={editable && onSwapPrinting ? 'Click to change printing' : undefined}
                      className={`flex-1 rounded-full px-2 py-0.5 text-center text-xs ${foil.className} ${editable && onSwapPrinting ? 'hover:opacity-80' : 'cursor-default'} ${focusRing}`}
                    >
                      {foil.name}
                    </button>
                  )}
                </div>
              </div>

              {editable && (
                <div className="mt-2.5 flex justify-center border-t border-gray-300 pt-2.5 dark:border-gray-600">
                  <label className={`flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 ${r.forTrade ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    <Switch
                      checked={!!r.forTrade}
                      disabled={busy}
                      onCheckedChange={(checked) => onToggleForTrade?.(r, checked)}
                      className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4"
                    />
                    <span className={`text-xs font-medium ${r.forTrade ? 'text-green-700 dark:text-green-300' : 'text-gray-600 dark:text-gray-300'}`}>For Trade</span>
                  </label>
                </div>
              )}

              {editable && (
                <div className="mt-2.5 flex items-center justify-between border-t border-gray-300 pt-2.5 dark:border-gray-600">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onAdjustQty?.(r, -1)}
                      disabled={busy || qty <= 1}
                      aria-label="Decrease quantity"
                      className={`flex h-6 w-6 items-center justify-center rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-600 dark:hover:bg-gray-500 ${focusRing}`}
                    >
                      <Minus className="h-3 w-3" aria-hidden="true" />
                    </button>
                    <div className="min-w-5 text-center text-sm font-medium">{qty}</div>
                    <button
                      type="button"
                      onClick={() => onAdjustQty?.(r, 1)}
                      disabled={busy}
                      aria-label="Increase quantity"
                      className={`flex h-6 w-6 items-center justify-center rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-600 dark:hover:bg-gray-500 ${focusRing}`}
                    >
                      <Plus className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="flex gap-1">
                    {r.preview.printingId && (
                      <Link
                        href={`/printing/${r.preview.printingId}`}
                        title="View Printing Details"
                        className={`rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700 ${focusRing}`}
                      >
                        <ExternalLink className="h-4 w-4 text-blue-500" aria-hidden="true" />
                        <span className="sr-only">View printing details for {r.name}</span>
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemoveAll?.(r)}
                      disabled={busy}
                      aria-label={`Remove ${r.name} from binder`}
                      title="Remove from binder (all copies, with Undo)"
                      className={`rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900 ${focusRing}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
