"use server"; // This directive is essential

import { userService } from '@/lib/services';
import { revalidatePath } from 'next/cache';
import { auth } from "@/auth";

/**
 * A secure Server Action to update a boolean flag (role or user type) for any user.
 * This action can only be performed by a logged-in Super Administrator.
 * 
 * @param userId The ID of the user to update.
 * @param field The dot-notation path to the flag to update (e.g., 'roles.isAdmin' or 'isMetafySupporter').
 * @param value The new boolean value (true or false).
 */
export async function updateUserFlag(userId: string, field: string, value: boolean) {
  try {
    // --- 1. CRITICAL SECURITY CHECK ---
    const session = await auth();

    // Check if a user is logged in at all.
    if (!session?.user?.id) {
      throw new Error("Authentication required. You must be logged in to perform this action.");
    }

    // Check if the CURRENT user is a Super Admin using the service layer.
    // This is more secure than trusting potentially stale session data for permissions.
    const roleCheck = await userService.hasRole(session.user.id, 'isSuperAdmin');

    if (!roleCheck.success || !roleCheck.data) {
      throw new Error("Permission denied. Super Admin role is required to modify user access.");
    }
    // --- END SECURITY CHECK ---


    // --- 2. UPDATE USER FIELD VIA SERVICE ---
    // Using the service layer to update the field with dot notation support
    const updateResult = await userService.updateUserField(userId, field, value);

    if (!updateResult.success) {
      throw new Error(updateResult.error || "User not found.");
    }

    // 3. Revalidate the path of the admin page.
    // This tells Next.js to clear the cache for this page, so when an admin
    // reloads, they will see the fresh data.
    revalidatePath('/admin/user-access');

    return { success: true, message: 'User updated successfully.' };

  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    console.error("[updateUserFlag Action Error]:", message);
    // Return a generic message to the client for security, but log the specific error.
    return { success: false, message: `Failed to update user: ${message}` };
  }
}
// "use server";

// import connectToDatabase from '@/lib/mongodb';
// import User from '@/models/User';
// import { revalidatePath } from 'next/cache';

// // Renamed to be more generic, as it now handles more than just roles.
// export async function updateUserFlag(userId: string, field: string, value: boolean) {
//   try {
//     await connectToDatabase();
    
//     // Using a dynamic key with $set allows us to update any field,
//     // including nested ones using dot notation like "roles.isAdmin".
//     // This is powerful and secure.
//     await User.updateOne(
//       { _id: userId },
//       { $set: { [field]: value } }
//     );

//     revalidatePath('/admin/user-access');
//     return { success: true };
//   } catch (error) {
//     console.error("Error updating user flag:", error);
//     const message = error instanceof Error ? error.message : "An unknown error occurred.";
//     return { success: false, message };
//   }
// }