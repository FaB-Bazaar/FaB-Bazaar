import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { tradeMatchingService } from "@/lib/services"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await tradeMatchingService.getTradeOpportunities(session.user.id)

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error
        },
        { status: 500 }
      )
    }

    if (!result.data) {
      return NextResponse.json({
        success: true,
        data: null,
        message: "No trade opportunities found. Make sure you have a wants list and check back after the nightly update."
      })
    }

    return NextResponse.json({
      success: true,
      data: result.data
    })

  } catch (error) {
    console.error("Error in trade opportunities:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch trade opportunities",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
