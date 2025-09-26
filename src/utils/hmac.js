// HMAC Verification Module

// Helper function for timing-safe string comparison
export function timingSafeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// HMAC Verification for OAuth callbacks
export async function verifyShopifyHmac(params, secret) {
  try {
    // Extract the hmac from the query parameters
    const providedHmac = params.get('hmac');
    if (!providedHmac) {
      console.warn('No HMAC provided in request');
      return false;
    }
    
    // Create a copy of params without the hmac and signature
    const paramsCopy = new URLSearchParams(params);
    paramsCopy.delete('hmac');
    paramsCopy.delete('signature'); // Also remove signature if present
    
    // Sort parameters and create query string
    // Shopify expects format: key1=value1&key2=value2 (sorted alphabetically)
    const sortedParams = Array.from(paramsCopy.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    
    // Calculate HMAC using Web Crypto API
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(sortedParams);
    
    // Import the secret key for HMAC-SHA256
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    // Generate the HMAC signature
    const signature = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      messageData
    );
    
    // Convert to hex string (Shopify uses hex encoding for OAuth HMAC)
    const hashArray = Array.from(new Uint8Array(signature));
    const calculatedHmac = hashArray
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
    
    // Use timing-safe comparison to prevent timing attacks
    return timingSafeEqual(providedHmac, calculatedHmac);
  } catch (error) {
    console.error('Error verifying HMAC:', error);
    return false;
  }
}

// HMAC Verification for Webhooks
export async function verifyWebhookHmac(body, hmac, secret) {
  try {
    if (!hmac || !secret || !body) {
      console.warn('Missing required parameters for webhook HMAC verification');
      return false;
    }
    
    // Calculate HMAC-SHA256 of the raw body
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(body);
    
    // Import the secret key for HMAC-SHA256
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    // Generate the HMAC signature
    const signature = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      messageData
    );
    
    // Convert to base64 (Shopify webhooks use base64 encoded HMAC)
    const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));
    
    // Use timing-safe comparison to prevent timing attacks
    return timingSafeEqual(hmac, base64Signature);
  } catch (error) {
    console.error('Error verifying webhook HMAC:', error);
    return false;
  }
}