"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { toast } from "sonner"
import { locationsClient } from "@/lib/client"
import { SUPPORTED_LANGUAGES } from "@/app/volzar/ui-strings"

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

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-md mx-auto space-y-6">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Edit Profile</CardTitle>
            <CardDescription className="text-center">Update your profile information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
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

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-500">This will be your display name on the platform</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discordUsername">Discord Username (Optional)</Label>
                <Input
                  id="discordUsername"
                  placeholder="username#1234"
                  value={discordUsername}
                  onChange={(e) => setDiscordUsername(e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  This will be used for contact in your listings and trade agreements
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country (Optional)</Label>
                <select
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Not set</option>
                  {countries.map((c) => (
                    <option key={c.iso2} value={c.iso2}>{c.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  Used to suggest nearby stores and events — never shown as an address
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="preferredLanguage">Preferred language (Optional)</Label>
                <select
                  id="preferredLanguage"
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Auto — based on country</option>
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  Volzar chats and prompts use this language; card names stay in English
                </p>
              </div>

              {states.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="state">State / Region (Optional)</Label>
                  <select
                    id="state"
                    value={stateCode}
                    onChange={(e) => setStateCode(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Not set</option>
                    {states.map((s) => (
                      <option key={s.id} value={s.stateCode}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center">
                    <span className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                    Saving...
                  </span>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter>
            <Link href="/profile" className="w-full">
              <Button variant="outline" className="w-full">
                Cancel
              </Button>
            </Link>
          </CardFooter>
        </Card>

      </div>
    </div>
  )
}
