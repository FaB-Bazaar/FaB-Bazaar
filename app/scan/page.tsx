// app/scan/page.tsx — photograph cards, confirm the printing, add to a binder.
// Recognition = perceptual hash of the artwork (POST /api/scan/identify);
// the page only downsizes the photo before upload. State lives in
// lib/scan/scan-session (pure reducer) so the flow is unit-tested there.
"use client";

import { Suspense, useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useAuth } from "@/contexts/AuthContext";
import { canUseScanner } from "@/lib/scan/scan-access";
import { Camera, ImagePlus, Loader2 } from "lucide-react";
import { bindersClient, scanClient } from "@/lib/client";
import type { BinderSummaryDTO } from "@/lib/services/contracts/IBinderService";
import { useToast } from "@/hooks/use-toast";
import ScanItemCard from "@/components/scan/ScanItemCard";
import PhonePairPanel from "@/components/scan/PhonePairPanel";
import PhoneScanner from "@/components/scan/PhoneScanner";
import { prepareUpload } from "@/lib/scan/prepare-upload";
import { scanReducer, initialScanState, pendingAdds, readyItemIds } from "@/lib/scan/scan-session";

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";
const BINDER_KEY = "scan:lastBinderId";

export default function ScanPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-700 dark:text-gray-300" aria-label="Loading" /></div>}>
      <ScanPageInner />
    </Suspense>
  );
}

