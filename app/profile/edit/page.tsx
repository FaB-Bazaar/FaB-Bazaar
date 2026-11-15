"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AccountNav } from "@/components/profile/AccountNav"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { toast } from "sonner"
import { locationsClient } from "@/lib/client"
import { SUPPORTED_LANGUAGES } from "@/app/volzar/ui-strings"
import { LANDING_PAGE_OPTIONS, DEFAULT_LANDING_PAGE, DEFAULT_LANDING_PAGE_LABEL } from "@/lib/landing-page"

export default function EditProfilePage() {
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()
  const { user, updateDiscordUsername } = useAuth()

  const [username, setUsername] = useState("")
  const [discordUsername, setDiscordUsername] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  // Coarse self-set location (country + state only — used to default store discovery)
  const [country, setCountry] = useState("")
  const [preferredLanguage, setPreferredLanguage] = useState("")
  const [landingPage, setLandingPage] = useState("")
  const [stateCode, setStateCode] = useState("")
  const [countries, setCountries] = useState<{ iso2: string; name: string }[]>([])
  const [states, setStates] = useState<{ id: number; stateCode: string; name: string }[]>([])

  // Load country reference data once
  useEffect(() => {
    locationsClient.getCountries().then((r) => {
      if (r.success) setCountries(r.data as any)
    })
  }, [])

  // Load states when the country changes (keep state if it belongs to the new list)
  useEffect(() => {
    setStates([])
    if (!country) { setStateCode(""); return }
    locationsClient.getStates(country).then((r) => {
      if (!r.success) return
      setStates(r.data as any)
      setStateCode((prev) => ((r.data as any[]).some((s) => s.stateCode === prev) ? prev : ""))
    })
  }, [country])

  // Fetch current user data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsFetching(true)
        const response = await fetch("/api/auth/me")
        const data = await response.json()

        if (data.success && data.user) {
          setUserProfile(data.user)
          setUsername(data.user.username || "")
          setDiscordUsername(data.user.discordUsername || "")
          setCountry(data.user.countryCode || "")
          setPreferredLanguage(data.user.preferredLanguage || "")
          setLandingPage(data.user.landingPage || "")
          setStateCode(data.user.stateCode || "")
        }
      } catch (err) {
        console.error("Failed to fetch user data:", err)
      } finally {
        setIsFetching(false)
      }
    }

    if (sessionStatus === "loading") return
    if (user || session?.user) {
      fetchUserData()
    } else {
      setIsFetching(false)
    }
  }, [user, session, sessionStatus])

  // If not logged in, redirect to login. Wait for session hydration first —
  // redirecting while useSession is still loading bounces logged-in users
  // through /auth/login → middleware → /discord.
  useEffect(() => {
    if (sessionStatus === "loading") return
    if (!isFetching && !user && !session?.user) {
      router.push("/auth/login")
    }
  }, [isFetching, user, session, sessionStatus, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    toast.info("Saving profile...")
    setError(null)
    setSuccess(null)

    if (!username.trim()) {
      setError("Username is required")
      return
    }

    setIsLoading(true)

    try {
      // Check if Discord username has changed
      const discordUsernameChanged = userProfile?.discordUsername !== discordUsername

      // Save profile info
      const response = await fetch("/api/user/complete-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          discordUsername,
          country,
          state: stateCode,
          preferredLanguage,
          landingPage,
        }),
      })
      const data = await response.json()
      if (!data.success) {
        setError(data.error || "Failed to update profile")
        setIsLoading(false)
        return
      }

      // If Discord username changed, update it with cascade
      if (discordUsernameChanged) {
        const discordResponse = await fetch("/api/user/update-discord-cascade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ discordUsername }),
        })
        const discordData = await discordResponse.json()
        if (!discordData.success) {
          console.warn("Failed to cascade Discord username update:", discordData.error)
          // Don't fail the entire save, just log a warning
        } else {
          console.log("Discord username cascaded successfully:", discordData.stats)
        }
      }

      setSuccess("Profile updated successfully")
      if (updateDiscordUsername && discordUsername) {
        await updateDiscordUsername(discordUsername)
      }
      setTimeout(() => {
        router.push("/profile")
      }, 1500)
    } catch (err) {
      setError("An unexpected error occurred")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  if (isFetching) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl text-center">Loading...</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const selectClass =
    "w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
  const hintClass = "text-xs text-gray-600 dark:text-gray-400"
  const sectionClass = "text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3"

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-4 md:gap-8">
        <AccountNav username={userProfile?.username || ""} />

        <Card className="flex-1 min-w-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl">Edit profile</CardTitle>
            <CardDescription>Only a username is required.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="bg-green-50 text-green-800 border-green-200">
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              <section>
                <h2 className={sectionClass}>Identity</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      placeholder="Choose a username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                    <p className={hintClass}>Your display name on the platform</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="discordUsername">Discord username</Label>
                    <Input
                      id="discordUsername"
                      placeholder="username"
                      value={discordUsername}
                      onChange={(e) => setDiscordUsername(e.target.value)}
                    />
                    <p className={hintClass}>How traders contact you</p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className={sectionClass}>Location</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="country">Country</Label>
                    <select
                      id="country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">Not set</option>
                      {countries.map((c) => (
                        <option key={c.iso2} value={c.iso2}>{c.name}</option>
                      ))}
                    </select>
                    <p className={hintClass}>Suggests nearby stores and events — never shown as an address</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="state">State / Region</Label>
                    <select
                      id="state"
                      value={stateCode}
                      onChange={(e) => setStateCode(e.target.value)}
                      disabled={states.length === 0}
                      className={selectClass}
                    >
                      <option value="">Not set</option>
                      {states.map((s) => (
                        <option key={s.id} value={s.stateCode}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <section>
                <h2 className={sectionClass}>Preferences</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="preferredLanguage">Preferred language</Label>
                    <select
                      id="preferredLanguage"
                      value={preferredLanguage}
                      onChange={(e) => setPreferredLanguage(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">Auto — based on country</option>
                      {SUPPORTED_LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>{l.label}</option>
                      ))}
                    </select>
                    <p className={hintClass}>For Volzar chats; card names stay in English</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="landingPage">Home page</Label>
                    <select
                      id="landingPage"
                      value={landingPage}
                      onChange={(e) => setLandingPage(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">{DEFAULT_LANDING_PAGE_LABEL}</option>
                      {LANDING_PAGE_OPTIONS.filter((o) => o.value !== DEFAULT_LANDING_PAGE).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <p className={hintClass}>Where you land after signing in</p>
                  </div>
                </div>
              </section>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-1">
                <Link href="/profile">
                  <Button type="button" variant="outline" className="w-full sm:w-auto">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" className="w-full sm:w-auto" disabled={isLoading}>
                  {isLoading ? (
                    <span className="flex items-center">
                      <span className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                      Saving...
                    </span>
                  ) : (
                    "Save changes"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
