import type { Metadata } from "next"
import { locationService, eventService } from "@/lib/services"
import type { EventDTO } from "@/types/location"

const BASE_URL = process.env.NEXTAUTH_URL || "https://fabbazaar.app"
const FALLBACK_IMAGE = `${BASE_URL}/icon-512x512.png`

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

/** Deterministic, locale-independent date range, e.g. "Jul 16–19, 2026" or "Jul 30 – Aug 2, 2026". */
function formatDateRange(start: Date, end: Date): string {
  const s = new Date(start)
  const e = new Date(end)
  const sm = MONTHS[s.getUTCMonth()]
  const em = MONTHS[e.getUTCMonth()]
  const sd = s.getUTCDate()
  const ed = e.getUTCDate()
  const sy = s.getUTCFullYear()
  const ey = e.getUTCFullYear()

  if (sy === ey && s.getUTCMonth() === e.getUTCMonth() && sd === ed) {
    return `${sm} ${sd}, ${sy}`
  }
  if (sy === ey && s.getUTCMonth() === e.getUTCMonth()) {
    return `${sm} ${sd}–${ed}, ${sy}`
  }
  if (sy === ey) {
    return `${sm} ${sd} – ${em} ${ed}, ${sy}`
  }
  return `${sm} ${sd}, ${sy} – ${em} ${ed}, ${ey}`
}

function placeLabel(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(", ")
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params

  const fallback: Metadata = {
    title: "Stores & Events",
    description: "Find Flesh and Blood game stores and events near you, track upcoming tournaments, and connect with players bringing trades.",
  }

  try {
    const locResult = await locationService.getLocationById(id)
    if (!locResult.success || !locResult.data) return fallback

    const loc = locResult.data
    const place = placeLabel([loc.addressCity, loc.addressState, loc.addressCountry])
    const isVenue = loc.category === "venue"

    // Find the soonest upcoming (not-yet-ended) event at this location.
    let upcoming: EventDTO | null = null
    const eventsResult = await eventService.getEventsAtLocation(id)
    if (eventsResult.success && eventsResult.data) {
      const now = new Date()
      upcoming =
        eventsResult.data
          .filter((e) => new Date(e.endDate) >= now)
          .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0] ?? null
    }

    let title: string
    let description: string

    if (upcoming) {
      const dates = formatDateRange(upcoming.startDate, upcoming.endDate)
      title = `${upcoming.name} · ${loc.name}`
      description = `${dates}${upcoming.format ? ` · ${upcoming.format}` : ""} at ${loc.name}${place ? `, ${place}` : ""}. See who's attending and find players bringing trades.`
    } else if (loc.notes) {
      title = loc.name
      description = loc.notes
    } else if (isVenue) {
      title = loc.name
      description = `Flesh and Blood event venue${place ? ` in ${place}` : ""}. Track upcoming tournaments and find players bringing trades.`
    } else {
      title = loc.name
      description = `Flesh and Blood game store${place ? ` in ${place}` : ""}. Browse events, followers, and trade matches on FaB Bazaar.`
    }

    const url = `${BASE_URL}/stores/${id}`
    const ogImage = loc.images?.[0] || FALLBACK_IMAGE

    return {
      title,
      description,
      openGraph: {
        title: `${title} | FaB Bazaar`,
        description,
        url,
        images: [{ url: ogImage, alt: loc.name }],
        type: "website",
      },
      twitter: {
        card: "summary",
        title,
        description,
        images: [ogImage],
      },
      alternates: {
        canonical: url,
      },
    }
  } catch (error) {
    console.error("[Store Metadata] Error generating metadata:", error)
    return fallback
  }
}

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return children
}
