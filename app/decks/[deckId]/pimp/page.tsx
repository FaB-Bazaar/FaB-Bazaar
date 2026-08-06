// app/decks/[deckId]/pimp/page.tsx — "Pimp My Deck"
//
// For every card in the deck, the blingier English printings (extended/alt
// art, marvel, cold foil, promo, alpha/first edition) that the signed-in
// viewer does NOT own anywhere in their collection — a hunting list for
// upgrading the deck's looks. Data: GET /api/decks/[deckId]/pimp.
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Heart, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { decksClient, wantsClient } from "@/lib/client";
import { FOILING_STYLES, SET_MAP } from "@/lib/fab-constants";
import { AffiliateDisclosure } from "@/components/shared/AffiliateDisclosure";
import { TcgAffiliateLink } from "@/components/tracking";
import type { PimpResult, PimpUpgradeDTO } from "@/lib/deck/pimp-upgrades";

type PimpData = PimpResult & { deckName: string; deckPublicId: string };

function formatPrice(p: number | null | undefined): string {
  if (p == null) return "—";
  if (p >= 100) return `$${p.toFixed(0)}`;
  if (p >= 10) return `$${p.toFixed(1)}`;
  return `$${p.toFixed(2)}`;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";

function FoilPill({ foiling }: { foiling: string }) {
  const style = FOILING_STYLES[foiling?.toLowerCase() as keyof typeof FOILING_STYLES];
  if (!style || style.shortName === "NF") return null;
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${style.className}`}>
      {style.shortName}
    </span>
  );
}

function UpgradeTile({
  u,
  onAddToWants,
  wantsStatus,
}: {
  u: PimpUpgradeDTO;
  onAddToWants: (printingId: string) => void;
  wantsStatus?: "busy" | "done" | "error";
}) {
  const setLabel = (SET_MAP as Record<string, string>)[u.set?.toLowerCase()] || u.set?.toUpperCase();
  return (
    <div className="rounded-lg border border-gray-300 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-800">
      <Link
        href={`/printing/${u.printingId}`}
        className={`block aspect-[63/88] relative overflow-hidden rounded bg-gray-100 dark:bg-gray-700 ${focusRing}`}
        aria-label={`View ${u.displayName} (${u.badges.join(", ") || "printing"})`}
      >
        {u.imageUrl ? (
          <Image
            src={u.imageUrl}
            alt={u.displayName}
            fill
            sizes="(max-width: 640px) 45vw, 180px"
            className="object-cover"
            unoptimized
          />
        ) : null}
      </Link>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <FoilPill foiling={u.foiling} />
        {u.badges
          .filter((b) => b !== "Rainbow Foil" && b !== "Cold Foil" && b !== "Gold Foil")
          .map((b) => (
            <span
              key={b}
              className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
            >
              {b}
            </span>
          ))}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-400">
        <span className="truncate">
          {setLabel}
          {u.collectorNumber ? ` · ${u.collectorNumber.toUpperCase()}` : ""}
        </span>
        <span className="shrink-0 font-semibold text-gray-900 dark:text-gray-100">
          {formatPrice(u.tcgLow)}
        </span>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        {/* Compact affiliate link — the wants-page "Available for purchase
            here" long form wraps to four lines inside these narrow tiles. */}
        {u.tcgplayerUrl ? (
          <TcgAffiliateLink
            tcgplayerUrl={u.tcgplayerUrl}
            feature="pimp_my_deck"
            title="Buy on TCGplayer"
            className={`inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 dark:border-gray-600 dark:text-blue-400 dark:hover:bg-gray-700 ${focusRing}`}
          >
            Buy
          </TcgAffiliateLink>
        ) : <span />}
        <button
          type="button"
          onClick={() => onAddToWants(u.printingId)}
          disabled={wantsStatus === "busy" || wantsStatus === "done"}
          title="Add to your wants list"
          className={`inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-60 dark:border-gray-600 dark:text-rose-400 dark:hover:bg-gray-700 ${focusRing}`}
        >
          {wantsStatus === "busy" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : wantsStatus === "done" ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-500" aria-hidden="true" />
          ) : wantsStatus === "error" ? (
            <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-500" aria-hidden="true" />
          ) : (
            <Heart className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {wantsStatus === "done" ? "Wanted" : "Want"}
        </button>
      </div>
    </div>
  );
}

export default function PimpMyDeckPage() {
  const params = useParams<{ deckId: string }>();
  const deckId = params.deckId;
  const [data, setData] = useState<PimpData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wantsStatus, setWantsStatus] = useState<Record<string, "busy" | "done" | "error">>({});

  useEffect(() => {
    if (!deckId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const result = await decksClient.getPimpUpgrades(deckId);
      if (cancelled) return;
      if (!result.success) setError(result.error || "Failed to load upgrades");
      else setData(result.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [deckId]);

  const addToWants = async (printingId: string) => {
    setWantsStatus((s) => ({ ...s, [printingId]: "busy" }));
    const result = await wantsClient.addWantsItem(printingId, 1);
    setWantsStatus((s) => ({ ...s, [printingId]: result.success ? "done" : "error" }));
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <AffiliateDisclosure />
      <div className="container mx-auto max-w-6xl px-4 py-6">
        <Link
          href={`/decks/${deckId}`}
          className={`inline-flex items-center gap-1.5 rounded-md text-sm text-blue-700 hover:underline dark:text-blue-400 ${focusRing}`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {data?.deckName ? `Back to ${data.deckName}` : "Back to deck"}
        </Link>

        {/* The banner IS the page title (decorative text baked into the art). */}
        <div className="mx-auto mt-3 max-w-md">
          <Image
            src="/images/pimp-my-deck.png"
            alt="Pimp My Deck"
            width={1200}
            height={895}
            priority
            className="h-auto w-full rounded-xl border border-amber-300/60 shadow-md dark:border-amber-700/60"
          />
        </div>

        {loading && (
          <div className="flex flex-col items-center py-16" role="status">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
            <p className="text-gray-600 dark:text-gray-300">Checking your collection for bling…</p>
          </div>
        )}

        {!loading && error && (
          <div className="mx-auto max-w-md py-12 text-center">
            <h2 className="mb-2 text-xl font-semibold text-rose-600 dark:text-rose-400">
              Couldn’t load upgrades
            </h2>
            <p className="mb-4 text-gray-600 dark:text-gray-300">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className={`rounded-md border border-gray-300 px-4 py-2 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800 ${focusRing}`}
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <>
            <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
              {data.cards.length === 0
                ? "This deck is already dripping — you own a top-tier printing of every card."
                : <>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{data.cards.length}</span>
                    {" "}card{data.cards.length === 1 ? "" : "s"} can get blingier
                    {data.topPickTotal > 0 && (
                      <> · full pimp (top pick each): <span className="font-semibold text-amber-700 dark:text-amber-400">{formatPrice(data.topPickTotal)}</span></>
                    )}
                    {data.fullyPimped > 0 && <> · {data.fullyPimped} already maxed out</>}
                  </>}
            </p>

            <div className="mt-6 space-y-8">
              {data.cards.map((card) => (
                <section key={card.cardUniqueId}>
                  <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {card.quantity}× {card.name}
                    </h2>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {card.bestOwned
                        ? `Best owned: ${card.bestOwned.badges.join(" · ") || "plain printing"}`
                        : "You own none of these yet"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {card.upgrades.map((u) => (
                      <UpgradeTile
                        key={u.printingId}
                        u={u}
                        onAddToWants={addToWants}
                        wantsStatus={wantsStatus[u.printingId]}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
