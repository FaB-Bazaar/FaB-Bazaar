"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus } from "lucide-react";
import {
  AXIS_IDS,
  AXIS_LABELS,
  BUCKET_ORDER,
  FlowAxisId,
  FlowBucket,
  FlowCard,
  FlowContext,
  classify,
  computeTopKeywords,
} from "@/lib/deck-flow/classify";

const DEFAULT_COLUMNS: FlowAxisId[] = ["pitch", "supertype", "blocks"];
const MAX_COLUMNS = 4;
const MIN_COLUMNS = 2;

type RawPrinting = {
  printingId: string;
  quantity?: number;
  foiling?: string;
  printingDetails?: {
    display_name?: string;
    name?: string;
    types?: string[];
    keywords?: string[];
    classes?: string[];
    talents?: string[];
    pitch?: number | null;
    cost?: number | null;
    defense?: number | null;
    power?: number | null;
    image_url?: string;
    foiling?: string;
  };
};

type DeckFlowProps = {
  deckId: string;
  maindeck: RawPrinting[];
  hero: RawPrinting[];
};

function toFlowCard(p: RawPrinting): FlowCard {
  const d = p.printingDetails ?? {};
  const imageUrl =
    d.image_url ||
    (p.printingId
      ? `https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${p.printingId}/public`
      : undefined);
  return {
    name: d.display_name || d.name || "Unknown",
    quantity: p.quantity ?? 1,
    types: d.types ?? [],
    keywords: d.keywords ?? [],
    classes: d.classes ?? [],
    talents: d.talents ?? [],
    pitch: d.pitch ?? null,
    cost: d.cost ?? null,
    defense: d.defense ?? null,
    power: d.power ?? null,
    printingId: p.printingId,
    imageUrl,
    foiling: p.foiling || d.foiling,
  };
}

type Node = {
  key: string;
  col: number;
  bucket: FlowBucket;
  count: number;
  cards: FlowCard[];
  x: number;
  y: number;
  h: number;
  inY: number;
  outY: number;
  color: string;
};

type Link = {
  key: string;
  source: Node;
  target: Node;
  value: number;
  color: string;
  cards: FlowCard[];
};

type Graph = { nodes: Node[]; links: Link[] };

