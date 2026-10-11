// components/scan/PhoneScanner.tsx — the phone side of pairing: /scan?pair=CODE. The phone reads the cards in each
// photo itself (useBannerScanner -> lib/scan/banner) and sends only the results — name, pitch, a small crop of each card,
// never the photo — to the paired desktop (POST /api/scan/session/[code]/items), where they're reviewed and staged.
"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, Loader2, AlertTriangle } from "lucide-react";
import { scanClient } from "@/lib/client";
import type { SessionCardResult } from "@/lib/client/scan-client";
import { useBannerScanner, toCanvas } from "@/components/scan/useBannerScanner";
import { cutRegion } from "@/lib/scan/banner/find-banners";
import { cardRegionFromBanner } from "@/lib/scan/banner/review";

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";
const NEAR_MISS_SCORE = -0.05;   // same cut-off as /scan: unconfirmed reads worth a "Not sure" row

interface Shot { id: string; status: "reading" | "sent" | "none" | "error"; found?: number; unsure?: number; error?: string }

export default function PhoneScanner({ code }: { code: string }) {
  const scanner = useBannerScanner();
  const [phase, setPhase] = useState<"pairing" | "ready" | "error">("pairing");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const camera = useRef<HTMLInputElement>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    void scanClient.pairSession(code).then((res) => {
      if (cancelled) return;
      if (res.success) setPhase("ready");
      else { setPhase("error"); setError(res.error); }
    });
    return () => { cancelled = true; };
  }, [code]);

  const update = (id: string, patch: Partial<Shot>) => setShots(s => s.map(x => (x.id === id ? { ...x, ...patch } : x)));

  const shoot = (files: FileList | null) => {
    for (const file of Array.from(files ?? [])) {
      const id = crypto.randomUUID();
      setShots(s => [{ id, status: "reading" as const }, ...s].slice(0, 12));
      // one photo at a time: the reader is busy, and results arrive on the desktop in order
      queue.current = queue.current.then(async () => {
        try {
          const { result, image } = await scanner.scanFile(file, setStatus);
          const keep = result.cards.filter(c => c.accepted || (c.card && c.score <= NEAR_MISS_SCORE));
          if (keep.length === 0) { update(id, { status: "none" }); setStatus(null); return; }
          const items: SessionCardResult[] = keep.map(c => ({
            name: c.card, status: c.accepted ? "ok" : "check", pitch: c.pitch, pitchOptions: c.pitchOptions,
            crop: toCanvas(cutRegion(image, cardRegionFromBanner(c.rect), 120)).toDataURL("image/jpeg", 0.7),
          }));
          setStatus("Sending to your computer…");
          const res = await scanClient.sendSessionItems(code, items);
          if (!res.success) { update(id, { status: "error", error: res.error }); setStatus(null); return; }
          update(id, { status: "sent", found: items.filter(i => i.status === "ok").length, unsure: items.filter(i => i.status === "check").length });
          setStatus(null);
        } catch (e) {
          update(id, { status: "error", error: e instanceof Error ? e.message : String(e) }); setStatus(null);
        }
      });
    }
  };

  if (phase === "pairing") return <p className="inline-flex items-center gap-2 text-base text-gray-700 dark:text-gray-300"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Connecting to your computer…</p>;
  if (phase === "error") return <p className="text-base text-red-700 dark:text-red-300">{error}</p>;

  const ready = scanner.ready;
  return (
    <div>
      <p className="text-base text-gray-700 dark:text-gray-300">Connected. Photograph a binder page or some cards: we read them here and send them to your computer to check.</p>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={e => { shoot(e.target.files); e.target.value = ""; }} />
      <input type="file" accept="image/*,.heic,.heif" multiple className="sr-only" data-testid="scan-file-input" onChange={e => { shoot(e.target.files); e.target.value = ""; }} />
      <button type="button" disabled={!ready} onClick={() => camera.current?.click()}
        className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-gray-900 px-4 py-3 text-lg font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300 dark:disabled:bg-gray-600 ${FOCUS_RING}`}>
        <Camera className="h-5 w-5" aria-hidden /> Take a photo
      </button>
      <p className="mt-3 text-base text-gray-900 dark:text-gray-100" role="status" aria-live="polite">
        {status ?? (scanner.loadError ? `Couldn't load card names: ${scanner.loadError}` : ready ? "Ready to scan." : "Loading card names…")}
      </p>
      {shots.length > 0 && (
        <ul className="mt-3 space-y-2" aria-label="Photos sent">
          {shots.map((s, i) => (
            <li key={s.id} className="rounded-md border border-gray-200 px-3 py-2 text-base text-gray-900 dark:border-gray-700 dark:text-gray-100">
              <span className="mr-2 text-sm text-gray-700 dark:text-gray-300">Photo {shots.length - i}</span>
              {s.status === "reading" && <span className="inline-flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Reading…</span>}
              {s.status === "sent" && <span className="inline-flex items-center gap-1"><Check className="h-4 w-4 text-green-700 dark:text-green-400" aria-hidden />Sent {s.found} card{s.found === 1 ? "" : "s"}{s.unsure ? `, ${s.unsure} to check` : ""}</span>}
              {s.status === "none" && <span>No card names found. Try closer, with less glare.</span>}
              {s.status === "error" && <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-300"><AlertTriangle className="h-4 w-4" aria-hidden />{s.error}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
