// lib/scan/quad-detect.ts — find the card's four corners in a photo.
// Sobel edges → Hough lines → two strongest well-separated lines per
// orientation → intersections → validated card-shaped quad. Pure TS on a
// grayscale plane, so it runs server-side (sharp raw) or in a browser canvas.
import { orderQuad, quadArea, type Point, type Quad } from './geometry';

export interface DetectedQuad {
  quad: Quad;
  /** 0..1: how much of the expected edge length the weakest side collected. */
  confidence: number;
}

const WORK_MAX = 256;         // longest edge of the working image
const EDGE_PERCENTILE = 0.75; // gradient magnitude above this = edge pixel (low: a black border on a dark table is a faint edge)
const STRONG_FRACTION = 0.25;  // a line counts as a candidate edge if it has ≥ this × the group's best votes
const ANGLE_TOL = 35;         // degrees from vertical/horizontal a card edge may lean
const MIN_SEP = 0.3;          // min distance between opposite edges, fraction of the dimension
// A card FILLING the frame has no detectable outer edge — the strongest lines
// are then its inner border, which would crop it differently from the (never
// deskewed) index renders. So a quad must leave visible background around it.
const MIN_AREA = 0.2, MAX_AREA = 0.75;
const MIN_MARGIN = 0.05; // every corner this far inside the frame: a card on a table has background all round
const PAIR_PARALLEL_TOL = 8;  // degrees: opposite card edges must be (near-)parallel
const MIN_ASPECT = 1.15, MAX_ASPECT = 1.9; // card is ~1.4 tall:wide; allow perspective

function downscale(src: Uint8Array | Uint8ClampedArray, w: number, h: number): { px: Float32Array; w: number; h: number; scale: number } {
  const scale = Math.max(1, Math.max(w, h) / WORK_MAX);
  const dw = Math.max(8, Math.round(w / scale)), dh = Math.max(8, Math.round(h / scale));
  const px = new Float32Array(dw * dh);
  for (let j = 0; j < dh; j++) {
    const y0 = Math.floor(j * scale), y1 = Math.max(y0 + 1, Math.floor((j + 1) * scale));
    for (let i = 0; i < dw; i++) {
      const x0 = Math.floor(i * scale), x1 = Math.max(x0 + 1, Math.floor((i + 1) * scale));
      let s = 0, n = 0;
      for (let y = y0; y < y1 && y < h; y++) for (let x = x0; x < x1 && x < w; x++) { s += src[y * w + x]; n++; }
      px[j * dw + i] = n ? s / n : 0;
    }
  }
  return { px, w: dw, h: dh, scale: w / dw };
}

function blur3(px: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(px.length);
  const k = [1, 2, 1];
  const tmp = new Float32Array(px.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, n = 0;
    for (let d = -1; d <= 1; d++) { const xx = x + d; if (xx < 0 || xx >= w) continue; s += px[y * w + xx] * k[d + 1]; n += k[d + 1]; }
    tmp[y * w + x] = s / n;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, n = 0;
    for (let d = -1; d <= 1; d++) { const yy = y + d; if (yy < 0 || yy >= h) continue; s += tmp[yy * w + x] * k[d + 1]; n += k[d + 1]; }
    out[y * w + x] = s / n;
  }
  return out;
}

interface Line { rho: number; theta: number; votes: number } // x cosθ + y sinθ = ρ, θ in degrees [0,180)

