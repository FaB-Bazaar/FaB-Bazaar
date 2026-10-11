// components/scan/ScanReview.tsx — review what the scanner found before it goes into Pending Import: each photo with a
// numbered box on every card it read (a card WITHOUT a box was missed), and one row per physical card with a crop of
// the user's photo next to our match. Presentational: /scan owns the state.
"use client";

import { ArrowRight, Check, CircleHelp, Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { getCardImageUrl } from "@/lib/utils";
import type { NameIndex } from "@/lib/scan/banner/name-match";
import NameAutocomplete from "@/components/scan/NameAutocomplete";
import PrintingChoice from "@/components/scan/PrintingChoice";
import { printingLine } from "@/lib/scan/banner/printing-options";

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
  /** the user confirmed this card (only confirmed cards go to the stage); names the user picked start confirmed */
  confirmed: boolean;
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
  /** a scan has run: keep "Add a card we missed" around even when nothing was found or everything is staged */
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
  onConfirm: (id: string) => void;
  onUnconfirm: (id: string) => void;
  onConfirmAll: () => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string, printing?: any | null, printings?: any[]) => void;
  onPickPitch: (id: string, pitch: number) => void;
  /** the user picked another printing for a row ("Swap printing") */
  onChoosePrinting: (id: string, printing: any) => void;
  onStageChecked: () => void;
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

