import { NextResponse } from "next/server"
import { metadataService } from "@/lib/services"

export async function GET() {
  try {
    const result = await metadataService.getArtVariations()

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      artVariations: result.data,
    })
  } catch (error) {
    console.error("Error fetching art variations:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch art variations",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
