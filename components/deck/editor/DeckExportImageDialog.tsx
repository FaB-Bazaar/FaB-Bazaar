// components/deck/editor/DeckExportImageDialog.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Share2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { DeckDTO } from "@/lib/services/contracts/IDeckService";
import { buildDeckImageModel, layoutDeckImage } from "@/lib/deck/deck-image";
import { renderDeckImage, deckImageFilename, canShareFile, downloadBlob } from "@/lib/deck/deck-image-render";

interface DeckExportImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deck: DeckDTO | null;
}

/**
 * "Export image" — renders the deck to a shareable PNG (hero header, pitch
 * strip, card grid by section) and previews it. Download works everywhere;
 * Share appears where the browser can hand files to the native share sheet
 * (phones), which is the mobile path to Photos / Discord / iMessage.
 */
export default function DeckExportImageDialog({ open, onOpenChange, deck }: DeckExportImageDialogProps) {
  const [includeInventory, setIncludeInventory] = useState(true);
  const [status, setStatus] = useState<"idle" | "rendering" | "ready" | "error">("idle");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const filename = useMemo(() => deckImageFilename(deck?.name ?? "deck"), [deck?.name]);

  useEffect(() => {
    if (!open || !deck) return;
    const controller = new AbortController();
    setStatus("rendering");
    setBlob(null);

    const model = buildDeckImageModel(deck, { origin: window.location.origin, includeInventory });
    const layout = layoutDeckImage(model);
    const fontFamily = getComputedStyle(document.body).fontFamily;

    renderDeckImage(model, layout, { fontFamily, signal: controller.signal })
      .then(result => {
        if (controller.signal.aborted) return;
        if (!result) { setStatus("error"); return; }
        setBlob(result);
        setBlobUrl(prev => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(result);
        });
        setStatus("ready");
      })
      .catch(() => { if (!controller.signal.aborted) setStatus("error"); });

    return () => controller.abort();
  }, [open, deck, includeInventory]);

  // Release the preview URL when the dialog closes.
  useEffect(() => {
    if (open) return;
    setBlobUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setBlob(null);
    setStatus("idle");
  }, [open]);

  const hasInventory = (deck?.inventory?.length ?? 0) > 0;
  const file = blob ? new File([blob], filename, { type: "image/png" }) : null;
  const shareable = !!file && canShareFile(file);

  const handleShare = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: deck?.name ?? "Deck" });
    } catch {
      // User cancelled the share sheet — nothing to do.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Extra bottom padding <sm so the action row clears the floating MobileTabBar. */}
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto pb-24 sm:pb-6">
        <DialogHeader>
          <DialogTitle>Export image</DialogTitle>
          <DialogDescription>
            A shareable snapshot of this deck. Download it, or share straight to your camera roll or Discord on your phone.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 bg-[#0b1220] min-h-[200px] flex items-center justify-center">
          {status === "ready" && blobUrl ? (
            <img src={blobUrl} alt="Deck image preview" className="w-full h-auto" />
          ) : status === "error" ? (
            <p className="text-sm text-red-500 p-6">Couldn&apos;t render the image. Try again.</p>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-300 p-6">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Rendering deck image…
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <label className={hasInventory ? "flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none" : "hidden"}>
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
              checked={includeInventory}
              onChange={e => setIncludeInventory(e.target.checked)}
            />
            Include inventory
          </label>
          <div className="flex gap-2 sm:justify-end">
            {shareable && (
              <Button type="button" variant="outline" onClick={handleShare} disabled={status !== "ready"}>
                <Share2 className="h-4 w-4 mr-2" aria-hidden="true" />
                Share
              </Button>
            )}
            <Button type="button" onClick={() => blob && downloadBlob(blob, filename)} disabled={status !== "ready"}>
              <Download className="h-4 w-4 mr-2" aria-hidden="true" />
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
