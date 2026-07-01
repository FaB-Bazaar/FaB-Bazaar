"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MapPin, Users, ExternalLink, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { locationsClient } from "@/lib/client";
import type { LocationSummaryDTO, EventSummaryDTO } from "@/types/location";

function formatEventDate(date: Date | string) {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function LocationCard({
  location,
  onUnfollow,
}: {
  location: LocationSummaryDTO;
  onUnfollow: (id: string) => void;
}) {
  const [unfollowing, setUnfollowing] = useState(false);

  async function handleUnfollow() {
    setUnfollowing(true);
    const result = await locationsClient.unfollowLocation(location.id);
    if (result.success) {
      onUnfollow(location.id);
    } else {
      setUnfollowing(false);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/stores/${location.id}`}
          className="font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          {location.name}
        </Link>
        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
      </div>

      <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
        <span>
          {location.addressCity}
          {location.addressState ? `, ${location.addressState}` : ""}{" "}
          &middot; {location.addressCountry}
        </span>
      </div>

      {location.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {location.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <Users className="w-3 h-3" />
          {location.followerCount} follower{location.followerCount !== 1 ? "s" : ""}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 h-7 px-2"
          onClick={handleUnfollow}
          disabled={unfollowing}
        >
          {unfollowing ? "Leaving…" : "Unfollow"}
        </Button>
      </div>
    </div>
  );
}

function EventCard({ event }: { event: EventSummaryDTO }) {
  return (
    <Link
      href={`/stores/${event.locationId}`}
      className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-2 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-gray-900 dark:text-gray-100 text-sm leading-snug">
          {event.name}
        </span>
        <Badge variant="outline" className="text-xs flex-shrink-0">
          {event.type.replace("_", " ")}
        </Badge>
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {event.locationName}
      </span>
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
        <span>{formatEventDate(event.startDate)} – {formatEventDate(event.endDate)}</span>
        <span>{event.attendeeCount} attending</span>
      </div>
    </Link>
  );
}

export default function StoresPage() {
  const [followedStores, setFollowedStores] = useState<LocationSummaryDTO[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<EventSummaryDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    locationsClient.getStoresContext().then((result) => {
      if (result.success) {
        setFollowedStores(result.data.followedStores);
        setUpcomingEvents(result.data.upcomingEvents);
      }
      setLoading(false);
    });
  }, []);

  function handleUnfollow(id: string) {
    setFollowedStores((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Stores</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Stores you follow and upcoming events
            </p>
          </div>
          <Link href="/stores/browse">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              Browse stores
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading…</div>
        ) : (
          <>
            {/* Upcoming events */}
            {upcomingEvents.length > 0 && (
              <section className="mb-8">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Upcoming Events at Your Stores
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {upcomingEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              </section>
            )}

            {/* Followed stores */}
            <section>
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Followed Stores ({followedStores.length})
              </h2>

              {followedStores.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-700">
                  <MapPin className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    You haven't followed any stores yet.
                  </p>
                  <Link href="/stores/browse">
                    <Button size="sm">Browse stores</Button>
                  </Link>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {followedStores.map((store) => (
                    <LocationCard key={store.id} location={store} onUnfollow={handleUnfollow} />
                  ))}
                </div>
              )}
            </section>

            {/* Submit CTA */}
            <div className="mt-10 text-center">
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Don't see your local store?{" "}
                <Link
                  href="/stores/submit"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Submit it
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
