import { auth } from '@/auth';
import { userService } from '@/lib/services';

export async function GET() {
  try {
    const session = await auth();

    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await userService.getProfile(session.user.id);

    if (!result.success) {
      return Response.json({ error: result.error }, { status: 500 })
    }

    if (!result.data) {
      return Response.json({ error: "User not found" }, { status: 404 })
    }

    const profile = result.data;

    return Response.json({
      success: true,
      user: {
        id: profile._id,
        username: profile.username,
        email: profile.email,
        discordUsername: profile.discordUsername,
        createdAt: profile.createdAt,
        roles: profile.roles,
        isLocalGamingStore: profile.isLocalGamingStore,
        isMetafySupporter: profile.isMetafySupporter,
        isShop: profile.isShop,
        isTcgSeller: profile.isTcgSeller,
        metafyLinked: !!profile.metafyId,
        metafyUsername: profile.metafyUsername,
      },
      sessionType: "nextauth",
      debug: {
        userId: session.user.id,
        username: session.user.name
      }
    })
  } catch (error) {
    console.error("=== ERROR IN /api/auth/me ===", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return Response.json({ error: "Internal server error", details: errorMessage }, { status: 500 })
  }
}

