// app/auth/login/page.tsx
"use client" // Keep this for the client-side redirect logic

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { safeCallbackUrl } from "@/lib/auth/safe-callback-url"
import { LoginForm } from "./login-form" // Import the new component

function LoginPageInner() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  // Validated here AND in the server action — this copy only decides what the
  // form carries / where an already-signed-in visitor goes.
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"))

  // If a user is already logged in, redirect them away from the login page —
  // to the page they were originally headed for when we know it.
  useEffect(() => {
    if (user) {
      router.push(callbackUrl ?? "/collection")
    }
  }, [user, router, callbackUrl])

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="max-w-md mx-auto">
        <LoginForm callbackUrl={callbackUrl} />
      </div>
    </div>
  )
}

export default function LoginPage() {
  // useSearchParams requires a Suspense boundary during prerender.
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  )
}
