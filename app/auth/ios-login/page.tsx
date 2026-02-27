"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Smartphone } from "lucide-react"

export default function IOSLoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [loginSuccess, setLoginSuccess] = useState(false)

  // Check if we're on iOS
  const [isIOS, setIsIOS] = useState(false)
  useEffect(() => {
    const userAgent = navigator.userAgent
    setIsIOS(/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream)
  }, [])

  // Function to fetch debug info
  const fetchDebugInfo = async () => {
    try {
      const response = await fetch("/api/debug/auth")
      const data = await response.json()
      setDebugInfo(data)
      return data
    } catch (err) {
      console.error("Error fetching debug info:", err)
      return null
    }
  }

  // Check session status on load
  useEffect(() => {
    fetchDebugInfo()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      console.log("Alternative Login attempt started for:", email)

      // Direct server-side authentication
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          isPreHashed: false,
          isIOS: true,
          // Add a special flag to indicate this is from the alternative login page
          isIOSLoginPage: true,
        }),
        credentials: "include",
      })

      const data = await response.json()
      console.log("Login response:", data)

      if (data.success) {
        console.log("Login successful!")
        setLoginSuccess(true)

        // Fetch debug info to verify session
        const debugData = await fetchDebugInfo()
        console.log("Session debug after login:", debugData)

        // Wait a moment before redirecting
        setTimeout(() => {
          // window.location.href = "/trades"
        }, 2000)
      } else {
        console.error("Login failed:", data.error)
        setError(data.error || "Login failed. Please check your credentials.")
      }
    } catch (err) {
      console.error("Login error:", err)
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (loginSuccess) {
    return (
      <div className="container mx-auto py-12 px-4">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold text-center">Login Successful!</CardTitle>
              <CardDescription className="text-center">
                You are now logged in. Redirecting to your trades...
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-red-600 border-t-transparent rounded-full"></div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-center">
              {/* <Button onClick={() => (window.location.href = "/trades")}>Go to Trades Now</Button> */}
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-2">
              <Smartphone className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-center">Alternative Login</CardTitle>
            <CardDescription className="text-center">
              Use this method if you're having trouble with the standard login
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="text-sm text-red-600 hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-red-600 hover:bg-red-700" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center">
                    <span className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                    Logging in...
                  </span>
                ) : (
                  "Login"
                )}
              </Button>
            </form>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-700">
                <strong>Note:</strong> This alternative login method uses a different authentication approach that may
                work better on some browsers or devices. Your password is still securely handled.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col">
            <div className="text-center text-sm mt-2">
              Don't have an account?{" "}
              <Link href="/auth/signup" className="text-red-600 hover:underline">
                Sign up
              </Link>
            </div>
            <div className="text-center text-sm mt-2">
              <Link href="/auth/login" className="text-gray-500 hover:underline">
                Return to standard login page
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
