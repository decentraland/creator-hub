/**
 * Generates a hash from a string using the Web Crypto API
 * This uses SHA-256 algorithm which is widely supported in modern browsers
 *
 * @param input - The string to hash
 * @returns A promise that resolves to a hexadecimal hash string
 */
export async function generateHash(input: string): Promise<string> {
  // Use TextEncoder to convert string to Uint8Array
  const encoder = new TextEncoder();
  const data = encoder.encode(input);

  // Generate hash using SubtleCrypto API
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Convert ArrayBuffer to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex.slice(0, 16); // Return first 16 characters for brevity
}

/**
 * Generates a thumbnail filename based on the asset path
 * This ensures unique thumbnail names even for assets with the same filename
 * in different directories.
 * @param assetPath - The full path to the asset file
 * @returns A promise that resolves to a unique thumbnail filename
 */
export async function getThumbnailHashNameForAsset(assetPath: string): Promise<string> {
  // Normalize path separators to forward slashes
  const normalizedPath = assetPath.replace(/\\/g, '/');

  // Generate hash from the full path
  const pathHash = await generateHash(normalizedPath);

  return `${pathHash}.png`;
}
