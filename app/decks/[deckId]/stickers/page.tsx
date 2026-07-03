// app/decks/[deckId]/stickers/page.tsx
// Print-ready QR sticker sheet for a deck: one sticker per physical copy,
// each QR encoding the printing page URL. Companion to webcam play — stickers
// go inside the sleeve so a playmat camera can identify cards as they're played.
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import QRCode from "qrcode";
import {
  buildStickerSheet,
  type StickerSection,
} from "@/lib/stickers/buildStickerSheet";

const PITCH_COLORS: Record<number, string> = {
  1: "#c0392b",
  2: "#d4a017",
  3: "#2563a8",
};

export default function DeckStickersPage() {
  const params = useParams();
  const deckId = params.deckId as string;

  const [deckName, setDeckName] = useState<string | null>(null);
  const [sections, setSections] = useState<StickerSection[] | null>(null);
  const [qrSvgs, setQrSvgs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/decks/${deckId}`, { credentials: "include" });
        const json = await res.json();
        if (!res.ok || !json?.data) {
          throw new Error(json?.error || "Deck not found");
        }
        const built = buildStickerSheet(json.data);
        // One QR per unique printing; repeated copies reuse the same SVG
        const unique = new Map<string, string>();
        for (const section of built) {
          for (const s of section.stickers) unique.set(s.printingId, s.payload);
        }
        const svgs: Record<string, string> = {};
        await Promise.all(
          Array.from(unique, async ([pid, payload]) => {
            svgs[pid] = await QRCode.toString(payload, {
              type: "svg",
              errorCorrectionLevel: "M",
              margin: 0,
            });
          })
        );
        if (cancelled) return;
        setDeckName(json.data.name || "Deck");
        setSections(built);
        setQrSvgs(svgs);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load deck");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deckId]);

  const totalStickers = useMemo(
    () => (sections ? sections.reduce((n, s) => n + s.stickers.length, 0) : 0),
    [sections]
  );
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <Link href={`/decks/${deckId}`} className="text-blue-600 hover:underline">
          Back to deck
        </Link>
      </div>
    );
  }

  if (!sections) {
    return (
      <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Loading sticker sheet">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="stickers-root">
      <style>{`
        .stickers-root { background: #eceef1; min-height: 100vh; padding: 24px 0; }
        .stickers-sheet {
          max-width: 216mm; margin: 0 auto; background: #fff; color: #16181d;
          padding: 12mm 10mm; box-shadow: 0 2px 16px rgba(22,24,29,.12);
        }
        .stickers-controls { max-width: 216mm; margin: 0 auto 12px; display: flex; gap: 12px; align-items: center; }
        .stickers-grid { display: flex; flex-wrap: wrap; }
        .sticker-cell {
          width: 30mm; padding: 2mm 2mm 1.2mm; box-sizing: content-box;
          border: 1px dashed #c8ccd4; margin: -0.5px; text-align: center;
          break-inside: avoid; background: #fff;
        }
        .sticker-cell .qr { width: 26mm; height: 26mm; margin: 0 auto; }
        .sticker-cell .qr svg { width: 100%; height: 100%; display: block; }
        .sticker-name {
          display: flex; align-items: center; justify-content: center; gap: 1mm;
          margin-top: 1mm; font-size: 5.4pt; font-weight: 600; line-height: 1.15;
        }
        .sticker-name span {
          max-width: 28mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .pitch-dot { width: 2.2mm; height: 2.2mm; border-radius: 50%; flex: none; }
        .sticker-num { font-size: 4.6pt; color: #5c6470; margin-top: .4mm; font-family: ui-monospace, monospace; }
        .section-title {
          font-size: .78rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
          color: #5c6470; border-bottom: 1px solid #c8ccd4; padding-bottom: 4px; margin: 14px 0 8px;
        }
        .section-title small { font-weight: 400; letter-spacing: 0; text-transform: none; float: right; }
        .stickers-howto {
          font-size: .8rem; color: #5c6470; line-height: 1.5;
          border: 1px solid #c8ccd4; border-radius: 4px; padding: 10px 14px; margin: 0 0 14px;
        }
        @media print {
          /* Dark mode sets a near-black bg on <body>; without this the space
             after the last sticker prints as a solid dark block. */
          html, body { background: #fff !important; }
          .stickers-root { background: #fff; padding: 0; }
          .stickers-sheet { box-shadow: none; padding: 0; max-width: none; }
          .stickers-controls, .stickers-howto { display: none; }
          /* Hide site chrome (navbar, footer, mobile tab bar, cookie banner) —
             this style tag only exists while the stickers page is mounted. */
          body header, body footer, main ~ * { display: none !important; }
          @page { size: letter; margin: 10mm; }
        }
      `}</style>

      <div className="stickers-controls print:hidden">
        <Link
          href={`/decks/${deckId}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-200 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to deck
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          Print sticker sheet
        </button>
      </div>

      <div className="stickers-sheet">
        <h1 className="text-xl font-semibold mb-1">QR Stickers — {deckName}</h1>
        <p className="text-xs text-gray-500 mb-3">
          {totalStickers} stickers · one per physical copy · scan any sticker to open its printing page
        </p>

        <div className="stickers-howto">
          Print at <strong>100% scale</strong> (&ldquo;Actual size&rdquo;). Cut along the dashed
          guides; each sticker keeps a 2mm white quiet zone. Matte sleeves scan far better than
          gloss.
        </div>

        {sections.map((section) => (
          <section key={section.section}>
            <h2 className="section-title">
              {section.section} <small>{section.stickers.length} stickers</small>
            </h2>
            <div className="stickers-grid">
              {section.stickers.map((s, i) => (
                <div key={`${s.printingId}-${i}`} className="sticker-cell">
                  <div
                    className="qr"
                    dangerouslySetInnerHTML={{ __html: qrSvgs[s.printingId] || "" }}
                  />
                  <div className="sticker-name">
                    {s.pitch != null && PITCH_COLORS[s.pitch] && (
                      <span
                        className="pitch-dot"
                        style={{ background: PITCH_COLORS[s.pitch] }}
                        title={`pitch ${s.pitch}`}
                      />
                    )}
                    <span>{s.name}</span>
                  </div>
                  <div className="sticker-num">{s.collectorNumber}</div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
