/*
 * This is a mock implementation of the sharp module to allow
 * the crawler to run without the native module dependency.
 * 
 * It provides no-op implementations of common sharp methods.
 */

export default function mock() {
  return {
    resize: () => mock(),
    jpeg: () => mock(),
    png: () => mock(),
    webp: () => mock(),
    toBuffer: async () => Buffer.from([]),
    toFile: async () => ({}),
  };
}

// Add other commonly used sharp functions as needed
mock.cache = () => mock;
mock.format = () => mock;
mock.metadata = async () => ({});
