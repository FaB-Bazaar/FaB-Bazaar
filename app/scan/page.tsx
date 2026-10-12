// app/scan/page.tsx — scan cards straight into a binder. The in-browser banner scanner (components/scan/useBannerScanner
// → lib/scan/banner) reads each card's NAME on this device; recognised cards go into a REVIEW list
// (components/scan/ScanReview): a numbered box per card on the photo (no box = missed) and one row per card, the user's
// photo next to our match. No stage: each row has "Add to <binder>" (the default binder at the top — BinderBar —
// remembered between visits), "Add all", and Undo, which takes back exactly that row's copies (removeCopies).
// Rollout-gated (lib/scan/scan-access.ts). Phone pairing: PhonePairPanel here, PhoneScanner on /scan?pair=CODE.
"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useAuth } from "@/contexts/AuthContext";
import { canUseScanner } from "@/lib/scan/scan-access";
import { AlertCircle, Camera, ImagePlus, Loader2 } from "lucide-react";
import { useBannerScanner, toCanvas, photoPreview } from "@/components/scan/useBannerScanner";
import ScanReview, { type ReviewItem, type ReviewPhoto, type ReviewStatus } from "@/components/scan/ScanReview";
import { cutRegion } from "@/lib/scan/banner/find-banners";
import { matchName } from "@/lib/scan/banner/name-match";
import { cardRegionFromBanner } from "@/lib/scan/banner/review";
import { addableRowIds, addedFromResult, pickDefaultBinder, type BinderOption } from "@/lib/scan/banner/add-to-binder";
import { estimateCardWidth } from "@/lib/scan/banner/read-at-point";
import type { RgbImage } from "@/lib/scan/banner/find-banners";
import { defaultScanPrinting } from "@/lib/scan/banner/printing-options";
import { bindersClient, searchClient } from "@/lib/client";
import { generateUniqueBinderSlug } from "@/lib/utils";
import { isHeicPhoto } from "@/lib/scan/banner/photo-errors";
import BinderBar from "@/components/scan/BinderBar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import PhonePairPanel from "@/components/scan/PhonePairPanel";
import PhoneScanner from "@/components/scan/PhoneScanner";
import type { ScanSessionItem } from "@/lib/scan/session-store";

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";
const NEAR_MISS_SCORE = -0.05;   // unconfirmed reads at or below this are worth a "Check" row; type lines / rules text score >= 0

const PITCH_WORD = { 1: "red", 2: "yellow", 3: "blue" } as Record<number, string>;
// per-viewer conveniences only (CLAUDE.md: wrap browser storage, the page works without it)
const BINDER_KEY = "scan.binderId", TRADE_KEY = "scan.forTrade";
const readPref = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const writePref = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode: not remembered */ } };
/** Photo box = the name banner we read, padded a little: exact, and never overlaps the next card (a guessed card
 *  outline did on crowded table photos). */
const bannerBox = (r: { cx: number; cy: number; w: number; h: number; angle: number }) => ({ cx: r.cx, cy: r.cy, w: r.w * 1.06, h: r.h * 1.7, angle: r.angle });

export default function ScanPage() {
  // useSearchParams (?pair=) needs a Suspense boundary
  return <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-700 dark:text-gray-300" aria-label="Loading" /></div>}><ScanPageInner /></Suspense>;
}

function ScanPageInner() {
  const pairCode = useSearchParams().get("pair");
  const { status: sessionStatus } = useSession();
  const { user } = useAuth();
  const signedIn = sessionStatus === "authenticated";
  // AuthContext fills `user` one render after the session resolves; gate on both to avoid a flash.
  const allowed = signedIn && !!user && canUseScanner(user);

  if (sessionStatus === "loading" || (signedIn && !user)) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-700 dark:text-gray-300" aria-label="Loading" /></div>;
  }
  if (!signedIn) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Camera className="mx-auto h-10 w-10 text-gray-700 dark:text-gray-300" aria-hidden />
        <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-gray-100">Scan cards into your collection</h1>
        <p className="mt-2 text-base text-gray-700 dark:text-gray-300">Sign in to photograph cards and add them to a binder.</p>
        <Link href={`/auth/login?callbackUrl=${encodeURIComponent(pairCode ? `/scan?pair=${pairCode}` : "/scan")}`} className={`mt-6 inline-block rounded-md bg-blue-600 px-5 py-2.5 text-base font-medium text-white hover:bg-blue-700 ${FOCUS_RING}`}>Sign in</Link>
      </div>
    );
  }
  if (!allowed) {
    // Rollout gate (lib/scan/scan-access.ts). Static panel — never redirect during render.
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Camera className="mx-auto h-10 w-10 text-gray-700 dark:text-gray-300" aria-hidden />
        <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-gray-100">Card scanning isn&apos;t available on your account yet</h1>
        <p className="mt-2 text-base text-gray-700 dark:text-gray-300">It&apos;s being tested with a small group first. In the meantime you can add cards from your collection page.</p>
        <Link href="/collection" className={`mt-6 inline-block rounded-md border border-gray-300 px-5 py-2.5 text-base font-medium text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700 ${FOCUS_RING}`}>Go to your collection</Link>
      </div>
    );
  }
  if (pairCode) {
    // the phone side of pairing: read cards here, review them on the computer
    return (
      <div className="mx-auto max-w-lg px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Scan cards</h1>
        <div className="mt-3"><PhoneScanner code={pairCode.toUpperCase()} /></div>
      </div>
    );
  }
  return <ScanAndImport />;
}

