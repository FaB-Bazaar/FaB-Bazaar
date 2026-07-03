"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertCircle, Sparkles } from "lucide-react";

interface ImportFabraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Called with the pasted decklist text. Should create the deck and resolve
   * on success (dialog then resets + closes) or throw with a message on failure
   * (dialog surfaces it).
   */
  onImport: (text: string) => Promise<void>;
}

const PLACEHOLDER = `Paste a FaBrary decklist here...

Name: My Deck
Hero: Puffin, Hightail
Format: Classic Constructed

Arena cards
1x Teklo Foundry Heart

Deck cards
3x Boom Grenade (red)
10x Copper Cog (blue)`;

export default function ImportFabraryDialog({
  open,
  onOpenChange,
  onImport,
}: ImportFabraryDialogProps) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!text.trim()) {
      setError("Paste a FaBrary decklist first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onImport(text);
      // Success — reset and close.
      setText("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import deck.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!submitting) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Import from FaBrary
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-300">
            Paste a decklist exported from FaBrary. We&apos;ll create the deck, add the
            hero, and select a printing for every card automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <textarea
            aria-label="FaBrary decklist"
            className="w-full h-72 p-3 border rounded-md font-mono text-sm bg-white text-gray-900 placeholder-gray-500 border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400 dark:border-gray-600"
            placeholder={PLACEHOLDER}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={submitting}
          />

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Couldn&apos;t import</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !text.trim()}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? "Creating deck..." : "Create Deck"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
