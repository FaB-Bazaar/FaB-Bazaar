// lib/scan/contour-detect.ts — card detection by closed contours, the approach
// that survives real photos: edges → connected edge components → convex hull →
// 4-corner polygon → card-shape filters → suppression. A card's frame (outer
// border, or the inner border→frame edge when the outer one vanishes on a dark
// mat) is a strong CLOSED contour; a type bar or text box never closes into a
// card-shaped hull. Pure TS on a grayscale plane; runs server-side or in a
// browser worker. Coordinates returned in input-image pixels.
import { orderQuad, quadArea, type Point, type Quad } from './geometry';

export interface ContourQuad { quad: Quad; confidence: number }

const WORK_MAX = 512;
const MIN_AREA = 0.015, MAX_AREA = 0.9;          // of the frame
const MIN_ASPECT = 1.1, MAX_ASPECT = 2.0;         // long/short side (card ≈1.4)
const SIDE_RATIO_MIN = 0.75;                      // opposite sides within this
const CORNER_TOL_DEG = 25;
const OVERLAP_IOU = 0.6;
const MIN_FILL = 0.55;                            // hull must be a solid shape: edge component bbox vs hull

// Several edge strategies for different lighting; their quads are pooled.
const STRATEGIES: Array<{ blur: number; highPct: number; lowRatio: number; dilate: number }> = [
  { blur: 2, highPct: 0.90, lowRatio: 0.4, dilate: 1 },
  { blur: 2, highPct: 0.80, lowRatio: 0.4, dilate: 1 },
  { blur: 1, highPct: 0.93, lowRatio: 0.5, dilate: 1 },
  { blur: 3, highPct: 0.85, lowRatio: 0.35, dilate: 2 },
];

function downscale(src: Uint8Array | Uint8ClampedArray, w: number, h: number) {
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

function boxBlur(px: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r <= 0) return px;
  const tmp = new Float32Array(px.length), out = new Float32Array(px.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let d = -r; d <= r; d++) { const xx = x + d; if (xx < 0 || xx >= w) continue; s += px[y * w + xx]; n++; } tmp[y * w + x] = s / n; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let d = -r; d <= r; d++) { const yy = y + d; if (yy < 0 || yy >= h) continue; s += tmp[yy * w + x]; n++; } out[y * w + x] = s / n; }
  return out;
}

/** Canny-lite: Sobel magnitude, non-max suppression along the gradient, hysteresis, dilation. */
function edgeMap(sm: Float32Array, w: number, h: number, highPct: number, lowRatio: number, dilate: number): Uint8Array {
  const mag = new Float32Array(w * h), dir = new Uint8Array(w * h); // dir: 0=horiz gradient(vertical edge),1=diag,2=vert,3=antidiag
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const gx = -sm[i - w - 1] + sm[i - w + 1] - 2 * sm[i - 1] + 2 * sm[i + 1] - sm[i + w - 1] + sm[i + w + 1];
    const gy = -sm[i - w - 1] - 2 * sm[i - w] - sm[i - w + 1] + sm[i + w - 1] + 2 * sm[i + w] + sm[i + w + 1];
    mag[i] = Math.hypot(gx, gy);
    const a = Math.atan2(gy, gx) * 180 / Math.PI; const aa = ((a % 180) + 180) % 180;
    dir[i] = aa < 22.5 || aa >= 157.5 ? 0 : aa < 67.5 ? 1 : aa < 112.5 ? 2 : 3;
  }
  const nz = Array.from(mag).filter(v => v > 0).sort((a, b) => a - b);
  if (nz.length < 50) return new Uint8Array(w * h);
  const high = Math.max(nz[Math.floor(nz.length * highPct)], 20), low = high * lowRatio;
  // non-max suppression
  const thin = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; const m = mag[i]; if (m < low) continue;
    let a = 0, b = 0;
    switch (dir[i]) { case 0: a = mag[i - 1]; b = mag[i + 1]; break; case 1: a = mag[i - w + 1]; b = mag[i + w - 1]; break; case 2: a = mag[i - w]; b = mag[i + w]; break; default: a = mag[i - w - 1]; b = mag[i + w + 1]; }
    if (m >= a && m >= b) thin[i] = m >= high ? 2 : 1;
  }
  // hysteresis: keep weak pixels connected to strong ones
  const out = new Uint8Array(w * h); const stack: number[] = [];
  for (let i = 0; i < thin.length; i++) if (thin[i] === 2) { out[i] = 1; stack.push(i); }
  while (stack.length) {
    const i = stack.pop()!; const x = i % w, y = (i - x) / w;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const j = yy * w + xx; if (thin[j] === 1 && !out[j]) { out[j] = 1; stack.push(j); }
    }
  }
  for (let d = 0; d < dilate; d++) {
    const src = out.slice();
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      if (src[y * w + x]) continue;
      if (src[y * w + x - 1] || src[y * w + x + 1] || src[(y - 1) * w + x] || src[(y + 1) * w + x]) out[y * w + x] = 1;
    }
  }
  return out;
}

