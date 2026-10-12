// components/scan/BinderBar.tsx — where /scan adds cards: the default binder (remembered by the page), "New binder…"
// right in the picker so making one never means leaving the page, and "Mark as for trade" for everything added.
"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { BinderOption } from "@/lib/scan/banner/add-to-binder";

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";
const NEW = "__new";

interface Props {
  binders: BinderOption[] | null;            // null = still loading
  binderId: string | null;
  onPick: (binderId: string) => void;
  forTrade: boolean;
  onForTrade: (v: boolean) => void;
  /** makes the binder and selects it; resolves to an error message, or null */
  onCreate: (name: string) => Promise<string | null>;
}

export default function BinderBar({ binders, binderId, onPick, forTrade, onForTrade, onCreate }: Props) {
  const none = binders !== null && binders.length === 0;
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showCreate = creating || none;

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true); setError(null);
    const err = await onCreate(name.trim());
    setBusy(false);
    if (err) setError(err); else { setCreating(false); setName(""); }
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700">
      {binders === null ? (
        <span className="inline-flex items-center gap-2 text-base text-gray-700 dark:text-gray-300"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Loading your binders…</span>
      ) : !none && (
        <label className="inline-flex flex-wrap items-center gap-2 text-base text-gray-900 dark:text-gray-100">
          <span className="font-medium">Add cards to</span>
          <select value={creating ? NEW : binderId ?? ""} aria-label="Add cards to"
            onChange={e => { if (e.target.value === NEW) setCreating(true); else { setCreating(false); onPick(e.target.value); } }}
            className={`max-w-[16rem] rounded-md border border-gray-300 bg-white px-2 py-1.5 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 ${FOCUS_RING}`}>
            {binders.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
            <option value={NEW}>New binder…</option>
          </select>
        </label>
      )}
      {showCreate && (
        <form className="inline-flex flex-wrap items-center gap-2" onSubmit={e => { e.preventDefault(); void create(); }}>
          {none && <span className="text-base text-gray-900 dark:text-gray-100">You don&apos;t have a binder yet.</span>}
          <input value={name} onChange={e => setName(e.target.value)} aria-label="New binder name" placeholder="New binder name" autoFocus={creating}
            className={`w-48 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 ${FOCUS_RING}`} />
          <button type="submit" disabled={busy || !name.trim()}
            className={`rounded-md bg-gray-900 px-3 py-1.5 text-base font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300 dark:disabled:bg-gray-600 ${FOCUS_RING}`}>
            {busy ? "Creating…" : "Create"}
          </button>
          {!none && <button type="button" onClick={() => { setCreating(false); setError(null); }}
            className={`rounded-md border border-gray-300 px-3 py-1.5 text-base text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700 ${FOCUS_RING}`}>Cancel</button>}
          {error && <span className="text-sm text-red-700 dark:text-red-300" role="alert">{error}</span>}
        </form>
      )}
      <label className="inline-flex items-center gap-2 text-base text-gray-900 dark:text-gray-100">
        <input type="checkbox" checked={forTrade} onChange={e => onForTrade(e.target.checked)} className={`h-4 w-4 ${FOCUS_RING}`} />
        Mark as for trade
      </label>
    </div>
  );
}
