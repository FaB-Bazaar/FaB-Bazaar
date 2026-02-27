import { NextResponse } from "next/server"
import { metadataService } from "@/lib/services"

export async function GET() {
  try {
    const result = await metadataService.getFoilings()

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
      foilings: result.data,
    })
  } catch (error) {
    console.error("Error fetching foilings:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch foilings",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
