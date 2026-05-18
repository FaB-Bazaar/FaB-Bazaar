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
import { sortPrintingsByLanguage, languageFlag } from '@/lib/utils/printing-language'
import { RarityIcon } from '@/components/shared/RarityIcon'
import { getSetImageOrFallback } from '@/lib/set-images'

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

  // Sibling printings (same card_unique_id) grouped by language
  const [otherPrintings, setOtherPrintings] = useState<any[]>([])
  const [otherPrintingsLoading, setOtherPrintingsLoading] = useState(false)
  const [selectedSiblingId, setSelectedSiblingId] = useState<string | null>(null)

  
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

  // Once the main printing loads, fetch siblings sharing the same card_unique_id
  useEffect(() => {
    if (!printing?.card_unique_id) return
    let cancelled = false
    ;(async () => {
      try {
        setOtherPrintingsLoading(true)
        const response = await fetch(
          `/api/printings/search?cardUniqueId=${encodeURIComponent(printing.card_unique_id)}&show=all&limit=200`
        )
        if (!response.ok) return
        const data = await response.json()
        if (cancelled || !data?.success) return
        const list = data.data?.printings || []
        setOtherPrintings(list)
        setSelectedSiblingId(resolvedParams.printing_id)
      } catch (err) {
        console.error('Failed to load other printings:', err)
      } finally {
        if (!cancelled) setOtherPrintingsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [printing?.card_unique_id])

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
      <div className="container mx-auto py-6 px-4 max-w-7xl 2xl:max-w-[1500px]">
      {/* Main Content: left = actions + selector + tabs, right = rail-style card preview */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px] gap-6 mb-6">


        {/* LEFT: actions, printings selector, tabs */}
        <div className="order-2 xl:order-1 space-y-4 min-w-0">
          {/* All 4 actions in one row on lg+, 2×2 on mobile */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Button
              onClick={handleAddToWants}
              disabled={addingToWants || !user}
              variant={addedToWants ? "default" : "outline"}
              size="sm"
            >
              {addingToWants ? "Adding..." : addedToWants ? (
                <><Heart className="mr-1.5 h-4 w-4 fill-current" />Added!</>
              ) : (
                <><Heart className="mr-1.5 h-4 w-4" />Add to Wants</>
              )}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowBinderSelector(true)}
              disabled={!user}
              size="sm"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add to Collection
            </Button>
            {printing.printing_id && (
              <WhoHasDropdown
                printingId={printing.printing_id}
                cardName={printing.display_name || printing.name}
                searchMode="printing"
                className="w-full justify-center !p-2 hover:bg-blue-50 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600 rounded text-sm font-medium"
                buttonText="Who Has This"
              />
            )}
            {printing.card_unique_id && (
              <WhoHasDropdown
                cardUniqueId={printing.card_unique_id}
                cardName={printing.display_name || printing.name}
                searchMode="unique"
                className="w-full justify-center !p-2 hover:bg-purple-50 dark:hover:bg-purple-900 border border-purple-200 dark:border-purple-700 hover:border-purple-300 dark:hover:border-purple-600 rounded text-sm font-medium"
                buttonText="Who Has Any Version"
              />
            )}
          </div>

          {/* All printings selector — pick a sibling to update the rail preview */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-sm">All Printings</h2>
              {otherPrintings.length > 0 && (
                <span className="text-xs text-gray-500">{otherPrintings.length} total</span>
              )}
            </div>
            <div className="p-3 max-h-[420px] overflow-y-auto">
              {otherPrintingsLoading ? (
                <div className="text-center py-4">
                  <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                </div>
              ) : otherPrintings.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No other printings found.</p>
              ) : (
                (() => {
                  const LANGUAGE_NAMES: Record<string, string> = {
                    en: 'English', fr: 'French', de: 'German', it: 'Italian', es: 'Spanish', ja: 'Japanese',
                  }
                  const sorted = sortPrintingsByLanguage(otherPrintings)
                  const groups = new Map<string, any[]>()
                  for (const p of sorted) {
                    const lang = (p.language || 'en').toLowerCase()
                    if (!groups.has(lang)) groups.set(lang, [])
                    groups.get(lang)!.push(p)
                  }
                  return (
                    <div className="space-y-3">
                      {Array.from(groups.entries()).map(([lang, items]) => (
                        <div key={lang}>
                          <div className="flex items-center gap-2 mb-2 pb-1 border-b border-gray-200 dark:border-gray-700">
                            <span className="text-base" aria-label={`Language: ${lang}`}>{languageFlag(lang)}</span>
                            <h3 className="font-semibold text-xs">{LANGUAGE_NAMES[lang] || lang.toUpperCase()}</h3>
                            <span className="text-xs text-gray-500">({items.length})</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-1.5">
                            {items.map((p: any) => {
                              const pid = p.printing_id || p.unique_id
                              const isSelected = pid === (selectedSiblingId || resolvedParams.printing_id)
                              const isCurrent = pid === resolvedParams.printing_id
                              const setName = SET_MAP[p.set as keyof typeof SET_MAP] || p.set?.toUpperCase() || 'Unknown'
                              const foilingName = FOILING_MAP[p.foiling as keyof typeof FOILING_MAP] || p.foiling || ''
                              const priceLabel = (p.tcg_market != null && p.tcg_market > 0) ? formatPrice(p.tcg_market) : null
                              // Short edition labels — always shown when non-normal so 1st vs Unl is visible at a glance
                              const editionShort: string | null = (() => {
                                const e = (p.edition || '').toLowerCase()
                                if (e === 'f' || e === 'first' || e === '1st' || e === 'first edition') return '1st'
                                if (e === 'u' || e === 'unl' || e === 'unlimited' || e === 'unlimited edition') return 'Unl'
                                if (e === 'a' || e === 'alpha') return 'Alpha'
                                return null
                              })()
                              const isFullArt = typeof p.art_variations === 'string' && p.art_variations.includes('FA')
                              const isExtArt = !!p.is_extended_art
                              return (
                                <button
                                  key={pid}
                                  type="button"
                                  onClick={() => setSelectedSiblingId(pid)}
                                  className={`w-full flex items-center gap-2 p-2 rounded border text-left transition-colors ${
                                    isSelected
                                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-gray-50 dark:hover:bg-gray-800/40'
                                  }`}
                                >
                                  <div className="w-9 h-12 flex-shrink-0 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                                    <img src={p.image_url || '/placeholder.svg'} alt="" className="w-full h-full object-cover" loading="lazy" />
                                  </div>
                                  <div className="flex-1 min-w-0 text-xs space-y-0.5">
                                    <div className="flex items-center gap-1 font-medium">
                                      <span className="truncate">{setName}</span>
                                      {isCurrent && <Badge className="text-[9px] px-1 py-0 ml-auto flex-shrink-0">Current</Badge>}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {foilingName && <Badge variant="secondary" className="text-[10px] px-1 py-0">{foilingName}</Badge>}
                                      {editionShort && <Badge variant="outline" className="text-[10px] px-1 py-0">{editionShort}</Badge>}
                                      {isFullArt && <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-400 text-amber-700 dark:text-amber-300">Full Art</Badge>}
                                      {isExtArt && <Badge variant="outline" className="text-[10px] px-1 py-0 border-sky-400 text-sky-700 dark:text-sky-300">Ext Art</Badge>}
                                    </div>
                                    <div className="flex items-center justify-between gap-2 text-[10px]">
                                      {p.collector_number && (
                                        <span className="font-mono text-gray-500">{p.collector_number}</span>
                                      )}
                                      {priceLabel && (
                                        <span className="tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">{priceLabel}</span>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()
              )}
            </div>
          </div>

          {!user && (
            <div className="text-center text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded">
              <Link href="/login" className="text-blue-600 hover:underline">Log in</Link>{" "}to add this card to your wants list or collection.
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

        {/* RIGHT: rail-style preview of the selected printing */}
        <aside className="order-1 xl:order-2 xl:sticky xl:top-20 xl:self-start">
          {(() => {
            const rail = (otherPrintings.length > 0
              ? otherPrintings.find((p: any) => (p.printing_id || p.unique_id) === selectedSiblingId)
              : null) || printing
            const railSetName = SET_MAP[rail.set as keyof typeof SET_MAP] || rail.set?.toUpperCase() || 'Unknown'
            const railFoiling = FOILING_MAP[rail.foiling as keyof typeof FOILING_MAP] || rail.foiling
            const railEdition = rail.edition && rail.edition !== 'n'
              ? EDITION_MAP[rail.edition as keyof typeof EDITION_MAP] || rail.edition.toUpperCase()
              : null
            const railLang = (rail.language || 'en').toLowerCase()
            const setLogo = rail.set ? getSetImageOrFallback(rail.set, rail.set) : null
            const hasPitch = rail.pitch != null && rail.pitch > 0
            const hasCost = rail.cost != null
            const hasPower = rail.power != null
            const hasDefense = rail.defense != null
            const isViewingDifferent = selectedSiblingId && selectedSiblingId !== resolvedParams.printing_id

            return (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
                <div className="max-w-[260px] sm:max-w-[300px] mx-auto xl:max-w-none">
                  <FoilCardImage
                    foiling={rail.foiling}
                    artStyle={rail.art_variations?.includes('FA') ? 'full-art' : rail.is_extended_art ? 'extended-art' : undefined}
                    foilInset={rail.foil_inset_bottom != null ? {
                      top: rail.foil_inset_top,
                      right: rail.foil_inset_right,
                      bottom: rail.foil_inset_bottom,
                      left: rail.foil_inset_left,
                      round: rail.foil_inset_round ?? '1.5%',
                    } : undefined}
                    src={rail.image_url || '/placeholder.svg'}
                    alt={rail.display_name || rail.name}
                    className="w-full rounded-md shadow"
                    imgClassName="w-full h-auto rounded-md"
                    expandable
                  />
                </div>

                {setLogo && (
                  <div className="flex justify-center">
                    <img
                      src={setLogo}
                      alt={rail.set?.toUpperCase() || ''}
                      title={rail.set?.toUpperCase() || ''}
                      className="h-10 w-auto object-contain"
                    />
                  </div>
                )}

                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    {rail.display_name || rail.name}
                    {rail.collector_number && (
                      <span className="font-normal text-gray-500 dark:text-gray-400 font-mono"> — {rail.collector_number}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 flex-wrap mt-1">
                    <span aria-label={`Language: ${railLang}`}>{languageFlag(railLang)}</span>
                    {rail.rarity && <RarityIcon rarityCode={rail.rarity} size="sm" />}
                    {railEdition && <span>{railEdition}</span>}
                    {railFoiling && <span>{railFoiling}</span>}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{railSetName}</div>
                </div>

                {(hasPitch || hasCost || hasPower || hasDefense) && (
                  <div className="flex items-center justify-center gap-2.5 text-sm text-gray-700 dark:text-gray-200">
                    {hasPitch && (
                      <span className="inline-flex items-center" title={`Pitch ${rail.pitch}`}>
                        <img src={`/fab/symbols/pitch${rail.pitch}.png`} alt={`Pitch ${rail.pitch}`} className="w-5 h-5 object-contain" />
                      </span>
                    )}
                    {hasCost && (
                      <span className="relative inline-flex items-center justify-center w-5 h-5 shrink-0" title={`Cost ${rail.cost}`}>
                        <img src="/fab/symbols/cost.png" alt="Cost" className="w-5 h-5 object-contain" />
                        <span className="absolute font-bold text-[10px] leading-none text-white drop-shadow-[0_0_2px_rgba(0,0,0,1)]">{rail.cost}</span>
                      </span>
                    )}
                    {hasPower && (
                      <span className="inline-flex items-center gap-1 tabular-nums font-semibold" title={`Power ${rail.power}`}>
                        <span>{rail.power}</span>
                        <img src="/fab/symbols/power.png" alt="Power" className="w-4 h-4 object-contain" />
                      </span>
                    )}
                    {hasDefense && (
                      <span className="inline-flex items-center gap-1 tabular-nums font-semibold" title={`Defense ${rail.defense}`}>
                        <span>{rail.defense}</span>
                        <img src="/fab/symbols/block.png" alt="Defense" className="w-4 h-4 object-contain" />
                      </span>
                    )}
                  </div>
                )}

                {rail.tcgplayer_url && (
                  <TcgAffiliateLink
                    tcgplayerUrl={rail.tcgplayer_url}
                    feature="PrintingRailBuy"
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors"
                    title={`Buy ${rail.display_name || rail.name} on TCGplayer`}
                  >
                    <span>Buy on TCGplayer</span>
                    {rail.tcg_market != null && rail.tcg_market > 0 && (
                      <span className="ml-auto tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatPrice(rail.tcg_market)}
                      </span>
                    )}
                  </TcgAffiliateLink>
                )}

                {isViewingDifferent && (
                  <Link
                    href={`/printing/${selectedSiblingId}`}
                    className="block w-full text-center py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
                  >
                    Go to This Printing's Page
                  </Link>
                )}
              </div>
            )
          })()}
        </aside>
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
                {printing.collector_number && (
                  <div>
                    <strong>Card Number:</strong> {printing.collector_number}
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
