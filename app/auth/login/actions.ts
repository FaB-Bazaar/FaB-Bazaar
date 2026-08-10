// app/auth/login/actions.ts

"use server" // This directive marks all functions in this file as Server Actions

import { signIn } from "@/auth"
import { safeCallbackUrl } from "@/lib/auth/safe-callback-url"

export async function loginWithDiscord(formData?: FormData) {
  // A validated internal callbackUrl (e.g. the binder the user was viewing)
  // wins; otherwise land on the access-aware post-login route, which forwards
  // users to their chosen landing page (default /volzar).
  const callbackUrl = safeCallbackUrl(formData?.get("callbackUrl"))
  await signIn("discord", { redirectTo: callbackUrl ?? "/auth/post-login" })
}
