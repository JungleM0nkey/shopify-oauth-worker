// Encryption Module for Sensitive Data
// Uses Web Crypto API for secure encryption of KV stored data

class EncryptionService {
  constructor(encryptionKey) {
    this.encryptionKey = encryptionKey;
    this._cryptoKey = null;
  }

  // Initialize crypto key from environment
  async init() {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not provided');
    }
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.encryptionKey);
    
    // Create a 256-bit key from the provided key
    const hash = await crypto.subtle.digest('SHA-256', keyData);
    
    this._cryptoKey = await crypto.subtle.importKey(
      'raw',
      hash,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Encrypt sensitive data before storing in KV
  async encrypt(data) {
    if (!this._cryptoKey) {
      await this.init();
    }
    
    const encoder = new TextEncoder();
    const plaintext = encoder.encode(JSON.stringify(data));
    
    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this._cryptoKey,
      plaintext
    );
    
    // Combine IV and encrypted data
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encrypted), iv.length);
    
    // Return base64 encoded string
    return btoa(String.fromCharCode(...result));
  }

  // Decrypt data retrieved from KV
  async decrypt(encryptedData) {
    if (!this._cryptoKey) {
      await this.init();
    }
    
    // Decode base64
    const combined = new Uint8Array(
      atob(encryptedData)
        .split('')
        .map(char => char.charCodeAt(0))
    );
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this._cryptoKey,
      encrypted
    );
    
    const decoder = new TextDecoder();
    const plaintext = decoder.decode(decrypted);
    
    return JSON.parse(plaintext);
  }
}

// Singleton instance
let encryptionService = null;

export function getEncryptionService(encryptionKey) {
  if (!encryptionService) {
    encryptionService = new EncryptionService(encryptionKey);
  }
  return encryptionService;
}

// Helper functions for encrypting/decrypting KV data
export async function encryptKVData(data, env) {
  if (!env.ENCRYPTION_KEY) {
    // If no encryption key, store as-is (backward compatibility)
    return JSON.stringify(data);
  }
  
  const service = getEncryptionService(env.ENCRYPTION_KEY);
  return await service.encrypt(data);
}

export async function decryptKVData(encryptedData, env) {
  if (!env.ENCRYPTION_KEY) {
    // If no encryption key, assume it's plain JSON
    try {
      return JSON.parse(encryptedData);
    } catch {
      return null;
    }
  }
  
  try {
    const service = getEncryptionService(env.ENCRYPTION_KEY);
    return await service.decrypt(encryptedData);
  } catch (error) {
    console.error('Decryption failed, trying as plain JSON:', error);
    // Fallback to plain JSON for migration
    try {
      return JSON.parse(encryptedData);
    } catch {
      return null;
    }
  }
}