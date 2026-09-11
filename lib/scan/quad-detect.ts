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

const WORK_MAX = 384;         // longest edge of the working image (a row of 3 cards still gives ~100px per card)
const EDGE_PERCENTILE = 0.75; // gradient magnitude above this = edge pixel (low: a black border on a dark table is a faint edge)
const STRONG_FRACTION = 0.25;  // a line counts as a candidate edge if it has ≥ this × the group's best votes
const ANGLE_TOL = 25;         // degrees from vertical/horizontal a card edge may lean
const MIN_SEP_PX = 22;        // min distance between opposite edges in working px (an arm's-length card is ~45px wide at WORK_MAX)
// A card FILLING the frame has no detectable outer edge — the strongest lines
// are then its inner border, which would crop it differently from the (never
// deskewed) index renders. So a quad must leave visible background around it.
const MIN_AREA = 0.02, MAX_AREA = 0.65; // a card may be small (arm's length); above MAX the card overflows the frame — the flat path handles frame-filling shots
const MIN_MARGIN = 0.02; // every corner this far inside the frame (cards in a multi-card shot sit close to the edges)
const PAIR_PARALLEL_TOL = 8;  // degrees: opposite card edges must be (near-)parallel
const MIN_ASPECT = 1.15, MAX_ASPECT = 1.9; // card is ~1.4 tall:wide; allow perspective
const CARD_ASPECT = 1.4;      // a quad's score is discounted by how far its shape is from a card

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
      const nv = acc[rr2 * nTheta + tt];
      // equal votes: keep only the lowest-index cell so adjacent ρ duplicates collapse to one line
      if (nv > v || (nv === v && rr2 * nTheta + tt < r * nTheta + t)) { isMax = false; break; }
    }
    if (isMax) peaks.push({ rho: r - diag, theta: t, votes: v });
  }
  peaks.sort((a, b) => b.votes - a.votes);
  return peaks.slice(0, limit);
}

/**
 * Fraction of sample points along the segment p0→p1 that sit on an edge pixel
 * (3×3 neighbourhood). Hough votes are GLOBAL — a line fitted across several
 * cards' edges outvotes any one card's own edge — so quads are scored by what
 * lies along each side, not by the whole line.
 */
interface EdgeField { edges: Uint8Array; gx: Float32Array; gy: Float32Array; w: number; h: number }
const SUPPORT_ANGLE_COS = Math.cos((30 * Math.PI) / 180); // gradient must be within 30° of the side's normal

function segmentSupport(f: EdgeField, p0: Point, p1: Point): number {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
  const len = Math.hypot(dx, dy);
  if (len < 1) return 0;
  const nx = -dy / len, ny = dx / len; // unit normal of the side
  const n = Math.max(8, Math.round(len));
  let hit = 0;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const x = Math.round(p0[0] + dx * t), y = Math.round(p0[1] + dy * t);
    let found = false;
    for (let oy = -1; oy <= 1 && !found; oy++) for (let ox = -1; ox <= 1; ox++) {
      const xx = x + ox, yy = y + oy;
      if (xx < 0 || yy < 0 || xx >= f.w || yy >= f.h) continue;
      const i = yy * f.w + xx;
      if (!f.edges[i]) continue;
      const g = Math.hypot(f.gx[i], f.gy[i]);
      if (g > 0 && Math.abs((f.gx[i] * nx + f.gy[i] * ny) / g) >= SUPPORT_ANGLE_COS) { found = true; break; }
    }
    if (found) hit++;
  }
  return hit / (n + 1);
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

interface Candidate { quad: Quad; score: number; area: number; aspect: number; support: number; vPair: [Line, Line]; hPair: [Line, Line] }

const TOP_LINES = 24; // per orientation, when enumerating quads (a row of 3 cards has 6 outer + 6 inner verticals + text boxes)
const MIN_QUAD_SCORE = 0.5;   // edge support a quad needs to count as a card (real cards score ≥0.85; structured noise ≈0.45)
const OVERLAP_SUPPRESS = 0.3; // bbox overlap (of the smaller) above this = same card

export interface DetectDebug { lines: Line[]; vertical: Line[]; horizontal: Line[]; vPair: [Line, Line] | null; hPair: [Line, Line] | null; reject?: string; w: number; h: number }
export type { Line };

