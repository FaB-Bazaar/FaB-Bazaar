import User from "@/models/User"
import { hashPassword } from "./client-crypto"

/**
 * Updates a user record to include client hash after successful login
 * This helps migrate existing users to the new authentication system
 */
export async function migrateUserAfterLogin(userId: string, plainPassword: string): Promise<void> {
  try {
    // Generate client hash
    const clientHash = await hashPassword(plainPassword)

    // Update user record
    await User.findByIdAndUpdate(userId, {
      clientHash,
      isPasswordPreHashed: true,
    })

    console.log(`User ${userId} migrated to client-side hashing`)
  } catch (error) {
    console.error("Error migrating user:", error)
    // Don't throw - this is a background operation that shouldn't affect the user experience
  }
}
