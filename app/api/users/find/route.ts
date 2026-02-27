import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { userService } from "@/lib/services"

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session || !session.user.id) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const discordUsername = searchParams.get("discord")
    const username = searchParams.get("username")
    const userId = searchParams.get("userId")

    if (!discordUsername && !username && !userId) {
      return NextResponse.json(
        { success: false, error: "Username, Discord username, or user ID is required" },
        { status: 400 },
      )
    }

    let result

    // Search by user ID if provided
    if (userId) {
      result = await userService.findById(userId)
    }
    // Search by regular username if provided
    else if (username) {
      result = await userService.findByUsername(username)
    }
    // Search by Discord username if provided
    else if (discordUsername) {
      result = await userService.findByDiscordUsername(discordUsername)
    }

    if (!result || !result.success) {
      return NextResponse.json(
        { success: false, error: result?.error || "Failed to find user" },
        { status: 500 }
      )
    }

    if (!result.data) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Return limited user data for privacy
    return NextResponse.json({
      success: true,
      user: {
        _id: result.data._id,
        username: result.data.username,
        discordUsername: result.data.discordUsername,
      },
    })
  } catch (error) {
    console.error("Error finding user:", error)
    return NextResponse.json({ success: false, error: "Failed to find user" }, { status: 500 })
  }
}
