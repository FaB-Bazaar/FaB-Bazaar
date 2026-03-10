import mongoose, { Schema, type Document, Types } from "mongoose"
import bcrypt from "bcryptjs"
import crypto from "node:crypto"

export interface IUser extends Document {
  username: string
  email: string
  emailHash?: string
  emailIV?: string
  password: string
  discordUsername?: string
  discordAvatar?: string
  isPasswordPreHashed?: boolean
  clientHash?: string
  discordId?: string
  mcpToken?: string // Dynamic token generated during MCP auth
  mcpTokenExpiry?: Date // Optional: make tokens expire
  createdAt: Date
  updatedAt: Date
  comparePassword(candidatePassword: string): Promise<boolean>
  getDecryptedEmail(): string
  roles: {
    isAdmin: boolean
    isSuperAdmin: boolean
    isContentCreator: boolean
    canManageLocations: boolean
    canImportCardCollections: boolean
    canModerateForums: boolean
  },
  isLocalGamingStore?: boolean
  isMetafySupporter?: boolean
  isShop?: boolean
  isTcgSeller?: boolean
}

const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [36, "Username cannot exceed 36 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
    },
    emailHash: {
      type: String,
      index: true, // Index for faster searching
    },
    emailIV: {
      type: String,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
    },
    discordUsername: {
      type: String,
      trim: true,
      unique: true,
      sparse: true, // Allows multiple null/undefined values
    },
    discordAvatar: {
      type: String,
      sparse: true, // Optional Discord avatar URL
    },
    isPasswordPreHashed: {
      type: Boolean,
      default: false,
    },
    clientHash: {
      type: String,
      default: null,
    },
    discordId: {
      type: String,
      sparse: true,
    },
    mcpToken: {
      type: String,
      index: true,
      sparse: true,
    },
    mcpTokenExpiry: {
      type: Date,
    },
    roles: {
      isAdmin: { type: Boolean, default: false },
      isSuperAdmin: { type: Boolean, default: false },
      isContentCreator: { type: Boolean, default: false },
      canManageLocations: { type: Boolean, default: false },
      canImportCardCollections: { type: Boolean, default: false },
      canModerateForums: { type: Boolean, default: false },
    },
    isLocalGamingStore: { type: Boolean, default: false },
    isMetafySupporter: { type: Boolean, default: false },
    isShop: { type: Boolean, default: false },
    isTcgSeller: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
)

// --- CONSOLIDATED PRE-SAVE HOOK ---
UserSchema.pre("save", async function (next) {
  // 1. Handle username and displayUsername (case-insensitive uniqueness)
  if (this.isModified("username") || (this.isNew && this.username)) {
    // Store original casing in displayUsername if not already set
    if (!this.displayUsername) {
      this.displayUsername = this.username;
    }
    // Convert username to lowercase for uniqueness
    this.username = this.username.toLowerCase();
  }
  
  // 2. Discord username - keep as-is (Discord handles their own normalization)
  // No processing needed for discordUsername

  // 3. Roles Logic
  if (!this.roles) {
    this.roles = {
      isAdmin: false,
      isSuperAdmin: false,
      isContentCreator: false,
      canManageLocations: false,
      canImportCardCollections: false,
      canModerateForums: false,
    };
  } else {
    this.roles.isAdmin = this.roles.isAdmin ?? false;
    this.roles.isSuperAdmin = this.roles.isSuperAdmin ?? false;
    this.roles.isContentCreator = this.roles.isContentCreator ?? false;
    this.roles.canManageLocations = this.roles.canManageLocations ?? false;
    this.roles.canImportCardCollections = this.roles.canImportCardCollections ?? false;
    this.roles.canModerateForums = this.roles.canModerateForums ?? false;
  }

  // 3. Password Hashing Logic
  if (this.isModified("password")) {
    try {
      if (this.isPasswordPreHashed) {
        this.clientHash = this.password;
        const randomPassword = Math.random().toString(36).slice(-10);
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(randomPassword, salt);
      } else {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
      }
    } catch (error: any) {
      return next(error);
    }
  }

  // 4. Email Encryption Logic
  if (this.isModified("email")) {
    try {
      const key = process.env.JWT_SECRET;
      if (!key) {
        throw new Error('JWT_SECRET environment variable is not set. Cannot encrypt email.');
      }

      this.emailHash = crypto.createHash("sha256").update(this.email.toLowerCase()).digest("hex");
      const iv = crypto.randomBytes(16);
      this.emailIV = iv.toString("hex");

      const cipher = crypto.createCipheriv(
        "aes-256-cbc",
        Buffer.from(crypto.createHash("sha256").update(key).digest().slice(0, 32)),
        Buffer.from(iv, "hex") // Ensure IV is treated as hex
      );

      let encryptedEmail = cipher.update(this.email, "utf8", "hex");
      encryptedEmail += cipher.final("hex");
      this.email = encryptedEmail;
    } catch (error: any) {
      return next(error);
    }
  }

  // Always call next() to move to the next middleware or the save operation.
  next();
});

// Method to compare password for login
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  try {
    // Use bcrypt to compare the password
    return await bcrypt.compare(candidatePassword, this.password)
  } catch (error) {
    console.error("Error comparing password:", error)
    return false
  }
}

// Method to decrypt email
UserSchema.methods.getDecryptedEmail = function (): string {
  try {
    // Get encryption key from environment variable
    const key = process.env.JWT_SECRET;

    // If the key is missing, or if the IV is missing (which would also cause a crash),
    // immediately stop and return the safe fallback string.
    if (!key || !this.emailIV) {
      console.error('Error decrypting email: Missing JWT_SECRET or emailIV for user.', this._id);
      return "[Encrypted]";
    }

    // Create decipher with the stored IV
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      Buffer.from(
        crypto.createHash("sha256").update(key).digest().slice(0, 32)
      ), // Create a 32-byte key
      Buffer.from(this.emailIV, "hex"),
    );

    // Decrypt the email
    let decryptedEmail = decipher.update(this.email, "hex", "utf8");
    decryptedEmail += decipher.final("utf8");

    return decryptedEmail;
  } catch (error) {
    console.error("Error decrypting email:", error);
    return "[Encrypted]"; // Fallback if decryption fails for other reasons (e.g., corrupt data)
  }
}

// Create the model if it doesn't exist, otherwise use the existing one
export const User = mongoose.models.User || mongoose.model<IUser>("User", UserSchema)

export default User
