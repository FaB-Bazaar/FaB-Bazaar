"use client";

import { useEffect, useState } from "react";
import { locationsClient } from "@/lib/client";
import type {
  EventType,
  CreateLocationDTO,
  LocationSummaryDTO,
  CountryDTO,
} from "@/types/location";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: "pro_tour", label: "Pro Tour" },
  { value: "calling", label: "Calling" },
  { value: "national", label: "National Championship" },
  { value: "open", label: "Open" },
  { value: "store_champ", label: "Store Championship" },
  { value: "other", label: "Other" },
];

const inputClass =
  "w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-gray-500 dark:text-gray-400">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

type LocationMode = "new" | "existing";

const LOCATION_CATEGORIES: { value: "venue" | "store"; label: string }[] = [
  { value: "venue", label: "Venue (event site)" },
  { value: "store", label: "Store" },
];

export function CreateEventForm() {
  // Whether to attach an event. When off, the form just creates a location.
  const [withEvent, setWithEvent] = useState(true);

  // Country reference list (for the country selector), loaded once.
  const [countries, setCountries] = useState<CountryDTO[]>([]);
  useEffect(() => {
    locationsClient.getCountries().then((res) => {
      if (res.success) {
        setCountries([...res.data].sort((a, b) => a.name.localeCompare(b.name)));
      }
    });
  }, []);

  // ── Location selection ──────────────────────────────────────
  const [mode, setMode] = useState<LocationMode>("new");

  // New venue fields
  const [category, setCategory] = useState<"venue" | "store">("venue");
  const [name, setName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressPostalCode, setAddressPostalCode] = useState("");
  const [addressCountry, setAddressCountry] = useState("US");
  const [contactWebsite, setContactWebsite] = useState("");
  const [venueTags, setVenueTags] = useState("");

  // Existing location search
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<LocationSummaryDTO[]>([]);
  const [selectedLocation, setSelectedLocation] =
    useState<LocationSummaryDTO | null>(null);

  // ── Event fields ────────────────────────────────────────────
  const [eventName, setEventName] = useState("");
  const [eventType, setEventType] = useState<EventType>("pro_tour");
  const [format, setFormat] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [registrationUrl, setRegistrationUrl] = useState("");
  const [discordInviteUrl, setDiscordInviteUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);

  // ── Submit state ────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ locationId: string; eventName: string } | null>(
    null
  );

  async function handleSearch() {
    if (!search.trim()) return;
    setSearching(true);
    const res = await locationsClient.browseLocations({ search: search.trim() });
    if (res.success) setResults(res.data.locations);
    setSearching(false);
  }

  function resetForm() {
    setCategory("venue");
    setName("");
    setAddressLine1("");
    setAddressCity("");
    setAddressState("");
    setAddressPostalCode("");
    setAddressCountry("US");
    setContactWebsite("");
    setVenueTags("");
    setSelectedLocation(null);
    setSearch("");
    setResults([]);
    setEventName("");
    setEventType("pro_tour");
    setFormat("");
    setStartDate("");
    setEndDate("");
    setRegistrationUrl("");
    setDiscordInviteUrl("");
    setNotes("");
    setActive(true);
  }

  function validate(): string | null {
    if (withEvent) {
      if (!eventName.trim()) return "Event name is required.";
      if (!startDate) return "Start date is required.";
      if (!endDate) return "End date is required.";
      if (endDate < startDate) return "End date must be on or after the start date.";
    }
    // Location-only always creates a new location; an event may reuse an existing one.
    if (!withEvent || mode === "new") {
      if (!name.trim()) return "Location name is required.";
      if (!addressLine1.trim()) return "Location address is required.";
      if (!addressCity.trim()) return "Location city is required.";
      if (!addressCountry.trim()) return "Location country is required.";
    } else if (!selectedLocation) {
      return "Select an existing location, or switch to creating a new venue.";
    }
    return null;
  }

  async function handleSubmit() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    // 1. Resolve the location id (create a venue, or use the selected one).
    let locationId: string;
    if (!withEvent || mode === "new") {
      const venue: CreateLocationDTO = {
        category,
        name: name.trim(),
        addressLine1: addressLine1.trim(),
        addressCity: addressCity.trim(),
        addressState: addressState.trim() || undefined,
        addressPostalCode: addressPostalCode.trim() || undefined,
        addressCountry: addressCountry.trim(),
        addressCountryId: countries.find((c) => c.iso2 === addressCountry)?.id,
        contactWebsite: contactWebsite.trim() || undefined,
        discordInviteUrl: discordInviteUrl.trim() || undefined,
        tags: venueTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };
      const locRes = await locationsClient.adminCreateLocation(venue);
      if (!locRes.success) {
        setError(locRes.error ?? "Failed to create venue");
        setSubmitting(false);
        return;
      }
      locationId = locRes.data.id;
    } else {
      locationId = selectedLocation!.id;
    }

    // Location-only: done after step 1, no event to create.
    if (!withEvent) {
      setSuccess({ locationId, eventName: name.trim() });
      setSubmitting(false);
      resetForm();
      return;
    }

    // 2. Create the event attached to that location.
    const eventData = {
      name: eventName.trim(),
      type: eventType,
      format: format.trim() || undefined,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      registrationUrl: registrationUrl.trim() || undefined,
      discordInviteUrl: discordInviteUrl.trim() || undefined,
      notes: notes.trim() || undefined,
      active,
    };
    // CreateEventDTO types dates as Date; the API route coerces the ISO strings.
    const evtRes = await locationsClient.createEvent(locationId, eventData as never);
    if (!evtRes.success) {
      setError(
        `Venue is saved, but the event failed: ${evtRes.error ?? "unknown error"}. ` +
          `You can retry using "Use existing location".`
      );
      setSubmitting(false);
      return;
    }

    setSuccess({ locationId, eventName: eventName.trim() });
    setSubmitting(false);
    resetForm();
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex flex-col gap-6">
      {success && (
        <div className="rounded-md border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/30 p-3 text-sm">
          <p className="text-green-700 dark:text-green-300">
            Created “{success.eventName}”.{" "}
            <a
              href={`/stores/${success.locationId}`}
              className="underline font-medium"
              target="_blank"
              rel="noreferrer"
            >
              View location →
            </a>
          </p>
        </div>
      )}

      {/* ── Add-an-event toggle ── */}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={withEvent}
          onChange={(e) => setWithEvent(e.target.checked)}
        />
        <span className="text-gray-700 dark:text-gray-300">
          Create an event for this location
        </span>
        <span className="text-gray-400">
          (uncheck to add a location only)
        </span>
      </label>

      {/* ── Location section ── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Location</h3>
          {withEvent && (
            <div className="flex gap-1 text-sm">
              <button
                type="button"
                onClick={() => setMode("new")}
                className={`px-3 py-1 rounded-md ${
                  mode === "new"
                    ? "bg-blue-600 text-white"
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                New venue
              </button>
              <button
                type="button"
                onClick={() => setMode("existing")}
                className={`px-3 py-1 rounded-md ${
                  mode === "existing"
                    ? "bg-blue-600 text-white"
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                Use existing
              </button>
            </div>
          )}
        </div>

        {!withEvent || mode === "new" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Field label="Category" required>
                <select
                  className={inputClass}
                  value={category}
                  onChange={(e) => setCategory(e.target.value as "venue" | "store")}
                >
                  {LOCATION_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Location name" required>
                <input
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Las Vegas Convention Center"
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Address" required>
                <input
                  className={inputClass}
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="3150 Paradise Rd"
                />
              </Field>
            </div>
            <Field label="City" required>
              <input
                className={inputClass}
                value={addressCity}
                onChange={(e) => setAddressCity(e.target.value)}
                placeholder="Las Vegas"
              />
            </Field>
            <Field label="State / Province">
              <input
                className={inputClass}
                value={addressState}
                onChange={(e) => setAddressState(e.target.value)}
                placeholder="NV"
              />
            </Field>
            <Field label="Postal code">
              <input
                className={inputClass}
                value={addressPostalCode}
                onChange={(e) => setAddressPostalCode(e.target.value)}
                placeholder="89109"
              />
            </Field>
            <Field label="Country" required>
              <select
                className={inputClass}
                value={addressCountry}
                onChange={(e) => setAddressCountry(e.target.value)}
              >
                {countries.length === 0 && (
                  <option value={addressCountry}>{addressCountry}</option>
                )}
                {countries.map((c) => (
                  <option key={c.id} value={c.iso2}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Website">
              <input
                className={inputClass}
                value={contactWebsite}
                onChange={(e) => setContactWebsite(e.target.value)}
                placeholder="https://…"
              />
            </Field>
            <Field label="Tags (comma-separated)">
              <input
                className={inputClass}
                value={venueTags}
                onChange={(e) => setVenueTags(e.target.value)}
                placeholder="pro-tour, 2026"
              />
            </Field>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                className={inputClass}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                placeholder="Search locations by name…"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleSearch}
                disabled={searching || !search.trim()}
              >
                {searching ? "Searching…" : "Search"}
              </Button>
            </div>
            {selectedLocation && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Selected:</span>
                <Badge variant="secondary">{selectedLocation.name}</Badge>
                <span className="text-gray-400">
                  {selectedLocation.addressCity}
                  {selectedLocation.addressState ? `, ${selectedLocation.addressState}` : ""}
                </span>
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-600 underline"
                  onClick={() => setSelectedLocation(null)}
                >
                  clear
                </button>
              </div>
            )}
            {results.length > 0 && (
              <ul className="flex flex-col gap-1 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md p-1">
                {results.map((loc) => (
                  <li key={loc.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedLocation(loc)}
                      className={`w-full text-left text-sm px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 ${
                        selectedLocation?.id === loc.id ? "bg-gray-100 dark:bg-gray-700" : ""
                      }`}
                    >
                      <span className="font-medium">{loc.name}</span>{" "}
                      <span className="text-gray-400">
                        — {loc.addressCity}
                        {loc.addressState ? `, ${loc.addressState}` : ""} ({loc.category})
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* ── Event section ── */}
      {withEvent && (
      <section className="flex flex-col gap-3 border-t border-gray-200 dark:border-gray-700 pt-5">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Event</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <Field label="Event name" required>
              <input
                className={inputClass}
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Pro Tour: Las Vegas"
              />
            </Field>
          </div>
          <Field label="Type" required>
            <select
              className={inputClass}
              value={eventType}
              onChange={(e) => setEventType(e.target.value as EventType)}
            >
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Format">
            <input
              className={inputClass}
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              placeholder="Classic Constructed"
            />
          </Field>
          <Field label="Start date" required>
            <input
              type="date"
              className={inputClass}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="End date" required>
            <input
              type="date"
              className={inputClass}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Registration URL">
              <input
                className={inputClass}
                value={registrationUrl}
                onChange={(e) => setRegistrationUrl(e.target.value)}
                placeholder="https://fabtcg.com/en/organised-play/…"
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Discord invite URL">
              <input
                className={inputClass}
                value={discordInviteUrl}
                onChange={(e) => setDiscordInviteUrl(e.target.value)}
                placeholder="https://discord.gg/…"
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Notes">
              <textarea
                className={inputClass}
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            <span className="text-gray-600 dark:text-gray-300">
              Active (visible in upcoming events)
            </span>
          </label>
        </div>
      </section>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Saving…" : withEvent ? "Create event" : "Create location"}
        </Button>
        <Button variant="ghost" onClick={resetForm} disabled={submitting}>
          Reset
        </Button>
      </div>
    </div>
  );
}