function ScanPageInner() {
  const pairCode = useSearchParams().get("pair");
  const { status: sessionStatus } = useSession();
  const { user } = useAuth();
  const signedIn = sessionStatus === "authenticated";
  // AuthContext fills `user` one render after the session resolves; gate on both to avoid a flash.
  const allowed = signedIn && !!user && canUseScanner(user);
  const { toast } = useToast();

  const [state, dispatch] = useReducer(scanReducer, initialScanState);
  const [binders, setBinders] = useState<BinderSummaryDTO[]>([]);
  const [binderId, setBinderId] = useState<string>("");
  const [bindersLoading, setBindersLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    setBindersLoading(true);
    void bindersClient.getUserBinders().then((res) => {
      if (cancelled) return;
      if (res.success) {
        setBinders(res.data.binders);
        let remembered: string | null = null;
        try { remembered = localStorage.getItem(BINDER_KEY); } catch { /* ignore */ }
        const first = res.data.binders[0]?._id ?? "";
        setBinderId(remembered && res.data.binders.some(b => b._id === remembered) ? remembered : first);
      } else {
        toast({ title: "Couldn't load your binders", description: res.error, variant: "destructive" });
      }
      setBindersLoading(false);
    });
    return () => { cancelled = true; };
  }, [allowed, toast]);

  const chooseBinder = (id: string) => {
    setBinderId(id);
    try { localStorage.setItem(BINDER_KEY, id); } catch { /* ignore */ }
  };

  const enqueue = useCallback((files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const id = crypto.randomUUID();
      dispatch({ type: "queued", id, previewUrl: URL.createObjectURL(file) });
      // one at a time: keeps the server hashing serial and results in order
      queue.current = queue.current.then(async () => {
        try {
          const blob = await prepareUpload(file);
          const res = await scanClient.identifyCard(blob);
          if (res.success) dispatch({ type: "identified", id, candidates: res.data.candidates, bestDistance: res.data.bestDistance, pitchHint: res.data.pitchHint });
          else dispatch({ type: "failed", id, error: res.error });
        } catch (err) {
          dispatch({ type: "failed", id, error: err instanceof Error ? err.message : "Upload failed" });
        }
      });
    }
  }, []);

  // paste a screenshot / photo
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter(f => f.type.startsWith("image/"));
      if (files.length) enqueue(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [enqueue]);

  const adds = pendingAdds(state);
  const addCount = adds.reduce((n, a) => n + a.quantity, 0);

  const addToBinder = async () => {
    if (!binderId || adds.length === 0) return;
    setAdding(true);
    const ids = readyItemIds(state);
    const res = await bindersClient.addCardsToBinder(binderId, adds.map(a => ({ printingId: a.printingId, quantity: a.quantity })));
    setAdding(false);
    if (res.success) {
      dispatch({ type: "added", ids });
      const binder = binders.find(b => b._id === binderId);
      toast({ title: `Added ${addCount} card${addCount === 1 ? "" : "s"}`, description: binder ? `to ${binder.name}` : undefined });
    } else {
      toast({ title: "Add failed", description: res.error, variant: "destructive" });
    }
  };

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
        <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-gray-100">Card scanning isn't available on your account yet</h1>
        <p className="mt-2 text-base text-gray-700 dark:text-gray-300">It's being tested with a small group first. In the meantime you can add cards from your collection page.</p>
        <Link href="/collection" className={`mt-6 inline-block rounded-md border border-gray-300 px-5 py-2.5 text-base font-medium text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700 ${FOCUS_RING}`}>Go to your collection</Link>
      </div>
    );
  }

  if (pairCode) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Scan cards</h1>
        <div className="mt-3"><PhoneScanner code={pairCode.toUpperCase()} /></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Scan cards</h1>
      <p className="mt-1 text-base text-gray-700 dark:text-gray-300">
        Photograph one card per shot, filling the frame. We match the artwork; you confirm the pitch, foiling and edition.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex-1 min-w-[12rem] text-sm text-gray-700 dark:text-gray-300">
          Add to binder
          <select value={binderId} onChange={(e) => chooseBinder(e.target.value)} disabled={bindersLoading || binders.length === 0}
            className={`mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 ${FOCUS_RING}`}>
            {binders.length === 0 && <option value="">{bindersLoading ? "Loading binders…" : "No binders yet"}</option>}
            {binders.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
        </label>
        <button type="button" onClick={addToBinder} disabled={!binderId || adds.length === 0 || adding}
          className={`rounded-md bg-blue-600 px-4 py-2 text-base font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400 dark:disabled:bg-gray-600 ${FOCUS_RING}`}>
          {adding ? "Adding…" : `Add ${addCount} to binder`}
        </button>
      </div>
      {binders.length === 0 && !bindersLoading && (
        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">You need a binder first — <Link href="/collection" className="text-blue-700 underline dark:text-blue-300">create one</Link>.</p>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); enqueue(e.dataTransfer.files); }}
        className={`mt-5 rounded-lg border-2 border-dashed p-5 text-center ${dragOver ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-300 dark:border-gray-600"}`}
      >
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => { if (e.target.files) enqueue(e.target.files); e.target.value = ""; }} data-testid="scan-camera-input" />
        <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) enqueue(e.target.files); e.target.value = ""; }} data-testid="scan-file-input" />
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => cameraInput.current?.click()} className={`inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2.5 text-base font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300 ${FOCUS_RING}`}>
            <Camera className="h-5 w-5" aria-hidden /> Take a photo
          </button>
          <button type="button" onClick={() => fileInput.current?.click()} className={`inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2.5 text-base font-medium text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700 ${FOCUS_RING}`}>
            <ImagePlus className="h-5 w-5" aria-hidden /> Choose photos
          </button>
        </div>
        <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">…or drop images here, or paste one.</p>
      </div>

      <PhonePairPanel onRemoteItem={(item) => dispatch({ type: "remote", id: item.id, previewUrl: item.thumb ?? "", candidates: item.candidates, bestDistance: item.bestDistance, pitchHint: item.pitchHint })} />

      {state.items.length > 0 && (
        <ul className="mt-5 space-y-3" aria-label="Scanned cards">
          {state.items.map((item) => (
            <ScanItemCard key={item.id} item={item}
              onChoose={(printingId) => dispatch({ type: "choose", id: item.id, printingId })}
              onQuantity={(quantity) => dispatch({ type: "quantity", id: item.id, quantity })}
              onRemove={() => { URL.revokeObjectURL(item.previewUrl); dispatch({ type: "remove", id: item.id }); }} />
          ))}
        </ul>
      )}
      {state.items.some(i => i.status === "added") && (
        <button type="button" onClick={() => dispatch({ type: "clearAdded" })} className={`mt-3 text-sm text-blue-700 underline dark:text-blue-300 ${FOCUS_RING}`}>Clear added cards</button>
      )}
    </div>
  );
}
