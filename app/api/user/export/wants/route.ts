import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { wantsService } from "@/lib/services"

export async function GET() {
  try {
    const session = await auth();

    if (!session || !session.user.id) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 })
    }

    // Get user's wants items using service
    const result = await wantsService.exportWants(session.user.id)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    if (!result.data || result.data.length === 0) {
      return NextResponse.json({ success: false, error: "Wants list not found" }, { status: 404 })
    }

    // Format the data for export
    const exportData = {
      name: "My Wants List",
      description: "",
      cards: result.data.map((item) => ({
        id: item.printingId,
        cardId: item.printingId,
        name: item.display_name,
        set: item.set,
        foiling: item.foiling,
        quantity: item.quantity,
        priority: item.priority,
        notes: item.notes,
        tcg_market: item.tcg_market,
        tcg_low: item.tcg_low,
        addedAt: item.addedAt,
      })),
    }

    // Set headers for file download
    return NextResponse.json(exportData, {
      headers: {
        "Content-Disposition": `attachment; filename="wants-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    })
  } catch (error) {
    console.error("Export wants list error:", error)
    return NextResponse.json({ success: false, error: "Failed to export wants list" }, { status: 500 })
  }
}
