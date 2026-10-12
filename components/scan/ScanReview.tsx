// components/scan/ScanReview.tsx — review what the scanner found and add it straight to a binder: each photo with a
// numbered box on every card it read (a card WITHOUT a box was missed), and one row per physical card with a crop of
// the user's photo next to our match, an "Add to <binder>" button (▾ for another binder) and Undo once added.
// Presentational: /scan owns the state and the binder calls.
"use client";

import { ArrowRight, Check, ChevronDown, CircleHelp, Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { getCardImageUrl } from "@/lib/utils";
import type { NameIndex } from "@/lib/scan/banner/name-match";
import NameAutocomplete from "@/components/scan/NameAutocomplete";
import PrintingChoice from "@/components/scan/PrintingChoice";
import { printingLine } from "@/lib/scan/banner/printing-options";
import { PrintingMetaChips } from "@/components/shared/PrintingMetaChips";
import { addableRowIds, type AddedTo, type BinderOption } from "@/lib/scan/banner/add-to-binder";

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";
const PITCH = { 1: "red", 2: "yellow", 3: "blue" } as Record<number, string>;
const PITCH_DOT = { 1: "bg-red-600", 2: "bg-yellow-400", 3: "bg-blue-600" } as Record<number, string>;
const SMALL_BTN = `rounded-md border border-gray-300 px-2.5 py-1 text-sm text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700 ${FOCUS_RING}`;

export type ReviewStatus = "ok" | "check";
export type BoxStatus = ReviewStatus | "reading";
export interface ReviewItem {
  id: string; photoId: string;
  /** number of its box on the photo; null = added by hand (the scan missed it) */
  n: number | null;
  /** data URL: the card cut out of the user's photo; null for cards added by hand */
  crop: string | null;
  name: string; status: ReviewStatus;
  printing: any | null; allPrintings: any[]; resolving: boolean;
  /** pitches this card name exists in; more than one + no settled pitch = the user picks */
  pitchOptions: Array<number | null>;
  /** found by a tap on a card the scan missed (name "" = the tap couldn't read it: ask for the name) */
  viaTap?: boolean;
  /** read by a paired phone (crop from the phone's photo; no box on a desktop photo) */
  fromPhone?: boolean;
  /** added to a binder (the row folds to "Added to … · Undo") */
  added?: AddedTo;
  /** the add (or undo) call is in flight */
  adding?: boolean;
  /** why the last add or undo failed */
  addError?: string;
}
export interface PhotoBox { id: string; n: number; cx: number; cy: number; w: number; h: number; angle: number; status: BoxStatus }
export interface ReviewPhoto {
  id: string; preview: string; width: number; height: number; boxes: PhotoBox[];
  /** full-resolution source for the desktop zoom lens (object URL of the original file) */
  zoomSrc?: string;
}

interface Props {
  photos: ReviewPhoto[];
  items: ReviewItem[];
  /** a scan has run: keep "Add a card we missed" around even when nothing was found or everything is added */
  hasScanned: boolean;
  onAddMissing: (name: string, printing?: any | null, printings?: any[]) => void;
  /** printings of a card name (all languages), for the name box's printing step */
  loadPrintings: (name: string) => Promise<any[]>;
  /** more buttons for the sticky action bar (the page's stage toggle) */
  extraActions?: ReactNode;
  /** the user tapped the photo at (fx, fy), fractions of its width/height — a card without a box */
  onTapPhoto: (photoId: string, fx: number, fy: number) => void;
  /** the card-name list (for name suggestions while typing) */
  nameIndex: NameIndex | null;
  /** "Yes, that's it" on a row we weren't sure about */
  onConfirm: (id: string) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string, printing?: any | null, printings?: any[]) => void;
  onPickPitch: (id: string, pitch: number) => void;
  /** the user picked another printing for a row ("Swap printing") */
  onChoosePrinting: (id: string, printing: any) => void;
  /** the user's binders (null = loading) and the one cards go to by default */
  binders: BinderOption[] | null;
  binder: BinderOption | null;
  /** add one row to a binder (the default one unless the row's ▾ picked another) */
  onAdd: (id: string, binderId: string) => void;
  onAddAll: () => void;
  onUndo: (id: string) => void;
}

const LENS = 176, ZOOM = 3;   // lens diameter (px) and magnification

