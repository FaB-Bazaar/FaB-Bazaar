// //hooks/useBinderState.ts

// "use client"

// import { useState, useEffect, useMemo } from "react"
// import { fetchMetadata } from "@/lib/metadata-service"
// import { useBinderDataRefresh } from "@/hooks/useBinderDataRefresh"
// import { fuzzySearch } from "@/lib/utils"

// interface BinderStats {
//   totalCards: number
//   forTradeCount: number
//   uniqueCards: number
//   estimatedValue: number
// }

// interface OwnerInfo {
//   username?: string
//   discordUsername?: string
// }

// export function useBinderState(initialBinder: any) {
//     console.log('🔄 useBinderState called with initialBinder keys:', Object.keys(initialBinder || {}))

//     // Core binder state
//     const [binder, setBinder] = useState<any>(initialBinder)
//     console.log('🔄 useBinderState binder state has', binder?.cards?.length, 'cards')

//   const [loading, setLoading] = useState(false)
//   const [error, setError] = useState<string | null>(null)
//   const [metadata, setMetadata] = useState<any>(null)
//   const [ownerInfo, setOwnerInfo] = useState<OwnerInfo | null>(null)
//   const [cardOrder, setCardOrder] = useState<string[]>([])

//   // UI state
//   const [activeTab, setActiveTab] = useState("cards")
//   const [isCardSearchOpen, setIsCardSearchOpen] = useState(false)
//   const [editingCard, setEditingCard] = useState<any>(null)
//   const [printingSwapCard, setPrintingSwapCard] = useState<any>(null)
//   const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  
//   // Filter state
//   const [searchQuery, setSearchQuery] = useState("")
//   const [filterForTrade, setFilterForTrade] = useState<string>("all")
//   const [filterRarity, setFilterRarity] = useState<string>("all")
//   const [filterFoiling, setFilterFoiling] = useState<string>("all")
//   const [filterSet, setFilterSet] = useState<string>("all")
//   const [sortOption, setSortOption] = useState<string>("name-asc")

//   // Selection state
//   const [selectedCards, setSelectedCards] = useState<any[]>([])
//   const [sidebarOpen, setSidebarOpen] = useState(false)
//   const [copied, setCopied] = useState(false)

//   // Smart refresh hook
//   const { isRefreshing, lastRefreshTime } = useBinderDataRefresh({
//     binder,
//     setBinder,
//     staleThresholdHours: 24,
//     minRefreshIntervalMinutes: 30
//   })

//   // Initialize card order on first load
//   useEffect(() => {
//     if (binder?.cards && cardOrder.length === 0) {
//       const rarityOrder = ["P", "V", "F", "L", "M", "S", "R", "C", "B", "T"]
//       const getRarityRank = (rarity?: string) => {
//         if (!rarity) return 100
//         const idx = rarityOrder.indexOf(rarity.toUpperCase())
//         return idx === -1 ? 99 : idx
//       }

//       const initialOrder = [...binder.cards]
//         .sort((a, b) => {
//           const rarityA = getRarityRank(a.rarity || a.printingDetails?.rarity)
//           const rarityB = getRarityRank(b.rarity || b.printingDetails?.rarity)
//           if (rarityA !== rarityB) return rarityA - rarityB
//           return (a.name || a.display_name || '').localeCompare(b.name || b.display_name || '')
//         })
//         .map(card => card.id)
      
//       setCardOrder(initialOrder)
//     }
//   }, [binder?.cards, cardOrder.length])

//   // Fetch owner info
//   useEffect(() => {
//     if (binder?.userId) {
//       fetch(`/api/users/find?userId=${binder.userId}`)
//         .then(res => res.json())
//         .then(data => {
//           if (data.success && data.user) {
//             setOwnerInfo({ 
//               username: data.user.username, 
//               discordUsername: data.user.discordUsername 
//             })
//           }
//         })
//         .catch(() => {
//           // Silently fail - owner info is optional
//         })
//     }
//   }, [binder?.userId])

//   // Fetch metadata on mount
//   useEffect(() => {
//     const fetchMeta = async () => {
//       try {
//         setLoading(true)
//         const metadataResult = await fetchMetadata()
//         setMetadata(metadataResult)
//       } catch (err) {
//         setError("Failed to load metadata.")
//       } finally {
//         setLoading(false)
//       }
//     }
//     fetchMeta()
//   }, [])

//   // Calculate stats when binder changes
//   const stats: BinderStats = useMemo(() => {
//     if (!binder?.cards) {
//       return {
//         totalCards: 0,
//         forTradeCount: 0,
//         uniqueCards: 0,
//         estimatedValue: 0,
//       }
//     }

//     const cards = binder.cards
//     const forTradeCount = cards.filter((card: any) => card.forTrade).length
//     const uniqueCards = new Set(cards.map((card: any) => card.cardId)).size
    
//     let totalValue = 0
//     cards.forEach((card: any) => {
//       const marketPrice = card.tcg_market ?? card.priceInfo?.tcgMarket
//       if (marketPrice && !isNaN(Number(marketPrice))) {
//         totalValue += Number(marketPrice) * (card.quantity || 1)
//       } else if (card.value) {
//         const valueMatch = card.value.toString().match(/\$?(\d+(\.\d+)?)/)
//         if (valueMatch) {
//           const value = Number.parseFloat(valueMatch[1])
//           totalValue += value * (card.quantity || 1)
//         }
//       }
//     })