function Row({ item, ...h }: { item: ReviewItem } & Omit<Props, "photos" | "items" | "onStageChecked" | "hasScanned" | "onAddMissing" | "extraActions" | "onTapPhoto" | "onConfirmAll">) {
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
  // confirmed and not being edited: fold to one line (long scans keep only what still needs attention big)
  if (item.confirmed && p && !renaming && swapList === undefined) {
    const line = printingLine(p);
    return (
      <li data-testid="scan-review-row" className="rounded-lg border-2 border-green-600 px-2 py-1.5 dark:border-green-500">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="w-6 shrink-0 text-center text-sm font-bold text-gray-700 dark:text-gray-300">{item.n ?? "+"}</span>
          {/* eslint-disable-next-line @next/next/no-img-element -- card images are CDN URLs (image_url) */}
          <img src={getCardImageUrl(p)} alt={`Our match: ${item.name}`} className="h-12 w-9 shrink-0 rounded object-cover" />
          <span className="font-medium text-gray-900 dark:text-gray-100">{item.name}</span>
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-sm text-gray-700 dark:text-gray-300">
            {p.pitch ? <span className={`inline-block h-2.5 w-2.5 rounded-full ${PITCH_DOT[p.pitch]}`} aria-label={PITCH[p.pitch]} /> : null}
            <span className="font-medium text-gray-900 dark:text-gray-100">{line.code}</span>
            <span className="rounded border border-gray-300 px-1 text-xs font-semibold text-gray-800 dark:border-gray-600 dark:text-gray-200">{line.language}</span>
            <span>{line.details.join(" · ")} · {line.price}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-green-700 dark:text-green-400"><Check className="h-4 w-4" aria-hidden /> Confirmed</span>
          {item.n === null ? <span className="text-sm text-gray-700 dark:text-gray-300">Added by you</span> : item.viaTap ? <span className="text-sm text-gray-700 dark:text-gray-300">Found by your tap</span> : null}
          <button type="button" onClick={() => h.onUnconfirm(item.id)} className={SMALL_BTN}>Undo</button>
          <button type="button" onClick={() => h.onRemove(item.id)} className={SMALL_BTN}>Remove</button>
        </div>
      </li>
    );
  }
  const pitchUnsettled = item.pitchOptions.length > 1 && item.pitchOptions.every(o => o !== null);
  return (
    <li data-testid="scan-review-row" className={`rounded-lg border p-2 ${item.confirmed ? "border-2 border-green-600 dark:border-green-500" : item.status === "check" ? "border-amber-400 dark:border-amber-600" : "border-gray-200 dark:border-gray-700"}`}>
      <div className="flex items-start gap-2 sm:gap-3">
        <span className="mt-1 w-6 shrink-0 text-center text-sm font-bold text-gray-700 dark:text-gray-300" aria-label={item.n === null ? "Added by you" : undefined}>{item.n ?? "+"}</span>
        {item.crop ? (
          // eslint-disable-next-line @next/next/no-img-element -- local data URL cut from the user's photo
          <img src={item.crop} alt={`Your photo of card ${item.n}`} className="h-28 w-20 shrink-0 rounded object-cover" />
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
            // what this printing IS, same words as the printing list: number, language, set · foiling · edition, price
            const line = printingLine(p);
            return (
              <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-gray-700 dark:text-gray-300">
                {p.pitch ? <span><span className={`mr-1 inline-block h-2.5 w-2.5 rounded-full ${PITCH_DOT[p.pitch]}`} aria-hidden />{PITCH[p.pitch]} ·</span> : null}
                <span className="font-medium text-gray-900 dark:text-gray-100">{line.code}</span>
                <span className="rounded border border-gray-300 px-1 text-xs font-semibold text-gray-800 dark:border-gray-600 dark:text-gray-200">{line.language}</span>
                <span>{line.details.join(" · ")} · <span className="font-medium text-gray-900 dark:text-gray-100">{line.price}</span></span>
              </p>
            );
          })()}
          <p className={`mt-1 inline-flex flex-wrap items-center gap-x-2 text-sm ${item.confirmed ? "text-green-700 dark:text-green-400" : item.status === "ok" ? "text-gray-700 dark:text-gray-300" : "text-amber-800 dark:text-amber-300"}`}>
            {unread ? <span className="inline-flex items-center gap-1"><CircleHelp className="h-4 w-4" aria-hidden /> What&apos;s it called?</span>
              : item.status === "check" ? <span className="inline-flex items-center gap-1"><CircleHelp className="h-4 w-4" aria-hidden /> Not sure. Is this {item.name}?</span>
              : <>
                  {item.confirmed && <span className="inline-flex items-center gap-1 font-semibold"><Check className="h-4 w-4" aria-hidden /> Confirmed</span>}
                  {item.n === null ? <span>Added by you</span> : item.viaTap ? <span>Found by your tap</span> : null}
                </>}
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
            {item.status === "ok" && !unread && p && (item.confirmed
              ? <button type="button" onClick={() => h.onUnconfirm(item.id)} className={SMALL_BTN}>Undo</button>
              : <button type="button" onClick={() => h.onConfirm(item.id)}
                  className={`inline-flex items-center gap-1 rounded-md border-2 border-green-600 px-2.5 py-0.5 text-sm font-medium text-green-800 hover:bg-green-50 dark:border-green-500 dark:text-green-300 dark:hover:bg-gray-700 ${FOCUS_RING}`}>
                  <Check className="h-4 w-4" aria-hidden />Confirm
                </button>)}
            {p && <button type="button" onClick={() => (swapList === undefined ? openSwap() : setSwapList(undefined))} aria-expanded={swapList !== undefined} className={SMALL_BTN}>Swap printing</button>}
            {!unread && <button type="button" onClick={() => setRenaming(r => !r)} className={SMALL_BTN} aria-expanded={renaming}>Not this card?</button>}
            <button type="button" onClick={() => h.onRemove(item.id)} className={SMALL_BTN}>Remove</button>
          </div>
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

export default function ScanReview({ photos, items, hasScanned, onAddMissing, onStageChecked, extraActions, onTapPhoto, onConfirmAll, ...handlers }: Props) {
  const ready = items.filter(i => i.confirmed && i.printing).length;
  const confirmable = items.filter(i => !i.confirmed && i.status === "ok" && i.printing && i.name).length;
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
          {confirmable > 0 && (
            <button type="button" onClick={onConfirmAll}
              className={`inline-flex items-center gap-1 rounded-md border-2 border-green-600 px-3 py-1.5 text-base font-medium text-green-800 hover:bg-green-50 dark:border-green-500 dark:text-green-300 dark:hover:bg-gray-700 ${FOCUS_RING}`}>
              <Check className="h-4 w-4" aria-hidden />Confirm all ({confirmable})
            </button>
          )}
          {items.length > 0 && (
            <button type="button" onClick={onStageChecked} disabled={ready === 0}
              className={`rounded-md bg-blue-600 px-4 py-2 text-base font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400 dark:disabled:bg-gray-600 ${FOCUS_RING}`}>
              Add {ready} confirmed card{ready === 1 ? "" : "s"} to stage
            </button>
          )}
          {extraActions}
        </div>
        {photos.length > 0 && <div className="mt-3 space-y-3">{photos.map(p => <PhotoOverview key={p.id} photo={p} onTap={onTapPhoto} />)}</div>}
      </div>
      <div className="mt-5 lg:mt-0">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{items.length > 0 ? "What we found" : "Anything we missed?"}</h2>
        {items.length === 0 && <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">Add any card by name with &ldquo;Add a card we missed&rdquo;.</p>}
        {items.length > 0 && <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">Confirm the ones that are right, then add them to the stage.{unsure > 0 ? ` The ${unsure} marked “Not sure” need a closer look.` : ""}</p>}
        {items.length > 0 && <ul className="mt-3 space-y-2">{items.map(i => <Row key={i.id} item={i} {...handlers} />)}</ul>}
      </div>
    </section>
  );
}
