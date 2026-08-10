// components/binder/AccessDeniedScreen.tsx
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AccessDeniedScreenProps {
  // When set (signed-out viewers), render a sign-in CTA that returns the
  // user here after login. Omit for signed-in users who simply lack access.
  signInHref?: string;
}

export function AccessDeniedScreen({ signInHref }: AccessDeniedScreenProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md mx-4">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          {signInHref
            ? "This binder is private. If it's yours, sign in to view it."
            : "This binder is private and you don't have permission to view it."}
        </p>
        <div className="flex items-center justify-center gap-3">
          {signInHref && (
            <Button asChild>
              <Link href={signInHref}>Sign in</Link>
            </Button>
          )}
          <Button onClick={() => window.history.back()} variant="outline">
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}