function PhotoOverview({ photo, onTap }: { photo: ReviewPhoto; onTap: (photoId: string, fx: number, fy: number) => void }) {
  // desktop zoom lens: follows the mouse over the photo, drawn from the full-resolution original so names stay sharp.
  // pointer-events-none so a click still reaches the photo (tap-to-read); CSS shows it only for hover + fine pointer.
  const [lens, setLens] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  return (
    // capped at 60% of the screen height (via width, so the % boxes stay aligned): a portrait phone photo would
    // otherwise make the sticky column taller than the screen and push the action buttons off the top
    <figure className="w-full max-w-md rounded-lg border border-gray-200 dark:border-gray-700" style={{ maxWidth: `min(28rem, calc(60vh * ${(photo.width / photo.height).toFixed(4)}))` }}>
      {/* clips boxes that run past the photo's edge; a tap on a card WITHOUT a box asks for a closer look (taps on a box are
          ignored). Pointer-only on purpose: keyboard users have "Add a card we missed". */}
      <div className="relative cursor-crosshair overflow-hidden rounded-t-lg"
        onMouseMove={e => { const r = e.currentTarget.getBoundingClientRect(); setLens({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }); }}
        onMouseLeave={() => setLens(null)}
        onClick={e => {
          if ((e.target as HTMLElement).closest('[data-testid="scan-photo-box"]')) return;
          const r = e.currentTarget.getBoundingClientRect();
          onTap(photo.id, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
        }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local data URL of the scanned photo */}
      <img src={photo.preview} alt="Your scanned photo" className="block w-full" />
      {photo.boxes.map(b => (
        <div key={b.id} data-testid="scan-photo-box" aria-hidden
          className={`absolute rounded border-2 ${b.status === "ok" ? "border-green-500" : b.status === "reading" ? "animate-pulse border-dashed border-blue-500" : "border-dashed border-amber-400"}`}
          style={{ left: `${((b.cx - b.w / 2) / photo.width) * 100}%`, top: `${((b.cy - b.h / 2) / photo.height) * 100}%`, width: `${(b.w / photo.width) * 100}%`, height: `${(b.h / photo.height) * 100}%`, transform: `rotate(${b.angle}deg)` }}>
          <span className={`absolute left-0 top-0 rounded-br px-1.5 text-xs font-bold ${b.status === "ok" ? "bg-green-600 text-white" : b.status === "reading" ? "bg-blue-600 text-white" : "bg-amber-400 text-gray-900"}`}>
            {b.status === "reading" ? "looking…" : `${b.n}${b.status === "check" ? "?" : ""}`}
          </span>
        </div>
      ))}
      {lens && photo.zoomSrc && (
        <div data-testid="scan-photo-zoom" aria-hidden
          className="pointer-events-none absolute z-20 hidden rounded-full border-2 border-white ring-1 ring-gray-900/60 [@media(hover:hover)_and_(pointer:fine)]:block"
          style={{ width: LENS, height: LENS, left: lens.x - LENS / 2, top: lens.y - LENS / 2, backgroundImage: `url(${photo.zoomSrc})`, backgroundRepeat: "no-repeat",
            backgroundSize: `${lens.w * ZOOM}px ${lens.h * ZOOM}px`, backgroundPosition: `${LENS / 2 - lens.x * ZOOM}px ${LENS / 2 - lens.y * ZOOM}px` }} />
      )}
      </div>
      <figcaption className="px-2 py-1 text-sm text-gray-700 dark:text-gray-300">Cards without a box weren&apos;t read. Tap one and we&apos;ll take a closer look.</figcaption>
    </figure>
  );
}

function AddButton({ item, binders, binder, onAdd }: { item: ReviewItem; binders: BinderOption[] | null; binder: BinderOption | null; onAdd: Props["onAdd"] }) {
  const [others, setOthers] = useState(false);
  if (item.adding) return <span className="inline-flex items-center gap-1 px-1 text-sm text-gray-700 dark:text-gray-300"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Adding…</span>;
  if (!binder) return <span className="px-1 text-sm text-gray-700 dark:text-gray-300">{binders === null ? "Loading binders…" : "Make a binder above to add cards"}</span>;
  const rest = (binders ?? []).filter(b => b._id !== binder._id);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="inline-flex">
        <button type="button" onClick={() => onAdd(item.id, binder._id)}
          className={`inline-flex items-center gap-1 rounded-l-md border-2 border-green-600 px-2.5 py-0.5 text-sm font-medium text-green-800 hover:bg-green-50 dark:border-green-500 dark:text-green-300 dark:hover:bg-gray-700 ${rest.length ? "" : "rounded-r-md"} ${FOCUS_RING}`}>
          <Check className="h-4 w-4" aria-hidden />Add to {binder.name}
        </button>
        {rest.length > 0 && (
          <button type="button" onClick={() => setOthers(o => !o)} aria-expanded={others} aria-label="Choose another binder"
            className={`rounded-r-md border-2 border-l-0 border-green-600 px-1 text-green-800 hover:bg-green-50 dark:border-green-500 dark:text-green-300 dark:hover:bg-gray-700 ${FOCUS_RING}`}>
            <ChevronDown className="h-4 w-4" aria-hidden />
          </button>
        )}
      </span>
      {others && (
        <span className="flex w-full flex-wrap gap-1.5" role="group" aria-label="Other binders">
          {rest.map(b => <button key={b._id} type="button" onClick={() => { setOthers(false); onAdd(item.id, b._id); }} className={SMALL_BTN}>Add to {b.name}</button>)}
        </span>
      )}
    </span>
  );
}