function houghLines(edges: Uint8Array, w: number, h: number, limit: number): Line[] {
  const diag = Math.ceil(Math.hypot(w, h));
  const nRho = 2 * diag + 1, nTheta = 180;
  const acc = new Int32Array(nRho * nTheta);
  const cos = new Float32Array(nTheta), sin = new Float32Array(nTheta);
  for (let t = 0; t < nTheta; t++) { cos[t] = Math.cos((t * Math.PI) / 180); sin[t] = Math.sin((t * Math.PI) / 180); }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!edges[y * w + x]) continue;
    for (let t = 0; t < nTheta; t++) {
      const r = Math.round(x * cos[t] + y * sin[t]) + diag;
      acc[r * nTheta + t]++;
    }
  }
  // peaks with non-max suppression in a (±4 ρ, ±4 θ) window
  const peaks: Line[] = [];
  for (let r = 0; r < nRho; r++) for (let t = 0; t < nTheta; t++) {
    const v = acc[r * nTheta + t];
    if (v < 8) continue;
    let isMax = true;
    for (let dr = -4; dr <= 4 && isMax; dr++) for (let dt = -4; dt <= 4; dt++) {
      if (!dr && !dt) continue;
      const rr = r + dr; let tt = t + dt; let sign = 1;
      if (rr < 0 || rr >= nRho) continue;
      if (tt < 0) { tt += 180; sign = -1; } else if (tt >= 180) { tt -= 180; sign = -1; }
      const rr2 = sign === 1 ? rr : (2 * diag - rr);
      if (rr2 < 0 || rr2 >= nRho) continue;
      if (acc[rr2 * nTheta + tt] > v) { isMax = false; break; }
    }
    if (isMax) peaks.push({ rho: r - diag, theta: t, votes: v });
  }
  peaks.sort((a, b) => b.votes - a.votes);
  return peaks.slice(0, limit);
}

/** Angular distance to the nearest of `target` mod 180. */
const angDist = (theta: number, target: number) => { const d = Math.abs(((theta - target) % 180) + 180) % 180; return Math.min(d, 180 - d); };

function intersect(a: Line, b: Line): Point | null {
  const [ca, sa] = [Math.cos((a.theta * Math.PI) / 180), Math.sin((a.theta * Math.PI) / 180)];
  const [cb, sb] = [Math.cos((b.theta * Math.PI) / 180), Math.sin((b.theta * Math.PI) / 180)];
  const det = ca * sb - sa * cb;
  if (Math.abs(det) < 1e-6) return null;
  return [(a.rho * sb - b.rho * sa) / det, (ca * b.rho - cb * a.rho) / det];
}

/** Normalise b onto a's θ sign convention; null when the two aren't near-parallel. */
function parallelPair(a: Line, b: Line): { rho: number } | null {
  const flip = Math.abs(a.theta - b.theta) > 90;
  const tb = flip ? (b.theta > a.theta ? b.theta - 180 : b.theta + 180) : b.theta;
  if (Math.abs(a.theta - tb) > PAIR_PARALLEL_TOL) return null;
  return { rho: flip ? -b.rho : b.rho };
}

interface Candidate { quad: Quad; score: number; area: number; vPair: [Line, Line]; hPair: [Line, Line] }

const TOP_LINES = 8; // per orientation, when enumerating quads

export interface DetectDebug { lines: Line[]; vertical: Line[]; horizontal: Line[]; vPair: [Line, Line] | null; hPair: [Line, Line] | null; reject?: string; w: number; h: number }
export type { Line };

