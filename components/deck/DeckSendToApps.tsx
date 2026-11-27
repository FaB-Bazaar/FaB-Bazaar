"use client";

// Deck Settings → "Send to": which connected apps (partner game clients such
// as Cintari) get this deck. One switch per app the player connected with
// access to their decks; each switch saves at once. Renders nothing when the
// player has no such app. See /api/decks/[deckId]/partner-shares.

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface PlayAppShare {
  client_id: string;
  name: string;
  site: string | null;
  shared: boolean;
}

export default function DeckSendToApps({ deckId }: { deckId: string }) {
  const [apps, setApps] = useState<PlayAppShare[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/decks/${deckId}/partner-shares`)
      .then(res => (res.ok ? res.json() : null))
      .then(body => { if (!cancelled) setApps(body?.data ?? []); })
      .catch(() => { if (!cancelled) setApps([]); });
    return () => { cancelled = true; };
  }, [deckId]);

  if (!apps || apps.length === 0) return null;

  const toggle = async (app: PlayAppShare) => {
    const shared = !app.shared;
    setBusy(app.client_id);
    setError(null);
    setApps(list => list?.map(a => (a.client_id === app.client_id ? { ...a, shared } : a)) ?? list);
    try {
      const res = await fetch(`/api/decks/${deckId}/partner-shares`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: app.client_id, shared }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Could not save");
    } catch (e) {
      setApps(list => list?.map(a => (a.client_id === app.client_id ? { ...a, shared: !shared } : a)) ?? list);
      setError(`Couldn't change ${app.name}: ${e instanceof Error ? e.message : "please try again"}.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-1.5 py-1" role="group" aria-labelledby={`send-to-${deckId}`}>
      <div>
        <Label id={`send-to-${deckId}`}>Send to</Label>
        <p className="text-sm text-muted-foreground mt-0.5">
          Apps you connected that can play your decks. Each one sees only the decks switched on here. Saves right away.
        </p>
      </div>
      <ul className="space-y-1">
        {apps.map(app => (
          <li key={app.client_id} className="flex items-center justify-between gap-3">
            <span className="min-w-0 text-base">
              {app.name}
              {app.site && <span className="ml-2 text-sm text-muted-foreground">{app.site}</span>}
            </span>
            <button
              role="switch"
              type="button"
              aria-checked={app.shared}
              aria-label={`Send this deck to ${app.name}`}
              disabled={busy === app.client_id}
              onClick={() => toggle(app)}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-wait",
                app.shared ? "bg-green-500 dark:bg-green-600" : "bg-gray-300 dark:bg-gray-600",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-green-700 shadow-md transition-transform duration-200",
                  app.shared ? "translate-x-5" : "translate-x-0",
                )}
                aria-hidden
              >
                {app.shared ? "✓" : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
}
