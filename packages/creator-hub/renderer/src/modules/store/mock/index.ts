/**
 * Generic mock data utility for Redux slices.
 *
 * How to add mock data for a new slice:
 * 1. Create a new file in ./data/ (e.g., ./data/ens.ts)
 * 2. Export your mock data from that file
 * 3. Import it here and add it to the mockRegistry
 * 4. In your slice's initialState, use `withMockData([], 'your.key')` to preload
 *    mock data - it will be available immediately regardless of API success/failure
 * 5. Enable mocking by setting VITE_MOCK_DATA=true in your .env
 */

// Data imports
import { MOCK_MANAGEMENT_PROJECTS } from './data/management';

// Mock registry - maps keys to mock data
const mockRegistry: Record<string, unknown> = {
  'management.projects': MOCK_MANAGEMENT_PROJECTS,
};

/**
 * Check if mock data is enabled via environment variable
 */
export const isMockEnabled = (): boolean => {
  return import.meta.env.VITE_MOCK_DATA === 'true';
};

/**
 * Get registered mock data by key
 * @param key - The key used when registering the mock
 * @returns The mock data if mocking is enabled and data exists, undefined otherwise
 */
export const getMockData = <T>(key: string): T | undefined => {
  if (!isMockEnabled()) {
    return undefined;
  }
  return mockRegistry[key] as T | undefined;
};

/**
 * Combine real data with mock data (if mocking is enabled)
 * - For arrays: appends mock data to real data
 * - For objects: merges mock data into real data (mock values override)
 *
 * @param realData - The real data from the API
 * @param key - The key used when registering the mock
 * @returns Combined data if mock exists and mocking is enabled, otherwise just real data
 */
export const withMockData = <T>(realData: T, key: string): T => {
  if (!isMockEnabled()) {
    return realData;
  }

  const mockData = mockRegistry[key] as T | undefined;
  if (mockData === undefined) {
    return realData;
  }

  if (Array.isArray(realData) && Array.isArray(mockData)) {
    return [...realData, ...mockData] as T;
  }

  if (
    typeof realData === 'object' &&
    realData !== null &&
    typeof mockData === 'object' &&
    mockData !== null
  ) {
    return { ...realData, ...mockData };
  }

  return mockData;
};