function Row({ item, ...h }: { item: ReviewItem } & Omit<Props, "photos" | "items" | "hasScanned" | "onAddMissing" | "extraActions" | "onTapPhoto" | "onAddAll">) {
  const unread = item.name === "";                 // a tap we couldn't read: ask for the name straight away
  const [renaming, setRenaming] = useState(unread);
  // "Swap printing": the row's printings as quick text lines, same pitch as the card now (the colour buttons change pitch)
  const [swapList, setSwapList] = useState<any[] | null | undefined>(undefined);   // undefined = closed, null = loading
  const openSwap = () => {
    const samePitch = (ps: any[]) => (item.printing?.pitch ? ps.filter(x => x.pitch === item.printing.pitch) : ps);
    if (item.allPrintings.length) { setSwapList(samePitch(item.allPrintings)); return; }
    setSwapList(null);
    void h.loadPrintings(item.name).then(ps => setSwapList(samePitch(ps)));
  };
  const p = item.printing;
  // added to a binder: fold to one line (long scans keep only what still needs attention big)
  if (item.added && p) {
    const line = printingLine(p);
    return (
      <li data-testid="scan-review-row" className="rounded-lg border-2 border-green-600 px-2 py-1.5 dark:border-green-500" aria-busy={item.adding || undefined}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="w-6 shrink-0 text-center text-sm font-bold text-gray-700 dark:text-gray-300">{item.n ?? "+"}</span>
          {/* eslint-disable-next-line @next/next/no-img-element -- card images are CDN URLs (image_url) */}
          <img src={getCardImageUrl(p)} alt={`Our match: ${item.name}`} className="h-12 w-9 shrink-0 rounded object-cover" />
          <span className="font-medium text-gray-900 dark:text-gray-100">{item.name}</span>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-sm text-gray-700 dark:text-gray-300">
            {p.pitch ? <span className={`inline-block h-2.5 w-2.5 rounded-full ${PITCH_DOT[p.pitch]}`} aria-label={PITCH[p.pitch]} /> : null}
            <PrintingMetaChips set={p.set} foiling={p.foiling} rarity={p.rarity} setSize="md" className="shrink-0" />
            <span className="font-medium text-gray-900 dark:text-gray-100">{line.code}</span>
            <span className="rounded border border-gray-300 px-1 text-xs font-semibold text-gray-800 dark:border-gray-600 dark:text-gray-200">{line.language}</span>
            <span>{line.detailsBesideChips.join(" · ")} · {line.price}</span>
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-green-700 dark:text-green-400"><Check className="h-4 w-4" aria-hidden /> Added to {item.added.binderName}</span>
          {item.fromPhone ? <span className="text-sm text-gray-700 dark:text-gray-300">From your phone</span> : item.n === null ? <span className="text-sm text-gray-700 dark:text-gray-300">Added by you</span> : item.viaTap ? <span className="text-sm text-gray-700 dark:text-gray-300">Found by your tap</span> : null}
          {item.adding ? <Loader2 className="h-4 w-4 animate-spin text-gray-700 dark:text-gray-300" aria-label="Undoing" />
            : <button type="button" onClick={() => h.onUndo(item.id)} className={SMALL_BTN}>Undo</button>}
          {item.addError && <span className="w-full pl-8 text-sm text-red-700 dark:text-red-300" role="alert">{item.addError}</span>}
        </div>
      </li>
    );
  }
  const pitchUnsettled = item.pitchOptions.length > 1 && item.pitchOptions.every(o => o !== null);
  return (
    <li data-testid="scan-review-row" className={`rounded-lg border p-2 ${item.status === "check" ? "border-amber-400 dark:border-amber-600" : "border-gray-200 dark:border-gray-700"}`}>
      <div className="flex items-start gap-2 sm:gap-3">
        <span className="mt-1 w-6 shrink-0 text-center text-sm font-bold text-gray-700 dark:text-gray-300" aria-label={item.n === null ? "Added by you" : undefined}>{item.n ?? "+"}</span>
        {item.crop ? (
          // eslint-disable-next-line @next/next/no-img-element -- local data URL cut from the user's photo
          <img src={item.crop} alt={`Your photo of ${item.n === null ? item.name : `card ${item.n}`}`} className="h-28 w-20 shrink-0 rounded object-cover" />
        ) : (
          <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded border border-dashed border-gray-300 p-1 text-center text-xs text-gray-700 dark:border-gray-600 dark:text-gray-300">added by hand</div>
        )}
        <ArrowRight className="mt-12 h-4 w-4 shrink-0 text-gray-600 dark:text-gray-300" aria-hidden />
        {p ? (
          // eslint-disable-next-line @next/next/no-img-element -- card images are CDN URLs (image_url)
          <img src={getCardImageUrl(p)} alt={`Our match: ${item.name}`} className="h-28 w-20 shrink-0 rounded object-cover" />
        ) : (
          <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded border border-dashed border-gray-300 dark:border-gray-600">
            {item.resolving ? <Loader2 className="h-4 w-4 animate-spin text-gray-600 dark:text-gray-300" aria-label="Finding the card" /> : <span className="text-xs text-gray-700 dark:text-gray-300">no match</span>}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-base font-medium text-gray-900 dark:text-gray-100">{unread ? "We couldn't read this one" : `${item.name}${item.status === "check" ? "?" : ""}`}</p>
          {p && (() => {
            // what this printing IS, same as the printing list: set logo, foiling chip, rarity, number, language, set · edition, price
            const line = printingLine(p);
            return (
              <div className="flex flex-wrap items-center gap-x-1.5 text-sm text-gray-700 dark:text-gray-300">
                {p.pitch ? <span><span className={`mr-1 inline-block h-2.5 w-2.5 rounded-full ${PITCH_DOT[p.pitch]}`} aria-hidden />{PITCH[p.pitch]} ·</span> : null}
                <PrintingMetaChips set={p.set} foiling={p.foiling} rarity={p.rarity} setSize="md" className="shrink-0" />
                <span className="font-medium text-gray-900 dark:text-gray-100">{line.code}</span>
                <span className="rounded border border-gray-300 px-1 text-xs font-semibold text-gray-800 dark:border-gray-600 dark:text-gray-200">{line.language}</span>
                <span>{line.detailsBesideChips.join(" · ")} · <span className="font-medium text-gray-900 dark:text-gray-100">{line.price}</span></span>
              </div>
            );
          })()}
          <p className={`mt-1 inline-flex flex-wrap items-center gap-x-2 text-sm ${item.status === "ok" ? "text-gray-700 dark:text-gray-300" : "text-amber-800 dark:text-amber-300"}`}>
            {unread ? <span className="inline-flex items-center gap-1"><CircleHelp className="h-4 w-4" aria-hidden /> What&apos;s it called?</span>
              : item.status === "check" ? <span className="inline-flex items-center gap-1"><CircleHelp className="h-4 w-4" aria-hidden /> Not sure. Is this {item.name}?</span>
              : item.fromPhone ? <span>From your phone</span> : item.n === null ? <span>Added by you</span> : item.viaTap ? <span>Found by your tap</span> : null}
          </p>
          {pitchUnsettled && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
              Which colour?
              {item.pitchOptions.map(o => o !== null && (
                <button key={o} type="button" onClick={() => h.onPickPitch(item.id, o)} aria-pressed={p?.pitch === o}
                  className={`${SMALL_BTN} ${p?.pitch === o ? "border-2 border-blue-600 dark:border-blue-400" : ""}`}>
                  <span className={`mr-1 inline-block h-2.5 w-2.5 rounded-full ${PITCH_DOT[o]}`} aria-hidden />{PITCH[o]}{p?.pitch === o ? " ✓" : ""}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 pl-8">
            {item.status === "check" && !unread && <button type="button" onClick={() => h.onConfirm(item.id)} className={`rounded-md bg-blue-600 px-2.5 py-1 text-sm font-medium text-white hover:bg-blue-700 ${FOCUS_RING}`}>Yes, that&apos;s it</button>}
            {item.status === "ok" && !unread && p && <AddButton item={item} binders={h.binders} binder={h.binder} onAdd={h.onAdd} />}
            {p && <button type="button" onClick={() => (swapList === undefined ? openSwap() : setSwapList(undefined))} aria-expanded={swapList !== undefined} className={SMALL_BTN}>Swap printing</button>}
            {!unread && <button type="button" onClick={() => setRenaming(r => !r)} className={SMALL_BTN} aria-expanded={renaming}>Not this card?</button>}
            <button type="button" onClick={() => h.onRemove(item.id)} className={SMALL_BTN}>Remove</button>
          </div>
          {item.addError && <p className="mt-1 pl-8 text-sm text-red-700 dark:text-red-300" role="alert">{item.addError}</p>}
          {swapList !== undefined && (
            <div className="mt-2 pl-8">
              <PrintingChoice name={item.name} printings={swapList} currentId={p?.printing_id} cancelLabel="Keep this one"
                onCancel={() => setSwapList(undefined)} onChoose={pr => { h.onChoosePrinting(item.id, pr); setSwapList(undefined); }} />
            </div>
          )}
          {renaming && (
            <div className="mt-2 pl-8">
              <NameAutocomplete index={h.nameIndex} label="Card name" submitLabel="Use" loadPrintings={h.loadPrintings}
                onPick={(name, printing, printings) => { h.onRename(item.id, name, printing, printings); setRenaming(false); }} />
            </div>
          )}
    </li>
  );
}

function AddMissing({ onAdd, nameIndex, loadPrintings }: { onAdd: Props["onAddMissing"]; nameIndex: NameIndex | null; loadPrintings: Props["loadPrintings"] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className={`${SMALL_BTN} py-2 text-base`}>Add a card we missed</button>
      {open && <NameAutocomplete index={nameIndex} label="Name of the missed card" submitLabel="Add card" loadPrintings={loadPrintings}
        onPick={(name, printing, printings) => { onAdd(name, printing, printings); setOpen(false); }} />}
    </>
  );
}

export default function ScanReview({ photos, items, hasScanned, onAddMissing, extraActions, onTapPhoto, onAddAll, ...handlers }: Props) {
  const addable = addableRowIds(items).length;
  const unsure = items.filter(i => i.status === "check").length;
  if (!hasScanned && items.length === 0 && photos.length === 0) return null;
  // Desktop: two columns — left = action buttons + the photo(s), sticky under the site header, so checking row 9
  // against box 9 never means scrolling back up. Phone: the left column dissolves (display: contents) so the button bar
  // can stick for the whole list (sticky only holds within its parent), and the photo scrolls away normally.
  return (
    <section className="mt-6 lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-6" aria-label="Scanned cards">
      <div className="contents lg:sticky lg:top-20 lg:block lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
        <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-900 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:dark:bg-transparent">
          <AddMissing onAdd={onAddMissing} nameIndex={handlers.nameIndex} loadPrintings={handlers.loadPrintings} />
          {addable > 0 && handlers.binder && (
            <button type="button" onClick={onAddAll}
              className={`rounded-md bg-blue-600 px-4 py-2 text-base font-medium text-white hover:bg-blue-700 ${FOCUS_RING}`}>
              Add all {addable} to {handlers.binder.name}
            </button>
          )}
          {extraActions}
        </div>
        {photos.length > 0 && <div className="mt-3 space-y-3">{photos.map(p => <PhotoOverview key={p.id} photo={p} onTap={onTapPhoto} />)}</div>}
      </div>
      <div className="mt-5 lg:mt-0">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{items.length > 0 ? "What we found" : "Anything we missed?"}</h2>
        {items.length === 0 && <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">Add any card by name with &ldquo;Add a card we missed&rdquo;.</p>}
        {items.length > 0 && <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">Check each card and add it to your binder. Undo takes it back out.{unsure > 0 ? ` The ${unsure} marked “Not sure” need a closer look first.` : ""}</p>}
        {items.length > 0 && <ul className="mt-3 space-y-2">{items.map(i => <Row key={i.id} item={i} {...handlers} />)}</ul>}
      </div>
    </section>
  );
}
