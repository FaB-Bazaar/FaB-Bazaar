import crypto from 'crypto';

export function generateMcpToken(): string {
  // 32 bytes = 256 bits, base64url encoded
  return crypto.randomBytes(32).toString('base64url');
} 