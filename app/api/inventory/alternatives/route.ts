import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { binderService } from "@/lib/services";

export async function GET(request: NextRequest) {
  try {
    const authResult = await getSession();
    if (!authResult?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cardUniqueId = searchParams.get('cardUniqueId');

    if (!cardUniqueId) {
      return NextResponse.json({ error: "cardUniqueId is required" }, { status: 400 });
    }

    const result = await binderService.getPrintingAlternatives(cardUniqueId, authResult.userId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      alternatives: result.data.alternatives
    });

  } catch (error) {
    console.error('Error fetching alternative printings:', error);
    return NextResponse.json({
      error: "Failed to fetch alternative printings"
    }, { status: 500 });
  }
}