/** 8-connected components of edge pixels; returns each component's pixel list. */
function components(edges: Uint8Array, w: number, h: number, minPixels: number): Point[][] {
  const seen = new Uint8Array(w * h); const out: Point[][] = [];
  for (let s = 0; s < edges.length; s++) {
    if (!edges[s] || seen[s]) continue;
    const pts: Point[] = []; const stack = [s]; seen[s] = 1;
    while (stack.length) {
      const i = stack.pop()!; const x = i % w, y = (i - x) / w; pts.push([x, y]);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx; if (edges[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
      }
    }
    if (pts.length >= minPixels) out.push(pts);
  }
  return out;
}

function convexHull(pts: Point[]): Point[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Point[] = []; for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  const upper: Point[] = []; for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  upper.pop(); lower.pop(); return lower.concat(upper);
}

/** Douglas–Peucker on a closed polygon. */
function simplify(poly: Point[], eps: number): Point[] {
  if (poly.length <= 4) return poly;
  // open the ring at the two farthest-apart points, simplify both halves
  let a = 0, b = 0, best = -1;
  for (let i = 0; i < poly.length; i++) for (let j = i + 1; j < poly.length; j++) { const d = Math.hypot(poly[i][0] - poly[j][0], poly[i][1] - poly[j][1]); if (d > best) { best = d; a = i; b = j; } }
  const seg1 = poly.slice(a, b + 1), seg2 = poly.slice(b).concat(poly.slice(0, a + 1));
  const dp = (pts: Point[]): Point[] => {
    if (pts.length < 3) return pts;
    const [s, e] = [pts[0], pts[pts.length - 1]]; let maxD = -1, idx = -1;
    const L = Math.hypot(e[0] - s[0], e[1] - s[1]) || 1e-9;
    for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs((e[0] - s[0]) * (s[1] - pts[i][1]) - (s[0] - pts[i][0]) * (e[1] - s[1])) / L; if (d > maxD) { maxD = d; idx = i; } }
    if (maxD > eps) { const l = dp(pts.slice(0, idx + 1)), r = dp(pts.slice(idx)); return l.slice(0, -1).concat(r); }
    return [s, e];
  };
  const r1 = dp(seg1), r2 = dp(seg2);
  return r1.slice(0, -1).concat(r2.slice(0, -1));
}

/**
 * Minimum-area rotated bounding rectangle of a convex hull (rotating calipers
 * over hull edge directions). Robust to tilt and to a clipped corner; the
 * line-fit refinement afterwards corrects it for perspective.
 */
function minAreaRect(hull: Point[]): Quad | null {
  if (hull.length < 3) return null;
  let best: { area: number; quad: Quad } | null = null;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    if (L < 1e-6) continue;
    const ux = dx / L, uy = dy / L, vx = -uy, vy = ux;
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const [x, y] of hull) { const u = x * ux + y * uy, v = x * vx + y * vy; if (u < minU) minU = u; if (u > maxU) maxU = u; if (v < minV) minV = v; if (v > maxV) maxV = v; }
    const area = (maxU - minU) * (maxV - minV);
    if (!best || area < best.area) {
      const c = (u: number, v: number): Point => [u * ux + v * vx, u * uy + v * vy];
      best = { area, quad: orderQuad([c(minU, minV), c(maxU, minV), c(maxU, maxV), c(minU, maxV)]) };
    }
  }
  return best?.quad ?? null;
}

function quadFrom(hull: Point[]): Quad | null {
  const rect = minAreaRect(hull);
  if (rect) return rect;
  const perim = hull.reduce((s, p, i) => s + Math.hypot(p[0] - hull[(i + 1) % hull.length][0], p[1] - hull[(i + 1) % hull.length][1]), 0);
  for (const f of [0.02, 0.03, 0.05, 0.07, 0.1]) {
    const poly = simplify(hull, perim * f);
    if (poly.length === 4) return orderQuad(poly);
    if (poly.length < 4) return null;
  }
  return null;
}

