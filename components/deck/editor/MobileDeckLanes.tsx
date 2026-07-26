"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Lane, LaneCardLike, LaneMode } from "./mobile-lanes";

/**
 * Mobile deck list — one lane per page, swiped horizontally.
 *
 * Lanes come from `buildLanes`; this component only arranges them. Rows are
 * supplied by the caller (`renderRow`) so the action sheet, ownership and
 * swap/move/remove wiring stay in one place.
 */

interface MobileDeckLanesProps<T extends LaneCardLike> {
  lanes: Array<Lane<T>>;
  mode: LaneMode;
  onModeChange: (mode: LaneMode) => void;
  renderRow: (card: T) => React.ReactNode;
  rowKey: (card: T) => string;
}

export default function MobileDeckLanes<T extends LaneCardLike>({
  lanes, mode, onModeChange, renderRow, rowKey,
}: MobileDeckLanesProps<T>) {
  const pagerRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  /** Pages are siblings in a flex row, so the pager would otherwise stand as tall
      as the longest lane and leave a dead gap under short ones. */
  const [pagerHeight, setPagerHeight] = useState<number>();

  // Lane set changes when the grouping does — start over at the first page.
  useEffect(() => {
    setActive(0);
    pagerRef.current?.scrollTo({ left: 0 });
  }, [mode]);

  // Scroll position is the source of truth: a swipe and a tab tap both land here.
  const syncActive = useCallback(() => {
    const pager = pagerRef.current;
    if (!pager || pager.clientWidth === 0) return;
    const idx = Math.round(pager.scrollLeft / pager.clientWidth);
    setActive(prev => (prev === idx ? prev : Math.min(Math.max(idx, 0), Math.max(lanes.length - 1, 0))));
  }, [lanes.length]);

  // Keep the active tab in view in the (scrollable) tab strip.
  useEffect(() => {
    tabsRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [active]);

  // Track the visible page's height — including row adds/removes while it's open.
  useEffect(() => {
    const page = pagerRef.current?.children[active] as HTMLElement | undefined;
    if (!page) return;
    const apply = () => setPagerHeight(page.offsetHeight);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(page);
    return () => ro.disconnect();
  }, [active, lanes]);

  const goTo = (idx: number) => {
    const pager = pagerRef.current;
    if (!pager) return;
    pager.scrollTo({ left: idx * pager.clientWidth, behavior: 'smooth' });
    setActive(idx);
  };

  const onTabKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    goTo(Math.min(Math.max(active + (e.key === 'ArrowRight' ? 1 : -1), 0), lanes.length - 1));
  };

  if (lanes.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 py-4">No cards yet</p>;
  }

  return (
    <div className="flex flex-col" data-testid="lane-view">
      {/* Controls stick under the app header so you can change lanes from anywhere
          in a long one (Actions runs 30+ rows) without scrolling back up. */}
      <div className="sticky top-14 z-20 -mx-1 px-1 pt-1 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm">
      {/* Grouping toggle — the lane header is the type cue, so this also decides
          whether the rows have one at all. */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Lanes</span>
        <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-700 overflow-hidden text-xs">
          {([
            { key: 'type' as const, label: 'Type' },
            { key: 'pitch' as const, label: 'Pitch' },
          ]).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={mode === key}
              aria-label={`Group by ${label.toLowerCase()}`}
              onClick={() => onModeChange(key)}
              className={cn(
                "px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400",
                key === 'pitch' && "border-l border-gray-300 dark:border-gray-700",
                mode === key
                  ? "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold"
                  : "text-gray-600 dark:text-gray-300",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab strip — also the deck's shape at a glance (17 / 6 / 28 / 19 / 3) */}
      <div
        ref={tabsRef}
        role="tablist"
        aria-label="Deck lanes"
        onKeyDown={onTabKeyDown}
        className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {lanes.map((lane, i) => (
          <button
            key={lane.key}
            role="tab"
            type="button"
            id={`lane-tab-${lane.key}`}
            aria-selected={i === active}
            aria-controls={`lane-panel-${lane.key}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => goTo(i)}
            className={cn(
              "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
              i === active
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold"
                : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300",
            )}
          >
            {lane.label}
            <span className="tabular-nums text-[10px] text-gray-500 dark:text-gray-400">{lane.count}</span>
          </button>
        ))}
      </div>
      </div>

      <div
        ref={pagerRef}
        data-testid="lane-pager"
        onScroll={syncActive}
        style={pagerHeight ? { height: pagerHeight } : undefined}
        className="flex items-start overflow-x-auto overflow-y-hidden snap-x snap-mandatory transition-[height] duration-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {lanes.map((lane, i) => (
          <section
            key={lane.key}
            id={`lane-panel-${lane.key}`}
            data-testid={`lane-panel-${lane.key}`}
            role="tabpanel"
            aria-labelledby={`lane-tab-${lane.key}`}
            // Inert pages stay in the tab order's way otherwise — only the visible
            // lane should be reachable by keyboard.
            {...(i === active ? {} : { 'aria-hidden': true })}
            className="shrink-0 basis-full snap-start pr-2"
          >
            <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
              <h3 className="flex items-baseline justify-between px-3 py-2 border-b border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{lane.label}</span>
                <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{lane.count}</span>
              </h3>
              {lane.cards.map(card => (
                <div key={rowKey(card)} data-testid="lane-row">{renderRow(card)}</div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="flex items-center justify-center gap-1.5 pt-2" aria-hidden="true">
        {lanes.map((lane, i) => (
          <span
            key={lane.key}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === active ? "w-4 bg-blue-500" : "w-1.5 bg-gray-300 dark:bg-gray-700",
            )}
          />
        ))}
      </div>
    </div>
  );
}
