"use server";

import { auth } from "@/auth";
import { userService, siteSettingsService } from "@/lib/services";
import { revalidatePath } from "next/cache";

const ADS_ENABLED_KEY = "ads_enabled";

export async function getAdsEnabled(): Promise<boolean> {
  const result = await siteSettingsService.get<boolean>(ADS_ENABLED_KEY);
  if (!result.success || result.data === null) return true; // default: ads on
  return result.data;
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

  const result = await siteSettingsService.set(ADS_ENABLED_KEY, value);
  if (!result.success) {
    throw new Error(result.error);
  }

  revalidatePath("/", "layout");
}
