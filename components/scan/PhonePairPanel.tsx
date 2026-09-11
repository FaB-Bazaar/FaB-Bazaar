// components/scan/PhonePairPanel.tsx — desktop side of phone pairing: creates
// a scan session, shows its QR, and streams the phone's results into the
// page's queue (via onRemoteItem) over server-sent events.
"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Smartphone, Loader2, X } from "lucide-react";
import { scanClient } from "@/lib/client";
import type { ScanSessionItem } from "@/lib/scan/session-store";

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";

export default function PhonePairPanel({ onRemoteItem }: { onRemoteItem: (item: ScanSessionItem) => void }) {
  const [session, setSession] = useState<{ code: string; pairUrl: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "creating" | "waiting" | "connected" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [received, setReceived] = useState(0);
  const es = useRef<EventSource | null>(null);
  const onItem = useRef(onRemoteItem);
  onItem.current = onRemoteItem;

  const stop = () => { es.current?.close(); es.current = null; setSession(null); setQr(null); setPhase("idle"); setReceived(0); };

  const start = async () => {
    setPhase("creating"); setError(null);
    const res = await scanClient.createSession();
    if (!res.success) { setPhase("error"); setError(res.error); return; }
    setSession(res.data);
    try { setQr(await QRCode.toDataURL(res.data.pairUrl, { margin: 1, width: 220 })); } catch { setQr(null); }
    setPhase("waiting");
    const source = new EventSource(scanClient.sessionEventsUrl(res.data.code));
    es.current = source;
    source.onmessage = (ev) => {
      let msg: any; try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === "paired" || (msg.type === "status" && msg.paired)) setPhase("connected");
      if (msg.type === "item") { setReceived(n => n + 1); onItem.current(msg.item as ScanSessionItem); }
    };
    source.onerror = () => { /* EventSource reconnects on its own; items dedupe by id */ };
  };

  useEffect(() => () => { es.current?.close(); }, []);

  return (
    <section aria-label="Scan with your phone" className="mt-5 rounded-lg border border-gray-300 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          <Smartphone className="h-5 w-5" aria-hidden /> Scan with your phone
        </h2>
        {phase === "idle" || phase === "error" ? (
          <button type="button" onClick={start} className={`rounded-md border border-gray-300 px-4 py-2 text-base font-medium text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700 ${FOCUS_RING}`}>
            Pair a phone
          </button>
        ) : (
          <button type="button" onClick={stop} aria-label="Stop phone pairing" className={`inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm text-gray-700 hover:text-red-700 dark:text-gray-300 dark:hover:text-red-300 ${FOCUS_RING}`}>
            <X className="h-4 w-4" aria-hidden /> Stop
          </button>
        )}
      </div>
      {phase === "idle" && <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">Use your phone's camera and confirm the printings here.</p>}
      {phase === "error" && <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {phase === "creating" && <p className="mt-2 inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Creating session…</p>}
      {session && (phase === "waiting" || phase === "connected") && (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {qr && <img src={qr} alt={`QR code to open ${session.pairUrl}`} className="h-44 w-44 rounded bg-white p-1" />}
          <div className="min-w-0 text-sm text-gray-700 dark:text-gray-300">
            <p>Scan this with your phone, or open</p>
            <p className="mt-1 break-all font-medium text-gray-900 dark:text-gray-100">{session.pairUrl}</p>
            <p className="mt-2 text-base font-semibold" data-testid="pair-status">
              {phase === "connected"
                ? <span className="text-green-700 dark:text-green-300">✓ Phone connected · {received} scanned</span>
                : <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Waiting for your phone…</span>}
            </p>
            <p className="mt-1 text-sm">Code <span className="font-sans font-bold tracking-widest">{session.code}</span> · expires in 30 min</p>
          </div>
        </div>
      )}
    </section>
  );
}
