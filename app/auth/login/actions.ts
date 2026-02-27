// app/auth/login/actions.ts

"use server" // This directive marks all functions in this file as Server Actions

import { signIn } from "@/auth"

export async function loginWithDiscord() {
  await signIn("discord", { redirectTo: "/discord" })
}