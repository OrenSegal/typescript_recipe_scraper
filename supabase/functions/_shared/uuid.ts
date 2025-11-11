/*
 * Simple UUID v4 generator
 * @returns A random UUID v4 string
 */
export function generateUuid(): string {
  // @ts-ignore - crypto is available in Deno
  return globalThis.crypto.randomUUID ? 
    // @ts-ignore
    globalThis.crypto.randomUUID() : 
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
}
