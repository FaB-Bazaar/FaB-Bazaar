"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AccountNav } from "@/components/profile/AccountNav"
import { SOCIAL_FIELDS, type SocialLinks } from "@/lib/profile/social-links"

export default function ProfileSocialsPage() {
  const router = useRouter()
  const { status: sessionStatus } = useSession()
  const { toast } = useToast()

  const [username, setUsername] = useState("")
  const [values, setValues] = useState<SocialLinks>({})
  const [isFetching, setIsFetching] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (sessionStatus === "loading") return
    if (sessionStatus === "unauthenticated") {
      router.push("/auth/login?callbackUrl=/profile/socials")
      return
    }
    let cancelled = false
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.user) return
        setUsername(data.user.username || "")
        setValues(data.user.socialLinks || {})
      })
      .catch((err) => console.error("Failed to load socials:", err))
      .finally(() => {
        if (!cancelled) setIsFetching(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionStatus, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSaving(true)
    try {
      const response = await fetch("/api/user/socials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socials: values }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.success) {
        setError(data?.error || "Failed to save socials")
        return
      }
      // Show what was stored: a pasted link comes back as its handle.
      setValues(data.data.socials)
      toast({ title: "Socials saved" })
    } catch (err) {
      console.error(err)
      setError("Failed to save socials")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-4 md:gap-8">
        <AccountNav username={username} />

        <Card className="flex-1 min-w-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl">Socials</CardTitle>
            <CardDescription>
              Shown as links on your public profile. Enter a username or paste a profile link, and add your own or your store&apos;s website; leave blank to hide.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {SOCIAL_FIELDS.map((platform) => (
                  <div key={platform.key} className="space-y-1.5">
                    <Label htmlFor={`social-${platform.key}`}>{platform.label}</Label>
                    <Input
                      id={`social-${platform.key}`}
                      placeholder={platform.placeholder}
                      value={values[platform.key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [platform.key]: e.target.value }))}
                      disabled={isFetching}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-1">
                <Button type="submit" className="w-full sm:w-auto" disabled={isSaving || isFetching}>
                  {isSaving ? "Saving..." : "Save socials"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
