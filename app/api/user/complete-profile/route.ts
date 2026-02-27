import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { userService } from "@/lib/services"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 })
    }

    const { username, discordUsername, city, state, country, country_id } = await request.json()

    if (!username) {
      return NextResponse.json({ success: false, error: "Username is required" }, { status: 400 })
    }

    // Prepare update data
    const updates: any = { username }
    if (discordUsername) updates.discordUsername = discordUsername
    if (city) updates.city = city
    if (state) updates.state = state
    if (country) updates.country = country
    if (country_id) updates.country_id = country_id

    // Update profile using service
    const result = await userService.updateProfile(session.user.id, updates)

    if (!result.success) {
      // Check if error is about duplicate username
      if (result.error?.includes('already exists') || result.error?.includes('already taken')) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 })
      }
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error completing profile:", error)
    return NextResponse.json({ success: false, error: "An unexpected error occurred" }, { status: 500 })
  }
}