/** Move each corner inward along the bisector by `d` px (undo edge dilation / hull outward bias). */
function shrink(q: Quad, d: number): Quad {
  const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, cy = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
  return q.map(([x, y]) => { const L = Math.hypot(x - cx, y - cy) || 1; return [x - ((x - cx) / L) * d * 1.414, y - ((y - cy) / L) * d * 1.414] as Point; }) as Quad;
}

const CARD_ASPECT_INNER = 1.42;
/**
 * A FaB card is 63×88 mm. When a detected quad is too SHORT (its bottom edge
 * fell on the type bar because the frame's bottom is busy), extend both sides
 * along their own direction so the height matches the card aspect, keeping the
 * top edge. Too-tall quads are left alone (no way to know which end is wrong).
 */
function snapAspect(q: Quad): Quad {
  const top = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]);
  const left = Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1]), right = Math.hypot(q[2][0] - q[1][0], q[2][1] - q[1][1]);
  const aspect = ((left + right) / 2) / Math.max(1, top);
  if (aspect >= 1.32 || aspect < 1.1) return q;
  const target = top * CARD_ASPECT_INNER;
  const ext = (a: Point, b: Point, len: number): Point => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [a[0] + ((b[0] - a[0]) / L) * len, a[1] + ((b[1] - a[1]) / L) * len]; };
  return [q[0], q[1], ext(q[1], q[2], target), ext(q[0], q[3], target)];
}

function validQuad(q: Quad, w: number, h: number): { ok: boolean; aspect: number } {
  const side = (i: number) => Math.hypot(q[(i + 1) % 4][0] - q[i][0], q[(i + 1) % 4][1] - q[i][1]);
  const top = side(0), right = side(1), bottom = side(2), left = side(3);
  if (Math.min(top, bottom) / Math.max(top, bottom) < SIDE_RATIO_MIN) return { ok: false, aspect: 0 };
  if (Math.min(left, right) / Math.max(left, right) < SIDE_RATIO_MIN) return { ok: false, aspect: 0 };
  // Cards are photographed upright: the vertical sides must be the long ones. A landscape rectangle
  // inside a portrait frame is a text box or an art window, never a card.
  const long = (left + right) / 2, short = (top + bottom) / 2;
  if (long < short) return { ok: false, aspect: 0 };
  const aspect = long / Math.max(1, short);
  if (aspect < MIN_ASPECT || aspect > MAX_ASPECT) return { ok: false, aspect };
  for (let i = 0; i < 4; i++) {
    const p = q[(i + 3) % 4], c = q[i], n = q[(i + 1) % 4];
    const v1 = [p[0] - c[0], p[1] - c[1]], v2 = [n[0] - c[0], n[1] - c[1]];
    const ang = Math.acos((v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(v1[0], v1[1]) * Math.hypot(v2[0], v2[1]) || 1)) * 180 / Math.PI;
    if (Math.abs(ang - 90) > CORNER_TOL_DEG) return { ok: false, aspect };
  }
  const area = quadArea(q) / (w * h);
  if (area < MIN_AREA || area > MAX_AREA) return { ok: false, aspect };
  return { ok: true, aspect };
}

function iou(a: Quad, b: Quad): number {
  const bb = (q: Quad) => ({ x0: Math.min(...q.map(p => p[0])), y0: Math.min(...q.map(p => p[1])), x1: Math.max(...q.map(p => p[0])), y1: Math.max(...q.map(p => p[1])) });
  const A = bb(a), B = bb(b);
  const ix = Math.max(0, Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0)), iy = Math.max(0, Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0));
  const inter = ix * iy, union = (A.x1 - A.x0) * (A.y1 - A.y0) + (B.x1 - B.x0) * (B.y1 - B.y0) - inter;
  return union > 0 ? inter / union : 0;
}
/** Fraction of the smaller bbox covered by the larger one. */
function coverOfSmaller(a: Quad, b: Quad): number {
  const bb = (q: Quad) => ({ x0: Math.min(...q.map(p => p[0])), y0: Math.min(...q.map(p => p[1])), x1: Math.max(...q.map(p => p[0])), y1: Math.max(...q.map(p => p[1])) });
  const A = bb(a), B = bb(b);
  const ix = Math.max(0, Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0)), iy = Math.max(0, Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0));
  const small = Math.min((A.x1 - A.x0) * (A.y1 - A.y0), (B.x1 - B.x0) * (B.y1 - B.y0));
  return small > 0 ? (ix * iy) / small : 0;
}
function contains(outer: Quad, inner: Quad): boolean {
  const bb = (q: Quad) => ({ x0: Math.min(...q.map(p => p[0])), y0: Math.min(...q.map(p => p[1])), x1: Math.max(...q.map(p => p[0])), y1: Math.max(...q.map(p => p[1])) });
  const O = bb(outer), I = bb(inner); const tx = (O.x1 - O.x0) * 0.03, ty = (O.y1 - O.y0) * 0.03;
  return I.x0 >= O.x0 - tx && I.y0 >= O.y0 - ty && I.x1 <= O.x1 + tx && I.y1 <= O.y1 + ty;
}

