// lib/user-migration.ts
// DEAD CODE — commented out 2026-03-22
// Not imported anywhere. Legacy migration script for client-side hashing.
// Use userService from @/lib/services for user updates.

// import User from "@/models/User"
// import { hashPassword } from "./client-crypto"

// /**
//  * Updates a user record to include client hash after successful login
//  * This helps migrate existing users to the new authentication system
//  * @deprecated Not imported anywhere — legacy migration script
//  */
// export async function migrateUserAfterLogin(userId: string, plainPassword: string): Promise<void> {
//   try {
//     const clientHash = await hashPassword(plainPassword)
//     await User.findByIdAndUpdate(userId, {
//       clientHash,
//       isPasswordPreHashed: true,
//     })
//     console.log(`User ${userId} migrated to client-side hashing`)
//   } catch (error) {
//     console.error("Error migrating user:", error)
//   }
// }
