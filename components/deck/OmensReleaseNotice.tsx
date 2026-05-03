"use client";

import { Info } from "lucide-react";
import { getSetMetadata } from "@/lib/fab-constants/sets";
import { getSetImageOrFallback } from "@/lib/set-images";

export default function OmensReleaseNotice() {
  const meta = getSetMetadata("omn");
  if (!meta?.releaseDate) return null;

  const release = new Date(meta.releaseDate + "T00:00:00Z");
  if (Number.isNaN(release.getTime())) return null;
  if (Date.now() >= release.getTime()) return null;

  const formatted = release.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const setImage = getSetImageOrFallback("omn", "OMN");

  return (
    <div
      role="note"
      className="flex items-start gap-2 rounded-md border border-blue-400/40 bg-blue-500/10 px-3 py-2 text-sm text-blue-100 mb-4"
    >
      <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-300" aria-hidden="true" />
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <span>Decks using cards from</span>
        {setImage && (
          <img
            src={setImage}
            alt=""
            aria-hidden="true"
            className="inline-block h-5 w-auto align-middle"
          />
        )}
        <strong>Omens of the Third Age</strong>
        <span>
          are not tournament-legal until {formatted}, but you may play with them
          on Talishar in <em>Future Formats</em>.
        </span>
      </p>
    </div>
  );
}
