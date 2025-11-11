/*
 * This module provides a mock implementation of the 'sharp' module,
 * since we've removed the native module dependency due to ARM64 compatibility issues.
 */

let sharpModule: any;

export async function getSharp() {
  if (sharpModule) {
    return sharpModule;
  }

  // Load our mock implementation
  console.log('[Sharp] Using mock implementation');
  const mockSharp = await import('../mocks/sharp.js');
  sharpModule = mockSharp;

  return sharpModule.default || sharpModule;
}

export default getSharp;
