"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  let errorMessage = "An unknown error occurred during authentication."
  let errorDescription = "Please try again or contact support if the problem persists."

  // Handle specific error types
  switch (error) {
    case "Configuration":
      errorMessage = "Server configuration error"
      errorDescription = "There is a problem with the server configuration. Please contact support."
      break
    case "AccessDenied":
      errorMessage = "Access denied"
      errorDescription = "You do not have permission to sign in."
      break
    case "Verification":
      errorMessage = "Verification error"
      errorDescription = "The verification link may have expired or already been used."
      break
    case "OAuthSignin":
      errorMessage = "OAuth sign in error"
      errorDescription = "Error in the OAuth sign in process. Please try again."
      break
    case "OAuthCallback":
      errorMessage = "OAuth callback error"
      errorDescription = "Error in the OAuth callback process. Please try again."
      break
    case "OAuthCreateAccount":
      errorMessage = "Account creation failed"
      errorDescription = "Could not create an account using the OAuth provider."
      break
    case "EmailCreateAccount":
      errorMessage = "Account creation failed"
      errorDescription = "Could not create an account using the email provider."
      break
    case "Callback":
      errorMessage = "Callback error"
      errorDescription = "Error in the authentication callback process."
      break
    case "OAuthAccountNotLinked":
      errorMessage = "Account not linked"
      errorDescription = "To confirm your identity, sign in with the same account you used originally."
      break
    case "SessionRequired":
      errorMessage = "Authentication required"
      errorDescription = "You must be signed in to access this page."
      break
    default:
      // Use default error message
      break
  }

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Authentication Error</CardTitle>
            <CardDescription className="text-center">There was a problem with your authentication</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{errorMessage}</AlertTitle>
              <AlertDescription>{errorDescription}</AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Link href="/auth/login" className="text-red-600 hover:text-red-800 font-medium">
              Return to login
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
