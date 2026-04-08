// app/printing/[printing_id]/page.tsx
"use client"

import React, { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Heart, Plus, ExternalLink, Users, TrendingUp, Package } from "lucide-react"
import CardDisplay from "@/components/printing/CardDisplay"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"
import { SET_MAP, FOILING_MAP, RARITY_MAP, EDITION_MAP } from "@/lib/fab-constants"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import WhoHasDropdown from "@/components/shared/WhoHasDropdown"
import BinderSelector from "@/components/printing/BinderSelector"
import { useCookieConsent } from '@/contexts/CookieConsentContext'
import { TcgAffiliateLink } from '@/components/tracking'
import FoilCardImage from '@/components/shared/FoilCardImage'

interface PrintingDetailPageProps {
  params: Promise<{
    printing_id: string
  }>
}

const AffiliateDisclosure = () => {
  const { consentOptions } = useCookieConsent()

  return (
    <div className="container mx-auto px-2 sm:px-4 mt-2 sm:mt-4">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-2 sm:p-3">
        <div className="flex items-start gap-2 sm:gap-3">
          <img
            src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/596dace2-8614-4efc-b58d-0b0ebdc0d300/public"
            alt="TCGPlayer"
            className="h-4 w-auto sm:h-5 mt-0.5 flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
              {consentOptions.advertising ? (
                <>
                  <span className="block sm:inline">TCGPlayer links include affiliate tracking to support this site.</span>
                  <span className="block sm:inline sm:ml-1">
                    Adjust in your <button
                      onClick={() => document.dispatchEvent(new Event('openCookiePreferences'))}
                      className="underline hover:text-blue-900 dark:hover:text-blue-100 font-medium"
                    >
                      cookie preferences
                    </button>.
                  </span>
                </>
              ) : (
                <>
                  <span className="block sm:inline">Help support this site by enabling affiliate tracking.</span>
                  <span className="block sm:inline sm:ml-1">
                    Enable in <button
                      onClick={() => document.dispatchEvent(new Event('openCookiePreferences'))}
                      className="underline hover:text-blue-900 dark:hover:text-blue-100 font-medium"
                    >
                      cookie preferences
                    </button> for small commissions at no extra cost.
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PrintingDetailPage({ params }: PrintingDetailPageProps) {
  const [printing, setPrinting] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addingToWants, setAddingToWants] = useState(false)
  const [addedToWants, setAddedToWants] = useState(false)
  const [showBinderSelector, setShowBinderSelector] = useState(false)

  // Who Has data
  const [whoHasData, setWhoHasData] = useState<any>(null)
  const [whoHasLoading, setWhoHasLoading] = useState(false)
  const [whoHasError, setWhoHasError] = useState<string | null>(null)
  
  // Unwrap the params Promise
  const resolvedParams = use(params)

  const { user } = useAuth()
  const { toast } = useToast()

  const router = useRouter()

  // Check if user came from search
  const [searchParams, setSearchParams] = useState<{ from?: string; query?: string }>({})

  useEffect(() => {
    // Get URL search parameters on client side
    const urlParams = new URLSearchParams(window.location.search)
    setSearchParams({
      from: urlParams.get('from') || undefined,
      query: urlParams.get('query') || undefined
    })
  }, [])

  useEffect(() => {
    fetchPrintingDetails()
    fetchWhoHasData()
  }, [resolvedParams.printing_id])

  const fetchPrintingDetails = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('🔍 Fetching printing details for ID:', resolvedParams.printing_id)

      // Use the correct parameter name and format for the existing API
      const response = await fetch(`/api/printings/search?printingIds=${encodeURIComponent(resolvedParams.printing_id)}&show=all&limit=1`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch printing details: ${response.status}`)
      }

      const responseData = await response.json()
      console.log('📡 Raw API response:', responseData)
      
      if (!responseData.success) {
        throw new Error(responseData.error || 'Failed to fetch printing details')
      }

      const printings = responseData.data.printings || []
      console.log('📋 Printings array:', printings)
      
      if (printings.length === 0) {
        throw new Error('Printing not found')
      }

      // Get the first (and should be only) printing result
      const printingData = printings[0]
      console.log('🃏 Individual printing data:', printingData)
      console.log('🏷️ Keywords:', printingData.keywords, 'Type:', typeof printingData.keywords)
      console.log('🎯 Types:', printingData.types, 'Type:', typeof printingData.types)
      console.log('👥 Classes:', printingData.classes, 'Type:', typeof printingData.classes)
      console.log('✨ Talents:', printingData.talents, 'Type:', typeof printingData.talents)
      console.log('🎨 Artists:', printingData.artists, 'Type:', typeof printingData.artists)
      
      setPrinting(printingData)
      
    } catch (err: any) {
      console.error('❌ Error fetching printing details:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchWhoHasData = async () => {
    try {
      setWhoHasLoading(true)
      setWhoHasError(null)

      console.log('🔍 Fetching who has data for ID:', resolvedParams.printing_id)

      const response = await fetch(`/api/whohas?printingIds=${encodeURIComponent(resolvedParams.printing_id)}&limit=20&sortBy=quantity`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch who has data: ${response.status}`)
      }

      const data = await response.json()
      console.log('📡 Who has data response:', data)
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch who has data')
      }

      console.log('👥 Owners array:', data.owners, 'Type:', typeof data.owners)
      if (data.owners && data.owners.length > 0) {
        console.log('🔍 First owner matching_cards:', data.owners[0].matching_cards, 'Type:', typeof data.owners[0].matching_cards)
      }

      setWhoHasData(data)
      
    } catch (err: any) {
      console.error('❌ Error fetching who has data:', err)
      setWhoHasError(err.message)
    } finally {
      setWhoHasLoading(false)
    }
  }

  const handleAddToWants = async () => {
    if (!user) {
      toast({ 
        title: "Login required", 
        description: "Please log in to add cards to your wants list.", 
        variant: "destructive" 
      })
      return
    }

    if (!printing) return

    try {
      setAddingToWants(true)

      const response = await fetch('/api/wants/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          printingId: printing.printing_id || printing.unique_id,
          quantity: 1,
          priority: 'medium',
          notes: ''
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast({ 
          title: "Added to wants list!", 
          description: `${printing.display_name || printing.name} was ${result.action} in your wants list.`,
          variant: "default"
        })
        
        setAddedToWants(true)
        setTimeout(() => setAddedToWants(false), 3000)
      } else {
        throw new Error(result.error || 'Failed to add to wants list')
      }
    } catch (error: any) {
      console.error('Error adding to wants list:', error)
      toast({ 
        title: "Error", 
        description: error.message || "Failed to add card to wants list.", 
        variant: "destructive" 
      })
    } finally {
      setAddingToWants(false)
    }
  }

  const getDisplayInfo = (printing: any) => {
    if (!printing) return {}
    
    return {
      setName: SET_MAP[printing.set as keyof typeof SET_MAP] || printing.set?.toUpperCase() || 'Unknown Set',
      foilingName: FOILING_MAP[printing.foiling as keyof typeof FOILING_MAP] || printing.foiling || 'Unknown Foiling',
      rarityName: RARITY_MAP[printing.rarity as keyof typeof RARITY_MAP] || printing.rarity?.toUpperCase() || 'Unknown Rarity',
      editionName: EDITION_MAP[printing.edition as keyof typeof EDITION_MAP] || printing.edition?.toUpperCase() || 'Unknown Edition'
    }
  }

  const formatPrice = (price: number | null | undefined) => {
    if (!price || price <= 0) return 'N/A'
    return `$${price.toFixed(2)}`
  }

  const getPriceColor = (priceType: string, price: number | null | undefined) => {
    if (!price || price <= 0) return 'text-gray-400'
    
    switch (priceType) {
      case 'low': return 'text-green-600'
      case 'market': return 'text-blue-600 font-bold'
      case 'mid': return 'text-orange-600'
      case 'high': return 'text-red-600'
      default: return 'text-gray-700'
    }
  }

  // Add safety check for loading state
  if (loading || !printing) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Loading printing details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="mb-6">
          <Link href="/browse" className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Browse
          </Link>
        </div>
        <div className="text-center py-12 bg-red-50 rounded-lg border border-red-200">
          <h2 className="text-xl font-semibold text-red-900 mb-2">Error</h2>
          <p className="text-red-700">{error}</p>
          <Button 
            variant="outline" 
            onClick={fetchPrintingDetails}
            className="mt-4"
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  const displayInfo = getDisplayInfo(printing)

  return (
    <>
      <AffiliateDisclosure />
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        {/* Navigation */}
        <div className="mb-6">
          <button
            onClick={() => {
              if (searchParams.from === 'search' && searchParams.query) {
                // Go back to home page and trigger search with query
                router.push(`/?openSearch=true&query=${encodeURIComponent(searchParams.query)}`)
              } else {
                router.back()
              }
            }}
            className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {searchParams.from === 'search' ? 'Back to Search' : 'Back'}
          </button>
        </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Card Image */}
        <div className="flex justify-center">
          <div className="max-w-sm w-full">
            <FoilCardImage
              foiling={printing.foiling}
              src={printing.image_url || "/placeholder.svg"}
              alt={printing.display_name || printing.name}
              className="w-full rounded-lg shadow-lg"
              imgClassName="w-full h-auto rounded-lg"
            />
          </div>
        </div>

        {/* Card Details */}
        <div className="space-y-6">
          {/* Card Name & Basic Info */}
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {printing.display_name || printing.name}
            </h1>
            <div className="text-lg text-gray-600 dark:text-gray-400 space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-medium">Set:</span>
                <span>{displayInfo.setName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Rarity:</span>
                <span>{displayInfo.rarityName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Foiling:</span>
                <span>{displayInfo.foilingName}</span>
              </div>
              {printing.edition !== 'n' && (
                <div className="flex justify-between items-center">
                  <span className="font-medium">Edition:</span>
                  <span className="text-blue-600 font-medium">{displayInfo.editionName}</span>
                </div>
              )}
              {printing.printing_card_id && (
                <div className="flex justify-between items-center">
                  <span className="font-medium">Card Number:</span>
                  <span className="font-mono text-sm">{printing.printing_card_id}</span>
                </div>
              )}
            </div>
          </div>

          {/* TCG Pricing Grid */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                TCG Player Pricing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-sm text-green-700">Low</div>
                  <div className={`text-xl font-bold ${getPriceColor('low', printing.tcg_low)}`}>
                    {formatPrice(printing.tcg_low)}
                  </div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm text-blue-700">Market</div>
                  <div className={`text-xl font-bold ${getPriceColor('market', printing.tcg_market)}`}>
                    {formatPrice(printing.tcg_market)}
                  </div>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <div className="text-sm text-orange-700">Mid</div>
                  <div className={`text-xl font-bold ${getPriceColor('mid', printing.tcg_mid)}`}>
                    {formatPrice(printing.tcg_mid)}
                  </div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <div className="text-sm text-red-700">High</div>
                  <div className={`text-xl font-bold ${getPriceColor('high', printing.tcg_high)}`}>
                    {formatPrice(printing.tcg_high)}
                  </div>
                </div>
              </div>

              {/* Purchase Link */}
              {printing.tcgplayer_url && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-600">
                  <TcgAffiliateLink
                    tcgplayerUrl={printing.tcgplayer_url}
                    feature="PurchaseLink"
                    className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                    title="Purchase on TCGPlayer"
                  >
                    <span>Purchase on TCGPlayer</span>
                    <ExternalLink className="h-4 w-4" />
                    <img
                      src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/596dace2-8614-4efc-b58d-0b0ebdc0d300/public"
                      alt="TCGPlayer"
                      className="h-4 w-auto"
                    />
                  </TcgAffiliateLink>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card Stats (if available) */}
          {(printing.cost !== null || printing.power !== null || printing.defense !== null) && (
            <div className="grid grid-cols-3 gap-4">
              {printing.cost !== null && (
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm text-blue-700">Cost</div>
                  <div className="text-xl font-bold text-blue-800">{printing.cost}</div>
                </div>
              )}
              {printing.power !== null && (
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <div className="text-sm text-red-700">Power</div>
                  <div className="text-xl font-bold text-red-800">{printing.power}</div>
                </div>
              )}
              {printing.defense !== null && (
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <div className="text-sm text-yellow-700">Defense</div>
                  <div className="text-xl font-bold text-yellow-800">{printing.defense}</div>
                </div>
              )}
            </div>
          )}

          {/* Actions - Enhanced with WhoHas dropdowns */}
          <div className="space-y-3">
            {/* Primary action row */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleAddToWants}
                disabled={addingToWants || !user}
                variant={addedToWants ? "default" : "outline"}
              >
                {addingToWants ? (
                  "Adding..."
                ) : addedToWants ? (
                  <>
                    <Heart className="mr-2 h-4 w-4 fill-current" />
                    Added to Wants!
                  </>
                ) : (
                  <>
                    <Heart className="mr-2 h-4 w-4" />
                    Add to Wants
                  </>
                )}
              </Button>

              <Button
                variant="secondary"
                onClick={() => setShowBinderSelector(true)}
                disabled={!user}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add to Collection
              </Button>
            </div>

            {/* Who Has quick access row */}
            <div className="flex gap-2">
              {/* Search for SPECIFIC printing */}
              {printing.printing_id && (
                <div className="flex-1">
                  <WhoHasDropdown 
                    printingId={printing.printing_id} 
                    cardName={printing.display_name || printing.name} 
                    searchMode="printing"
                    className="w-full justify-center !p-3 hover:bg-blue-50 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600 rounded font-medium"
                    buttonText="Who Has This Exact Card"
                  />
                </div>
              )}
              
              {/* Search for ANY version */}
              {printing.card_unique_id && (
                <div className="flex-1">
                  <WhoHasDropdown 
                    cardUniqueId={printing.card_unique_id} 
                    cardName={printing.display_name || printing.name} 
                    searchMode="unique"
                    className="w-full justify-center !p-3 hover:bg-purple-50 dark:hover:bg-purple-900 border border-purple-200 dark:border-purple-700 hover:border-purple-300 dark:hover:border-purple-600 rounded font-medium"
                    buttonText="Who Has Any Version"
                  />
                </div>
              )}
            </div>

            {/* Help text */}
            <div className="text-center text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded">
              Quick access: Click "Who Has" buttons above for instant results, or use the detailed tab below
            </div>
          </div>

          {!user && (
            <div className="text-center text-sm text-gray-600 dark:text-gray-400 bg-gray-50 p-3 rounded">
              <Link href="/login" className="text-blue-600 hover:underline">
                Log in
              </Link>{" "}
              to add this card to your wants list or collection.
            </div>
          )}

          {/* Binder Selector Modal */}
          {showBinderSelector && printing && (
            <BinderSelector
              printingId={printing.printing_id || printing.unique_id}
              cardName={printing.display_name || printing.name}
              onSuccess={() => setShowBinderSelector(false)}
              onCancel={() => setShowBinderSelector(false)}
            />
          )}
        </div>
      </div>

      {/* Tabs for additional content */}
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="details">Card Details</TabsTrigger>
          <TabsTrigger value="technical">Technical Info</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Card Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Card Text */}
              {printing.text && (
                <div>
                  <h3 className="font-semibold mb-2">Card Text</h3>
                  <div className="text-sm whitespace-pre-wrap p-3 rounded 
                    bg-gray-50 dark:bg-gray-800 
                    text-gray-800 dark:text-gray-200">
                    {printing.text}
                  </div>
                </div>
              )}

              {/* Keywords - SAFE VERSION */}
              {Array.isArray(printing.keywords) && printing.keywords.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Keywords</h3>
                  <div className="flex flex-wrap gap-2">
                    {printing.keywords.map((keyword: string, index: number) => (
                      <Badge key={`${keyword}-${index}`} variant="secondary">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Types - SAFE VERSION */}
              {Array.isArray(printing.types) && printing.types.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Types</h3>
                  <div className="flex flex-wrap gap-2">
                    {printing.types.map((type: string, index: number) => (
                      <Badge key={`${type}-${index}`} variant="outline">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Classes - SAFE VERSION */}
              {Array.isArray(printing.classes) && printing.classes.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Classes</h3>
                  <div className="flex flex-wrap gap-2">
                    {printing.classes.map((cls: string, index: number) => (
                      <Badge key={`${cls}-${index}`} variant="default">
                        {cls}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Talents - SAFE VERSION */}
              {Array.isArray(printing.talents) && printing.talents.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Talents</h3>
                  <div className="flex flex-wrap gap-2">
                    {printing.talents.map((talent: string, index: number) => (
                      <Badge key={`${talent}-${index}`} variant="destructive">
                        {talent}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="technical" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Technical Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Printing ID:</strong> {printing.printing_id}
                </div>
                <div>
                  <strong>Card Unique ID:</strong> {printing.card_unique_id || printing.cardId}
                </div>
                {printing.printing_card_id && (
                  <div>
                    <strong>Card Number:</strong> {printing.printing_card_id}
                  </div>
                )}
                <div>
                  <strong>Set Code:</strong> {printing.set}
                </div>
                <div>
                  <strong>Edition:</strong> {printing.edition}
                </div>
                <div>
                  <strong>Foiling:</strong> {printing.foiling}
                </div>
                <div>
                  <strong>Rarity:</strong> {printing.rarity}
                </div>
                {printing.color && (
                  <div>
                    <strong>Color:</strong> {printing.color}
                  </div>
                )}
                {printing.pitch !== null && (
                  <div>
                    <strong>Pitch:</strong> {printing.pitch}
                  </div>
                )}
                {Array.isArray(printing.artists) && printing.artists.length > 0 && (
                  <div className="md:col-span-2">
                    <strong>Artists:</strong> {printing.artists.join(', ')}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </>
  )
}
