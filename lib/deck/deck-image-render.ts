// lib/deck/deck-image-render.ts
// BROWSER-ONLY canvas renderer for the deck snapshot PNG. Draws the layout
// computed by `lib/deck/deck-image.ts`. Card art is pulled straight from the
// stored `image_url`s (Cloudflare Images serves `access-control-allow-origin: *`
// on the `public` variant, so the canvas stays untainted and exportable).
import type { DeckImageLayout, DeckImageModel, PlacedCard } from './deck-image';
import { FORMAT_CODES } from '@/lib/fab-constants/formats';

const CONCURRENCY = 8;

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Load every distinct url with bounded concurrency; failures resolve to null. */
async function loadImages(urls: string[]): Promise<Map<string, HTMLImageElement | null>> {
  const distinct = [...new Set(urls)];
  const out = new Map<string, HTMLImageElement | null>();
  let next = 0;
  const worker = async () => {
    while (next < distinct.length) {
      const url = distinct[next++];
      out.set(url, await loadImage(url));
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, distinct.length) }, worker));
  return out;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/\s*\S*$/, '') + '…';
    return kept;
  }
  return lines;
}

/** "cc" → "Classic Constructed"; unknown codes are upper-cased as-is. */
export function formatLabel(format: string): string {
  const key = (format ?? '').toLowerCase() as keyof typeof FORMAT_CODES;
  return FORMAT_CODES[key] ?? (format ?? '').toUpperCase();
}

/** `<name>-deck.png`, slugged for every OS. */
export function deckImageFilename(deckName: string): string {
  const slug = (deckName || 'deck').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'deck';
  return `${slug}-deck.png`;
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  placed: PlacedCard,
  img: HTMLImageElement | null,
  radius: number,
  fontFamily: string,
) {
  const { x, y, w, h, card } = placed;
  ctx.save();
  roundedRect(ctx, x, y, w, h, radius);
  ctx.clip();
  if (img) {
    ctx.drawImage(img, x, y, w, h);
  } else {
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#e5e7eb';
    ctx.font = `600 ${Math.round(w * 0.09)}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = wrapLines(ctx, card.name, w * 0.8, 4);
    const lh = Math.round(w * 0.11);
    lines.forEach((line, i) => ctx.fillText(line, x + w / 2, y + h / 2 + (i - (lines.length - 1) / 2) * lh));
  }
  ctx.restore();

  if (card.quantity > 1) {
    const r = Math.round(w * 0.13);
    const cx = x + w - r * 0.9;
    const cy = y + r * 0.9;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#2563eb';
    ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.18);
    ctx.strokeStyle = '#0b1220';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.round(r * 1.05)}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`×${card.quantity}`, cx, cy + r * 0.05);
  }
}

export interface RenderDeckImageOptions {
  fontFamily?: string;
  signal?: AbortSignal;
}

/**
 * Render the deck snapshot to a PNG blob. Resolves null when aborted.
 */
export async function renderDeckImage(
  model: DeckImageModel,
  layout: DeckImageLayout,
  opts: RenderDeckImageOptions = {},
): Promise<Blob | null> {
  const fontFamily = opts.fontFamily || 'system-ui, sans-serif';
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try { await document.fonts.ready; } catch { /* fonts are best-effort */ }
  }

  const urls: string[] = [];
  if (model.heroImageUrl) urls.push(model.heroImageUrl);
  for (const s of layout.sections) for (const c of s.cards) if (c.card.imageUrl) urls.push(c.card.imageUrl);
  const images = await loadImages(urls);
  if (opts.signal?.aborted) return null;

  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, layout.height);
  bg.addColorStop(0, '#0b1220');
  bg.addColorStop(1, '#111827');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, layout.width, layout.height);

  const { padding, header } = layout;
  const W = layout.width;

  // Header — hero card
  const heroImg = model.heroImageUrl ? images.get(model.heroImageUrl) ?? null : null;
  drawCard(
    ctx,
    { x: header.x, y: header.y, w: header.heroW, h: header.heroH, card: { name: model.heroName ?? 'Hero', imageUrl: model.heroImageUrl, quantity: 1, pitch: null } },
    heroImg,
    layout.cardRadius,
    fontFamily,
  );

  // Header — text block
  const textX = header.x + header.heroW + Math.round(W * 0.02);
  const textMaxW = W - textX - padding;
  const nameSize = Math.round(W * 0.03);
  ctx.fillStyle = '#f9fafb';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${nameSize}px ${fontFamily}`;
  const nameLines = wrapLines(ctx, model.name || 'Untitled deck', textMaxW, 2);
  let ty = header.y + nameSize;
  for (const line of nameLines) {
    ctx.fillText(line, textX, ty);
    ty += Math.round(nameSize * 1.15);
  }

  const subSize = Math.round(W * 0.016);
  ctx.font = `500 ${subSize}px ${fontFamily}`;
  ctx.fillStyle = '#cbd5e1';
  ty += Math.round(subSize * 0.4);
  const subtitle = [formatLabel(model.format), model.heroName, `${model.totalCards} cards`].filter(Boolean).join('  ·  ');
  ctx.fillText(subtitle, textX, ty);

  // Pitch strip
  ty += Math.round(subSize * 1.9);
  const dotR = Math.round(subSize * 0.38);
  let px = textX;
  const strip: Array<[string, number, string]> = [
    ['#ef4444', model.pitch.red, 'red'],
    ['#eab308', model.pitch.yellow, 'yellow'],
    ['#3b82f6', model.pitch.blue, 'blue'],
    ['#9ca3af', model.pitch.none, 'no pitch'],
  ];
  ctx.font = `600 ${subSize}px ${fontFamily}`;
  for (const [color, count, label] of strip) {
    if (!count) continue;
    ctx.beginPath();
    ctx.arc(px + dotR, ty - dotR * 0.9, dotR, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    px += dotR * 2 + Math.round(subSize * 0.45);
    const text = `${count} ${label}`;
    ctx.fillStyle = '#e5e7eb';
    ctx.fillText(text, px, ty);
    px += ctx.measureText(text).width + Math.round(subSize * 1.3);
  }

  // Sections
  const titleSize = Math.round(W * 0.016);
  for (const section of layout.sections) {
    ctx.font = `700 ${titleSize}px ${fontFamily}`;
    ctx.fillStyle = section.accent;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const title = section.title.toUpperCase();
    ctx.fillText(title, padding, section.titleY);
    const tw = ctx.measureText(title).width;
    ctx.fillStyle = '#9ca3af';
    ctx.font = `500 ${titleSize}px ${fontFamily}`;
    ctx.fillText(`(${section.count})`, padding + tw + Math.round(titleSize * 0.5), section.titleY);

    for (const placed of section.cards) {
      const img = placed.card.imageUrl ? images.get(placed.card.imageUrl) ?? null : null;
      drawCard(ctx, placed, img, layout.cardRadius, fontFamily);
    }
  }

  // Footer
  const footerSize = Math.round(W * 0.012);
  ctx.font = `500 ${footerSize}px ${fontFamily}`;
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'left';
  ctx.fillText(model.deckUrl.replace(/^https?:\/\//, ''), padding, layout.footerY);
  if (model.ownerUsername) {
    ctx.textAlign = 'right';
    ctx.fillText(`by ${model.ownerUsername}`, W - padding, layout.footerY);
  }

  if (opts.signal?.aborted) return null;
  return new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/png'));
}

/** True when the browser can hand the PNG to the native share sheet. */
export function canShareFile(file: File): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
