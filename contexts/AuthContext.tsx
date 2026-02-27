"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useSession, signIn, signOut } from "next-auth/react"

interface User {
  id: string
  username: string
  discordUsername?: string
  image?: string
  city?: string
  country?: string
  state?: string
  isPatreon?: boolean
}

interface AuthContextType {
  user: User | null
  loading: boolean
  loginWithDiscord: () => Promise<void>
  logout: () => Promise<void>
  updateDiscordUsername: (discordUsername: string) => Promise<void>
  updateCountry: (country: string) => Promise<{ success: boolean; error?: string }>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const [user, setUser] = useState<User | null>(null)
  const loading = status === "loading"

  // Update user state when session changes - using session data directly
  useEffect(() => {
    if (session?.user) {
      setUser({
        id: session.user.id,
        username: session.user.username || session.user.name || "",
        discordUsername: session.user.discordUsername,
        image: session.user.image,
        country: session.user.country,
        city: session.user.city,
        state: session.user.state,
        isPatreon: session.user.roles?.isPatreon || false,
      })
    } else {
      setUser(null)
    }
  }, [session])

  const loginWithDiscord = async () => {
    try {
      await signIn("discord", { callbackUrl: "/discord" })
    } catch (error) {
      console.error("Discord login error:", error)
    }
  }

  const logout = async () => {
    try {
      await signOut({ redirect: false })

      if (typeof window !== "undefined") {
        window.location.href = "/"
      }
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  const updateDiscordUsername = async (discordUsername: string) => {
    try {
      const res = await fetch("/api/user/update-discord", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ discordUsername }),
        credentials: "include",
      })

      const data = await res.json()

      if (data.success && user) {
        setUser({ ...user, discordUsername })
      }
    } catch (error) {
      console.error("Update Discord username error:", error)
    }
  }

  const updateCountry = async (country: string) => {
    try {
      const res = await fetch("/api/user/update-country", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ country }),
      })

      const data = await res.json()

      if (data.success && user) {
        setUser({ ...user, country })
      }

      return { success: true }
    } catch (error) {
      console.error("Update country error:", error)
      return { success: false, error: "Failed to update country" }
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, loginWithDiscord, logout, updateDiscordUsername, updateCountry }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}