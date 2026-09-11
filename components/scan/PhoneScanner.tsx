// components/scan/PhoneScanner.tsx — the phone side of pairing: /scan?pair=CODE.
// Shoot, see what matched, next. Printing choice and the binder add happen
// on the paired desktop.
"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Check, AlertTriangle, ImageOff } from "lucide-react";
import { scanClient } from "@/lib/client";
import { prepareUpload } from "@/lib/scan/prepare-upload";
import { matchConfidence } from "@/lib/scan/scan-session";

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";

interface Shot { id: string; previewUrl: string; status: "identifying" | "done" | "error"; name?: string; confidence?: "confident" | "plausible" | "weak" | "none"; error?: string; cardCount?: number }

export default function PhoneScanner({ code }: { code: string }) {
  const [phase, setPhase] = useState<"pairing" | "ready" | "error">("pairing");
  const [error, setError] = useState<string | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const input = useRef<HTMLInputElement>(null);
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

  const shoot = (files: FileList) => {
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const id = crypto.randomUUID();
      setShots(s => [{ id, previewUrl: URL.createObjectURL(file), status: "identifying" as const }, ...s].slice(0, 12));
      queue.current = queue.current.then(async () => {
        try {
          const blob = await prepareUpload(file);
          const res = await scanClient.identifyCardForSession(blob, code);
          setShots(s => s.map(x => x.id !== id ? x : res.success
            ? (() => {
                const cards = res.data.cards ?? [res.data];
                const matched = cards.filter(c => c.candidates.length > 0);
                if (cards.length > 1) return { ...x, status: "done" as const, cardCount: cards.length, name: `${matched.length} of ${cards.length} cards recognised`, confidence: matched.length === cards.length ? "confident" as const : matched.length ? "plausible" as const : "none" as const };
                return { ...x, status: "done" as const, cardCount: 1, name: res.data.candidates[0]?.name, confidence: res.data.candidates.length ? matchConfidence(res.data.bestDistance) : "none" as const };
              })()
            : { ...x, status: "error", error: res.error }));
        } catch (err) {
          setShots(s => s.map(x => x.id !== id ? x : { ...x, status: "error", error: err instanceof Error ? err.message : "Upload failed" }));
        }
      });
    }
  };

  if (phase === "pairing") return <p className="inline-flex items-center gap-2 text-base text-gray-700 dark:text-gray-300"><Loader2 className="h-5 w-5 animate-spin" aria-hidden />Connecting to your desktop…</p>;
  if (phase === "error") return (
    <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-base text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
      <p className="font-semibold">Couldn't pair</p>
      <p className="mt-1">{error}</p>
      <p className="mt-2 text-sm">Make sure this phone is signed in to the same account, then scan the QR again.</p>
    </div>
  );

  const done = shots.filter(s => s.status === "done").reduce((n, s) => n + (s.cardCount ?? 1), 0);
  return (
    <div>
      <p className="text-base text-green-700 dark:text-green-300" data-testid="phone-status">✓ Connected to your desktop · {done} scanned</p>
      <input ref={input} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => { if (e.target.files) shoot(e.target.files); e.target.value = ""; }} data-testid="phone-camera-input" />
      <button type="button" onClick={() => input.current?.click()}
        className={`mt-4 flex w-full items-center justify-center gap-3 rounded-xl bg-gray-900 px-6 py-6 text-xl font-semibold text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300 ${FOCUS_RING}`}>
        <Camera className="h-7 w-7" aria-hidden /> Take a photo
      </button>
      <p className="mt-2 text-center text-sm text-gray-700 dark:text-gray-300">One card filling the frame, or several laid out on a table. Pick printings on the desktop.</p>
      {shots.length > 0 && (
        <ul className="mt-4 space-y-2" aria-label="Recent shots">
          {shots.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-lg border border-gray-300 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
              <img src={s.previewUrl} alt="" className="h-16 w-12 flex-none rounded object-cover" />
              <div className="min-w-0 flex-1 text-base">
                {s.status === "identifying" && <span className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-300"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Identifying…</span>}
                {s.status === "error" && <span className="inline-flex items-center gap-2 text-red-700 dark:text-red-300"><AlertTriangle className="h-4 w-4" aria-hidden />{s.error}</span>}
                {s.status === "done" && (s.confidence === "none"
                  ? <span className="inline-flex items-center gap-2 text-red-700 dark:text-red-300"><ImageOff className="h-4 w-4" aria-hidden />No match — try again closer</span>
                  : <span className="block">
                      <span className="block truncate font-semibold text-gray-900 dark:text-gray-100">{s.name}</span>
                      <span className={`inline-flex items-center gap-1 text-sm ${s.confidence === "confident" ? "text-green-700 dark:text-green-300" : s.confidence === "plausible" ? "text-yellow-700 dark:text-yellow-400" : "text-red-700 dark:text-red-300"}`}>
                        {s.confidence === "confident" ? <><Check className="h-4 w-4" aria-hidden />Sent to desktop</> : <><AlertTriangle className="h-4 w-4" aria-hidden />Sent — verify on desktop</>}
                      </span>
                    </span>)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