function ScanAndImport() {
  const scanner = useBannerScanner();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<ReviewPhoto[]>([]);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [hasScanned, setHasScanned] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [binders, setBinders] = useState<BinderOption[] | null>(null);
  const [binderId, setBinderId] = useState<string | null>(null);
  const [forTrade, setForTrade] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  // each scanned photo stays in memory (full scan resolution) while it has cards on screen, so a tap on a card the
  // scan missed can be read closely; dropped once the photo leaves the review
  const photoData = useRef(new Map<string, { image: RgbImage; cardW: number; zoomUrl: string }>());
  useEffect(() => {
    const live = new Set(photos.map(p => p.id));
    for (const [id, d] of photoData.current) if (!live.has(id)) { URL.revokeObjectURL(d.zoomUrl); photoData.current.delete(id); }
  }, [photos]);
  useEffect(() => () => { for (const d of photoData.current.values()) URL.revokeObjectURL(d.zoomUrl); }, []);

  // the user's binders; the default is the one used last time (else the first)
  useEffect(() => {
    setForTrade(readPref(TRADE_KEY) === "1");
    void bindersClient.getUserBinders().then(res => {
      const list: BinderOption[] = res.success ? (res.data as any).binders ?? [] : [];
      setBinders(list);
      setBinderId(pickDefaultBinder(list, readPref(BINDER_KEY))?._id ?? null);
    });
  }, []);
  const binder = binders?.find(b => b._id === binderId) ?? null;
  const pickBinder = (id: string) => { setBinderId(id); writePref(BINDER_KEY, id); };
  const pickForTrade = (v: boolean) => { setForTrade(v); writePref(TRADE_KEY, v ? "1" : "0"); };
  const createBinder = async (name: string): Promise<string | null> => {
    const slug = generateUniqueBinderSlug(name, (binders ?? []).map(b => b.slug ?? ""));
    const res = await bindersClient.createBinder({ name, slug });
    if (!res.success) return res.error || "Couldn't make the binder";
    const made = res.data as any as BinderOption;
    setBinders(prev => [...(prev ?? []), made]);
    pickBinder(made._id);
    return null;
  };

  /** Look up each card's printings (same bulk name search as /browse) and pick the default one. */
  const resolve = useCallback(async (entries: Array<{ id: string; name: string; pitch: number | null }>) => {
    const keyOf = (e: { name: string; pitch: number | null }) => `${e.name}|${e.pitch ?? ""}`;
    const unique = [...new Map(entries.map(e => [keyOf(e), e])).values()];
    const res = await searchClient.bulkSearchByNames(unique.map(e => ({ name: e.name, color: e.pitch ? PITCH_WORD[e.pitch] : undefined, exact: true })));
    const printings = new Map<string, any[]>();
    if (res.success) res.data.results.forEach((r, i) => printings.set(keyOf(unique[i]), r.printings));
    setItems(prev => prev.map(it => {
      const e = entries.find(x => x.id === it.id); if (!e) return it;
      const ps = printings.get(keyOf(e)) ?? [];
      return { ...it, resolving: false, printing: ps.length ? defaultScanPrinting(ps) : null, allPrintings: ps };
    }));
  }, []);

  const setBoxStatus = (id: string, st: ReviewStatus | null) =>
    setPhotos(prev => prev.map(ph => ({ ...ph, boxes: st ? ph.boxes.map(b => (b.id === id ? { ...b, status: st } : b)) : ph.boxes.filter(b => b.id !== id) }))
      .filter(ph => ph.boxes.length > 0));

  const scanFiles = useCallback(async (files: FileList | File[]) => {
    // HEIC files often arrive with an EMPTY type: keep them so the user gets the HEIC explanation, not silence
    const list = Array.from(files).filter(f => f.type.startsWith("image/") || isHeicPhoto(f));
    if (list.length === 0 || !scanner.ready || busyRef.current) return;
    busyRef.current = true; setBusy(true); setScanError(null);
    let found = 0, toCheck = 0;
    try {
      for (const [i, file] of list.entries()) {
        const { result, image } = await scanner.scanFile(file, s => setStatus(list.length > 1 ? `Photo ${i + 1} of ${list.length}: ${s}` : s));
        const keep = result.cards.filter(c => c.accepted || (c.card && c.score <= NEAR_MISS_SCORE));
        found += keep.filter(c => c.accepted).length; toCheck += keep.filter(c => !c.accepted).length;
        if (keep.length === 0) continue;
        const photoId = crypto.randomUUID();
        const zoomUrl = URL.createObjectURL(file);   // the original file, full resolution, for the desktop zoom lens
        photoData.current.set(photoId, { image, cardW: estimateCardWidth(result.cards.filter(c => c.accepted).map(c => c.rect.w), image.width), zoomUrl });
        const fresh = keep.map((c, k) => {
          const region = cardRegionFromBanner(c.rect);
          return {
            region, banner: bannerBox(c.rect), pitch: c.pitch,
            item: { id: crypto.randomUUID(), photoId, n: k + 1, crop: toCanvas(cutRegion(image, region, 160)).toDataURL("image/jpeg", 0.8),
              name: c.card, status: (c.accepted ? "ok" : "check") as ReviewStatus, printing: null, allPrintings: [], resolving: true, pitchOptions: c.pitchOptions },
          };
        });
        setPhotos(prev => [...prev, { id: photoId, preview: photoPreview(image), zoomSrc: zoomUrl, width: image.width, height: image.height,
          boxes: fresh.map(f => ({ id: f.item.id, n: f.item.n, ...f.banner, status: f.item.status })) }]);
        setItems(prev => [...prev, ...fresh.map(f => f.item)]);
        void resolve(fresh.map(f => ({ id: f.item.id, name: f.item.name, pitch: f.pitch })));
      }
      setStatus(found || toCheck
        ? `Found ${found} card${found === 1 ? "" : "s"}${toCheck ? `, and ${toCheck} we're not sure about` : ""}. Check them below.`
        : "No card names found. Try a sharper photo, closer to the cards.");
    } catch (e) {
      setScanError(e instanceof Error ? e.message : String(e)); setStatus(null);
    } finally { busyRef.current = false; setBusy(false); setHasScanned(true); }
  }, [scanner, resolve]);

  // paste a screenshot / photo
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => { const files = Array.from(e.clipboardData?.files ?? []); if (files.length) void scanFiles(files); };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [scanFiles]);

  const review = {
    onConfirm: (id: string) => { setItems(prev => prev.map(i => (i.id === id ? { ...i, status: "ok" } : i))); setBoxStatus(id, "ok"); },
    onRemove: (id: string) => { setItems(prev => prev.filter(i => i.id !== id)); setBoxStatus(id, null); },
    onRename: (id: string, typed: string, printing?: any | null, printings?: any[]) => {
      const m = scanner.index ? matchName(scanner.index, typed) : null;
      const name = m?.card || typed;
      const settled = m && m.pitches.length === 1 ? m.pitches[0] : null;
      const chosen = printing ?? (printings?.length ? defaultScanPrinting(printings) : null);
      setItems(prev => prev.map(i => (i.id === id ? { ...i, name, status: "ok", printing: chosen, allPrintings: printings ?? [], resolving: !chosen, pitchOptions: m?.pitches ?? [] } : i)));
      setBoxStatus(id, "ok");
      if (!chosen) void resolve([{ id, name, pitch: settled }]);
    },
    onPickPitch: (id: string, pitch: number) => {
      const it = items.find(i => i.id === id); if (!it) return;
      setItems(prev => prev.map(i => (i.id === id ? { ...i, resolving: true } : i)));
      void resolve([{ id, name: it.name, pitch }]);
    },
    onChoosePrinting: (id: string, printing: any) => setItems(prev => prev.map(i => (i.id === id ? { ...i, printing } : i))),
  };

  /** A tap on a card without a box: targeted read there. Read -> a "Found by your tap" row; not read -> a row asking for
   *  the name. Either way the card gets a numbered box on the photo. */
  const tapPhoto = async (photoId: string, fx: number, fy: number) => {
    const data = photoData.current.get(photoId); if (!data) return;
    const { image, cardW } = data;
    const tap = { x: fx * image.width, y: fy * image.height };
    const readingId = crypto.randomUUID();
    const guess = { cx: tap.x, cy: tap.y, w: cardW, h: cardW * (88 / 63), angle: 0 };   // the card, centred on the tap
    setPhotos(prev => prev.map(ph => (ph.id === photoId ? { ...ph, boxes: [...ph.boxes, { id: readingId, n: 0, ...guess, status: "reading" }] } : ph)));
    setStatus("Taking a closer look…");
    let hit: Awaited<ReturnType<typeof scanner.readAt>> = null;
    try { hit = await scanner.readAt(image, tap, cardW); } catch { hit = null; }
    const region = hit ? cardRegionFromBanner(hit.card.rect) : guess;
    const id = crypto.randomUUID();
    const crop = toCanvas(cutRegion(image, region, 160)).toDataURL("image/jpeg", 0.8);
    // next number on this photo (state updaters below must stay pure: React runs them twice in development)
    const n = Math.max(0, ...(photos.find(ph => ph.id === photoId)?.boxes.map(b => b.n) ?? [])) + 1;
    setItems(prev => [...prev, { id, photoId, n, crop, name: hit?.card.card ?? "", status: hit ? "ok" : "check", printing: null, allPrintings: [],
      resolving: !!hit, pitchOptions: hit?.card.pitchOptions ?? [], viaTap: true }]);
    setPhotos(prev => prev.map(ph => (ph.id !== photoId ? ph
      : { ...ph, boxes: [...ph.boxes.filter(b => b.id !== readingId), { id, n, ...(hit ? bannerBox(hit.card.rect) : guess), status: hit ? "ok" : "check" }] })));
    setStatus(hit ? `Found ${hit.card.card}. Check it below.` : "Couldn't read that one. Type its name below.");
    if (hit) void resolve([{ id, name: hit.card.card, pitch: hit.card.pitch }]);
  };

  /** Cards a paired phone read: review rows like any other ("From your phone"). A reconnecting event stream can replay
   *  items, so they're taken once by id. */
  const seenRemote = useRef(new Set<string>());
  const addRemote = (it: ScanSessionItem) => {
    if (seenRemote.current.has(it.id)) return;
    seenRemote.current.add(it.id);
    setHasScanned(true);
    setItems(prev => [...prev, { id: it.id, photoId: "", n: null, crop: it.crop, name: it.name, status: it.status, printing: null, allPrintings: [],
      resolving: true, pitchOptions: it.pitchOptions, fromPhone: true }]);
    void resolve([{ id: it.id, name: it.name, pitch: it.pitch }]);
  };

  /** A card the scan missed entirely: typed name (close is fine) -> best card name -> a hand-added review row. */
  const addMissing = (typed: string, printing?: any | null, printings?: any[]) => {
    const m = scanner.index ? matchName(scanner.index, typed) : null;
    const name = m?.card || typed;
    const id = crypto.randomUUID();
    const chosen = printing ?? (printings?.length ? defaultScanPrinting(printings) : null);
    setItems(prev => [...prev, { id, photoId: "", n: null, crop: null, name, status: "ok", printing: chosen, allPrintings: printings ?? [], resolving: !chosen, pitchOptions: m?.pitches ?? [] }]);
    if (!chosen) void resolve([{ id, name, pitch: m && m.pitches.length === 1 ? m.pitches[0] : null }]);
  };

  /** Every printing of a card name (all languages), for the name box's text list of printings. */
  const loadPrintings = async (name: string): Promise<any[]> => {
    const res = await searchClient.bulkSearchByNames([{ name, exact: true }]);
    return res.success ? res.data.results[0]?.printings ?? [] : [];
  };

  const patchItem = (id: string, patch: Partial<ReviewItem>) => setItems(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)));

  /** One card straight into a binder (one copy); the row records where it went so Undo can take exactly it back. */
  const addRow = async (id: string, toBinderId: string) => {
    const it = items.find(i => i.id === id), target = binders?.find(b => b._id === toBinderId);
    if (!it?.printing || !target || it.added || it.adding) return;
    patchItem(id, { adding: true, addError: undefined });
    const res = await bindersClient.addCardsToBinder(target._id, [{ printingId: it.printing.printing_id, quantity: 1, forTrade, condition: "NM" } as any]);
    const out = res.success ? addedFromResult(res.data, target) : { ok: false as const, error: res.error || "Couldn't add the card" };
    patchItem(id, out.ok ? { adding: false, added: out.added } : { adding: false, addError: `Couldn't add it: ${out.error}` });
  };
  const addAll = async () => {
    if (!binder) return;
    const ids = addableRowIds(items);
    for (const id of ids) await addRow(id, binder._id);   // one at a time: each row shows its own result
    setStatus(`Added ${ids.length} card${ids.length === 1 ? "" : "s"} to ${binder.name}.`);
  };
  const undoRow = async (id: string) => {
    const it = items.find(i => i.id === id); if (!it?.added || it.adding) return;
    patchItem(id, { adding: true, addError: undefined });
    const res = await bindersClient.removeCopies(it.added.binderId, it.added.inventoryItemId, it.added.quantity);
    patchItem(id, res.success ? { adding: false, added: undefined } : { adding: false, addError: `Couldn't undo: ${res.error}` });
  };

  const shown = status ?? (scanner.loadError ? `Couldn't load card names: ${scanner.loadError}`
    : scanner.ready ? "Ready to scan. Photograph a binder page or cards laid out on a table." : "Loading card names…");

  return (
    <div className="bg-white dark:bg-gray-900 min-h-screen">
      <div>
        <div className="container mx-auto px-4 py-6 sm:py-8">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">Scan cards</h1>
            </div>
            <p className="mt-1 text-base text-gray-700 dark:text-gray-300">
              Snap a binder page or some cards on a table. We read the card names right here on your device, then you check what we found and add them to a binder.
            </p>

            <BinderBar binders={binders} binderId={binderId} onPick={pickBinder} forTrade={forTrade} onForTrade={pickForTrade} onCreate={createBinder} />

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); void scanFiles(e.dataTransfer.files); }}
              className={`mt-5 rounded-lg border-2 border-dashed p-5 text-center ${dragOver ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-300 dark:border-gray-600"}`}
            >
              <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { if (e.target.files) void scanFiles(e.target.files); e.target.value = ""; }} data-testid="scan-camera-input" />
              <input ref={fileInput} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { if (e.target.files) void scanFiles(e.target.files); e.target.value = ""; }} data-testid="scan-file-input" />
              <div className="flex flex-wrap justify-center gap-3">
                <button type="button" disabled={!scanner.ready || busy} onClick={() => cameraInput.current?.click()}
                  className={`inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2.5 text-base font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300 dark:disabled:bg-gray-600 ${FOCUS_RING}`}>
                  <Camera className="h-5 w-5" aria-hidden /> Take a photo
                </button>
                <button type="button" disabled={!scanner.ready || busy} onClick={() => fileInput.current?.click()}
                  className={`inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2.5 text-base font-medium text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-dashed disabled:text-gray-600 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700 dark:disabled:text-gray-300 ${FOCUS_RING}`}>
                  <ImagePlus className="h-5 w-5" aria-hidden /> Choose photos
                </button>
              </div>
              <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">…or drop images here, or paste one.</p>
              <p className="mt-3 text-base text-gray-900 dark:text-gray-100" role="status" aria-live="polite">
                {busy && <Loader2 className="mr-1 inline h-4 w-4 animate-spin" aria-hidden />}{shown}
              </p>
            </div>

            <PhonePairPanel onRemoteItem={addRemote} />

            {scanError && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Scan failed</AlertTitle>
                <AlertDescription>{scanError}</AlertDescription>
              </Alert>
            )}

            <ScanReview photos={photos} items={items} hasScanned={hasScanned} onAddMissing={addMissing} {...review}
              binders={binders} binder={binder} onAdd={(id, to) => void addRow(id, to)} onAddAll={() => void addAll()} onUndo={id => void undoRow(id)}
              onTapPhoto={(photoId, fx, fy) => void tapPhoto(photoId, fx, fy)}
              nameIndex={scanner.index}
              loadPrintings={loadPrintings} />

          </div>
        </div>
      </div>

    </div>
  );
}