/**
 * Refine a quad's corners: fit a straight line (PCA) to the component's edge
 * points lying along each side, then intersect adjacent lines. A corner the
 * contour never reached (a broken edge chain at a busy card bottom) is
 * recovered by extrapolating the two lines that lead into it.
 */
function refineQuad(q: Quad, pts: Point[]): Quad {
  const lines: Array<{ p: Point; d: Point } | null> = [];
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    const near: Point[] = [];
    for (const [x, y] of pts) {
      const dist = Math.abs((x - a[0]) * nx + (y - a[1]) * ny);
      const t = ((x - a[0]) * dx + (y - a[1]) * dy) / (L * L);
      if (dist <= 3 && t >= 0.08 && t <= 0.92) near.push([x, y]);
    }
    if (near.length < 10) { lines.push(null); continue; }
    let mx = 0, my = 0; for (const [x, y] of near) { mx += x; my += y; } mx /= near.length; my /= near.length;
    let sxx = 0, sxy = 0, syy = 0; for (const [x, y] of near) { sxx += (x - mx) ** 2; sxy += (x - mx) * (y - my); syy += (y - my) ** 2; }
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    lines.push({ p: [mx, my], d: [Math.cos(ang), Math.sin(ang)] });
  }
  const out: Point[] = [];
  for (let i = 0; i < 4; i++) {
    const l1 = lines[(i + 3) % 4], l2 = lines[i];
    if (!l1 || !l2) { out.push(q[i]); continue; }
    const det = l1.d[0] * l2.d[1] - l1.d[1] * l2.d[0];
    if (Math.abs(det) < 1e-6) { out.push(q[i]); continue; }
    const t = ((l2.p[0] - l1.p[0]) * l2.d[1] - (l2.p[1] - l1.p[1]) * l2.d[0]) / det;
    const x = l1.p[0] + l1.d[0] * t, y = l1.p[1] + l1.d[1] * t;
    // sanity: a refined corner must stay near the original (≤ 15% of the quad size)
    const size = Math.hypot(q[2][0] - q[0][0], q[2][1] - q[0][1]);
    out.push(Math.hypot(x - q[i][0], y - q[i][1]) <= size * 0.15 ? [x, y] : q[i]);
  }
  return orderQuad(out);
}

/** Fraction of the quad's perimeter (sampled) lying on an edge pixel. */
function perimeterSupport(edges: Uint8Array, w: number, h: number, q: Quad): number {
  let hit = 0, n = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4]; const len = Math.max(4, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])));
    for (let k = 0; k <= len; k++) {
      const t = k / len; const x = Math.round(a[0] + (b[0] - a[0]) * t), y = Math.round(a[1] + (b[1] - a[1]) * t); n++;
      let f = false; for (let dy = -1; dy <= 1 && !f; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h && edges[yy * w + xx]) { f = true; break; } }
      if (f) hit++;
    }
  }
  return n ? hit / n : 0;
}

export interface ContourTrace { pooled: Array<{ quad: Quad; score: number; area: number; aspect: number; strategy: number }>; dropped: Array<{ quad: Quad; why: string }>; rejected?: Array<{ strategy: number; bbox: [number, number, number, number]; pixels: number; why: string }>; scale: number }

