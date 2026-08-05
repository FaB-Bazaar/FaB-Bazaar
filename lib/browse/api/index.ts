// lib/browse/api/index.ts

export interface SearchCardsParams {
    searchQuery?: string
    filterSet?: string
    filterRarity?: string
    filterType?: string
    page?: number
    limit?: number
  }
  
  export interface SearchCardsResponse {
    success: boolean
    data: {
      printings: any[]
      pagination?: {
        totalPages: number
      }
      total: number
    }
    error?: string
  }
  
  /**
   * Search for cards using the new /api/printings/search endpoint
   */
  export async function searchCards(params: SearchCardsParams, signal?: AbortSignal): Promise<SearchCardsResponse> {
    const {
      searchQuery,
      filterSet,
      filterRarity,
      filterType,
      page = 1,
      limit = 12
    } = params
  
    // Build the query parameters for the new API
    const urlParams = new URLSearchParams()
    
    // Map search query to the new API's text search parameters
    if (searchQuery) {
      urlParams.append("searchableText", searchQuery)
    }
    
    // Map filter parameters to the new API format
    if (filterSet && filterSet !== "all") {
      urlParams.append("sets", filterSet)
    }
    
    if (filterRarity && filterRarity !== "all") {
      // Map rarity values to the new API's format
      const rarityMap: Record<string, string> = {
        'common': 'C',
        'rare': 'R', 
        'super_rare': 'S',
        'majestic': 'M',
        'legendary': 'L',
        'fabled': 'F'
      }
      const mappedRarity = rarityMap[filterRarity] || filterRarity
      urlParams.append("rarities", mappedRarity)
    }
    
    if (filterType && filterType !== "all") {
      urlParams.append("types", filterType)
    }
    
    // Pagination parameters
    urlParams.append("page", page.toString())
    urlParams.append("limit", limit.toString())
    
    // Optional: Set response mode for optimized data
    urlParams.append("show", "summary")
    
    const url = `/api/printings/search?${urlParams.toString()}`
    
    const response = await fetch(url, { signal })
  
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Server error: ${response.status}`)
    }
  
    const responseData = await response.json()
    
    if (!responseData.success) {
      throw new Error(responseData.error || 'Search failed')
    }
  
    return responseData
  }
  
  /**
   * Search for a single card by name and color (used in bulk import)
   */
  export async function searchCardByName(
    name: string, 
    color?: string, 
    useExactMatch: boolean = false
  ): Promise<any[]> {
    let url: string
    
    if (color && !useExactMatch) {
      // Use optimized search for formats that include color
      url = `/api/printings/search?name=${encodeURIComponent(name)}&color=${encodeURIComponent(color)}&limit=20&show=summary`
    } else {
      // Use broader search for Card List format or when no color specified
      url = `/api/printings/search?searchableText=${encodeURIComponent(name)}&limit=20&show=summary`
    }
    
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`Failed to search for card: ${name}`)
    }
    
    const responseData = await response.json()
    
    if (!responseData.success || !responseData.data.printings) {
      return []
    }
    
    let matches = responseData.data.printings
    
    // Filter for exact name matches when using broader search
    if (useExactMatch) {
      matches = matches.filter((printing: any) => 
        printing.name?.toLowerCase() === name.toLowerCase()
      )
    }
    
    return matches
  }
  
  /**
   * Fetch user's binders
   */
  export async function fetchUserBinders(): Promise<any[]> {
    const response = await fetch("/api/binders/user")
    const data = await response.json()
    return data.binders || []
  }
  
  /**
   * Fetch user's decks
   */
  export async function fetchUserDecks(): Promise<any[]> {
    const response = await fetch("/api/decks/user")
    const data = await response.json()
    return data.success ? (data.decks || []) : []
  }
  
/**
 * Fetch metadata (sets and rarities)
 */
export async function fetchMetadata(): Promise<{ sets: any[], rarities: any[] }> {
    try {
      // Fetch sets
      const setsResponse = await fetch("/api/metadata/sets")
      if (!setsResponse.ok) throw new Error("Failed to fetch sets")
      const setsData = await setsResponse.json()
      
      // Fetch rarities
      const raritiesResponse = await fetch("/api/metadata/rarities")
      if (!raritiesResponse.ok) throw new Error("Failed to fetch rarities")
      const raritiesData = await raritiesResponse.json()
      
      // Sort sets by name
      const mainSets = setsData.sets
        .filter((set: any) => set.category === "main")
        .sort((a: any, b: any) => a.name.localeCompare(b.name))
      const promoSets = setsData.sets
        .filter((set: any) => set.category === "promo")
        .sort((a: any, b: any) => a.name.localeCompare(b.name))
      const blitzSets = setsData.sets
        .filter((set: any) => set.category === "blitz")
        .sort((a: any, b: any) => a.name.localeCompare(b.name))
      const otherSets = setsData.sets
        .filter((set: any) => set.category === "other")
        .sort((a: any, b: any) => a.name.localeCompare(b.name))
      
      // Combine sets in the desired order
      const sets = [...mainSets, ...promoSets, ...blitzSets, ...otherSets]
      
      // Sort rarities
      const rarities = raritiesData.rarities.sort((a: any, b: any) => {
        // Custom sort order: C, R, S, M, L, F, others
        const order: Record<string, number> = { C: 1, R: 2, S: 3, M: 4, L: 5, F: 6 }
        return (order[a.code] || 99) - (order[b.code] || 99)
      })
      
      return { sets, rarities }
    } catch (err) {
      throw new Error("Failed to load metadata")
    }
  }
  /**
   * Add card to wants list
   */
  export async function addToWantsList(
    printingId: string,
    quantity: number = 1,
    priority: string = 'medium',
    notes: string = ''
  ): Promise<{ success: boolean; action: string; error?: string }> {
    const response = await fetch('/api/wants/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        printingId,
        quantity,
        priority,
        notes
      }),
    })
  
    const result = await response.json()
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to add to wants list')
    }
  
    return result
  }
  
  /**
   * Create a new binder
   */
  export async function createBinder(
    userId: string,
    name: string,
    slug?: string,
    tags: string[] = []
  ): Promise<any> {
    const response = await fetch(`/api/users/${userId}/binders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        name, 
        slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, ""),
        tags, 
        userId 
      }),
    })
    
    if (!response.ok) {
      throw new Error("Failed to create binder")
    }
    
    const result = await response.json()
    return result.binder
  }
  
  /**
   * Create a new deck
   */
  export async function createDeck(
    name: string,
    format: string = "Classic Constructed",
    isPublic: boolean = false
  ): Promise<any> {
    const response = await fetch(`/api/decks/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, format, isPublic }),
    })
    
    if (!response.ok) {
      throw new Error("Failed to create deck")
    }
    
    const result = await response.json()
    
    if (!result.success) {
      throw new Error(result.error || "Failed to create deck")
    }
    
    return result.deck
  }

  /**
 * Create a new deck with cards using smart allocation
 */
export async function createDeckWithCards(
    name: string,
    format: string,
    isPublic: boolean = false,
    cards: Array<{ printingId: string; quantity: number }>
  ): Promise<any> {
    const response = await fetch('/api/decks/create-with-cards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        format,
        isPublic,
        cards,
        debug: true // Remove this in production
      })
    });
  
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create deck with cards');
    }
  
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to create deck with cards');
    }
  
    return result;
  }
  
  /**
   * Add cards to binder in batch
   */
  export async function addCardsToBinder(
    binderSlug: string,
    printings: Array<{
      printingId: string
      quantity: number
      condition?: string
      forTrade?: boolean
      notes?: string
    }>
  ): Promise<{
    wantsRemoved?: Array<{ printingId: string; quantityRemoved: number; cardName: string }>
  }> {
    const response = await fetch(`/api/binders/${binderSlug}/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        printings: printings.map(p => ({
          printingId: p.printingId,
          quantity: p.quantity,
          condition: p.condition || "NM",
          forTrade: p.forTrade ?? true,
          notes: p.notes || ""
        }))
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || "Failed to add cards to binder")
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || "Failed to add cards to binder")
    }

    return result as {
      wantsRemoved?: Array<{ printingId: string; quantityRemoved: number; cardName: string }>
    }
  }