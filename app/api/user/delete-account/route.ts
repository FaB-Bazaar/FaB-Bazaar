import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { userService } from "@/lib/services"

export async function DELETE() {
  try {
    console.log("Starting delete account process");

    const session = await auth();
    console.log("Session retrieved:", !!session, session?.user?.id);

    if (!session || !session.user.id) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 })
    }

    console.log("Deleting account for user:", session.user.id);

    // Delete account with cascading deletion using service (handles ACID transaction)
    const result = await userService.deleteAccountCascade(session.user.id);

    if (!result.success) {
      console.error("Failed to delete account:", result.error);
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 })
    }

    console.log("Account deleted successfully");

    return NextResponse.json({
      success: true,
      message: "Account and all associated data deleted successfully"
    })

  } catch (error) {
    console.error("Delete account error:", error)
    return NextResponse.json({
      success: false,
      error: "Failed to delete account: " + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 })
  }
}