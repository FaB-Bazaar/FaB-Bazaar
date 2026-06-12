// app/admin/sets/SetsOrderClient.tsx
"use client";

import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, Save } from "lucide-react";
import type { SetDTO } from "@/lib/services/contracts/ISetsService";

const CATEGORY_BADGE: Record<string, string> = {
  standard: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  armory: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  "non-standard": "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  excluded: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

interface SetsOrderClientProps {
  initialSets: SetDTO[];
}

export function SetsOrderClient({ initialSets }: SetsOrderClientProps) {
  const sortedInitial = useMemo(
    () => [...initialSets].sort((a, b) => a.displayOrder - b.displayOrder),
    [initialSets],
  );
  const [sets, setSets] = useState<SetDTO[]>(sortedInitial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= sets.length) return;
    setSets((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setDirty(true);
    setStatus(null);
  };

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      // Full renumber spaced by 10 — keeps gaps for manual SQL curation too
      const orders = sets.map((s, i) => ({ code: s.code, displayOrder: (i + 1) * 10 }));
      const res = await fetch("/api/admin/sets/order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        setStatus(`Save failed: ${body?.error ?? res.statusText}`);
        return;
      }
      setSets((prev) => prev.map((s, i) => ({ ...s, displayOrder: (i + 1) * 10 })));
      setDirty(false);
      setStatus(`Saved — ${body.data.updated} sets renumbered. Now regenerate the snapshot (see above).`);
    } catch {
      setStatus("Save failed: network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4 text-base text-amber-900 dark:text-amber-200">
        <p className="font-semibold">The database is the source of truth — the app sorts from a generated snapshot.</p>
        <p className="mt-1">
          After saving a new order, regenerate the constants snapshot and deploy for printing
          carousels and import defaults to pick it up:
        </p>
        <code className="mt-2 block rounded bg-amber-100 dark:bg-amber-900/40 px-2 py-1 font-mono text-sm">
          npx tsx --env-file=.env.local scripts/generate-set-constants.ts
        </code>
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="text-base text-gray-700 dark:text-gray-300">
          {sets.length} sets — printings are shown in this order (top = first) within each language group.
        </p>
        <Button
          onClick={save}
          disabled={!dirty || saving}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving…" : "Save order"}
        </Button>
      </div>

      {status && (
        <p role="status" className="text-base text-gray-800 dark:text-gray-200">{status}</p>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-base">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 text-left text-gray-700 dark:text-gray-300">
              <th scope="col" className="px-3 py-2 w-16">#</th>
              <th scope="col" className="px-3 py-2 w-20">Code</th>
              <th scope="col" className="px-3 py-2">Name</th>
              <th scope="col" className="px-3 py-2 w-32">Category</th>
              <th scope="col" className="px-3 py-2 w-16">Tier</th>
              <th scope="col" className="px-3 py-2 w-32">Released</th>
              <th scope="col" className="px-3 py-2 w-28">
                <span className="sr-only">Reorder</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sets.map((s, i) => (
              <tr
                key={s.code}
                className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              >
                <td className="px-3 py-2 tabular-nums text-gray-700 dark:text-gray-300">{i + 1}</td>
                <td className="px-3 py-2 font-mono uppercase">{s.displayCode}</td>
                <td className="px-3 py-2">{s.name}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded px-2 py-0.5 text-sm ${CATEGORY_BADGE[s.category] ?? CATEGORY_BADGE["non-standard"]}`}>
                    {s.category}
                  </span>
                </td>
                <td className="px-3 py-2 tabular-nums">{s.tier}</td>
                <td className="px-3 py-2 tabular-nums">{s.releaseDate ?? "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={`Move ${s.name} up`}
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={`Move ${s.name} down`}
                      disabled={i === sets.length - 1}
                      onClick={() => move(i, 1)}
                      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
