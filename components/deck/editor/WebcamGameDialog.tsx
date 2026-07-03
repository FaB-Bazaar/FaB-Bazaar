// components/deck/editor/WebcamGameDialog.tsx
// Toolbar entry point (desktop only) that opens a modal pointing players to the
// webcam play table (play.fabbazaar.app) and to this deck's QR sticker sheet —
// the stickers go in the sleeves so the playmat camera can identify each card.
"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Video, ExternalLink, QrCode } from "lucide-react";

const PLAY_URL = "https://play.fabbazaar.app/";

export default function WebcamGameDialog() {
  const params = useParams();
  const deckId = params?.deckId as string | undefined;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-sm font-medium transition-colors border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <Video className="h-4 w-4" aria-hidden="true" />
          <span>Play a Webcam Game</span>
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            Play a Webcam Game
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-300">
            Play this deck against an opponent over webcam. Print QR stickers for
            your cards so the table can identify them as you play.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <a
            href={PLAY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-blue-800 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <span className="flex items-center gap-2 font-medium">
              <Video className="h-4 w-4" aria-hidden="true" />
              Open the webcam play table
            </span>
            <ExternalLink className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          </a>

          <Link
            href={deckId ? `/decks/${deckId}/stickers` : "#"}
            className="flex items-center justify-between gap-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <span className="flex items-center gap-2 font-medium">
              <QrCode className="h-4 w-4" aria-hidden="true" />
              Create your sticker / QR codes
            </span>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
