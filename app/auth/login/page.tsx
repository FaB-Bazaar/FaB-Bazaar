// app/auth/login/page.tsx
"use client" // Keep this for the client-side redirect logic

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { LoginForm } from "./login-form" // Import the new component

export default function LoginPage() {
  const { user } = useAuth()
  const router = useRouter()

  // This logic can stay the same.
  // If a user is already logged in, redirect them away from the login page.
  useEffect(() => {
    if (user) {
      router.push("/collection")
    }
  }, [user, router])

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="max-w-md mx-auto">
        <LoginForm />
      </div>
    </div>
  )
}