import type { Metadata } from "next"
import { userService } from "@/lib/services"
import { buildProfileMetadata } from "@/lib/profile/profile-metadata"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>
}): Promise<Metadata> {
  const { username } = await params

  try {
    const result = await userService.getUserProfileWithStats(decodeURIComponent(username))
    if (!result.success || !result.data) return buildProfileMetadata(username, null)

    return buildProfileMetadata(username, {
      username: result.data.username,
      discordAvatar: result.data.discordAvatar,
      publicBinders: result.data.binderStats?.public ?? 0,
      wantsCount: result.data.wantsCount ?? 0,
    })
  } catch {
    return { title: "Profile" }
  }
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children
}
