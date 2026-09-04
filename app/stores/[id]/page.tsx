"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { use } from "react";
import {
  MapPin, Phone, Globe, Users, Calendar, ChevronLeft,
  Check, ExternalLink, ArrowLeftRight, Heart, Send, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { locationsClient } from "@/lib/client";
import { sendWantsInterestNotification } from "@/lib/client/wants-client";
import { tradeInterestFeedback } from "@/lib/discord/trade-interest-feedback";
import { printingLabel } from "@/lib/trade/printing-label";
import { useToast } from "@/hooks/use-toast";
import type { LocationDTO, EventDTO, LocationFollowerDTO } from "@/types/location";
import type { StoreTradeMatchDTO, StoreWantMatchDTO, StoreTradeCardDTO } from "@/lib/services/contracts/IInventoryService";
import { profileHref, displayUsername } from "@/lib/utils/display-username";

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

// Foil pill colors on card tiles (NF renders no pill)
const FOIL_STYLES: Record<string, string> = {
  RF: "bg-gradient-to-r from-pink-500 via-amber-400 to-sky-500 text-white",
  CF: "bg-cyan-600 text-white",
  GF: "bg-amber-500 text-black",
};

type ZoomedCard = { url: string; caption: string };

/** Σ tcg_low × qty for a card list — shown on trader chips for at-a-glance triage. */
function sideValue(cards: StoreTradeCardDTO[]): number {
  return cards.reduce((sum, c) => sum + (c.tcgLow ?? 0) * (c.quantity || 1), 0);
}

function valueSuffix(cards: StoreTradeCardDTO[]): string {
  const v = sideValue(cards);
  return v > 0 ? ` · ~$${v.toFixed(0)}` : "";
}

function cardCaption(card: Pick<StoreTradeCardDTO, "displayName" | "foiling" | "collectorNumber" | "quantity">) {
  return `${card.quantity}× ${printingLabel(card)}`;
}

/**
 * Tappable card-art tile for trade/want match sections. Sized for phones —
 * big enough to recognize art at arm's length and show across a table.
 */
function CardTile({
  card,
  onZoom,
}: {
  card: Pick<StoreTradeCardDTO, "displayName" | "foiling" | "collectorNumber" | "quantity" | "imageUrl" | "tcgMarket" | "tcgLow">;
  onZoom: (zoom: ZoomedCard) => void;
}) {
  const caption = cardCaption(card);
  const price = card.tcgLow ?? card.tcgMarket;
  return (
    <div className="flex w-24 shrink-0 snap-start flex-col items-center">
      <button
        type="button"
        onClick={() => card.imageUrl && onZoom({ url: card.imageUrl, caption })}
        className="relative w-24 overflow-hidden rounded-lg ring-1 ring-gray-300 dark:ring-gray-600 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        style={{ aspectRatio: "5 / 7" }}
        title={caption}
        aria-label={`Zoom ${caption}`}
      >
        {card.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.imageUrl} alt={card.displayName} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-200 p-1 dark:bg-gray-700">
            <span className="text-center text-xs leading-tight text-gray-600 dark:text-gray-300">{card.displayName}</span>
          </div>
        )}
        {card.quantity > 1 && (
          <span className="absolute left-1 top-1 rounded-full bg-black/80 px-1.5 py-0.5 text-xs font-bold text-white">
            ×{card.quantity}
          </span>
        )}
        {FOIL_STYLES[card.foiling] && (
          <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-0.5 text-xs font-bold ${FOIL_STYLES[card.foiling]}`}>
            {card.foiling}
          </span>
        )}
      </button>
      <span className="mt-1 w-24 truncate text-center text-xs text-gray-700 dark:text-gray-300" title={card.displayName}>
        {card.displayName}
      </span>
      {price != null && (
        <span className="text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
          ${Number(price).toFixed(2)}
        </span>
      )}
    </div>
  );
}

/** Horizontal thumb-swipe strip on phones; wraps into a grid on wider screens. */
function CardStrip({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
      {children}
    </div>
  );
}

function EventRow({
  event,
  isAttending,
  onToggle,
}: {
  event: EventDTO;
  isAttending: boolean;
  onToggle: (id: string, attending: boolean) => void;
}) {
  const [pending, setPending] = useState(false);

  async function handleToggle() {
    setPending(true);
    await onToggle(event.id, isAttending);
    setPending(false);
  }

  const isPast = new Date(event.endDate) < new Date();

  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{event.name}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {formatDate(event.startDate)}
          {event.startDate !== event.endDate ? ` – ${formatDate(event.endDate)}` : ""}
          {event.format ? ` · ${event.format}` : ""}
        </span>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-xs px-1.5 py-0">
            {event.type.replace("_", " ")}
          </Badge>
          {event.registrationUrl && (
            <a
              href={event.registrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
            >
              Register <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>
      {!isPast && (
        <Button
          size="sm"
          variant={isAttending ? "secondary" : "default"}
          className="h-7 px-3 text-xs gap-1 flex-shrink-0"
          onClick={handleToggle}
          disabled={pending}
        >
          {isAttending && <Check className="w-3 h-3" />}
          {pending ? "…" : isAttending ? "Attending" : "Attend"}
        </Button>
      )}
    </div>
  );
}

function FollowerAvatar({ follower }: { follower: LocationFollowerDTO }) {
  return (
    <Link href={profileHref(follower.username)} title={follower.displayUsername || displayUsername(follower.username)}>
      {follower.avatarUrl ? (
        <img
          src={follower.avatarUrl}
          alt={follower.username}
          className="w-9 h-9 rounded-full object-cover border-2 border-white dark:border-gray-800"
        />
      ) : (
        <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-semibold text-gray-500 dark:text-gray-300 border-2 border-white dark:border-gray-800">
          {(follower.displayUsername || displayUsername(follower.username)).charAt(0).toUpperCase()}
        </div>
      )}
    </Link>
  );
}

export default function StoreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [location, setLocation] = useState<LocationDTO | null>(null);
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [followers, setFollowers] = useState<LocationFollowerDTO[]>([]);
  const [followerTotal, setFollowerTotal] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [attendingIds, setAttendingIds] = useState<Set<string>>(new Set());
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followPending, setFollowPending] = useState(false);
  const [tradeMatches, setTradeMatches] = useState<StoreTradeMatchDTO[]>([]);
  const [wantMatches, setWantMatches] = useState<StoreWantMatchDTO[]>([]);
  const [zoomedCard, setZoomedCard] = useState<ZoomedCard | null>(null);
  const [notifyingUserId, setNotifyingUserId] = useState<string | null>(null);
  const { toast } = useToast();

  // "I have the cards you're looking for" — pings the trader in the
  // Discord trade channel via their wants list. Awaited so we can report
  // a deduped ping as informational rather than as silence.
  const handleNotifyTrader = async (match: StoreTradeMatchDTO) => {
    // Exact printing identity (foil + collector number), never just the card
    // name — the match is on printing_id, so the ping must not overstate it.
    const cards = match.theyWantYouHave.map((c) => ({
      name: printingLabel(c),
      quantity: c.quantity,
      value: c.tcgLow ?? 0,
    }));
    if (cards.length === 0) return;

    // Say WHERE this was spotted: the ping otherwise reads like one from the
    // wants list itself. The soonest upcoming event here is the natural meetup.
    const nextEvent = events
      .filter((e) => new Date(e.endDate) >= new Date())
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0];

    setNotifyingUserId(match.userId);
    try {
      const { notified } = await sendWantsInterestNotification(match.userId, {
        cards,
        totalValue: cards.reduce((sum, c) => sum + c.value * c.quantity, 0),
        source: location
          ? {
              storeId: id,
              storeName: location.name,
              eventName: nextEvent?.name,
              eventDate: nextEvent ? formatDate(nextEvent.startDate) : undefined,
            }
          : undefined,
      });
      toast({
        ...tradeInterestFeedback({
          notified,
          recipientUsername: match.displayUsername || match.username,
          cardCount: cards.length,
        }),
        duration: 5000,
      });
    } catch (error: any) {
      toast({
        title: "Couldn't ping on Discord",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setNotifyingUserId(null);
    }
  };

  useEffect(() => {
    async function load() {
      const [locResult, eventsResult, followersResult, canManageResult, contextResult] =
        await Promise.all([
          locationsClient.getLocation(id),
          locationsClient.getStoreEvents(id),
          locationsClient.getStoreFollowers(id, { limit: 24 }),
          locationsClient.canManageStore(id),
          locationsClient.getStoresContext(),
        ]);

      if (locResult.success) setLocation(locResult.data);
      if (eventsResult.success) setEvents(eventsResult.data);
      if (followersResult.success) {
        setFollowers(followersResult.data.followers);
        setFollowerTotal(followersResult.data.total);
      }
      setCanManage(canManageResult);

      if (contextResult.success) {
        setIsFollowing(contextResult.data.followedStores.some((s) => s.id === id));
        // Figure out which events user is attending by checking upcoming events
        const attendingEventIds = new Set<string>(
          contextResult.data.upcomingEvents
            .filter((e) => e.locationId === id)
            .map((e) => e.id)
        );
        setAttendingIds(attendingEventIds);
      }

      // Load trade matches independently (auth optional — silently skipped if not logged in)
      fetch(`/api/stores/${id}/trade-matches`, { credentials: 'include' })
        .then((r) => r.json())
        .then((data) => { if (data.success) setTradeMatches(data.matches || []); })
        .catch(() => {});

      // "Who at this store has what I want" (auth-only; silently skipped otherwise)
      fetch(`/api/stores/${id}/want-matches`, { credentials: 'include' })
        .then((r) => r.json())
        .then((data) => { if (data.success) setWantMatches(data.data || []); })
        .catch(() => {});

      setLoading(false);
    }
    load();
  }, [id]);

  async function handleFollowToggle() {
    setFollowPending(true);
    if (isFollowing) {
      const result = await locationsClient.unfollowLocation(id);
      if (result.success) {
        setIsFollowing(false);
        setLocation((prev) =>
          prev ? { ...prev, followerCount: Math.max(0, prev.followerCount - 1) } : prev
        );
      }
    } else {
      const result = await locationsClient.followLocation(id);
      if (result.success) {
        setIsFollowing(true);
        setLocation((prev) =>
          prev ? { ...prev, followerCount: prev.followerCount + 1 } : prev
        );
      }
    }
    setFollowPending(false);
  }

  async function handleAttendToggle(eventId: string, currentlyAttending: boolean) {
    if (currentlyAttending) {
      const result = await locationsClient.cancelAttendance(eventId);
      if (result.success) {
        setAttendingIds((prev) => {
          const next = new Set(prev);
          next.delete(eventId);
          return next;
        });
      }
    } else {
      const result = await locationsClient.attendEvent(eventId);
      if (result.success) {
        setAttendingIds((prev) => new Set([...prev, eventId]));
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <span className="text-gray-400">Loading…</span>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Store not found.</p>
          <Link href="/stores/browse"><Button variant="outline">Browse stores</Button></Link>
        </div>
      </div>
    );
  }

  const upcomingEvents = events.filter((e) => new Date(e.endDate) >= new Date());
  const pastEvents = events.filter((e) => new Date(e.endDate) < new Date());

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Hero bar */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-800 dark:to-indigo-800">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6">
          <Link
            href="/stores/browse"
            className="inline-flex items-center gap-1 text-blue-100 hover:text-white text-sm mb-3 sm:mb-4 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to browse
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">{location.name}</h1>
              <div className="flex items-center gap-1.5 text-blue-100 text-sm mt-1">
                <MapPin className="w-3.5 h-3.5" />
                {location.addressLine1}, {location.addressCity}
                {location.addressState ? `, ${location.addressState}` : ""}{" "}
                {location.addressPostalCode} &middot; {location.addressCountry}
              </div>
              <div className="flex items-center gap-1.5 text-blue-100 text-sm mt-1">
                <Users className="w-3.5 h-3.5" />
                {followerTotal} follower{followerTotal !== 1 ? "s" : ""}
              </div>
            </div>
            <Button
              variant={isFollowing ? "secondary" : "default"}
              className="flex-shrink-0 gap-1.5"
              onClick={handleFollowToggle}
              disabled={followPending}
            >
              {isFollowing && <Check className="w-4 h-4" />}
              {followPending ? "…" : isFollowing ? "Following" : "Follow"}
            </Button>
          </div>

          {location.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {location.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 grid gap-6 lg:grid-cols-3">
        {/* Left: events + followers */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Upcoming events */}
          {upcomingEvents.length > 0 && (
            <section className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  Upcoming Events
                </h2>
                {canManage && (
                  <Button size="sm" variant="outline" className="text-xs h-7">
                    Add event
                  </Button>
                )}
              </div>
              {upcomingEvents.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  isAttending={attendingIds.has(event.id)}
                  onToggle={handleAttendToggle}
                />
              ))}
            </section>
          )}

          {/* Followers */}
          {followers.length > 0 && (
            <section className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-5">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-blue-500" />
                Players at this store ({followerTotal})
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {followers.map((f) => (
                  <FollowerAvatar key={f.userId} follower={f} />
                ))}
                {followerTotal > followers.length && (
                  <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 font-medium">
                    +{followerTotal - followers.length}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* From your wants list — who at this store has them for trade */}
          {wantMatches.length > 0 && (
            <section className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-5">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-1">
                <Heart className="w-4 h-4 text-pink-500" />
                From your wants list ({wantMatches.length})
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Cards you want that followers of this store have for trade.
              </p>
              <ul className="flex flex-col gap-4">
                {wantMatches.map((m) => (
                  <li key={m.printingId} className="flex gap-3 items-start border-b border-gray-100 dark:border-gray-700 last:border-0 pb-4 last:pb-0">
                    <CardTile
                      card={{
                        displayName: m.displayName,
                        foiling: m.foiling,
                        collectorNumber: m.collectorNumber,
                        quantity: 1,
                        imageUrl: m.imageUrl,
                        tcgMarket: m.tcgMarket,
                        tcgLow: m.tcgLow,
                      }}
                      onZoom={setZoomedCard}
                    />
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {m.foiling !== 'NF' && <span className="text-gray-500 dark:text-gray-400">{m.foiling} </span>}
                        {m.displayName}
                        {m.collectorNumber && <span className="text-gray-500 dark:text-gray-400"> ({m.collectorNumber})</span>}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Available from:</div>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {m.owners.map((o) => (
                          <Link
                            key={o.userId}
                            href={profileHref(o.username)}
                            className="inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/60 rounded-full pl-1 pr-2.5 py-1 hover:bg-gray-200 dark:hover:bg-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                          >
                            {o.avatarUrl ? (
                              <img src={o.avatarUrl} alt={o.username} className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                              <span className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs font-semibold text-gray-600 dark:text-gray-200">
                                {(o.displayUsername || displayUsername(o.username)).charAt(0).toUpperCase()}
                              </span>
                            )}
                            <span className="font-medium">{o.displayUsername || displayUsername(o.username)}</span>
                            <span className="font-semibold text-green-600 dark:text-green-400">×{o.quantity}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Trade Opportunities */}
          {tradeMatches.length > 0 && (
            <section className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-5">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
                <ArrowLeftRight className="w-4 h-4 text-green-500" />
                Trade Opportunities ({tradeMatches.length})
              </h2>
              <div className="flex flex-col gap-5">
                {tradeMatches.map((match) => (
                  <div key={match.userId} className="border-b border-gray-100 dark:border-gray-700 last:border-0 pb-5 last:pb-0">
                    {/* Trader header: avatar + name + summary chips */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <Link href={profileHref(match.username)} className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-full">
                        {match.avatarUrl ? (
                          <img
                            src={match.avatarUrl}
                            alt={match.username}
                            className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-gray-800"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-sm font-semibold text-gray-500 dark:text-gray-300 border-2 border-white dark:border-gray-800">
                            {(match.displayUsername || displayUsername(match.username)).charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          {match.displayUsername || displayUsername(match.username)}
                        </span>
                      </Link>
                      {match.theyHaveYouWant.length > 0 && (
                        <span className="text-xs font-medium rounded-full px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                          Has {match.theyHaveYouWant.length} you want{valueSuffix(match.theyHaveYouWant)}
                        </span>
                      )}
                      {match.theyWantYouHave.length > 0 && (
                        <span className="text-xs font-medium rounded-full px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                          Wants {match.theyWantYouHave.length} you have{valueSuffix(match.theyWantYouHave)}
                        </span>
                      )}
                    </div>

                    {match.theyHaveYouWant.length > 0 && (
                      <div className="mt-3">
                        <div className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">
                          They have — you want
                        </div>
                        <CardStrip>
                          {match.theyHaveYouWant.map((c) => (
                            <CardTile key={c.printingId} card={c} onZoom={setZoomedCard} />
                          ))}
                        </CardStrip>
                      </div>
                    )}
                    {match.theyWantYouHave.length > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="text-sm font-medium text-blue-700 dark:text-blue-400">
                            They want — you have
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleNotifyTrader(match)}
                            disabled={notifyingUserId === match.userId}
                            data-testid={`notify-trade-match-${match.userId}`}
                            className="text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                          >
                            {notifyingUserId === match.userId ? (
                              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="mr-1.5 h-4 w-4" />
                            )}
                            Notify {match.displayUsername || displayUsername(match.username)}
                          </Button>
                        </div>
                        <CardStrip>
                          {match.theyWantYouHave.map((c) => (
                            <CardTile key={c.printingId} card={c} onZoom={setZoomedCard} />
                          ))}
                        </CardStrip>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Past events */}
          {pastEvents.length > 0 && (
            <section className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-5">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 text-sm text-gray-500 dark:text-gray-400">
                Past Events
              </h2>
              {pastEvents.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  isAttending={false}
                  onToggle={() => {}}
                />
              ))}
            </section>
          )}
        </div>

        {/* Right: store info */}
        <div className="flex flex-col gap-4">
          <section className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-5">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 text-sm">Store Info</h2>
            <dl className="flex flex-col gap-3 text-sm">
              {location.contactPhone && (
                <div className="flex items-start gap-2">
                  <Phone className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <a href={`tel:${location.contactPhone}`} className="text-gray-700 dark:text-gray-300 hover:underline">
                    {location.contactPhone}
                  </a>
                </div>
              )}
              {location.contactWebsite && (
                <div className="flex items-start gap-2">
                  <Globe className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <a
                    href={location.contactWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                  >
                    {location.contactWebsite.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              )}
              {location.tcgplayerStorefrontUrl && (
                <div className="flex items-start gap-2">
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <a
                    href={location.tcgplayerStorefrontUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    TCGPlayer store
                  </a>
                </div>
              )}
              {location.discordInviteUrl && (
                <div className="flex items-start gap-2">
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <a
                    href={location.discordInviteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Discord
                  </a>
                </div>
              )}
            </dl>
          </section>

        </div>
      </div>

      {/* Card zoom lightbox — tap anywhere to close */}
      {zoomedCard && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-3 bg-black/85 backdrop-blur-sm cursor-pointer px-4"
          onClick={() => setZoomedCard(null)}
          role="dialog"
          aria-label={zoomedCard.caption}
        >
          <Image
            src={zoomedCard.url}
            alt={zoomedCard.caption}
            width={400}
            height={560}
            className="max-h-[78vh] max-w-[90vw] w-auto h-auto rounded-xl shadow-2xl border border-gray-600"
          />
          <div className="text-center text-base font-medium text-white">
            {zoomedCard.caption}
          </div>
          <div className="text-sm text-gray-300">Tap anywhere to close</div>
        </div>
      )}
    </div>
  );
}
