// lib/encryption.ts (WORKING VERSION with modern crypto)
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ADDRESS_ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-cbc';

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  throw new Error('ADDRESS_ENCRYPTION_KEY must be a 64-character hex string');
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
}

export function encryptAddress(address: string): EncryptedData {
  if (!address) return { encrypted: '', iv: '', tag: '' };
  
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(address, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: '' // CBC mode doesn't use auth tags
  };
}

export function decryptAddress(encryptedData: EncryptedData): string {
  if (!encryptedData.encrypted) return '';
  
  try {
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt address:', error);
    return '';
  }
}

// Helper function to encrypt user shipping address when saving to database
export function encryptUserShippingAddress(address: any) {
  if (!address) return null;
  
  const addressString = typeof address === 'string' ? address : JSON.stringify(address);
  return encryptAddress(addressString);
}

// Helper function to decrypt user shipping address when retrieving from database
export function decryptUserShippingAddress(encryptedData: EncryptedData): any {
  if (!encryptedData?.encrypted) return null;
  
  const decrypted = decryptAddress(encryptedData);
  if (!decrypted) return null;
  
  try {
    return JSON.parse(decrypted);
  } catch {
    // If it's not JSON, return as string
    return decrypted;
  }
}