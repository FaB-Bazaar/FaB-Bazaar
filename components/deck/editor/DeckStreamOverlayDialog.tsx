// components/deck/editor/DeckStreamOverlayDialog.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2, Radio } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { buildStreamOverlayLinks } from "@/lib/overlay/stream-overlay-links";

interface DeckStreamOverlayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckPublicId: string;
  /** Private / friends-only decks can't be shown on stream (OBS has no session). */
  visibility: string;
}

/**
 * "Stream overlay" — lets a streamer pick this deck as their streaming deck and copy the
 * profile-level OBS browser-source URLs (/overlay/u/<username>/deck). Those URLs never
 * change: the overlay polls and reloads itself when the streaming deck is switched.
 */
export default function DeckStreamOverlayDialog({ open, onOpenChange, deckPublicId, visibility }: DeckStreamOverlayDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [overlayPath, setOverlayPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const streamable = visibility === "public" || visibility === "unlisted";
  const isCurrent = current === deckPublicId;

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch("/api/user/streaming-deck", { signal: controller.signal })
      .then(r => r.json())
      .then(body => {
        if (!body.success) throw new Error(body.error ?? "Could not load your stream settings");
        setCurrent(body.data.deckPublicId);
        setOverlayPath(body.data.overlayPath);
      })
      .catch(e => { if (e.name !== "AbortError") setError(e.message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [open]);

  const links = useMemo(
    () => (overlayPath && typeof window !== "undefined" ? buildStreamOverlayLinks(window.location.origin, overlayPath) : []),
    [overlayPath]
  );

  async function setStreamingDeck(next: string | null) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user/streaming-deck", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckPublicId: next }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.error ?? "Could not update your streaming deck");
      setCurrent(body.data.deckPublicId);
      toast({
        title: next ? "Streaming deck set" : "Removed from stream",
        description: next ? "Your overlay switches to this deck within about 30 seconds." : undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update your streaming deck");
    } finally {
      setSaving(false);
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(c => (c === url ? null : c)), 2000);
    } catch {
      toast({ title: "Couldn't copy", description: "Select the link and copy it manually.", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" aria-hidden="true" />
            Stream overlay
          </DialogTitle>
          <DialogDescription>
            Show your deck on stream with an OBS browser source. The links below always show your
            current streaming deck, so you set them up in OBS once.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…
          </div>
        ) : (
          <div className="space-y-4">
            <div aria-live="polite" className="space-y-2">
              {isCurrent ? (
                <>
                  <p className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
                    <Check className="h-4 w-4" aria-hidden="true" /> This is your streaming deck.
                  </p>
                  <Button variant="outline" disabled={saving} onClick={() => setStreamingDeck(null)}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
                    Stop showing on stream
                  </Button>
                </>
              ) : (
                <>
                  <Button disabled={saving || !streamable} onClick={() => setStreamingDeck(deckPublicId)}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
                    Use as my streaming deck
                  </Button>
                  {!streamable && (
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      Make this deck public or unlisted (Settings) to show it on stream.
                    </p>
                  )}
                  {streamable && current && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">This replaces your current streaming deck.</p>
                  )}
                </>
              )}
              {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
            </div>

            {links.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">OBS browser source links</h3>
                {links.map(link => (
                  <div key={link.layout} className="space-y-1">
                    <label htmlFor={`overlay-${link.layout}`} className="text-sm text-gray-700 dark:text-gray-200">
                      {link.label} <span className="text-gray-500 dark:text-gray-400">· {link.width}×{link.height}</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        id={`overlay-${link.layout}`}
                        readOnly
                        value={link.url}
                        onFocus={e => e.currentTarget.select()}
                        className="flex-1 min-w-0 rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-2 py-1 text-xs font-mono"
                      />
                      <Button variant="outline" size="sm" onClick={() => copy(link.url)} aria-label={`Copy ${link.layout} link`}>
                        {copied === link.url ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
