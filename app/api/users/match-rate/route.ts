import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { matchingService } from "@/lib/services"

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session || !session.user.id) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 })
    }

    const currentUserId = session.user.id
    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get("userId")

    if (!targetUserId) {
      return NextResponse.json({ success: false, error: "Target user ID is required" }, { status: 400 })
    }

    // Calculate match rate using service
    const result = await matchingService.calculateMatchRate(currentUserId, targetUserId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      ...result.data
    })
  } catch (error) {
    console.error("Error calculating match rate:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to calculate match rate",
        errorDetails: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}