"use client"

/**
 * /profile/[username]/trade — 1:1 trade view with another user: what they have
 * for trade that you want, and what you have for trade that they want.
 * Same matching as Discord /trade (inventoryService.getUserTradeMatches):
 * exact printing by default, ?match=loose = any printing of the card.
 * "Open binder" links fill the binder's trade request from your wants.
 */
import { Suspense, use, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, ArrowLeftRight, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { usersClient } from "@/lib/client"
import { displayUsername, profileHref } from "@/lib/utils/display-username"
import { formatPrice } from "@/lib/pricing/price-source"
import { FOILING_MAP } from "@/lib/fab-constants"
import { parseTradeMatchMode, type TradeMatchMode } from "@/lib/trade/allocate-wants"
import { groupTradeCardsByBinder, tradeBinderHref, type TradeBinderGroup } from "@/lib/trade/group-by-binder"
import type { UserTradeCardDTO, UserTradeMatchesDTO } from "@/lib/services/contracts/IInventoryService"

export default function TradePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params)
  return (
    <Suspense fallback={<PageSpinner />}>
      <TradeView username={decodeURIComponent(username)} />
    </Suspense>
  )
}

function PageSpinner() {
  return (
    <div className="flex justify-center py-24" role="status" aria-label="Loading trade matches">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
    </div>
  )
}

