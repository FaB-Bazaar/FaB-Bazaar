// components/scan/ScanLab.tsx — the dev-only /scan/lab page: runs the in-browser banner scanner on one photo and
// shows every step's timing + what it read (for phone speed / accuracy checks). The real flow is /scan.
"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2 } from "lucide-react";
import type { ScannedCard } from "@/lib/scan/banner/scan-photo";
import { useBannerScanner, bannerThumb } from "@/components/scan/useBannerScanner";

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";
const PITCH = { 1: "red", 2: "yellow", 3: "blue" } as Record<number, string>;

interface Row extends ScannedCard { thumb: string }
interface Timings { decode: number; find: number; ocr: number; match: number; total: number; banners: number; reads: number; size: string }

export default function ScanLab() {
  const scanner = useBannerScanner();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [timings, setTimings] = useState<Timings | null>(null);
  const camera = useRef<HTMLInputElement>(null);

  const scan = async (file: File | undefined) => {
    if (!file || !scanner.ready || busy) return;
    setBusy(true); setRows([]); setTimings(null);
    try {
      const { result, image, decodeMs, totalMs } = await scanner.scanFile(file, setStatus);
      setRows(result.cards.map(c => ({ ...c, thumb: bannerThumb(image, c) })));
      const t = result.timings;
      setTimings({ decode: decodeMs, find: t.findMs, ocr: t.ocrMs, match: t.matchMs, total: totalMs, banners: t.banners, reads: t.reads, size: `${image.width}×${image.height}` });
      const n = result.cards.filter(c => c.accepted).length;
      setStatus(`Found ${n} card${n === 1 ? "" : "s"}.`);
    } catch (e) {
      setStatus(`Scan failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setBusy(false); }
  };

  const accepted = rows.filter(r => r.accepted);
  const flagged = rows.filter(r => !r.accepted && r.card && r.score <= -0.05);   // near misses only: type lines / rules text score >= 0
  const ms = (v: number) => `${(v / 1000).toFixed(2)} s`;
  const shown = status ?? (scanner.loadError ? `Couldn't load card names: ${scanner.loadError}`
    : scanner.ready ? `${scanner.nameCount.toLocaleString()} card names loaded. Take or choose a photo.` : "Loading card names…");

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Scan lab</h1>
      <p className="mt-1 text-base text-gray-700 dark:text-gray-300">
        Dev-only. Everything runs on this device: it finds each card&apos;s name banner, reads it, and matches it against the card list. Nothing is uploaded.
      </p>
      <p className="mt-3 text-sm text-gray-700 dark:text-gray-300" role="status" aria-live="polite">
        {busy && <Loader2 className="mr-1 inline h-4 w-4 animate-spin" aria-hidden />}{shown}
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={e => { void scan(e.target.files?.[0]); e.target.value = ""; }} />
        <button type="button" disabled={!scanner.ready || busy} onClick={() => camera.current?.click()}
          className={`inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2.5 text-base font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300 dark:disabled:bg-gray-600 ${FOCUS_RING}`}>
          <Camera className="h-5 w-5" aria-hidden /> Take a photo
        </button>
        <label className={`inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-4 py-2.5 text-base font-medium text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700 ${!scanner.ready || busy ? "pointer-events-none border-dashed text-gray-600 dark:text-gray-300" : ""}`}>
          <ImagePlus className="h-5 w-5" aria-hidden /> Choose a photo
          <input data-testid="scan-lab-input" type="file" accept="image/*" className="sr-only" disabled={!scanner.ready || busy} onChange={e => { void scan(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      </div>

      {timings && (
        <dl data-testid="scan-lab-timings" className="mt-5 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-gray-200 p-3 text-sm text-gray-800 sm:grid-cols-4 dark:border-gray-700 dark:text-gray-200">
          <div><dt className="text-gray-600 dark:text-gray-300">Total</dt><dd className="font-semibold">{ms(timings.total)}</dd></div>
          <div><dt className="text-gray-600 dark:text-gray-300">Decode</dt><dd>{ms(timings.decode)}</dd></div>
          <div><dt className="text-gray-600 dark:text-gray-300">Find banners</dt><dd>{ms(timings.find)}</dd></div>
          <div><dt className="text-gray-600 dark:text-gray-300">Read text</dt><dd>{ms(timings.ocr)}</dd></div>
          <div><dt className="text-gray-600 dark:text-gray-300">Match names</dt><dd>{ms(timings.match)}</dd></div>
          <div><dt className="text-gray-600 dark:text-gray-300">Banners / reads</dt><dd>{timings.banners} / {timings.reads}</dd></div>
          <div><dt className="text-gray-600 dark:text-gray-300">Photo</dt><dd>{timings.size}</dd></div>
          <div><dt className="text-gray-600 dark:text-gray-300">CPU cores</dt><dd>{typeof navigator !== "undefined" ? navigator.hardwareConcurrency : "?"}</dd></div>
        </dl>
      )}

      {rows.length > 0 && (
        <>
          <h2 className="mt-6 text-lg font-semibold text-gray-900 dark:text-gray-100">Cards found ({accepted.length})</h2>
          <ul className="mt-2 space-y-2">
            {[...accepted, ...flagged].map((r, i) => (
              <li key={i} data-testid="scan-lab-card" className="rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                {/* eslint-disable-next-line @next/next/no-img-element -- local data URL of the banner crop */}
                <img src={r.thumb} alt="" className="h-8 max-w-full rounded object-contain" />
                <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span data-accepted={r.accepted ? "true" : "false"} className={`font-medium ${r.accepted ? "text-gray-900 dark:text-gray-100" : "text-amber-800 dark:text-amber-300"}`}>
                    {r.accepted ? r.card : `Check: ${r.card}?`}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {r.pitch ? PITCH[r.pitch] : r.pitchOptions.length > 1 ? `pitch? (${r.pitchOptions.map(p => (p ? PITCH[p] : "none")).join(" / ")})` : "no pitch"}
                  </span>
                  <span className="text-gray-600 dark:text-gray-300">score {r.score.toFixed(2)}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
