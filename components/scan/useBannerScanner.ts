// components/scan/useBannerScanner.ts — the in-browser banner scanner (lib/scan/banner) as a React hook: loads the
// card-name vocabulary (/api/scan/name-index), starts tesseract.js on the first scan, and scans photo files ON THIS
// DEVICE (nothing is uploaded). Used by /scan and the dev-only /scan/lab.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildNameIndex, type NameIndex } from "@/lib/scan/banner/name-match";
import { cutBanner, type RgbImage } from "@/lib/scan/banner/find-banners";
import { scanPhoto, type ScanResult, type ScannedCard } from "@/lib/scan/banner/scan-photo";
import { describeDecodeFailure } from "@/lib/scan/banner/photo-errors";
import { readAtPoint } from "@/lib/scan/banner/read-at-point";

const MAX_EDGE = 3000;   // full 24 MP phone photos are decoded down to this (names read fine at 2160+)

type OcrWorker = { recognize: (img: HTMLCanvasElement) => Promise<{ data: { text: string } }>; terminate: () => Promise<unknown> };
export interface PhotoScan { result: ScanResult; image: RgbImage; decodeMs: number; totalMs: number }

export function toCanvas(img: RgbImage): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const ctx = c.getContext("2d")!; const id = ctx.createImageData(img.width, img.height);
  for (let i = 0, n = img.width * img.height; i < n; i++) {
    id.data[i * 4] = img.data[i * img.channels]; id.data[i * 4 + 1] = img.data[i * img.channels + 1];
    id.data[i * 4 + 2] = img.data[i * img.channels + 2]; id.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(id, 0, 0); return c;
}

/** Downscaled JPEG data URL of the whole scanned photo (for the review overview). */
export function photoPreview(image: RgbImage, maxWidth = 900): string {
  const full = toCanvas(image), k = Math.min(1, maxWidth / image.width);
  const c = document.createElement("canvas"); c.width = Math.round(image.width * k); c.height = Math.round(image.height * k);
  c.getContext("2d")!.drawImage(full, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8);
}

/** JPEG data URL of a scanned card's name banner (for review rows). */
export function bannerThumb(image: RgbImage, card: ScannedCard): string {
  return toCanvas(cutBanner(image, card.rect)).toDataURL("image/jpeg", 0.8);
}

async function decode(file: File): Promise<RgbImage> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);              // applies the photo's EXIF orientation
  } catch {
    throw new Error(describeDecodeFailure(file));     // e.g. an iPhone HEIC photo in Chrome / Firefox
  }
  const k = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const ctx = c.getContext("2d")!; ctx.drawImage(bmp, 0, 0, c.width, c.height); bmp.close();
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  return { data, width: c.width, height: c.height, channels: 4 };
}

/** Let React paint a status message before the CPU-heavy scan blocks the main thread. */
export const nextFrame = () => new Promise<void>(r => requestAnimationFrame(() => setTimeout(r, 0)));

export function useBannerScanner() {
  const [index, setIndex] = useState<NameIndex | null>(null);
  const [nameCount, setNameCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const worker = useRef<OcrWorker | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/scan/name-index").then(r => r.json()).then(body => {
      if (cancelled) return;
      if (!body.success) { setLoadError(body.error ?? "Couldn't load card names"); return; }
      setIndex(buildNameIndex(body.data.entries)); setNameCount(body.data.entries.length);
    }).catch(e => { if (!cancelled) setLoadError(String(e)); });
    return () => { cancelled = true; void worker.current?.terminate(); worker.current = null; };
  }, []);

  const ensureWorker = useCallback(async (onStatus?: (s: string) => void): Promise<OcrWorker> => {
    if (!worker.current) {
      onStatus?.("Loading the text reader (first scan only)…"); await nextFrame();
      const { createWorker } = await import("tesseract.js");
      // self-hosted (scripts/copy-tesseract-assets.mjs -> public/tesseract), not tesseract.js's default public CDN.
      // Absolute URLs: the worker runs from a blob URL, where relative paths don't resolve.
      const base = `${window.location.origin}/tesseract`;
      const w = await createWorker("eng", 1, { workerPath: `${base}/worker.min.js`, corePath: `${base}/core`, langPath: `${base}/lang` });
      await w.setParameters({ tessedit_pageseg_mode: "7" as never });   // a banner is one line of text
      worker.current = w as unknown as OcrWorker;
    }
    return worker.current;
  }, []);

  /** Scan one photo. `onStatus` reports the slow steps (first-time text-reader load, reading, finding). */
  const scanFile = useCallback(async (file: File, onStatus?: (s: string) => void): Promise<PhotoScan> => {
    if (!index) throw new Error("Card names are still loading");
    await ensureWorker(onStatus);
    const t0 = performance.now();
    onStatus?.("Reading the photo…"); await nextFrame();
    const image = await decode(file); const decodeMs = performance.now() - t0;
    onStatus?.("Finding and reading card names…"); await nextFrame();
    const w = worker.current!;
    const result = await scanPhoto(image, index, async crop => (await w.recognize(toCanvas(crop))).data.text);
    return { result, image, decodeMs, totalMs: performance.now() - t0 };
  }, [index, ensureWorker]);

  /** Targeted read where the user tapped a card the scan missed (lib/scan/banner/read-at-point). */
  const readAt = useCallback(async (image: RgbImage, tap: { x: number; y: number }, cardW: number) => {
    if (!index) throw new Error("Card names are still loading");
    const w = await ensureWorker();
    return readAtPoint(image, tap, cardW, index, async crop => (await w.recognize(toCanvas(crop))).data.text);
  }, [index, ensureWorker]);

  return { ready: !!index, index, nameCount, loadError, scanFile, readAt };
}
