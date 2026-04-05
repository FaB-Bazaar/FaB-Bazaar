"use client"

import Image from "next/image"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { CheckCircle2, XCircle } from "lucide-react"
import { hasTalisharMembership, hasFabBazaarMembership } from "@/lib/metafy/communities"

function TalisharStatus({ communities }: { communities: { communityId: string }[] }) {
  const inTalishar = hasTalisharMembership(communities)
  const inFabBazaar = hasFabBazaarMembership(communities)
  const isLinked = inTalishar && inFabBazaar

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {isLinked ? (
          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
        ) : (
          <XCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
        <span className={`text-sm font-medium ${isLinked ? "text-green-600" : "text-muted-foreground"}`}>
          {isLinked ? "Talishar deck sync active" : "Talishar deck sync not available"}
        </span>
      </div>
      {!isLinked && (
        <div className="pl-1 space-y-1.5">
          <StatusRow label="FabBazaar Community" ok={inFabBazaar} />
          <StatusRow label="Talishar's Community" ok={inTalishar} />
        </div>
      )}
      <div className="grid grid-cols-1 gap-3">
        <div className="space-y-1.5">
          <p className="text-sm text-muted-foreground text-center">Without</p>
          <div className="rounded-md overflow-hidden border border-border">
            <Image
              src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/0a8c6f4d-82a8-45a3-a580-9ea1652ec800/public"
              alt="Without integration: manual URL import required in Talishar"
              width={300}
              height={100}
              className="w-full object-cover"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm text-muted-foreground text-center">With</p>
          <div className="rounded-md overflow-hidden border border-border">
            <Image
              src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/898f1e1e-4a01-4665-5c57-9eb7d2036b00/public"
              alt="With integration: FaB Bazaar decks appear in Talishar's Quick Join panel"
              width={300}
              height={100}
              className="w-full object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
      )}
      <span className={`text-sm ${ok ? "text-muted-foreground" : "text-destructive"}`}>{label}</span>
    </div>
  )
}

export default function ConnectedAccountsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const { user } = useAuth()

  const [isFetching, setIsFetching] = useState(true)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [isUnlinking, setIsUnlinking] = useState(false)

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsFetching(true)
        const response = await fetch("/api/auth/me")
        const data = await response.json()
        if (data.success && data.user) {
          setUserProfile(data.user)
        }
      } catch (err) {
        console.error("Failed to fetch user data:", err)
      } finally {
        setIsFetching(false)
      }
    }

    if (user || session?.user) {
      fetchUserData()
    } else {
      setIsFetching(false)
    }
  }, [user, session])

  useEffect(() => {
    if (!isFetching && !user && !session?.user) {
      router.push("/auth/login")
    }
  }, [isFetching, user, session, router])

  useEffect(() => {
    const metafyParam = searchParams.get("metafy")
    if (!metafyParam) return

    if (metafyParam === "linked") {
      toast.success("Metafy account linked successfully")
      fetch("/api/auth/me").then(r => r.json()).then(data => {
        if (data.success) setUserProfile(data.user)
      })
    } else if (metafyParam === "error") {
      const reason = searchParams.get("reason") || "unknown"
      const messages: Record<string, string> = {
        state_mismatch: "Link failed: security check failed. Please try again.",
        token_exchange_failed: "Link failed: could not connect to Metafy. Please try again.",
        no_user_id: "Link failed: could not retrieve your Metafy profile.",
        save_failed: "Link failed: could not save your account link. Please try again.",
        not_configured: "Metafy integration is not configured.",
      }
      toast.error(messages[reason] || "Failed to link Metafy account. Please try again.")
    }

    router.replace("/profile/connected-accounts", { scroll: false })
  }, [searchParams, router])

  const handleMetafyUnlink = async () => {
    setIsUnlinking(true)
    try {
      const response = await fetch("/api/auth/metafy/unlink", { method: "DELETE" })
      const data = await response.json()
      if (data.success) {
        toast.success("Metafy account disconnected")
        setUserProfile((prev: any) => ({ ...prev, metafyLinked: false, metafyUsername: undefined }))
      } else {
        toast.error("Failed to disconnect Metafy account")
      }
    } catch {
      toast.error("Failed to disconnect Metafy account")
    } finally {
      setIsUnlinking(false)
    }
  }

  if (isFetching) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-center">Loading...</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-2">
        <CardHeader className="px-0 pb-2">
          <CardTitle className="text-xl">Connected Accounts</CardTitle>
          <CardDescription>Link third-party accounts to unlock additional features</CardDescription>
        </CardHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left: Metafy connection + communities */}
          <Card>
            <CardContent className="pt-5 space-y-4">
              {/* Metafy row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-md bg-[#f5c842] flex items-center justify-center flex-shrink-0">
                    <span className="text-black font-bold text-sm">M</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Metafy</p>
                    {userProfile?.metafyLinked ? (
                      <p className="text-sm text-muted-foreground">@{userProfile.metafyUsername}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Enables Talishar deck sync and more</p>
                    )}
                  </div>
                </div>
                {userProfile?.metafyLinked ? (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-600">Connected</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleMetafyUnlink} disabled={isUnlinking}>
                      {isUnlinking ? "Disconnecting..." : "Disconnect"}
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" onClick={() => { window.location.href = "/api/auth/metafy/authorize" }}>
                    Connect
                  </Button>
                )}
              </div>

              {/* Communities */}
              {userProfile?.metafyLinked && userProfile?.metafyCommunities?.length > 0 && (
                <div className="pt-3 border-t space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Communities</p>
                  {userProfile.metafyCommunities.map((community: { communityId: string; title: string; tiers?: { id: string; name: string }[] | null }) => (
                    <div key={community.communityId} className="min-w-0">
                      <span className="text-sm font-medium">{community.title}</span>
                      {community.tiers && community.tiers.length > 0 && (
                        <p className="text-sm text-muted-foreground truncate">
                          {community.tiers.map((t) => t.name).join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right: Talishar integration status */}
          <Card>
            <CardContent className="pt-5 space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Talishar Integration</p>
              {userProfile?.metafyLinked ? (
                <TalisharStatus communities={userProfile.metafyCommunities ?? []} />
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">Connect Metafy to enable deck sync</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-1.5">
                      <p className="text-sm text-muted-foreground text-center">Without</p>
                      <div className="rounded-md overflow-hidden border border-border">
                        <Image
                          src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/0a8c6f4d-82a8-45a3-a580-9ea1652ec800/public"
                          alt="Without integration: manual URL import required in Talishar"
                          width={300}
                          height={100}
                          className="w-full object-cover"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-sm text-muted-foreground text-center">With</p>
                      <div className="rounded-md overflow-hidden border border-border">
                        <Image
                          src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/898f1e1e-4a01-4665-5c57-9eb7d2036b00/public"
                          alt="With integration: FaB Bazaar decks appear in Talishar's Quick Join panel"
                          width={300}
                          height={100}
                          className="w-full object-cover"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