function bbox(q: Quad) {
  const xs = q.map(p => p[0]), ys = q.map(p => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}
/** Intersection area of the two bounding boxes over the smaller box's area. */
function overlapRatio(a: Quad, b: Quad): number {
  const A = bbox(a), B = bbox(b);
  const ix = Math.max(0, Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0));
  const iy = Math.max(0, Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0));
  const inter = ix * iy;
  const small = Math.min((A.x1 - A.x0) * (A.y1 - A.y0), (B.x1 - B.x0) * (B.y1 - B.y0));
  return small > 0 ? inter / small : 0;
}

/** All card-shaped, edge-supported quads in the image (working-resolution coords), best first. */
export function enumerateCandidates(gray: Uint8Array | Uint8ClampedArray, width: number, height: number, debug?: DetectDebug): { cands: Candidate[]; scale: number; w: number; h: number; reject: string } {
  const { px, w, h, scale } = downscale(gray, width, height);
  const none = (reject: string) => ({ cands: [] as Candidate[], scale, w, h, reject });
  const sm = blur3(px, w, h);
  // Sobel magnitude
  const mag = new Float32Array(w * h), gxs = new Float32Array(w * h), gys = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const gx = -sm[i - w - 1] + sm[i - w + 1] - 2 * sm[i - 1] + 2 * sm[i + 1] - sm[i + w - 1] + sm[i + w + 1];
    const gy = -sm[i - w - 1] - 2 * sm[i - w] - sm[i - w + 1] + sm[i + w - 1] + 2 * sm[i + w] + sm[i + w + 1];
    mag[i] = Math.hypot(gx, gy); gxs[i] = gx; gys[i] = gy;
  }
  const sorted = Array.from(mag).filter(v => v > 0).sort((a, b) => a - b);
  if (sorted.length < 50) return none('no edges');
  const thr = Math.max(sorted[Math.floor(sorted.length * EDGE_PERCENTILE)], 16);
  const edges = new Uint8Array(w * h);
  let nEdges = 0;
  for (let i = 0; i < mag.length; i++) if (mag[i] >= thr) { edges[i] = 1; nEdges++; }
  if (nEdges < 40) return none('no edges');

  const field: EdgeField = { edges, gx: gxs, gy: gys, w, h };
  const lines = houghLines(edges, w, h, 200); // plenty: texture lines can flood one orientation
  if (lines.length < 4) return none('no lines');
  const vertical = lines.filter(l => angDist(l.theta, 0) <= ANGLE_TOL);   // θ≈0 → x ≈ ρ (vertical line)
  const horizontal = lines.filter(l => angDist(l.theta, 90) <= ANGLE_TOL);
  const vs = vertical.slice(0, TOP_LINES), hs = horizontal.slice(0, TOP_LINES);
  const cands: Candidate[] = [];
  let reject = 'no pair';
  for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) {
    const vp = parallelPair(vs[i], vs[j]); if (!vp || Math.abs(vs[i].rho - vp.rho) < MIN_SEP_PX) continue;
    for (let k = 0; k < hs.length; k++) for (let l = k + 1; l < hs.length; l++) {
      const hp = parallelPair(hs[k], hs[l]); if (!hp || Math.abs(hs[k].rho - hp.rho) < MIN_SEP_PX) continue;
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
      const supports = [
        segmentSupport(field, quad[0], quad[1]), segmentSupport(field, quad[1], quad[2]),
        segmentSupport(field, quad[2], quad[3]), segmentSupport(field, quad[3], quad[0]),
      ];
      const support = Math.min(...supports) * 0.5 + (supports.reduce((a, b) => a + b, 0) / 4) * 0.5;
      // shape term: a card-plus-gap span (~1.9) or a two-card span (~0.7) loses to a real card (~1.4)
      const score = support * (1 - Math.min(1, Math.abs(aspect - CARD_ASPECT) / 0.6) * 0.5);
      if (score < MIN_QUAD_SCORE) { reject = 'weak'; continue; }
      cands.push({ quad, score, area, aspect, support: Math.min(...supports), vPair, hPair });
    }
  }
  if (debug) Object.assign(debug, { lines, vertical, horizontal, vPair: cands[0]?.vPair ?? null, hPair: cands[0]?.hPair ?? null, w, h });
  cands.sort((a, b) => b.score - a.score);
  return { cands, scale, w, h, reject };
}

/**
 * Every distinct card in the image, best-supported first. Overlapping
 * candidates (a card's outer vs inner border, or a text box) collapse to
 * one; among near-equal support the LARGER quad wins (the outline
 * encloses the inner frame). Coordinates are in the input image's pixels.
 */
