// app/profile/[username]/page.tsx
"use client"

import { use, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  User,
  Calendar,
  BookOpen,
  MapPin,
  ExternalLink,
  TrendingUp,
  Loader2,
  DollarSign,
  Heart,
  Layers,
  Swords
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ProfileTile } from "@/components/profiles/ProfileTile"
import CommunityDeckCard from "@/components/deck/CommunityDeckCard"
import { decksClient } from "@/lib/client"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/use-toast"
import type { PublicDeckSummaryDTO } from "@/lib/services/contracts/IDeckService"
import { displayUsername } from "@/lib/utils/display-username"

interface UserProfile {
  _id: string
  username: string
  discordUsername?: string
  discordId?: string
  city?: string
  state?: string
  country?: string
  createdAt: string
  image?: string
}

interface ProfileStats {
  totalBinders: number
  totalCards: number
  totalValue: number
  totalWants: number
}

// Updated interface to match new binder stats structure
interface PublicBinder {
  _id: string;
  name: string;
  description?: string;
  tags?: string[];
  slug?: string;
  isOnHand?: boolean;
  visibility?: {
    level: 'public' | 'private' | 'unlisted';
    [key: string]: any;
  };
  isPublic?: boolean;
  
  // NEW STATS FIELDS (from inventory_items aggregation)
  totalQuantity?: number;
  quantityForTrade?: number;
  quantityNotForTrade?: number;
  totalValue?: {
    tcg_market: number;
    tcg_low: number;
    tcg_mid: number;
    tcg_high: number;
  };
  valueForTrade?: {
    tcg_market: number;
    tcg_low: number;
    tcg_mid: number;
    tcg_high: number;
  };
  valueNotForTrade?: {
    tcg_market: number;
    tcg_low: number;
    tcg_mid: number;
    tcg_high: number;
  };
  rarityCounts?: Record<string, number>;
  rarityCountsForTrade?: Record<string, number>;
  rarityCountsNotForTrade?: Record<string, number>;
  
  // NEW: Showcase cards
  showcaseCards?: Array<{
    printingId: string;
    tcg_low: number;
    rarity: string;
  }>;
  
  // OLD STATS FIELDS (backward compatibility)
  total_value?: number;
  cardCount?: number;
  totalCards?: number;
  updatedAt: string;
}

interface ProfileResponse {
  success: boolean
  user: UserProfile
  stats: ProfileStats
  binders: PublicBinder[]
  error?: string
}

