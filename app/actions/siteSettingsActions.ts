"use server";

import { auth } from "@/auth";
import { userService } from "@/lib/services";
import { db } from "@/lib/postgres/db";
import { siteSettings } from "@/lib/postgres/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const ADS_ENABLED_KEY = "ads_enabled";

export async function getAdsEnabled(): Promise<boolean> {
  const rows = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.key, ADS_ENABLED_KEY))
    .limit(1);

  if (rows.length === 0) return true; // default: ads on
  return rows[0].value as boolean;
}

export async function setAdsEnabled(value: boolean) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Authentication required.");
  }

  const roleCheck = await userService.hasRole(session.user.id, "isSuperAdmin");
  if (!roleCheck.success || !roleCheck.data) {
    throw new Error("Permission denied. Super Admin role required.");
  }

  await db
    .insert(siteSettings)
    .values({ key: ADS_ENABLED_KEY, value })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: { value, updatedAt: new Date() },
    });

  revalidatePath("/", "layout");
}