//     return {
//       totalCards: cards.length,
//       forTradeCount,
//       uniqueCards,
//       estimatedValue: totalValue,
//     }
//   }, [binder?.cards])

//   // Filtering and sorting logic
//   const filteredCards = useMemo(() => {
//     if (!binder?.cards) return []

//     return binder.cards.filter((card: any) => {
//       // Search matching
//       const matchesSearch = searchQuery === "" ||
//         fuzzySearch(searchQuery, card.name) ||
//         (card.notes && fuzzySearch(searchQuery, card.notes)) ||
//         (card.printingDetails?.text && card.printingDetails.text.toLowerCase().includes(searchQuery.toLowerCase())) ||
//         (card.printingDetails?.types && Array.isArray(card.printingDetails.types) && 
//          card.printingDetails.types.some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase())))

//       // Filter matching
//       const matchesTradeStatus = filterForTrade === "all" ||
//         (filterForTrade === "forTrade" && card.forTrade) ||
//         (filterForTrade === "notForTrade" && !card.forTrade)
      
//       const matchesRarity = filterRarity === "all" || 
//         (card.rarity || card.printingDetails?.rarity) === filterRarity
      
//       const matchesFoiling = filterFoiling === "all" || 
//         (card.foiling || card.printingDetails?.foiling) === filterFoiling
      
//       const matchesSet = filterSet === "all" || 
//         (card.set || card.printingDetails?.set || card.set_id || card.printingDetails?.set_id) === filterSet

//       return matchesSearch && matchesTradeStatus && matchesRarity && matchesFoiling && matchesSet
//     })
//   }, [binder?.cards, searchQuery, filterForTrade, filterRarity, filterFoiling, filterSet])

//   // Sorted cards with preserved order
//   const sortedCards = useMemo(() => {
//     if (!filteredCards.length || !cardOrder.length) {
//       // Fallback to normal sorting if no order established
//       const rarityOrder = ["P", "V", "F", "L", "M", "S", "R", "C", "B", "T"]
//       const getRarityRank = (rarity?: string) => {
//         if (!rarity) return 100
//         const idx = rarityOrder.indexOf(rarity.toUpperCase())
//         return idx === -1 ? 99 : idx
//       }

//       return [...filteredCards].sort((a, b) => {
//         const rarityA = getRarityRank(a.rarity || a.printingDetails?.rarity)
//         const rarityB = getRarityRank(b.rarity || b.printingDetails?.rarity)
//         if (rarityA !== rarityB) return rarityA - rarityB
//         return (a.name || a.display_name || '').localeCompare(b.name || b.display_name || '')
//       })
//     }

//     // Sort by the preserved card order
//     return [...filteredCards].sort((a, b) => {
//       const orderA = cardOrder.indexOf(a.id)
//       const orderB = cardOrder.indexOf(b.id)
      
//       // If both cards are in the order array, use that order
//       if (orderA !== -1 && orderB !== -1) {
//         return orderA - orderB
//       }
      
//       // If only one is in the order array, prioritize it
//       if (orderA !== -1) return -1
//       if (orderB !== -1) return 1
      
//       // If neither is in the order array, fall back to normal sorting
//       const rarityOrder = ["P", "V", "F", "L", "M", "S", "R", "C", "B", "T"]
//       const getRarityRank = (rarity?: string) => {
//         if (!rarity) return 100
//         const idx = rarityOrder.indexOf(rarity.toUpperCase())
//         return idx === -1 ? 99 : idx
//       }
      
//       const rarityA = getRarityRank(a.rarity || a.printingDetails?.rarity)
//       const rarityB = getRarityRank(b.rarity || b.printingDetails?.rarity)
//       if (rarityA !== rarityB) return rarityA - rarityB
//       return (a.name || a.display_name || '').localeCompare(b.name || b.display_name || '')
//     })
//   }, [filteredCards, cardOrder])

//   return {
//     // Core state
//     binder,
//     setBinder,
//     loading,
//     setLoading,
//     error,
//     setError,
//     metadata,
//     ownerInfo,
//     cardOrder,
//     setCardOrder,
//     stats,

//     // UI state
//     activeTab,
//     setActiveTab,
//     isCardSearchOpen,
//     setIsCardSearchOpen,
//     editingCard,
//     setEditingCard,
//     printingSwapCard,
//     setPrintingSwapCard,
//     transferDialogOpen,
//     setTransferDialogOpen,

//     // Filter state
//     searchQuery,
//     setSearchQuery,
//     filterForTrade,
//     setFilterForTrade,
//     filterRarity,
//     setFilterRarity,
//     filterFoiling,
//     setFilterFoiling,
//     filterSet,
//     setFilterSet,
//     sortOption,
//     setSortOption,

//     // Selection state
//     selectedCards,
//     setSelectedCards,
//     sidebarOpen,
//     setSidebarOpen,
//     copied,
//     setCopied,

//     // Computed values
//     filteredCards,
//     sortedCards,

//     // Refresh state
//     isRefreshing,
//     lastRefreshTime,
//   }
// }