export default function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params)
  const router = useRouter()
  const { user: currentUser } = useAuth()
  const { toast } = useToast()
  const [profileData, setProfileData] = useState<ProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Tab state
  const [activeTab, setActiveTab] = useState<'collection' | 'decks'>('collection')

  // State to manage binder visibility
  const [showAllBinders, setShowAllBinders] = useState(false)

  // Decks tab state
  const [publicDecks, setPublicDecks] = useState<PublicDeckSummaryDTO[]>([])
  const [decksLoading, setDecksLoading] = useState(false)
  const [decksFetched, setDecksFetched] = useState(false)
  const [copyingId, setCopyingId] = useState<string | null>(null)

  // Fetch public decks when decks tab is first selected
  useEffect(() => {
    if (activeTab === 'decks' && !decksFetched) {
      setDecksLoading(true)
      decksClient.getCommunityDecks({ username }, { page: 1, limit: 50 })
        .then((result) => {
          if (result.success) {
            setPublicDecks(result.data.decks)
          }
        })
        .catch((err) => console.error('Failed to fetch public decks:', err))
        .finally(() => {
          setDecksLoading(false)
          setDecksFetched(true)
        })
    }
  }, [activeTab, decksFetched, username])

  const handleCopyDeck = async (deck: PublicDeckSummaryDTO) => {
    if (!currentUser) {
      router.push(`/auth/signin?callbackUrl=/profile/${username}`)
      return
    }
    setCopyingId(deck.publicId)
    try {
      const result = await decksClient.copyDeck(deck.publicId, `Copy of ${deck.name}`)
      if (result.success) {
        toast({ title: "Deck copied", description: `"${deck.name}" has been copied to your decks.` })
      } else {
        toast({ title: "Error", description: result.error || "Failed to copy deck.", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to copy deck.", variant: "destructive" })
    }
    setCopyingId(null)
  }

  // useEffect with AbortController to prevent issues with Strict Mode double-invoking
  useEffect(() => {
    const controller = new AbortController()
    const signal = controller.signal

    const fetchProfileData = async () => {
      try {
        setLoading(true)
        setError(null) // Reset error state at the start
        
        // Fetch user profile data first
        const profileResponse = await fetch(`/api/users/profile/${username}`, { signal })
        if (signal.aborted) return

        const profileData = await profileResponse.json()
        if (!profileResponse.ok || !profileData.success) {
          throw new Error(profileData.error || "User not found")
        }

        // Clear any previous errors since profile fetch succeeded
        setError(null)

        // Fetch binders with full stats for this user
        const bindersResponse = await fetch(`/api/users/${profileData.user._id}/binders?includeStats=true&includeShowcase=true`, { signal })
        if (signal.aborted) return

        const bindersData = await bindersResponse.json()
        if (!bindersResponse.ok || !bindersData.success) {
          throw new Error(bindersData.error || "Failed to load binders")
        }

        // Combine the data
        const combinedData: ProfileResponse = {
          success: true,
          user: profileData.user,
          stats: profileData.stats,
          binders: bindersData.binders || []
        }

        setProfileData(combinedData)
        setError(null) // Ensure error is cleared on success
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        console.error('Profile fetch error:', err)
        setError(err instanceof Error ? err.message : "Failed to load profile")
      } finally {
        if (!signal.aborted) {
          setLoading(false)
        }
      }
    }

    if (username) {
      fetchProfileData()
    }

    return () => {
      controller.abort()
    }
  }, [username])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center overflow-x-hidden">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !profileData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 overflow-x-hidden">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-12">
            <User className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Profile Not Found</h2>
            <p className="text-muted-foreground mb-4">{error || `No user found with username "${username}"`}</p>
            <div className="space-y-2">
              <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
                Try Again
              </Button>
              <Link href="/"><Button className="w-full">Back to Home</Button></Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { user, stats, binders } = profileData

  const formatJoinDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "short" })

  const formatLocation = () =>
    [user.city, user.state, user.country?.toUpperCase()].filter(Boolean).join(", ")

  const formatValue = (value: number) =>
    value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value.toFixed(2)}`
  
  const bindersToShow = showAllBinders ? binders : binders.slice(0, 6)

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="container mx-auto px-4 py-6 grid lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <aside className="lg:col-span-1 space-y-6">
          <Card className="bg-card border-border p-6 text-center lg:text-left">
            <Avatar className="h-24 w-24 mx-auto lg:mx-0 mb-3">
              <AvatarImage src={user.image || "/cardback.webp"} alt={user.username} />
              <AvatarFallback className="text-2xl">
                {displayUsername(user.username).charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <h1 className="text-2xl font-bold break-words">{displayUsername(user.username)}</h1>

            {user.discordUsername && (
              <a
                href={`https://discord.com/users/@${user.discordUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-1"
              >
                <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80 transition-colors">
                  <svg
                    className="h-3 w-3 mr-1.5"
                    viewBox="0 0 640 512"
                    fill="currentColor"
                  >
                    <path d="M524.531,69.836a1.5,1.5,0,0,0-.764-.7A485.065,485.065,0,0,0,404.081,32.03a1.816,1.816,0,0,0-1.923.91,337.461,337.461,0,0,0-1.923.91,337.461,337.461,0,0,0-14.9,30.6a447.848,447.848,0,0,0-134.426,0,309.541,309.541,0,0,0-15.135-30.6,1.89,1.89,0,0,0-1.924-.91A483.689,483.689,0,0,0,116.085,69.137a1.712,1.712,0,0,0-.788.676C39.068,183.651,18.186,294.69,28.43,404.354a2.016,2.016,0,0,0,.765,1.375A487.666,487.666,0,0,0,176.02,479.918a1.9,1.9,0,0,0,2.063-.676A348.2,348.2,0,0,0,208.12,430.4a1.86,1.86,0,0,0-1.019-2.588,321.173,321.173,0,0,1-45.868-21.853,1.885,1.885,0,0,1-.185-3.126c3.082-2.309,6.166-4.711,9.109-7.137a1.819,1.819,0,0,1,1.9-.256c96.229,43.917,200.41,43.917,295.5,0a1.812,1.812,0,0,1,1.924.233c2.944,2.426,6.027,4.851,9.132,7.16a1.884,1.884,0,0,1-.162,3.126,301.407,301.407,0,0,1-45.89,21.83a1.875,1.875,0,0,0-1,2.611,391.055,391.055,0,0,0,30.014,48.815,1.864,1.864,0,0,0,2.063.7A486.048,486.048,0,0,0,610.7,405.729a1.882,1.882,0,0,0,.765-1.352C623.729,277.594,590.933,167.465,524.531,69.836ZM222.491,337.58c-28.972,0-52.844-26.587-52.844-59.239S193.056,219.1,222.491,219.1c29.665,0,53.306,26.82,52.843,59.239C275.334,310.993,251.924,337.58,222.491,337.58Zm195.38,0c-28.971,0-52.843-26.587-52.843-59.239S388.437,219.1,417.871,219.1c29.667,0,53.307,26.26,52.844,59.239C470.715,310.993,447.538,337.58,417.871,337.58Z" />
                  </svg>
                  {user.discordUsername}
                </Badge>
              </a>
            )}

            <div className="text-sm text-muted-foreground space-y-1.5 mt-2">
              <div className="flex items-center gap-1.5 justify-center lg:justify-start">
                <Calendar className="h-3.5 w-3.5" />Since {formatJoinDate(user.createdAt)}
              </div>
              {formatLocation() && (
                <div className="flex items-center gap-1.5 justify-center lg:justify-start">
                  <MapPin className="h-3.5 w-3.5" />
                  {formatLocation()}
                </div>
              )}
            </div>
          </Card>

          {/* Stats - Updated with new data structure */}
          <div className="grid grid-cols-2 gap-3">

            <Card className="group hover:shadow-md transition cursor-default">
              <CardContent className="p-4 text-center">
                <BookOpen className="mx-auto h-5 w-5 mb-1 text-purple-500" />
                <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                  {stats.totalBinders}
                </div>
                <div className="text-sm text-muted-foreground">Binders</div>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-md transition cursor-default">
              <CardContent className="p-4 text-center">
                <Heart className="mx-auto h-5 w-5 mb-1 text-red-500" />
                <div className="text-lg font-bold text-red-600 dark:text-red-400">
                  {stats.totalWants}
                </div>
                <div className="text-sm text-muted-foreground">Wants</div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Actions */}
          <div className="space-y-2">
            <Link href={`/wants/${user._id}`} className="block w-full">
              <Button size="lg" className="w-full bg-red-600 hover:bg-red-700">
                <Heart className="h-4 w-4 mr-2" />
                View Wants List
              </Button>
            </Link>

          </div>
        </aside>

        {/* Main content */}
        <main className="lg:col-span-3 space-y-6">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('collection')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'collection'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              Collection
            </button>
            <button
              onClick={() => setActiveTab('decks')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'decks'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <Swords className="h-4 w-4" />
              Decks
            </button>
          </div>

          {/* Collection tab */}
          {activeTab === 'collection' && (
            binders.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Collection ({stats.totalBinders} binders)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {bindersToShow.map((binder) => (
                      <ProfileTile key={binder._id} binder={binder} />
                    ))}
                  </div>
                  {binders.length > 6 && !showAllBinders && (
                    <div className="mt-4">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setShowAllBinders(true)}
                      >
                        View All {stats.totalBinders} Binders
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">No Public Binders</h3>
                  <p className="text-muted-foreground text-sm">
                    {displayUsername(user.username)} has not made any of their binders public yet.
                  </p>
                </CardContent>
              </Card>
            )
          )}

          {/* Decks tab */}
          {activeTab === 'decks' && (
            decksLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : publicDecks.length > 0 ? (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {publicDecks.map((deck) => (
                  <CommunityDeckCard
                    key={deck.publicId}
                    deck={deck}
                    onCopy={handleCopyDeck}
                    copying={copyingId === deck.publicId}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <Swords className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">No Public Decks</h3>
                  <p className="text-muted-foreground text-sm">
                    {displayUsername(user.username)} has not made any of their decks public yet.
                  </p>
                </CardContent>
              </Card>
            )
          )}
        </main>
      </div>
    </div>
  )
}