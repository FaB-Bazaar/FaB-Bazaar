import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { oauthService } from "@/lib/services";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clientId } = await params;

    const result = await oauthService.revokeClient(session.user.id, clientId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error revoking OAuth client:', error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