function shade(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  let r = (n >> 16) & 0xff;
  let g = (n >> 8) & 0xff;
  let b = n & 0xff;
  if (amt >= 0) {
    r = Math.round(r + (255 - r) * amt);
    g = Math.round(g + (255 - g) * amt);
    b = Math.round(b + (255 - b) * amt);
  } else {
    const f = 1 + amt;
    r = Math.round(r * f);
    g = Math.round(g * f);
    b = Math.round(b * f);
  }
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function buildGraph(cards: FlowCard[], columns: FlowAxisId[], ctx: FlowContext): Graph {
  const nodes = new Map<string, Node>();
  const links = new Map<string, Link>();

  const ensureNode = (col: number, bucket: FlowBucket): Node => {
    const key = `${col}:${bucket.id}`;
    let n = nodes.get(key);
    if (!n) {
      n = {
        key,
        col,
        bucket,
        count: 0,
        cards: [],
        x: 0,
        y: 0,
        h: 0,
        inY: 0,
        outY: 0,
        color: bucket.color,
      };
      nodes.set(key, n);
    }
    return n;
  };

  const ensureLink = (src: Node, tgt: Node): Link => {
    const key = `${src.key}|${tgt.key}`;
    let l = links.get(key);
    if (!l) {
      l = { key, source: src, target: tgt, value: 0, color: src.color, cards: [] };
      links.set(key, l);
    }
    return l;
  };

  for (const card of cards) {
    const qty = card.quantity || 1;
    const buckets = columns.map((axis) => classify(card, axis, ctx));
    const path = buckets.map((b, i) => ensureNode(i, b));
    for (const n of path) {
      n.count += qty;
      if (!n.cards.includes(card)) n.cards.push(card);
    }
    for (let i = 0; i < path.length - 1; i++) {
      const l = ensureLink(path[i], path[i + 1]);
      l.value += qty;
      if (!l.cards.includes(card)) l.cards.push(card);
    }
  }

  const nodeList = Array.from(nodes.values());
  const linkList = Array.from(links.values());

  // Each ribbon takes its source node's own bucket color, so every column
  // segment reads in that column's palette (pitch reds only on pitch ribbons).
  // Within one source node's outflows, shade slightly so different targets
  // read as distinct tints of the same hue (Red → Attack Action vs Red →
  // Non-attack Action).
  const outgoing = new Map<string, Link[]>();
  for (const l of linkList) {
    const list = outgoing.get(l.source.key) ?? [];
    list.push(l);
    outgoing.set(l.source.key, list);
  }
  for (const links of outgoing.values()) {
    const targetAxis = columns[links[0].target.col];
    const order = BUCKET_ORDER[targetAxis];
    links.sort((a, b) => {
      if (!order) return 0;
      const ra = order.indexOf(a.target.bucket.id);
      const rb = order.indexOf(b.target.bucket.id);
      return (ra === -1 ? 999 : ra) - (rb === -1 ? 999 : rb);
    });
    const n = links.length;
    for (let i = 0; i < n; i++) {
      const amt = n === 1 ? 0 : ((i / (n - 1)) - 0.5) * 0.6;
      links[i].color = shade(links[i].source.bucket.color, amt);
    }
  }

  return { nodes: nodeList, links: linkList };
}

function layoutGraph(
  graph: Graph,
  width: number,
  height: number,
  columns: FlowAxisId[],
) {
  const columnsCount = columns.length;
  const pad = 6;
  const nodeWidth = 12;
  const colGap = 6;

  const colX: number[] = [];
  for (let c = 0; c < columnsCount; c++) {
    const x = pad + (width - pad * 2 - nodeWidth) * (c / Math.max(1, columnsCount - 1));
    colX.push(x);
  }

  const byCol: Node[][] = Array.from({ length: columnsCount }, () => []);
  for (const n of graph.nodes) byCol[n.col].push(n);
  for (let ci = 0; ci < byCol.length; ci++) {
    const order = BUCKET_ORDER[columns[ci]];
    if (order) {
      const rank = new Map(order.map((id, i) => [id, i]));
      byCol[ci].sort((a, b) => {
        const ra = rank.get(a.bucket.id) ?? 999;
        const rb = rank.get(b.bucket.id) ?? 999;
        if (ra !== rb) return ra - rb;
        return b.count - a.count;
      });
    } else {
      byCol[ci].sort((a, b) => b.count - a.count);
    }
  }

  let maxTotal = 0;
  for (const arr of byCol) {
    const sum = arr.reduce((s, n) => s + n.count, 0);
    if (sum > maxTotal) maxTotal = sum;
  }
  const maxNodes = Math.max(1, ...byCol.map((a) => a.length));
  const available = height - Math.max(0, (maxNodes - 1) * colGap);
  const heightPerUnit = maxTotal ? available / maxTotal : 0;

  for (let ci = 0; ci < byCol.length; ci++) {
    let y = 0;
    for (const n of byCol[ci]) {
      n.x = colX[ci];
      n.h = Math.max(2, n.count * heightPerUnit);
      n.y = y;
      y += n.h + colGap;
      n.inY = 0;
      n.outY = 0;
    }
  }

  return { nodeWidth, heightPerUnit };
}

function ribbonPath(
  l: Link,
  nodeWidth: number,
  thickness: number,
): { d: string; sy: number; ty: number } {
  const sx = l.source.x + nodeWidth;
  const tx = l.target.x;
  const sy = l.source.y + l.source.outY;
  const ty = l.target.y + l.target.inY;
  const midX = (sx + tx) / 2;
  const d =
    `M${sx},${sy} ` +
    `C${midX},${sy} ${midX},${ty} ${tx},${ty} ` +
    `L${tx},${ty + thickness} ` +
    `C${midX},${ty + thickness} ${midX},${sy + thickness} ${sx},${sy + thickness} Z`;
  return { d, sy, ty };
}

function storageKey(deckId: string) {
  return `deck-flow:${deckId}:columns`;
}

function useContainerWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(800);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0) setW(rect.width);
    });
    ro.observe(el);
    setW(el.getBoundingClientRect().width || 800);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export default function DeckFlow({ deckId, maindeck, hero }: DeckFlowProps) {
  const [columns, setColumns] = useState<FlowAxisId[]>(DEFAULT_COLUMNS);
  const [selection, setSelection] = useState<
    { kind: "node" | "link"; key: string } | null
  >(null);
  const [zoomCard, setZoomCard] = useState<{ src: string; alt: string } | null>(
    null,
  );
  const [containerRef, width] = useContainerWidth();

  useEffect(() => {
    if (!zoomCard) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomCard(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomCard]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(deckId));
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (
        Array.isArray(parsed) &&
        parsed.length >= MIN_COLUMNS &&
        parsed.length <= MAX_COLUMNS &&
        parsed.every((x) => AXIS_IDS.includes(x))
      ) {
        setColumns(parsed);
      }
    } catch {
      // ignore
    }
  }, [deckId]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(deckId), JSON.stringify(columns));
    } catch {
      // ignore
    }
  }, [deckId, columns]);

  const flowCards = useMemo(() => {
    return maindeck.map(toFlowCard).filter((c) => {
      const types = new Set(c.types.map((t) => t.toLowerCase()));
      // Exclude non-Evo equipment (arsenal/inventory items that aren't Evo-subtype)
      if (types.has("equipment") && !types.has("evo")) return false;
      return true;
    });
  }, [maindeck]);

  const heroCtx = useMemo<FlowContext>(() => {
    const heroCard = hero[0]?.printingDetails;
    const heroClass = heroCard?.classes?.[0]?.toLowerCase() ?? null;
    const talents = (heroCard?.talents ?? []).map((t) => t.toLowerCase());
    return {
      hero: { heroClass, talents },
      topKeywords: computeTopKeywords(flowCards, 5),
    };
  }, [hero, flowCards]);

  const graph = useMemo(
    () => buildGraph(flowCards, columns, heroCtx),
    [flowCards, columns, heroCtx],
  );

  const height = Math.max(280, Math.min(520, flowCards.length * 6 + 80));
  const { nodeWidth, heightPerUnit } = useMemo(() => {
    return layoutGraph(graph, width, height, columns);
  }, [graph, width, height, columns]);

  // Stable sort + compute ribbon y-offsets (thickness shares heightPerUnit with nodes)
  const ribbons = useMemo(() => {
    const sorted = graph.links
      .slice()
      .sort((a, b) => a.source.y - b.source.y || a.target.y - b.target.y);
    const out: Array<{
      link: Link;
      d: string;
      thickness: number;
      cx: number;
      cy: number;
    }> = [];
    for (const l of sorted) {
      const thickness = Math.max(1, l.value * heightPerUnit);
      const { d, sy, ty } = ribbonPath(l, nodeWidth, thickness);
      const cx = (l.source.x + nodeWidth + l.target.x) / 2;
      const cy = (sy + ty) / 2 + thickness / 2;
      l.source.outY += thickness;
      l.target.inY += thickness;
      out.push({ link: l, d, thickness, cx, cy });
    }
    for (const n of graph.nodes) {
      n.inY = 0;
      n.outY = 0;
    }
    return out;
  }, [graph, heightPerUnit, nodeWidth]);

  const selected = useMemo(() => {
    if (!selection) return null;
    if (selection.kind === "node") {
      const n = graph.nodes.find((x) => x.key === selection.key);
      if (!n) return null;
      return {
        kind: "node" as const,
        label: n.bucket.label,
        count: n.count,
        cards: n.cards,
      };
    }
    const l = graph.links.find((x) => x.key === selection.key);
    if (!l) return null;
    return {
      kind: "link" as const,
      label: `${l.source.bucket.label} → ${l.target.bucket.label}`,
      count: l.value,
      cards: l.cards,
    };
  }, [graph.nodes, graph.links, selection]);

  const setColumn = (i: number, id: FlowAxisId) => {
    setColumns((prev) => prev.map((c, idx) => (idx === i ? id : c)));
  };

  const addColumn = () => {
    if (columns.length >= MAX_COLUMNS) return;
    const next = AXIS_IDS.find((id) => !columns.includes(id)) ?? "keyword";
    setColumns((prev) => [...prev, next]);
  };

  const removeColumn = (i: number) => {
    if (columns.length <= MIN_COLUMNS) return;
    setColumns((prev) => prev.filter((_, idx) => idx !== i));
  };

  const resetColumns = () => setColumns(DEFAULT_COLUMNS);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>Flow</CardTitle>
          <Button variant="ghost" size="sm" onClick={resetColumns} className="text-gray-500">
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {columns.map((id, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="text-xs text-gray-400">{i + 1}</span>
              <Select value={id} onValueChange={(v) => setColumn(i, v as FlowAxisId)}>
                <SelectTrigger className="h-8 w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AXIS_IDS.map((aid) => (
                    <SelectItem key={aid} value={aid}>
                      {AXIS_LABELS[aid]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {columns.length > MIN_COLUMNS && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => removeColumn(i)}
                  aria-label={`Remove column ${i + 1}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
          {columns.length < MAX_COLUMNS && (
            <Button variant="outline" size="sm" onClick={addColumn} className="h-8">
              <Plus className="h-3 w-3 mr-1" />
              Column
            </Button>
          )}
        </div>

        <div ref={containerRef} className="w-full">
          {graph.nodes.length === 0 ? (
            <div className="text-sm text-gray-400 py-8 text-center">
              No maindeck cards to visualize.
            </div>
          ) : (
            <svg
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              className="block"
            >
              {ribbons.map(({ link, d }) => {
                const isActive =
                  selection?.kind === "link" && selection.key === link.key;
                return (
                  <path
                    key={link.key}
                    d={d}
                    fill={link.color}
                    fillOpacity={isActive ? 0.7 : 0.3}
                    className="cursor-pointer transition-opacity hover:opacity-80"
                    onClick={() =>
                      setSelection(
                        isActive ? null : { kind: "link", key: link.key },
                      )
                    }
                  >
                    <title>
                      {`${link.source.bucket.label} → ${link.target.bucket.label}: ${link.value}`}
                    </title>
                  </path>
                );
              })}
              {ribbons
                .filter((r) => r.thickness >= 10)
                .map(({ link, cx, cy }) => (
                  <text
                    key={`lbl-${link.key}`}
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={11}
                    className="fill-white/90 pointer-events-none select-none"
                    style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.6)", strokeWidth: 3 }}
                  >
                    {link.value}
                  </text>
                ))}
              {graph.nodes.map((n) => {
                const labelOnRight = n.col < columns.length - 1;
                const labelX = labelOnRight ? n.x + nodeWidth + 5 : n.x - 5;
                const anchor = labelOnRight ? "start" : "end";
                const cap =
                  n.bucket.label.length > 20
                    ? n.bucket.label.slice(0, 19) + "…"
                    : n.bucket.label;
                const isActive =
                  selection?.kind === "node" && selection.key === n.key;
                return (
                  <g key={n.key}>
                    <rect
                      x={n.x}
                      y={n.y}
                      width={nodeWidth}
                      height={n.h}
                      fill={n.bucket.color}
                      rx={2}
                      ry={2}
                      className="cursor-pointer"
                      style={{ outline: isActive ? "2px solid currentColor" : "none" }}
                      onClick={() =>
                        setSelection(
                          isActive ? null : { kind: "node", key: n.key },
                        )
                      }
                    >
                      <title>{`${n.bucket.label}: ${n.count}`}</title>
                    </rect>
                    <text
                      x={labelX}
                      y={n.y + n.h / 2}
                      dominantBaseline="middle"
                      textAnchor={anchor}
                      fontSize={11}
                      className="fill-gray-700 dark:fill-gray-200 pointer-events-none"
                    >
                      {cap}
                      <tspan dx={4} className="fill-gray-400">
                        {n.count}
                      </tspan>
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {graph.nodes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs">
            {columns.map((axisId, ci) => {
              const buckets = graph.nodes
                .filter((n) => n.col === ci)
                .sort((a, b) => b.count - a.count);
              if (!buckets.length) return null;
              return (
                <div key={ci} className="flex items-start gap-2">
                  <span className="text-gray-400 shrink-0">
                    {ci + 1}. {AXIS_LABELS[axisId]}
                  </span>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {buckets.map((n) => {
                      const isActive =
                        selection?.kind === "node" && selection.key === n.key;
                      return (
                        <button
                          key={n.key}
                          type="button"
                          onClick={() =>
                            setSelection(
                              isActive
                                ? null
                                : { kind: "node", key: n.key },
                            )
                          }
                          className={`flex items-center gap-1.5 rounded px-1 py-0.5 transition-colors ${
                            isActive
                              ? "bg-gray-200 dark:bg-gray-700"
                              : "hover:bg-gray-100 dark:hover:bg-gray-800"
                          }`}
                        >
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: n.bucket.color }}
                          />
                          <span className="text-gray-700 dark:text-gray-200">
                            {n.bucket.label}
                          </span>
                          <span className="text-gray-400">{n.count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selected && (
          <div className="mt-4 border-t border-gray-300 dark:border-gray-700 pt-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">
                {selected.label} · {selected.count} card
                {selected.count === 1 ? "" : "s"}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSelection(null)}
              >
                Clear
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
              {selected.cards
                .slice()
                .sort(
                  (a, b) =>
                    (b.quantity || 1) - (a.quantity || 1) ||
                    a.name.localeCompare(b.name),
                )
                .map((c) => (
                  <div
                    key={`${c.printingId ?? c.name}`}
                    className="group relative flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300"
                  >
                    {c.imageUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setZoomCard({ src: c.imageUrl!, alt: c.name })
                        }
                        className="h-10 w-[28px] shrink-0 rounded-sm overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                        aria-label={`View ${c.name}`}
                      >
                        <img
                          src={c.imageUrl}
                          alt={c.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    ) : (
                      <div className="h-10 w-[28px] shrink-0 rounded-sm bg-gray-800" />
                    )}
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-gray-400">×{c.quantity || 1}</span>
                    {c.imageUrl && (
                      <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover:block pointer-events-none">
                        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl border-2 border-gray-300 dark:border-gray-600 overflow-hidden">
                          <img
                            src={c.imageUrl}
                            alt={c.name}
                            className="w-64 h-auto"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>

      {zoomCard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoomCard(null)}
          role="dialog"
          aria-label="Card preview"
        >
          <img
            src={zoomCard.src}
            alt={zoomCard.alt}
            className="max-h-[90vh] max-w-[min(90vw,500px)] rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </Card>
  );
}
