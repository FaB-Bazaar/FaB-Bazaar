"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FOILING_MAP, EDITION_MAP, RARITY_MAP, SET_MAP } from "@/lib/fab-constants"
import { wantsClient, bindersClient } from "@/lib/client"

interface CardData {
  unique_id: string
  name: string
  display_name?: string
  pitch?: string
  cost?: string
  power?: string
  defense?: string
  health?: string
  types?: string[]
  printings?: {
    set_id: string
    edition: string
    foiling: string
    rarity: string
    unique_id: string
    image_url: string
    art_variation?: string
    tcg_market?: string | number
  }[]
  defaultPrinting?: any
}

interface CardDisplayProps {
  card: CardData
  showDetails?: boolean
  showActions?: boolean
  linkToDetail?: boolean
  className?: string
  selectedPrinting?: any | null
  onPrintingChange?: (printing: any | null) => void
  quantity?: number
  onQuantityChange?: (quantity: number) => void
}

export default function CardDisplay({
  card,
  showDetails = false,
  showActions = true,
  linkToDetail = true,
  className = "",
  selectedPrinting: controlledPrinting,
  onPrintingChange,
  quantity: controlledQuantity,
  onQuantityChange,
}: CardDisplayProps) {
  const [setNames, setSetNames] = useState<Record<string, string>>({})
  const [foilings, setFoilings] = useState<Record<string, { name: string; abbreviation: string; className: string }>>(
    {},
  )
  const [rarities, setRarities] = useState<Record<string, { name: string; className: string }>>({})
  const [artVariations, setArtVariations] = useState<Record<string, { name: string; className: string }>>({})
  const [isAddingToBinder, setIsAddingToBinder] = useState(false)
  const [isAddingToWants, setIsAddingToWants] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const [selectedPrinting, setSelectedPrinting] = useState<any | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)
  const [addedToBinder, setAddedToBinder] = useState(false)
  const [addedToWants, setAddedToWants] = useState(false)

  // Helper function to get edition name (uses your fab-constants)
  const getEditionDisplayName = (code?: string) => {
    if (!code) return ""
    return EDITION_MAP[code.toLowerCase() as keyof typeof EDITION_MAP] || code
  }

  // Helper function to get foiling info (uses your fab-constants)
  const getFoilingDisplayName = (code?: string) => {
    if (!code) return "Non-foil"
    return FOILING_MAP[code.toLowerCase() as keyof typeof FOILING_MAP] || code
  }

  // Helper function to get rarity info (uses your fab-constants)
  const getRarityDisplayName = (code?: string) => {
    if (!code) return ""
    return RARITY_MAP[code.toLowerCase() as keyof typeof RARITY_MAP] || code
  }

  // Helper function to get set name (uses your fab-constants)
  const getSetDisplayName = (code?: string) => {
    if (!code) return ""
    return SET_MAP[code.toLowerCase() as keyof typeof SET_MAP] || code.toUpperCase()
  }

  // // Load metadata on component mount
  // useEffect(() => {
  //   const loadMetadata = async () => {
  //     try {
  //       const metadata = await fetchMetadata()
  //
  //       // Create lookup maps for faster access
  //       const setMap: Record<string, string> = {}
  //       metadata.sets.forEach((set) => {
  //         setMap[set.code] = set.name
  //       })
  //
  //       const foilingMap: Record<string, { name: string; abbreviation: string; className: string }> = {}
  //       metadata.foilings.forEach((foiling) => {
  //         foilingMap[foiling.code] = {
  //           name: foiling.name,
  //           abbreviation: foiling.abbreviation || foiling.code,
  //           className: foiling.displayClass || "",
  //         }
  //       })
  //
  //       const rarityMap: Record<string, { name: string; className: string }> = {}
  //       metadata.rarities.forEach((rarity) => {
  //         rarityMap[rarity.code] = {
  //           name: rarity.name,
  //           className: rarity.displayClass || "",
  //         }
  //       })
  //
  //       const artVariationMap: Record<string, { name: string; className: string }> = {}
  //       metadata.artVariations.forEach((variation) => {
  //         artVariationMap[variation.code] = {
  //           name: variation.name,
  //           className: variation.displayClass || "",
  //         }
  //       })
  //
  //       setSetNames(setMap)
  //       setFoilings(foilingMap)
  //       setRarities(rarityMap)
  //       setArtVariations(artVariationMap)
  //     } catch (error) {
  //       console.error("Error loading metadata:", error)
  //
  //       // Fallback values if metadata fetch fails
  //       setFoilings({
  //         S: {
  //           name: "Non-Foil",
  //           abbreviation: "NF",
  //           className: "bg-gray-100 text-gray-700 border-gray-300",
  //         },
  //         R: {
  //           name: "Rainbow Foil",
  //           abbreviation: "RF",
  //           className: "bg-gradient-to-r from-blue-100 to-purple-100 text-purple-700 border-purple-300",
  //         },
  //         C: {
  //           name: "Cold Foil",
  //           abbreviation: "CF",
  //           className: "bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 border-blue-300",
  //         },
  //         G: {
  //           name: "Gold Cold Foil",
  //           abbreviation: "GF",
  //           className: "bg-gradient-to-r from-yellow-100 to-amber-100 text-amber-700 border-amber-300 font-semibold",
  //         },
  //         N: {
  //           name: "Non-Foil",
  //           abbreviation: "NF",
  //           className: "bg-gray-100 text-gray-700 border-gray-300",
  //         },
  //       })
  //
  //       setRarities({
  //         C: { name: "Common", className: "bg-gray-100 text-gray-700 border-gray-300" },
  //         R: { name: "Rare", className: "bg-blue-100 text-blue-700 border-blue-300" },
  //         S: { name: "Super Rare", className: "bg-purple-100 text-purple-700 border-purple-300" },
  //         M: { name: "Majestic", className: "bg-pink-100 text-pink-700 border-pink-300" },
  //         L: { name: "Legendary", className: "bg-amber-100 text-amber-700 border-amber-300" },
  //         F: { name: "Fabled", className: "bg-red-100 text-red-700 border-red-300 font-semibold" },
  //         T: { name: "Token", className: "bg-gray-100 text-gray-700 border-gray-300" },
  //         V: { name: "Marvel", className: "bg-indigo-100 text-indigo-700 border-indigo-300 font-semibold" },
  //         P: { name: "Promo", className: "bg-green-100 text-green-700 border-green-300" },
  //       })
  //
  //       setArtVariations({
  //         AB: { name: "Alternate Border", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  //         AA: { name: "Alternate Art", className: "bg-violet-50 text-violet-700 border-violet-200" },
  //         AT: { name: "Alternate Text", className: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" },
  //         EA: { name: "Extended Art", className: "bg-purple-50 text-purple-700 border-purple-200" },
  //         FA: { name: "Full Art", className: "bg-pink-50 text-pink-700 border-pink-200" },
  //         HS: { name: "Half Size", className: "bg-rose-50 text-rose-700 border-rose-200" },
  //       })
  //     }
  //   }
  //
  //   loadMetadata()
  // }, [])

  // Helper function to get set name
  const getSetName = (code: string): string => {
    return setNames[code] || getSetDisplayName(code)
  }

  // Helper function to get foiling info
  const getFoilingInfo = (code?: string) => {
    if (!code) return { name: "", abbreviation: "", className: "" }
    return foilings[code] || { name: getFoilingDisplayName(code), abbreviation: code, className: "" }
  }

  // Helper function to get rarity info
  const getRarityInfo = (code?: string) => {
    if (!code) return { name: "", className: "" }
    return rarities[code] || { name: getRarityDisplayName(code), className: "" }
  }

  // Helper function to get art variation info
  const getArtVariationInfo = (code?: string) => {
    if (!code) return { name: "", className: "" }
    return artVariations[code] || { name: code, className: "" }
  }

  const addToTradeBinderHandler = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      setIsAddingToBinder(true)

      const printingToUse = selectedPrinting || getDefaultPrinting()
      if (!printingToUse) {
        toast({
          title: "Error",
          description: "No printing information available for this card",
          variant: "destructive",
        })
        return
      }

      // TODO: Deprecated /api/binder endpoint - needs refactoring to use /api/binders with binder ID
      /*
      const response = await fetch("/api/binder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cardId: card.unique_id,
          name: card.display_name || card.name,
          set: printingToUse.set_id,
          rarity: printingToUse.rarity,
          foiling: printingToUse.foiling,
          edition: printingToUse.edition,
          printingId: printingToUse.unique_id,
          quantity: quantity,
          forTrade: true,
          printingDetails: {
            set_id: printingToUse.set_id,
            rarity: printingToUse.rarity,
            foiling: printingToUse.foiling,
            image_url: printingToUse.image_url,
          },
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to add card to binder")
      }

      const data = await response.json()
      */

      // Temporary: Feature disabled pending refactoring
      toast({
        title: "Feature Temporarily Disabled",
        description: "Add to binder functionality is being updated. Please use the Browse page for bulk import.",
        variant: "default",
      })
      return

      toast({
        title: "Added to Trade Binder",
        description: (
          <div className="flex flex-col gap-2">
            <p>
              {card.display_name || card.name} ({getSetName(printingToUse.set_id)}) has been added to your trade binder.
            </p>
            <Button variant="outline" size="sm" onClick={() => router.push("/binder")}>
              View Binder
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push(`/card/${card.unique_id}`)}>
              Edit Details
            </Button>
          </div>
        ),
        duration: 5000,
      })
      setAddedToBinder(true)
      setTimeout(() => setAddedToBinder(false), 2000)
    } catch (error) {
      console.error("Error adding to binder:", error)
      toast({
        title: "Error",
        description: "Failed to add card to binder. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsAddingToBinder(false)
    }
  }

  const addToWantsListHandler = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      setIsAddingToWants(true)
      const printingToUse = selectedPrinting || getDefaultPrinting()
      if (!printingToUse) {
        toast({
          title: "Error",
          description: "No printing information available for this card",
          variant: "destructive",
        })
        return
      }

      const result = await wantsClient.addWantsItem(printingToUse.unique_id, quantity)

      if (result.success) {
        toast({
          title: "Added to Wants List",
          description: `${card.display_name || card.name} has been added to your wants list.`,
          variant: "default",
        })
        setAddedToWants(true)
        setTimeout(() => setAddedToWants(false), 2000)
      } else {
        if (result.error === "Card already exists in wants list") {
          toast({
            title: "Already in Wants List",
            description: "This card is already in your wants list.",
            variant: "default",
          })
          return
        }
        throw new Error(result.error || "Failed to add card to wants list")
      }
    } catch (error) {
      console.error("Error adding to wants list:", error)
      toast({
        title: "Error",
        description: "Failed to add card to wants list. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsAddingToWants(false)
    }
  }

  const hasPrintings = card.printings && card.printings.length > 1

  // Helper function to get the default printing
  const getDefaultPrinting = () => {
    if (!card.printings || card.printings.length === 0) {
      return null
    }

    // Try to find a non-foil printing first (usually code "S")
    const nonFoil = card.printings.find((p) => p.foiling === "S")
    if (nonFoil) return nonFoil

    // Otherwise just return the first printing
    return card.printings[0]
  }

  // Use controlled props if provided
  const printing = controlledPrinting !== undefined ? controlledPrinting : selectedPrinting
  const qty = controlledQuantity !== undefined ? controlledQuantity : quantity

  const currentPrinting =
    selectedPrinting || card.defaultPrinting || (card.printings && card.printings.length > 0 ? card.printings[0] : null)

  // Determine if the card is a rainbow foil
  const isRainbowFoil = currentPrinting?.foiling === "R"

  // Get the image URL with fallback logic
  const getCardImageUrl = () => {
    // If we've already determined the image source, use that
    if (imageSrc) return imageSrc

    // First try: Cloudfront URL based on printing ID
    if (currentPrinting?.unique_id && !imageError) {
      return `https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${currentPrinting.unique_id}/public`
    }

    // Second try: Use the image_url from the printing if available
    if (currentPrinting?.image_url) {
      return currentPrinting.image_url
    }

    // Final fallback: Use the cardback image
    return "/cardback.webp"
  }

  // Handle image load error
  const handleImageError = () => {
    // If we're using the Cloudfront URL and it fails, try the image_url
    if (!imageError && currentPrinting?.image_url) {
      setImageError(true)
      setImageSrc(currentPrinting.image_url)
    }
    // If image_url fails or doesn't exist, use cardback
    else if (imageError || !currentPrinting?.image_url) {
      setImageSrc("/cardback.webp")
    }
  }

  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardHeader className="p-3 pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{card.display_name || card.name}</CardTitle>
        </div>
        <CardDescription>{card.types?.join(" • ")}</CardDescription>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        {/* Card image with conditional foil effect */}
        <div className="mb-3 flex justify-center">
          {/* Changed background from bg-gray-50 to bg-white to better show card corners */}
          <div className="relative w-full h-48 bg-white rounded overflow-hidden">
            <img
              src={getCardImageUrl() || "/placeholder.svg"}
              alt={card.display_name || card.name}
              className="w-full h-full object-contain z-10 relative"
              onError={handleImageError}
              style={{ objectFit: "contain" }}
            />

            {/* Rainbow foil effect overlay */}
            {isRainbowFoil && (
              <div className="absolute inset-0 z-20 opacity-30 pointer-events-none rainbow-foil-effect"></div>
            )}
          </div>
        </div>

        {/* Card attributes section */}
        {currentPrinting && (
          <div className="flex flex-wrap gap-1 mt-2">
            {/* Rarity badge */}
            {currentPrinting.rarity && (
              <Badge variant="secondary" className={getRarityInfo(currentPrinting.rarity).className}>
                {getRarityDisplayName(currentPrinting.rarity)}
              </Badge>
            )}

            {/* Foiling badge */}
            {currentPrinting.foiling && (
              <Badge variant="secondary" className={getFoilingInfo(currentPrinting.foiling).className}>
                {getFoilingDisplayName(currentPrinting.foiling)}
              </Badge>
            )}

            {/* Edition badge - only show if not Normal */}
            {currentPrinting.edition && getEditionDisplayName(currentPrinting.edition) !== "Normal" && (
              <Badge variant="secondary" className="bg-gray-200 text-gray-700 border-gray-300">
                {getEditionDisplayName(currentPrinting.edition)}
              </Badge>
            )}

            {/* Art variation badge */}
            {currentPrinting.art_variation && (
              <Badge variant="secondary" className={getArtVariationInfo(currentPrinting.art_variation).className}>
                {getArtVariationInfo(currentPrinting.art_variation).name}
              </Badge>
            )}

            {/* Price badge */}
            {currentPrinting.tcg_market && (
              <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-300 font-medium">
                ${Number(currentPrinting.tcg_market).toFixed(2)}
              </Badge>
            )}
          </div>
        )}

        {showDetails && card.printings && card.printings.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Available Printings</h4>
            <div className="space-y-2">
              {card.printings.slice(0, 3).map((printing, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>{getSetName(printing.set_id)}</span>
                  <Badge variant="secondary" className={getRarityInfo(printing.rarity).className}>
                    {getRarityDisplayName(printing.rarity)}
                  </Badge>
                </div>
              ))}
              {card.printings.length > 3 && (
                <p className="text-xs text-gray-500">+{card.printings.length - 3} more printings</p>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {showActions && (
        <CardFooter className="p-3 pt-0 flex flex-col gap-2">
          {hasPrintings && card.printings && (
            <Select
              value={printing?.unique_id || card.defaultPrinting?.unique_id || (card.printings[0]?.unique_id ?? "")}
              onValueChange={(value) => {
                const selected = card.printings ? card.printings.find((p) => p.unique_id === value) : undefined
                if (onPrintingChange) onPrintingChange(selected)
                else setSelectedPrinting(selected)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={printing ? "Select Printing" : "Default printing will be used"} />
              </SelectTrigger>
              <SelectContent>
                {card.printings && card.printings.map((printing) => {
                  const editionName = getEditionDisplayName(printing.edition);
                  const foilingName = getFoilingDisplayName(printing.foiling);
                  const rarityName = getRarityDisplayName(printing.rarity);
                  const setName = getSetDisplayName(printing.set_id);
                  const price = printing.tcg_market ? `$${Number(printing.tcg_market).toFixed(2)}` : '';

                  return (
                    <SelectItem key={printing.unique_id} value={printing.unique_id}>
                      <div className="flex justify-between items-center w-full">
                        <span>
                          {setName} - {rarityName}
                          {editionName && editionName !== "Normal" ? ` - ${editionName}` : ""} - {foilingName}
                        </span>
                        {price && (
                          <span className="text-green-600 font-medium ml-2">{price}</span>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
        </CardFooter>
      )}
    </Card>
  )
}
