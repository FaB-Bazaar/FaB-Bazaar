import { NextResponse } from "next/server"
import { signOut } from "@/auth"

export async function POST() {
  try {
    // Use NextAuth's signOut to properly clear the session
    await signOut({ redirect: false })

    console.log("Logout completed successfully")
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Logout error:", error)
    return NextResponse.json({ success: false, error: "Failed to logout" }, { status: 500 })
  }
}
