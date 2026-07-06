// app/auth/login/actions.ts

"use server" // This directive marks all functions in this file as Server Actions

import { signIn } from "@/auth"

export async function loginWithDiscord() {
  // Land on the access-aware post-login route, which forwards Fabby Chat
  // users to /fabby-chat and everyone else to /discord.
  await signIn("discord", { redirectTo: "/auth/post-login" })
}