//api/metadata/sets.route.ts
import { NextResponse } from "next/server"
import { metadataService } from "@/lib/services"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category") || undefined

    const result = await metadataService.getSets(category)

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
      sets: result.data,
    })
  } catch (error) {
    console.error("Error fetching sets:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch sets",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