export function detectCardContours(gray: Uint8Array | Uint8ClampedArray, width: number, height: number, opts: { maxCards?: number; trace?: ContourTrace } = {}): ContourQuad[] {
  const { px, w, h, scale } = downscale(gray, width, height);
  if (opts.trace) opts.trace.scale = scale;
  const minPixels = Math.round(2 * (w + h) * 0.15); // a card's contour is at least ~15% of the frame perimeter
  const pooled: Array<{ quad: Quad; score: number; area: number; aspect: number }> = [];
  for (let si = 0; si < STRATEGIES.length; si++) {
    const st = STRATEGIES[si];
    const edges = edgeMap(boxBlur(px, w, h, st.blur), w, h, st.highPct, st.lowRatio, st.dilate);
    for (const comp of components(edges, w, h, minPixels)) {
      const hull = convexHull(comp);
      const rej = (why: string) => { if (opts.trace?.rejected) { const xs = comp.map(p => p[0]), ys = comp.map(p => p[1]); opts.trace.rejected.push({ strategy: si, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], pixels: comp.length, why }); } };
      if (hull.length < 4) { rej('hull<4'); continue; }
      // a card contour is a ring: its pixels sit ON the hull, not filling it (shoelace area of the whole hull)
      let hullArea = 0; for (let k = 0; k < hull.length; k++) { const [x1, y1] = hull[k], [x2, y2] = hull[(k + 1) % hull.length]; hullArea += x1 * y2 - x2 * y1; } hullArea = Math.abs(hullArea) / 2;
      if (comp.length > hullArea * (1 - MIN_FILL)) { rej('solid'); continue; } // solid blob, not a frame
      const raw = quadFrom(hull);
      if (!raw) { rej('no quad'); continue; }
      const quad = snapAspect(shrink(refineQuad(raw, comp), st.dilate + 0.5));
      const v = validQuad(quad, w, h);
      if (!v.ok) { rej(`invalid aspect=${v.aspect.toFixed(2)}`); continue; }
      const score = perimeterSupport(edges, w, h, quad);
      if (score < 0.5) { rej(`weak ${score.toFixed(2)}`); continue; }
      pooled.push({ quad, score, area: quadArea(quad), aspect: v.aspect });
      opts.trace?.pooled.push({ quad, score, area: quadArea(quad), aspect: v.aspect, strategy: si });
    }
  }
  if (pooled.length === 0) return [];
  // suppression: high IoU → keep the better score; containment → prefer the OUTER (a card's border rings nest)
  const portrait = (q: Quad) => { const top = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]); const left = Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1]); return left >= top; };
  // 0) a portrait quad enclosing ≥2 non-overlapping smaller PORTRAIT quads is a block of cards, not a card
  const isBlock = (c: typeof pooled[0]) => {
    const inner = pooled.filter(o => o !== c && portrait(o.quad) && o.area < c.area * 0.6 && o.area > c.area * 0.12 && contains(c.quad, o.quad));
    const picked: Quad[] = []; for (const o of inner) if (picked.every(p => iou(p, o.quad) < 0.3)) picked.push(o.quad);
    return picked.length >= 2;
  };
  const cards = pooled.filter(c => { const b = isBlock(c); if (b) opts.trace?.dropped.push({ quad: c.quad, why: 'block' }); return !b; });
  cards.sort((a, b) => b.score - a.score);
  const kept: typeof pooled = [];
  for (const c of cards) {
    let drop = false;
    for (let k = 0; k < kept.length; k++) {
      const o = kept[k];
      if (iou(c.quad, o.quad) > OVERLAP_IOU) { drop = true; opts.trace?.dropped.push({ quad: c.quad, why: 'iou' }); break; }
      if (contains(o.quad, c.quad) || (c.area < o.area * 0.6 && coverOfSmaller(o.quad, c.quad) >= 0.8)) {
        // inside (or 80% inside) a kept card: an inner border ring or a feature (text box / art window) —
        // either way the kept outer quad is the card
        drop = true; opts.trace?.dropped.push({ quad: c.quad, why: 'inside kept' }); break;
      }
      if (contains(c.quad, o.quad) && portrait(o.quad) && o.area > c.area * 0.5 && c.score >= o.score * 0.8) { kept[k] = c; drop = true; break; } // outer ring: take it
      if (contains(c.quad, o.quad) && (!portrait(o.quad) || o.area <= c.area * 0.5) && c.score >= o.score * 0.6) { kept[k] = c; drop = true; break; } // kept one was a feature of this card
    }
    if (!drop) kept.push(c);
  }
  return kept
    .slice(0, opts.maxCards ?? 12)
    .map(c => ({ quad: c.quad.map(([x, y]) => [x * scale, y * scale]) as Quad, confidence: c.score, _cx: (c.quad[0][0] + c.quad[2][0]) / 2, _cy: (c.quad[0][1] + c.quad[2][1]) / 2, _h: c.quad[3][1] - c.quad[0][1] }))
    .sort((a, b) => (Math.abs(a._cy - b._cy) > Math.max(a._h, b._h) * 0.5 ? a._cy - b._cy : a._cx - b._cx))
    .map(({ quad, confidence }) => ({ quad, confidence }));
}
