// Client-side service for fetching and caching metadata

// Types
export interface ISet {
  _id: string
  code: string
  name: string
  releaseDate?: string
  isPromo: boolean
  category: string
  logoUrl?: string
  outOfPrint: boolean
}

export interface IEdition {
  _id: string
  code: string
  name: string
  displayClass: string
}

export interface IFoiling {
  _id: string
  code: string
  name: string
  abbreviation: string
  displayClass: string
}

export interface IRarity {
  _id: string
  code: string
  name: string
  abbreviation: string
  displayClass: string
}

export interface IArtVariation {
  _id: string
  code: string
  name: string
  displayClass: string
}

export interface IMetadata {
  sets: ISet[]
  editions: IEdition[]
  foilings: IFoiling[]
  rarities: IRarity[]
  artVariations: IArtVariation[]
}

// Cache
let metadataCache: IMetadata | null = null
let lastFetchTime = 0
const CACHE_TTL = 1000 * 60 * 60 // 1 hour

const BASE_URL = typeof window === "undefined"
  ? process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://fabbazaar.app')
  : "";

// Fetch all metadata
export async function fetchMetadata(forceRefresh = false): Promise<IMetadata> {
  // Return cached data if available and not expired
  const now = Date.now()
  if (!forceRefresh && metadataCache && now - lastFetchTime < CACHE_TTL) {
    return metadataCache
  }

  try {
    const response = await fetch(`${BASE_URL}/api/metadata`)

    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.status}`)
    }

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || "Failed to fetch metadata")
    }

    // Update cache
    metadataCache = data.metadata
    lastFetchTime = now

    return data.metadata
  } catch (error) {
    console.error("Error fetching metadata:", error)

    // Return cached data if available, even if expired
    if (metadataCache) {
      return metadataCache
    }

    throw error
  }
}

// Helper functions
export async function getSetName(code?: string): Promise<string> {
  if (!code) return "Unknown Set"

  try {
    const metadata = await fetchMetadata()
    const set = metadata.sets.find((s) => s.code === code)
    return set ? set.name : code
  } catch (error) {
    console.error("Error getting set name:", error)
    return code
  }
}

export async function getEditionInfo(code?: string): Promise<{ name: string; displayClass: string }> {
  if (!code) return { name: "", displayClass: "" }

  try {
    const metadata = await fetchMetadata()
    const edition = metadata.editions.find((e) => e.code === code)
    return edition ? { name: edition.name, displayClass: edition.displayClass } : { name: code, displayClass: "" }
  } catch (error) {
    console.error("Error getting edition info:", error)
    return { name: code, displayClass: "" }
  }
}

export async function getFoilingInfo(
  code?: string,
): Promise<{ name: string; abbreviation: string; displayClass: string }> {
  if (!code) return { name: "", abbreviation: "", displayClass: "" }

  try {
    const metadata = await fetchMetadata()
    const foiling = metadata.foilings.find((f) => f.code === code)
    return foiling
      ? { name: foiling.name, abbreviation: foiling.abbreviation, displayClass: foiling.displayClass }
      : { name: code, abbreviation: code, displayClass: "" }
  } catch (error) {
    console.error("Error getting foiling info:", error)
    return { name: code, abbreviation: code, displayClass: "" }
  }
}

export async function getRarityInfo(
  code?: string,
): Promise<{ name: string; abbreviation: string; displayClass: string }> {
  if (!code) return { name: "", abbreviation: "", displayClass: "" }

  try {
    const metadata = await fetchMetadata()
    const rarity = metadata.rarities.find((r) => r.code === code)
    return rarity
      ? { name: rarity.name, abbreviation: rarity.abbreviation, displayClass: rarity.displayClass }
      : { name: code, abbreviation: code, displayClass: "" }
  } catch (error) {
    console.error("Error getting rarity info:", error)
    return { name: code, abbreviation: code, displayClass: "" }
  }
}

export async function getArtVariationInfo(code?: string): Promise<{ name: string; displayClass: string }> {
  if (!code) return { name: "", displayClass: "" }

  try {
    const metadata = await fetchMetadata()
    const artVariation = metadata.artVariations.find((a) => a.code === code)
    return artVariation
      ? { name: artVariation.name, displayClass: artVariation.displayClass }
      : { name: code, displayClass: "" }
  } catch (error) {
    console.error("Error getting art variation info:", error)
    return { name: code, displayClass: "" }
  }
}

// Helper function to check if a card is special (Gold Cold Foil, Marvel, Fabled)
export function isSpecialCard(foiling?: string, rarity?: string): boolean {
  return foiling === "G" || rarity === "F" || rarity === "V"
}

// Helper function to get card color based on pitch value
export function getCardColor(pitch?: string): string {
  switch (pitch) {
    case "1":
      return "bg-red-50 border-red-200"
    case "2":
      return "bg-yellow-50 border-yellow-200"
    case "3":
      return "bg-blue-50 border-blue-200"
    default:
      return "bg-gray-50 border-gray-200"
  }
}