export function detectCardQuad(gray: Uint8Array | Uint8ClampedArray, width: number, height: number, debug?: DetectDebug): DetectedQuad | null {
  const { px, w, h, scale } = downscale(gray, width, height);
  const sm = blur3(px, w, h);
  // Sobel magnitude
  const mag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const gx = -sm[i - w - 1] + sm[i - w + 1] - 2 * sm[i - 1] + 2 * sm[i + 1] - sm[i + w - 1] + sm[i + w + 1];
    const gy = -sm[i - w - 1] - 2 * sm[i - w] - sm[i - w + 1] + sm[i + w - 1] + 2 * sm[i + w] + sm[i + w + 1];
    mag[i] = Math.hypot(gx, gy);
  }
  const sorted = Array.from(mag).filter(v => v > 0).sort((a, b) => a - b);
  if (sorted.length < 50) return null;
  const thr = Math.max(sorted[Math.floor(sorted.length * EDGE_PERCENTILE)], 16);
  const edges = new Uint8Array(w * h);
  let nEdges = 0;
  for (let i = 0; i < mag.length; i++) if (mag[i] >= thr) { edges[i] = 1; nEdges++; }
  if (nEdges < 40) return null;

  const lines = houghLines(edges, w, h, 200); // plenty: texture lines can flood one orientation
  if (lines.length < 4) return null;
  const vertical = lines.filter(l => angDist(l.theta, 0) <= ANGLE_TOL);   // θ≈0 → x ≈ ρ (vertical line)
  const horizontal = lines.filter(l => angDist(l.theta, 90) <= ANGLE_TOL);
  // Enumerate quads from the top lines of each orientation and keep the
  // best-supported VALID one. Selecting lines first ("two strongest", "widest
  // strong pair") fails on busy cards: the text box outvotes the outline on a
  // dark table, and inner frame lines look like edges on a frame-filling shot.
  const vs = vertical.slice(0, TOP_LINES), hs = horizontal.slice(0, TOP_LINES);
  let best: Candidate | null = null;
  let reject = 'no pair';
  for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) {
    const vp = parallelPair(vs[i], vs[j]); if (!vp || Math.abs(vs[i].rho - vp.rho) < MIN_SEP * w) continue;
    for (let k = 0; k < hs.length; k++) for (let l = k + 1; l < hs.length; l++) {
      const hp = parallelPair(hs[k], hs[l]); if (!hp || Math.abs(hs[k].rho - hp.rho) < MIN_SEP * h) continue;
      const vPair: [Line, Line] = [vs[i], vs[j]], hPair: [Line, Line] = [hs[k], hs[l]];
      const pts: Point[] = [];
      let ok = true;
      for (const v of vPair) for (const hl of hPair) { const p = intersect(v, hl); if (!p) { ok = false; break; } pts.push(p); }
      if (!ok) continue;
      const quad = orderQuad(pts);
      let bad: string | null = null;
      for (const [x, y] of quad) if (x < MIN_MARGIN * w || x > (1 - MIN_MARGIN) * w || y < MIN_MARGIN * h || y > (1 - MIN_MARGIN) * h) { bad = 'no margin'; break; }
      const area = quadArea(quad) / (w * h);
      if (!bad && (area < MIN_AREA || area > MAX_AREA)) bad = `area ${area.toFixed(2)}`;
      const top = Math.hypot(quad[1][0] - quad[0][0], quad[1][1] - quad[0][1]);
      const bottom = Math.hypot(quad[2][0] - quad[3][0], quad[2][1] - quad[3][1]);
      const left = Math.hypot(quad[3][0] - quad[0][0], quad[3][1] - quad[0][1]);
      const right = Math.hypot(quad[2][0] - quad[1][0], quad[2][1] - quad[1][1]);
      const aspect = ((left + right) / 2) / ((top + bottom) / 2);
      if (!bad && (aspect < MIN_ASPECT || aspect > MAX_ASPECT)) bad = `aspect ${aspect.toFixed(2)}`;
      if (bad) { reject = bad; continue; }
      // support: how much of each side's length its line collected in votes
      const sides = [[vPair[0], left], [vPair[1], right], [hPair[0], top], [hPair[1], bottom]] as const;
      const supports = sides.map(([ln, len]) => Math.min(1, ln.votes / Math.max(1, len)));
      const score = Math.min(...supports) * 0.5 + (supports.reduce((a, b) => a + b, 0) / 4) * 0.5;
      const cand: Candidate = { quad, score, area, vPair, hPair };
      // prefer support; among near-equal support prefer the LARGER quad (the outline encloses the inner frame)
      if (!best || cand.score > best.score * 1.15 || (cand.score >= best.score * 0.85 && cand.area > best.area * 1.1)) best = cand;
    }
  }
  if (debug) Object.assign(debug, { lines, vertical, horizontal, vPair: best?.vPair ?? null, hPair: best?.hPair ?? null, w, h });
  if (!best) { if (debug) debug.reject = reject; return null; }
  const { quad, vPair, hPair } = best;
  const confidence = Math.min(...[
    [vPair[0], Math.hypot(quad[3][0] - quad[0][0], quad[3][1] - quad[0][1])],
    [vPair[1], Math.hypot(quad[2][0] - quad[1][0], quad[2][1] - quad[1][1])],
    [hPair[0], Math.hypot(quad[1][0] - quad[0][0], quad[1][1] - quad[0][1])],
    [hPair[1], Math.hypot(quad[2][0] - quad[3][0], quad[2][1] - quad[3][1])],
  ].map(([ln, len]) => Math.min(1, (ln as Line).votes / Math.max(1, len as number))));

  return { quad: quad.map(([x, y]) => [x * scale, y * scale]) as Quad, confidence };
}
