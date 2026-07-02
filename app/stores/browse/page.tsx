"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { MapPin, Users, Search, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { locationsClient } from "@/lib/client";
import type { LocationSummaryDTO, CountryDTO, StateDTO } from "@/types/location";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function LocationCard({
  location,
  isFollowing,
  onToggleFollow,
}: {
  location: LocationSummaryDTO;
  isFollowing: boolean;
  onToggleFollow: (id: string, current: boolean) => void;
}) {
  const [pending, setPending] = useState(false);

  async function handleFollow() {
    setPending(true);
    await onToggleFollow(location.id, isFollowing);
    setPending(false);
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/stores/${location.id}`}
          className="font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors leading-snug"
        >
          {location.name}
        </Link>
        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
      </div>

      <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
        <span>
          {location.addressCity}
          {location.addressState ? `, ${location.addressState}` : ""} &middot;{" "}
          {location.addressCountry}
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
          variant={isFollowing ? "secondary" : "default"}
          className="h-7 px-3 text-xs gap-1"
          onClick={handleFollow}
          disabled={pending}
        >
          {isFollowing && <Check className="w-3 h-3" />}
          {pending ? "…" : isFollowing ? "Following" : "Follow"}
        </Button>
      </div>
    </div>
  );
}

export default function BrowseStoresPage() {
  const [countries, setCountries] = useState<CountryDTO[]>([]);
  const [states, setStates] = useState<StateDTO[]>([]);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);

  const [locations, setLocations] = useState<LocationSummaryDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  const LIMIT = 20;

  // Load countries + user context on mount
  useEffect(() => {
    locationsClient.getCountries().then((r) => {
      if (r.success) setCountries(r.data);
    });
    locationsClient.getStoresContext().then((r) => {
      if (r.success) {
        setFollowedIds(new Set(r.data.followedStores.map((s) => s.id)));
        if (r.data.countryCode) setSelectedCountry(r.data.countryCode);
        // Preselect the user's self-set state too (cleared if the states
        // effect finds it doesn't belong to the country's list)
        if (r.data.stateCode) setSelectedState(r.data.stateCode);
      }
    });
  }, []);

  // Load states when country changes; keep the selected state only if it
  // exists in the new country's list (lets the profile preselect survive)
  useEffect(() => {
    setStates([]);
    if (!selectedCountry) { setSelectedState(""); return; }
    locationsClient.getStates(selectedCountry).then((r) => {
      if (!r.success) return;
      setStates(r.data);
      setSelectedState((prev) => (r.data.some((s) => s.stateCode === prev) ? prev : ""));
    });
  }, [selectedCountry]);

  // Fetch locations
  const fetchLocations = useCallback(
    async (pageNum: number) => {
      setLoading(true);
      const result = await locationsClient.browseLocations(
        {
          country: selectedCountry || undefined,
          state: selectedState || undefined,
          search: debouncedSearch || undefined,
        },
        { page: pageNum, limit: LIMIT }
      );
      setLoading(false);
      if (result.success) {
        if (pageNum === 1) {
          setLocations(result.data.locations);
        } else {
          setLocations((prev) => [...prev, ...result.data.locations]);
        }
        setTotal(result.data.total);
      }
    },
    [selectedCountry, selectedState, debouncedSearch]
  );

  useEffect(() => {
    setPage(1);
    fetchLocations(1);
  }, [fetchLocations]);

  async function handleToggleFollow(locationId: string, currentlyFollowing: boolean) {
    if (currentlyFollowing) {
      const result = await locationsClient.unfollowLocation(locationId);
      if (result.success) {
        setFollowedIds((prev) => {
          const next = new Set(prev);
          next.delete(locationId);
          return next;
        });
        setLocations((prev) =>
          prev.map((l) =>
            l.id === locationId ? { ...l, followerCount: Math.max(0, l.followerCount - 1) } : l
          )
        );
      }
    } else {
      const result = await locationsClient.followLocation(locationId);
      if (result.success) {
        setFollowedIds((prev) => new Set([...prev, locationId]));
        setLocations((prev) =>
          prev.map((l) =>
            l.id === locationId ? { ...l, followerCount: l.followerCount + 1 } : l
          )
        );
      }
    }
  }

  function loadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchLocations(nextPage);
  }

  const hasMore = locations.length < total;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Browse Stores</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Find FaB stores near you and follow them to discover trading partners.
            </p>
          </div>
          <Link href="/stores">
            <Button variant="ghost" size="sm">My stores</Button>
          </Link>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar filters */}
          <aside className="w-full lg:w-56 flex-shrink-0">
            <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-4 sticky top-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1.5">
                  Country
                </label>
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="w-full text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-2 py-1.5"
                >
                  <option value="">All countries</option>
                  {countries.map((c) => (
                    <option key={c.iso2} value={c.iso2}>{c.name}</option>
                  ))}
                </select>
              </div>

              {states.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1.5">
                    State / Province
                  </label>
                  <select
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className="w-full text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-2 py-1.5"
                  >
                    <option value="">All states</option>
                    {states.map((s) => (
                      <option key={s.id} value={s.stateCode}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {(selectedCountry || selectedState || search) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-gray-400"
                  onClick={() => {
                    setSelectedCountry("");
                    setSelectedState("");
                    setSearch("");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>

            <div className="mt-4 text-center">
              <Link href="/stores/submit" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                + Submit a store
              </Link>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search stores…"
                className="pl-9"
              />
            </div>

            {/* Results */}
            {loading && locations.length === 0 ? (
              <div className="text-center py-20 text-gray-400">Loading…</div>
            ) : locations.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <MapPin className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                No stores found. Try adjusting your filters.
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-400 mb-3">{total} store{total !== 1 ? "s" : ""} found</p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {locations.map((loc) => (
                    <LocationCard
                      key={loc.id}
                      location={loc}
                      isFollowing={followedIds.has(loc.id)}
                      onToggleFollow={handleToggleFollow}
                    />
                  ))}
                </div>

                {hasMore && (
                  <div className="mt-6 text-center">
                    <Button variant="outline" onClick={loadMore} disabled={loading}>
                      {loading ? "Loading…" : "Load more"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
