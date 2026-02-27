"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function SignupPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to login page since we only support Discord auth
    router.push("/auth/login")
  }, [router])

  return (
    <div className="container mx-auto py-8 px-4 flex items-center justify-center">
      <p>Redirecting to login page...</p>
    </div>
  )
}
