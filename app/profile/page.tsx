//app/profile/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  User,
  Mail,
  Calendar,
  ShoppingCart,
  Star,
  Settings,
  Shield,
  AlertCircle,
  BookOpen,
  Download,
  MapPin,
  Home,
} from "lucide-react"
import Link from "next/link"
import { DeleteAccountDialog } from "@/components/dialogs/account/delete-account-dialog"
import { ExportDataDialog } from "@/components/dialogs/account/export-data-dialog"
import { ExportOptions } from "@/components/profile/ExportOptions"
import { useCookieConsent } from "@/contexts/CookieConsentContext"
import { toast } from "sonner"
import Select from 'react-select'
import { useRouter } from "next/navigation"
// Client services for API calls
import { bindersClient, wantsClient, usersClient, locationsClient } from '@/lib/client';
import { displayUsername as stripUsernamePrefix } from '@/lib/utils/display-username';
import { LANDING_PAGE_OPTIONS, DEFAULT_LANDING_PAGE, DEFAULT_LANDING_PAGE_LABEL } from '@/lib/landing-page';
import { useToast } from '@/hooks/use-toast';

/**
 * Inline "Home page" preference for the Settings tab — the same
 * users.landing_page dropdown as /profile/edit, saved immediately on change.
 */
function HomePageRow({
  initialValue,
  username,
}: {
  initialValue?: string | null
  username: string
}) {
  const [value, setValue] = useState(initialValue || "")
  const [saving, setSaving] = useState(false)
  // The root layout mounts the shadcn Toaster (hooks/use-toast), not sonner's
  // — sonner toasts render nowhere on this page.
  const { toast: showToast } = useToast()

  // Profile data arrives async — sync once it lands
  useEffect(() => {
    setValue(initialValue || "")
  }, [initialValue])

  async function handleChange(next: string) {
    if (!username) return
    const prev = value
    setValue(next)
    setSaving(true)
    try {
      const res = await fetch("/api/user/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, landingPage: next }),
      })
      const data = await res.json()
      if (data.success) {
        showToast({ title: "Home page updated" })
      } else {
        setValue(prev)
        showToast({ title: "Error", description: data.error || "Failed to update home page", variant: "destructive" })
      }
    } catch {
      setValue(prev)
      showToast({ title: "Error", description: "Failed to update home page", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center">
        <Home className="h-5 w-5 mr-2 text-muted-foreground" />
        <span>Home Page</span>
      </div>
      <select
        aria-label="Home page"
        value={value}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value)}
        className="h-9 px-2 max-w-[220px] rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        <option value="">{DEFAULT_LANDING_PAGE_LABEL}</option>
        {LANDING_PAGE_OPTIONS.filter((o) => o.value !== DEFAULT_LANDING_PAGE).map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

/**
 * Inline country/state editor for the Overview tab — location is coarse by
 * design (no city/coords) and editable in place, no trip to /profile/edit.
 */
function LocationRow({
  initialCountry,
  initialState,
  username,
}: {
  initialCountry?: string | null
  initialState?: string | null
  username: string
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [country, setCountry] = useState(initialCountry || "")
  const [stateCode, setStateCode] = useState(initialState || "")
  const [saved, setSaved] = useState({ country: initialCountry || "", state: initialState || "" })
  const [countries, setCountries] = useState<{ iso2: string; name: string }[]>([])
  const [states, setStates] = useState<{ id: number; stateCode: string; name: string }[]>([])

  // Profile data arrives async — sync once it lands
  useEffect(() => {
    setCountry(initialCountry || "")
    setStateCode(initialState || "")
    setSaved({ country: initialCountry || "", state: initialState || "" })
  }, [initialCountry, initialState])

  // Load reference data lazily, only when editing starts
  useEffect(() => {
    if (!editing || countries.length > 0) return
    locationsClient.getCountries().then((r) => {
      if (r.success) setCountries(r.data as any)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  useEffect(() => {
    if (!editing) return
    setStates([])
    if (!country) { setStateCode(""); return }
    locationsClient.getStates(country).then((r) => {
      if (!r.success) return
      setStates(r.data as any)
      setStateCode((prev) => ((r.data as any[]).some((s) => s.stateCode === prev) ? prev : ""))
    })
  }, [editing, country])

  async function handleSave() {
    if (!username) return
    setSaving(true)
    try {
      const res = await fetch("/api/user/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, country, state: stateCode }),
      })
      const data = await res.json()
      if (data.success) {
        setSaved({ country, state: stateCode })
        setEditing(false)
        toast.success("Location updated")
      } else {
        toast.error(data.error || "Failed to update location")
      }
    } catch {
      toast.error("Failed to update location")
    } finally {
      setSaving(false)
    }
  }

  const display = saved.country
    ? `${saved.state ? `${saved.state}, ` : ""}${saved.country}`
    : "Not set"

  if (!editing) {
    return (
      <div className="flex items-center">
        <MapPin className="h-5 w-5 mr-2 text-muted-foreground" />
        <span className="font-medium mr-2">Location:</span>
        <span className={saved.country ? "" : "text-muted-foreground"}>{display}</span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-2 h-7 px-2 text-xs"
          onClick={() => setEditing(true)}
        >
          Edit
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-start">
      <MapPin className="h-5 w-5 mr-2 mt-2 text-muted-foreground" />
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="h-9 px-2 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Country…</option>
          {countries.map((c) => (
            <option key={c.iso2} value={c.iso2}>{c.name}</option>
          ))}
        </select>
        {states.length > 0 && (
          <select
            aria-label="State or region"
            value={stateCode}
            onChange={(e) => setStateCode(e.target.value)}
            className="h-9 px-2 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">State…</option>
            {states.map((s) => (
              <option key={s.id} value={s.stateCode}>{s.name}</option>
            ))}
          </select>
        )}
        <Button size="sm" className="h-9" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-9"
          disabled={saving}
          onClick={() => {
            setCountry(saved.country)
            setStateCode(saved.state)
            setEditing(false)
          }}
        >
          Cancel
        </Button>
        <p className="w-full text-xs text-muted-foreground">
          Used to suggest nearby stores and events — never shown as an address
        </p>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const { data: session } = useSession()
  const { user } = useAuth()
  const { openPreferences } = useCookieConsent()
  const [isLoading, setIsLoading] = useState(true)
  const [profileData, setProfileData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [binderStats, setBinderStats] = useState<{ count: number; uniquePrintings?: number; id?: string } | null>(null)
  const [wantsStats, setWantsStats] = useState<{ count: number } | null>(null)
  const [defaultTab, setDefaultTab] = useState("overview")

  useEffect(() => {
    // Set default tab based on hash
    if (typeof window !== "undefined") {
      if (window.location.hash === "#local-stores") {
        setDefaultTab("local-stores")
      }
    }
  }, [])

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        setIsLoading(true)

        // Fetch user profile using client service
        const profileResult = await usersClient.getAuthMe()

        if (!profileResult.success) {
          setError(profileResult.error)
          return
        }

        // profileResult.data already has the full response structure
        setProfileData(profileResult.data)

        // Fetch total card count across all binders using real-time count (more accurate)
        const totalCardsResult = await bindersClient.getRealTimeCardCount()
        console.log('Real-time card count result:', totalCardsResult)
        if (totalCardsResult.success) {
          setBinderStats({
            count: totalCardsResult.data.totalQuantity,
            uniquePrintings: totalCardsResult.data.uniquePrintings
          })
          console.log('Set binder stats - total:', totalCardsResult.data.totalQuantity, 'unique:', totalCardsResult.data.uniquePrintings)
        } else {
          console.error("Failed to fetch card count:", totalCardsResult.error)
        }

        // Fetch wants total quantity using client service
        const wantsTotalResult = await wantsClient.getTotalQuantity()
        if (wantsTotalResult.success) {
          setWantsStats({
            count: wantsTotalResult.data,
          })
        } else {
          console.error("Failed to fetch wants total:", wantsTotalResult.error)
        }

      } catch (err) {
        setError("Failed to load profile data")
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }

    // Only run when we have a user ID from either source
    const userId = user?.id || session?.user?.id
    if (userId) {
      fetchProfileData()
    } else {
      setIsLoading(false)
    }
  }, [user?.id, session?.user?.id])

  // If not logged in, show login prompt
  if (!isLoading && !user && !session?.user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="w-full max-w-3xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle>Profile Not Available</CardTitle>
            <CardDescription>You need to be logged in to view your profile</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-center mb-4">Please log in to access your profile and trading information.</p>
            <Link href="/auth/login">
              <Button>Login with Discord</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="w-full max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>Loading Profile...</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center p-6">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="w-full max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>Error Loading Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-500">{error}</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Combine data from both auth sources
  const userData = profileData?.user || user || session?.user
  const username = userData?.username || userData?.name || "User"
  const email = userData?.email || "No email available"
  const discordUsername = userData?.discordUsername || null
  const discordId = userData?.discordId || userData?.discord?.id || null

  // Format join date from createdAt timestamp
  let joinDate = "Unknown join date"
  if (userData?.createdAt) {
    const date = new Date(userData.createdAt)
    joinDate = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  // Calculate trading statistics from real data
  const binderCount = binderStats?.count || 0
  const wantsCount = wantsStats?.count || 0

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader>
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={userData?.image || "/cardback.webp"} alt={username} />
              <AvatarFallback className="text-2xl">{stripUsernamePrefix(username).charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center md:text-left">
              <CardTitle className="text-2xl mb-2">{stripUsernamePrefix(username)}</CardTitle>
              <div className="flex flex-col md:flex-row gap-2 md:gap-4 items-center md:items-start">
                <div className="flex items-center text-muted-foreground">
                  <Calendar className="h-4 w-4 mr-1" />
                  <span className="text-sm">Joined {joinDate}</span>
                </div>
                {discordUsername && (
                  <Badge variant="secondary" className="flex items-center gap-1 px-2 py-1">
                    <svg
                      className="h-4 w-4"
                      aria-hidden="true"
                      focusable="false"
                      data-prefix="fab"
                      data-icon="discord"
                      role="img"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 640 512"
                    >
                      <path
                        fill="currentColor"
                        d="M524.531,69.836a1.5,1.5,0,0,0-.764-.7A485.065,485.065,0,0,0,404.081,32.03a1.816,1.816,0,0,0-1.923.91,337.461,337.461,0,0,0-14.9,30.6,447.848,447.848,0,0,0-134.426,0,309.541,309.541,0,0,0-15.135-30.6,1.89,1.89,0,0,0-1.924-.91A483.689,483.689,0,0,0,116.085,69.137a1.712,1.712,0,0,0-.788.676C39.068,183.651,18.186,294.69,28.43,404.354a2.016,2.016,0,0,0,.765,1.375A487.666,487.666,0,0,0,176.02,479.918a1.9,1.9,0,0,0,2.063-.676A348.2,348.2,0,0,0,208.12,430.4a1.86,1.86,0,0,0-1.019-2.588,321.173,321.173,0,0,1-45.868-21.853,1.885,1.885,0,0,1-.185-3.126c3.082-2.309,6.166-4.711,9.109-7.137a1.819,1.819,0,0,1,1.9-.256c96.229,43.917,200.41,43.917,295.5,0a1.812,1.812,0,0,1,1.924.233c2.944,2.426,6.027,4.851,9.132,7.16a1.884,1.884,0,0,1-.162,3.126,301.407,301.407,0,0,1-45.89,21.83,1.875,1.875,0,0,0-1,2.611,391.055,391.055,0,0,0,30.014,48.815,1.864,1.864,0,0,0,2.063.7A486.048,486.048,0,0,0,610.7,405.729a1.882,1.882,0,0,0,.765-1.352C623.729,277.594,590.933,167.465,524.531,69.836ZM222.491,337.58c-28.972,0-52.844-26.587-52.844-59.239S193.056,219.1,222.491,219.1c29.665,0,53.306,26.82,52.843,59.239C275.334,310.993,251.924,337.58,222.491,337.58Zm195.38,0c-28.971,0-52.843-26.587-52.843-59.239S388.437,219.1,417.871,219.1c29.667,0,53.307,26.82,52.844,59.239C470.715,310.993,447.538,337.58,417.871,337.58Z"
                      ></path>
                    </svg>
                    {discordUsername}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 gap-0">
              <TabsTrigger value="overview" className="w-full">Overview</TabsTrigger>
              <TabsTrigger value="settings" className="w-full">Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Account Information */}
                <div>
                  <h3 className="text-lg font-medium mb-2">Account Information</h3>
                  <Separator className="mb-4" />
                  <div className="grid gap-4">
                    <div className="flex items-center">
                      <User className="h-5 w-5 mr-2 text-muted-foreground" />
                      <span className="font-medium mr-2">Username:</span>
                      <span>{username}</span>
                    </div>
                    <div className="flex items-center">
                      <Mail className="h-5 w-5 mr-2 text-muted-foreground" />
                      <span className="font-medium mr-2">Email:</span>
                      <span>{email}</span>
                    </div>
                    <div className="flex items-center">
                      <Calendar className="h-5 w-5 mr-2 text-muted-foreground" />
                      <span className="font-medium mr-2">Member Since:</span>
                      <span>{joinDate}</span>
                    </div>
                    {discordUsername && (
                      <div className="flex items-center">
                        <svg
                          className="h-5 w-5 mr-2 text-muted-foreground"
                          aria-hidden="true"
                          focusable="false"
                          data-prefix="fab"
                          data-icon="discord"
                          role="img"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 640 512"
                        >
                          <path
                            fill="currentColor"
                            d="M524.531,69.836a1.5,1.5,0,0,0-.764-.7A485.065,485.065,0,0,0,404.081,32.03a1.816,1.816,0,0,0-1.923.91,337.461,337.461,0,0,0-14.9,30.6,447.848,447.848,0,0,0-134.426,0,309.541,309.541,0,0,0-15.135-30.6,1.89,1.89,0,0,0-1.924-.91A483.689,483.689,0,0,0,116.085,69.137a1.712,1.712,0,0,0-.788.676C39.068,183.651,18.186,294.69,28.43,404.354a2.016,2.016,0,0,0,.765,1.375A487.666,487.666,0,0,0,176.02,479.918a1.9,1.9,0,0,0,2.063-.676A348.2,348.2,0,0,0,208.12,430.4a1.86,1.86,0,0,0-1.019-2.588,321.173,321.173,0,0,1-45.868-21.853,1.885,1.885,0,0,1-.185-3.126c3.082-2.309,6.166-4.711,9.109-7.137a1.819,1.819,0,0,1,1.9-.256c96.229,43.917,200.41,43.917,295.5,0a1.812,1.812,0,0,1,1.924.233c2.944,2.426,6.027,4.851,9.132,7.16a1.884,1.884,0,0,1-.162,3.126,301.407,301.407,0,0,1-45.89,21.83,1.875,1.875,0,0,0-1,2.611,391.055,391.055,0,0,0,30.014,48.815,1.864,1.864,0,0,0,2.063.7A486.048,486.048,0,0,0,610.7,405.729a1.882,1.882,0,0,0,.765-1.352C623.729,277.594,590.933,167.465,524.531,69.836ZM222.491,337.58c-28.972,0-52.844-26.587-52.844-59.239S193.056,219.1,222.491,219.1c29.665,0,53.306,26.82,52.843,59.239C275.334,310.993,251.924,337.58,222.491,337.58Zm195.38,0c-28.971,0-52.843-26.587-52.843-59.239S388.437,219.1,417.871,219.1c29.667,0,53.307,26.82,52.844,59.239C470.715,310.993,447.538,337.58,417.871,337.58Z"
                          ></path>
                        </svg>
                        <span className="font-medium mr-2">Discord:</span>
                        <span>{discordUsername}</span>
                      </div>
                    )}
                    <LocationRow
                      initialCountry={userData?.countryCode}
                      initialState={userData?.stateCode}
                      username={userData?.username || ""}
                    />
                  </div>
                </div>

                {/* Right Column - Trading Summary & Export Options */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-2">Trading Summary</h3>
                    <Separator className="mb-4" />
                    <div className="grid gap-4">
                      <div className="flex items-center">
                        <ShoppingCart className="h-5 w-5 mr-2 text-muted-foreground" />
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Binder Cards:</span>
                            <span>{binderCount}</span>
                          </div>
                          {binderStats?.uniquePrintings && binderStats.uniquePrintings !== binderCount && (
                            <span className="text-xs text-muted-foreground ml-0">
                              ({binderStats.uniquePrintings} unique printings)
                            </span>
                          )}
                        </div>
                      </div>
                      {wantsStats && (
                        <div className="flex items-center">
                          <Star className="h-5 w-5 mr-2 text-muted-foreground" />
                          <span className="font-medium mr-2">Wants List Items:</span>
                          <span>{wantsCount}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-2">Export Data</h3>
                    <Separator className="mb-4" />
                    <ExportOptions />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="mt-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-2">Account Settings</h3>
                  <Separator className="mb-4" />
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Settings className="h-5 w-5 mr-2 text-muted-foreground" />
                        <span>Update Profile Information</span>
                      </div>
                      <Link href="/profile/edit">
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                      </Link>
                    </div>

                    <HomePageRow
                      initialValue={userData?.landingPage}
                      username={userData?.username || ""}
                    />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Shield className="h-5 w-5 mr-2 text-muted-foreground" />
                        <span>Privacy Settings</span>
                      </div>
                      <Button variant="outline" size="sm" onClick={openPreferences}>
                        Cookie Preferences
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-2 text-destructive">Danger Zone</h3>
                  <Separator className="mb-4" />
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <AlertCircle className="h-5 w-5 mr-2 text-destructive" />
                        <span>Delete Your Account</span>
                      </div>
                      <DeleteAccountDialog />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-between">
          <p className="text-sm text-muted-foreground">Member of FaB Bazaar since {joinDate}</p>
        </CardFooter>
      </Card>
    </div>
  )
}