function TradeView({ username }: { username: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = parseTradeMatchMode(searchParams.get("match"))
  const { user: currentUser, loading: authLoading } = useAuth()

  const [target, setTarget] = useState<{ _id: string; username: string } | null>(null)
  const [matches, setMatches] = useState<UserTradeMatchesDTO | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const name = displayUsername(target?.username ?? username)
  const isSelf = !!currentUser?.username && currentUser.username.toLowerCase() === username.toLowerCase()

  useEffect(() => {
    let cancelled = false
    fetch(`/api/users/profile/${encodeURIComponent(username)}`)
      .then((r) => r.json().then((body) => ({ ok: r.ok, body })))
      .then(({ ok, body }) => {
        if (cancelled) return
        if (!ok || !body?.success || !body.user?._id) setError("We couldn't find that user.")
        else setTarget({ _id: body.user._id, username: body.user.username })
      })
      .catch(() => !cancelled && setError("We couldn't load that profile. Try again."))
    return () => { cancelled = true }
  }, [username])

  useEffect(() => {
    if (!target || !currentUser || isSelf) {
      if (target && !authLoading) setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    usersClient.getTradeMatches(target._id, mode).then((result) => {
      if (cancelled) return
      if (result.success) { setMatches(result.data); setError(null) }
      else setError(result.error || "Couldn't load trade matches.")
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [target, currentUser, isSelf, mode, authLoading])

  const setMode = (next: TradeMatchMode) => {
    const query = next === "loose" ? "?match=loose" : ""
    router.replace(`${profileHref(username)}/trade${query}`, { scroll: false })
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 space-y-6">
      <div className="space-y-3">
        <Link
          href={profileHref(username)}
          className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to {name}&apos;s profile
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
          <ArrowLeftRight className="h-6 w-6" aria-hidden="true" />
          Trade with {name}
        </h1>
        <div role="radiogroup" aria-label="How to match cards" className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 p-0.5">
          {(["exact", "loose"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                mode === m
                  ? "bg-blue-600 text-white dark:bg-blue-500"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {m === "exact" ? "Exact printings" : "Any printing"}
            </button>
          ))}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {mode === "exact"
            ? "Only the same set, edition and foiling as on the wants list."
            : "Any version of a wanted card (same pitch). Check the printing before you trade."}
          {" "}Cards count when they're marked for trade in a binder that allows trade matching.
        </p>
      </div>

      {error ? (
        <p className="text-red-600 dark:text-red-400">{error}</p>
      ) : !authLoading && !currentUser ? (
        <div className="rounded-lg border border-gray-300 dark:border-gray-700 p-6 text-center space-y-3">
          <p className="text-gray-700 dark:text-gray-300">Sign in to see what you and {name} can trade.</p>
          <Link href={`/auth/login?callbackUrl=${encodeURIComponent(`${profileHref(username)}/trade`)}`}>
            <Button>Sign in</Button>
          </Link>
        </div>
      ) : isSelf ? (
        <p className="text-gray-700 dark:text-gray-300">This is your profile. Open someone else&apos;s profile to see what you can trade.</p>
      ) : loading || !matches ? (
        <PageSpinner />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <TradeSection
            title={`${name} has for you`}
            emptyText={`${name} has nothing for trade on your wants list${mode === "exact" ? " — try Any printing" : ""}.`}
            cards={matches.theyHaveYouWant}
            renderGroupAction={(group) =>
              group.binderViewable ? (
                <Link href={tradeBinderHref(group.binderId, mode)}>
                  <Button size="sm" className="h-8 text-xs" data-testid="trade-open-binder">
                    Add to trade request
                    <ExternalLink className="h-3.5 w-3.5 ml-1.5" aria-hidden="true" />
                  </Button>
                </Link>
              ) : (
                <span className="text-xs text-gray-500 dark:text-gray-400">Private binder — message {name}</span>
              )
            }
          />
          <TradeSection
            title={`You have for ${name}`}
            emptyText={`Nothing you have for trade is on ${name}'s wants list${mode === "exact" ? " — try Any printing" : ""}.`}
            cards={matches.theyWantYouHave}
            renderGroupAction={(group) => (
              <Link href={`/binder/${group.binderId}`} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                Open binder
              </Link>
            )}
          />
        </div>
      )}
    </div>
  )
}

function TradeSection({
  title,
  emptyText,
  cards,
  renderGroupAction,
}: {
  title: string
  emptyText: string
  cards: UserTradeCardDTO[]
  renderGroupAction: (group: TradeBinderGroup<UserTradeCardDTO>) => React.ReactNode
}) {
  const groups = groupTradeCardsByBinder(cards)
  const copies = cards.reduce((sum, c) => sum + c.quantity, 0)
  const total = groups.reduce((sum, g) => sum + g.totalValue, 0)

  return (
    <section aria-label={title} className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        {cards.length > 0 && (
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {copies} {copies === 1 ? "card" : "cards"} · {formatPrice(total, "tcgplayer")}
          </span>
        )}
      </div>
      {groups.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">{emptyText}</p>
      ) : (
        groups.map((group) => (
          <div key={group.binderId} className="rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800">
              <div className="min-w-0">
                <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{group.binderName}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">{formatPrice(group.totalValue, "tcgplayer")}</div>
              </div>
              {renderGroupAction(group)}
            </div>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {group.cards.map((card) => (
                <TradeCardRow key={card.inventoryItemId} card={card} />
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  )
}

function TradeCardRow({ card }: { card: UserTradeCardDTO }) {
  const foil = FOILING_MAP[(card.foiling || "").toLowerCase() as keyof typeof FOILING_MAP]
  const details = [card.collectorNumber || card.set.toUpperCase(), foil && foil !== "Non-foil" ? foil : null]
    .filter(Boolean)
    .join(" · ")
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      {card.imageUrl ? (
        <img src={card.imageUrl} alt="" loading="lazy" className="h-14 w-10 rounded object-cover flex-shrink-0" />
      ) : (
        <div className="h-14 w-10 rounded bg-gray-200 dark:bg-gray-700 flex-shrink-0" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {card.quantity}× {card.displayName}
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-400">{details}</div>
      </div>
      <div className="text-sm text-gray-700 dark:text-gray-300 tabular-nums">
        {card.tcgLow != null ? formatPrice(card.tcgLow, "tcgplayer") : "—"}
      </div>
    </li>
  )
}
