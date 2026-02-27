import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { userService } from "@/lib/services"

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session || !session.user.id) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 })
    }

    const { discordUsername } = await request.json()

    if (!discordUsername) {
      return NextResponse.json({ success: false, error: "Discord username is required" }, { status: 400 })
    }

    // Get current user to find discordId
    const userResult = await userService.findById(session.user.id)
    if (!userResult.success || !userResult.data) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Update Discord info using service
    const updateResult = await userService.updateDiscordInfo(
      session.user.id,
      userResult.data.discordId || '',
      discordUsername
    )

    if (!updateResult.success) {
      return NextResponse.json({ success: false, error: updateResult.error }, { status: 500 })
    }

    // Get updated user profile
    const profileResult = await userService.getProfile(session.user.id)
    if (!profileResult.success || !profileResult.data) {
      return NextResponse.json({ success: false, error: "Failed to retrieve updated profile" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: profileResult.data._id,
        username: profileResult.data.username,
        email: profileResult.data.email,
        discordUsername: profileResult.data.discordUsername,
      },
    })
  } catch (error) {
    console.error("Update Discord username error:", error)
    return NextResponse.json({ success: false, error: "Failed to update Discord username" }, { status: 500 })
  }
}
