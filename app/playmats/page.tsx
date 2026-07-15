// app/playmats/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Check, Heart, ImageOff, Search } from "lucide-react";
import { collectiblesClient } from "@/lib/client";
import type {
  CollectibleDTO,
  CollectibleMarkStatus,
} from "@/lib/services/contracts/ICollectibleService";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";

export default function PlaymatsPage() {
  const { status: sessionStatus } = useSession();
  const signedIn = sessionStatus === "authenticated";

  const [items, setItems] = useState<CollectibleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("all");
  // ids with an in-flight mark request, so double-clicks don't race
  const [pending, setPending] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const result = await collectiblesClient.listCollectibles({ kind: "playmat" });
    if (result.success) {
      setItems(result.data);
      setLoadError(null);
    } else {
      setLoadError(result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // refetch when auth resolves so viewerStatus reflects the session
    if (sessionStatus === "loading") return;
    void load();
  }, [load, sessionStatus]);

  const years = useMemo(() => {
    const ys = new Set<number>();
    for (const item of items) if (item.year != null) ys.add(item.year);
    return Array.from(ys).sort((a, b) => b - a);
  }, [items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (yearFilter !== "all" && String(item.year ?? "") !== yearFilter) return false;
      if (!q) return true;
      return [item.name, item.artist, item.source]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q));
    });
  }, [items, search, yearFilter]);

  const toggleMark = useCallback(
    async (item: CollectibleDTO, status: CollectibleMarkStatus) => {
      if (!signedIn || pending.has(item.id)) return;
      const clearing = item.viewerStatus === status;
      const nextStatus = clearing ? null : status;

      setPending((prev) => new Set(prev).add(item.id));
      // optimistic: flip viewerStatus + adjust counts locally
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? applyMark(it, nextStatus) : it)),
      );

      const result = clearing
        ? await collectiblesClient.clearMark(item.id)
        : await collectiblesClient.setMark(item.id, status);

      if (!result.success) {
        // revert to server truth
        void load();
      }
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    },
    [signedIn, pending, load],
  );

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Playmats</h1>
        <p className="mt-1 text-base text-gray-600 dark:text-gray-300">
          Every official Flesh and Blood playmat in one place — where it came
          from, who made it, and which ones you have or want.
        </p>
        {!signedIn && sessionStatus !== "loading" && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            <Link
              href="/login"
              className={`font-medium text-blue-600 underline dark:text-blue-400 ${FOCUS_RING}`}
            >
              Sign in
            </Link>{" "}
            to mark playmats as have or want.
          </p>
        )}
      </header>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, artist, or event…"
            aria-label="Search playmats"
            className={`w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-base dark:border-gray-700 dark:bg-gray-900 ${FOCUS_RING}`}
          />
        </div>
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          aria-label="Filter by year"
          className={`rounded-md border border-gray-300 bg-white px-3 py-2 text-base dark:border-gray-700 dark:bg-gray-900 ${FOCUS_RING}`}
        >
          <option value="all">All years</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="py-12 text-center text-base text-gray-600 dark:text-gray-300">
          Loading playmats…
        </p>
      ) : loadError ? (
        <p role="alert" className="py-12 text-center text-base text-red-600 dark:text-red-400">
          Couldn&apos;t load the catalog: {loadError}
        </p>
      ) : visible.length === 0 ? (
        <p className="py-12 text-center text-base text-gray-600 dark:text-gray-300">
          {items.length === 0
            ? "No playmats in the catalog yet — check back soon."
            : "No playmats match your search."}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" data-testid="playmat-grid">
          {visible.map((item) => (
            <li
              key={item.id}
              className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="relative aspect-[12/7] w-full bg-gray-100 dark:bg-gray-800">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={`${item.name} playmat`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-gray-600 dark:text-gray-400">
                    <ImageOff className="h-6 w-6" aria-hidden="true" />
                    <span className="text-sm">No image yet</span>
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-1 p-4">
                <h2 className="text-base font-semibold">{item.name}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {[item.source, item.year].filter(Boolean).join(" · ") || "Origin unknown"}
                </p>
                {item.artist && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">Art: {item.artist}</p>
                )}

                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {item.haveCount} {item.haveCount === 1 ? "collector has" : "collectors have"} it
                  · {item.wantCount} want it
                </p>

                <div className="mt-3 flex gap-2">
                  <MarkButton
                    label="Have"
                    active={item.viewerStatus === "have"}
                    disabled={!signedIn || pending.has(item.id)}
                    onClick={() => toggleMark(item, "have")}
                    activeClasses="border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-600"
                  />
                  <MarkButton
                    label="Want"
                    icon={<Heart className="h-4 w-4" aria-hidden="true" />}
                    active={item.viewerStatus === "want"}
                    disabled={!signedIn || pending.has(item.id)}
                    onClick={() => toggleMark(item, "want")}
                    activeClasses="border-rose-600 bg-rose-600 text-white dark:border-rose-500 dark:bg-rose-600"
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MarkButton({
  label,
  icon,
  active,
  disabled,
  onClick,
  activeClasses,
}: {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  activeClasses: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={disabled && !active ? "Sign in to track playmats" : undefined}
      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-base font-medium transition-colors disabled:cursor-not-allowed ${FOCUS_RING} ${
        active
          ? activeClasses
          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:disabled:text-gray-500"
      }`}
    >
      {/* active state is never color-only: ✓ prefix marks it (WCAG 1.4.1) */}
      {active ? <Check className="h-4 w-4" aria-hidden="true" /> : icon}
      {label}
    </button>
  );
}

function applyMark(
  item: CollectibleDTO,
  nextStatus: CollectibleMarkStatus | null,
): CollectibleDTO {
  const prevStatus = item.viewerStatus;
  if (prevStatus === nextStatus) return item;
  let { haveCount, wantCount } = item;
  if (prevStatus === "have") haveCount -= 1;
  if (prevStatus === "want") wantCount -= 1;
  if (nextStatus === "have") haveCount += 1;
  if (nextStatus === "want") wantCount += 1;
  return { ...item, viewerStatus: nextStatus, haveCount, wantCount };
}
