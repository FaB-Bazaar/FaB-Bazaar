"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/contexts/AuthContext"
import { usersClient } from '@/lib/client'

export default function CompleteProfilePage() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [username, setUsername] = useState("")
  const [discordUsername, setDiscordUsername] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pre-fill with data from URL if available
  useEffect(() => {
    const suggestedUsername = searchParams.get("username")
    const suggestedDiscord = searchParams.get("discord")

    if (suggestedUsername) setUsername(suggestedUsername)
    if (suggestedDiscord) setDiscordUsername(suggestedDiscord)
  }, [searchParams])

  // If user is already logged in and has completed profile, redirect
  useEffect(() => {
    if (user && user.username && !user.username.startsWith("dc_") && !user.username.startsWith("gh_")) {
      // router.push("/trades")
    }
  }, [user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!username.trim()) {
      setError("Username is required")
      return
    }

    setIsLoading(true)

    const result = await usersClient.completeProfile({
      username,
      discordUsername,
    })

    setIsLoading(false)

    if (result.success) {
      // router.push("/trades")
    } else {
      setError(result.error || "Failed to update profile")
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Complete Your Profile</CardTitle>
            <CardDescription className="text-center">
              Please provide a username to complete your account setup
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
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

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center">
                    <span className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                    Saving...
                  </span>
                ) : (
                  "Complete Profile"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
