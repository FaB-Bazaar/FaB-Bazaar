// lib/mongodb.ts
import mongoose from "mongoose"

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
// @ts-ignore
let cached = global.mongoose

if (!cached) {
  // @ts-ignore
  cached = global.mongoose = { conn: null, promise: null }
}

export async function connectToDatabase() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is not set.");
  }

  if (cached.conn) {
    return { db: cached.conn.connection.db };
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      autoIndex: process.env.NODE_ENV !== 'production',

      // Connection pool settings optimized for serverless
      maxPoolSize: 3,           // Max 3 connections per function instance
      minPoolSize: 0,           // Don't maintain minimum connections (close when idle)
      maxIdleTimeMS: 60000,     // Close connections idle for 60 seconds (1 minute)

      // Timeout settings for faster cleanup
      serverSelectionTimeoutMS: 5000,   // Fail fast if server unreachable (5s)
      socketTimeoutMS: 45000,           // Close sockets after 45s of inactivity

      // Heartbeat settings to detect stale connections
      heartbeatFrequencyMS: 10000,      // Check connection health every 10s
    };

    cached.promise = mongoose.connect(MONGODB_URI as string, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return { db: cached.conn.connection.db };
}

// Also keep the default export for backward compatibility
export default connectToDatabase
