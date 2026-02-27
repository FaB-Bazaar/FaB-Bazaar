import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { userService } from "@/lib/services";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user.id) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { discordUsername, discordId } = await request.json();

    if (discordUsername === undefined) {
      return NextResponse.json({ success: false, error: "Discord username is required" }, { status: 400 });
    }

    // Get current user to extract discordId if not provided
    let finalDiscordId = discordId;
    if (!finalDiscordId) {
      const userResult = await userService.findById(session.user.id);
      if (!userResult.success || !userResult.data) {
        return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
      }
      finalDiscordId = userResult.data.discordId || '';
    }

    // Update Discord info with cascade using service
    const result = await userService.updateDiscordWithCascade(
      session.user.id,
      finalDiscordId,
      discordUsername
    );

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    console.log(`Updated Discord username for user ${session.user.id} with cascade`);

    return NextResponse.json({
      success: true,
      message: "Discord username updated successfully"
    });
  } catch (error) {
    console.error("Error updating Discord username cascade:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
} 