export function detectCardQuads(gray: Uint8Array | Uint8ClampedArray, width: number, height: number, opts: { maxCards?: number } = {}, debug?: DetectDebug): DetectedQuad[] {
  const { cands: all, scale, reject } = enumerateCandidates(gray, width, height, debug);
  if (all.length === 0) { if (debug) debug.reject = reject; return []; }
  // 0) a rectangle made of several cards (a 2×2 block has a card-like aspect) is not a card:
  //    drop any candidate that fully contains two mutually non-overlapping smaller candidates.
  const contains = (outer: Quad, inner: Quad) => { const O = bbox(outer), I = bbox(inner); return I.x0 >= O.x0 - 2 && I.y0 >= O.y0 - 2 && I.x1 <= O.x1 + 2 && I.y1 <= O.y1 + 2; };
  const cands = all.filter(c => {
    const inside = all.filter(o => o !== c && o.area < c.area * 0.6 && contains(c.quad, o.quad));
    const picked: Candidate[] = [];
    for (const o of inside) { if (picked.every(p => overlapRatio(p.quad, o.quad) < OVERLAP_SUPPRESS)) picked.push(o); if (picked.length >= 2) break; }
    return picked.length < 2;
  });
  // 0b) a candidate fully inside a much larger, reasonably supported candidate is an inner
  //     feature (text box, art frame) — the enclosing outline is the card. Card+gap spans are
  //     only ~1.35× a card, so the 1.5× floor keeps them from swallowing real cards.
  //     The enclosing quad must itself be card-shaped (aspect ≈ 1.4): a card+gap+partial span is not.
  const candsInner = cands.filter(c => !cands.some(o => o !== c && o.area >= c.area * 1.5 && o.score >= c.score * 0.85 && Math.abs(o.aspect - CARD_ASPECT) <= 0.2 && contains(o.quad, c.quad)));
  // 1) greedy non-max suppression by score; within the winner's overlap cluster prefer the
  //    LARGER border variant (outer vs inner edge differ by ~1.16× in area) when its support is close.
  const kept: Candidate[] = [];
  const pool = candsInner;
  const alive = pool.map(() => true);
  for (let i = 0; i < pool.length; i++) {
    if (!alive[i]) continue;
    let winner = pool[i];
    for (let j = i + 1; j < pool.length; j++) {
      if (!alive[j] || overlapRatio(pool[i].quad, pool[j].quad) < OVERLAP_SUPPRESS) continue;
      // (spans like card+gap are already discounted by the aspect term, blocks by the composite filter)
      if (pool[j].score >= pool[i].score * 0.85 && pool[j].area > winner.area * 1.05) winner = pool[j];
    }
    kept.push(winner);
    for (let j = i; j < pool.length; j++) if (alive[j] && overlapRatio(winner.quad, pool[j].quad) >= OVERLAP_SUPPRESS) alive[j] = false;
    if (kept.length >= (opts.maxCards ?? 12)) break;
  }
  const confidenceOf = (c: Candidate) => c.support;
  // left-to-right, top-to-bottom reading order is nicer for the user; keep score for confidence
  return kept
    .map(c => ({ quad: c.quad.map(([x, y]) => [x * scale, y * scale]) as Quad, confidence: confidenceOf(c), _cx: (c.quad[0][0] + c.quad[2][0]) / 2, _cy: (c.quad[0][1] + c.quad[2][1]) / 2, _h: c.quad[3][1] - c.quad[0][1] }))
    .sort((a, b) => (Math.abs(a._cy - b._cy) > Math.max(a._h, b._h) * 0.5 ? a._cy - b._cy : a._cx - b._cx))
    .map(({ quad, confidence }) => ({ quad, confidence }));
}

/** The single best card quad (see detectCardQuads), or null. */
export function detectCardQuad(gray: Uint8Array | Uint8ClampedArray, width: number, height: number, debug?: DetectDebug): DetectedQuad | null {
  const { cands, scale, reject } = enumerateCandidates(gray, width, height, debug);
  if (cands.length === 0) { if (debug) debug.reject = reject; return null; }
  let best = cands[0];
  for (const c of cands) if (c.score >= cands[0].score * 0.85 && c.area > best.area * 1.05 && overlapRatio(c.quad, cands[0].quad) >= OVERLAP_SUPPRESS) best = c;
  return { quad: best.quad.map(([x, y]) => [x * scale, y * scale]) as Quad, confidence: best.support };
}
