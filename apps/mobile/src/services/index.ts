import { createApiServices } from './api';
import type { Services } from './interfaces';
import { createMockServices } from './mock';

/** EXPO_PUBLIC_API_MODE: "mock" (default) or "api". */
export const API_MODE: 'mock' | 'api' = process.env.EXPO_PUBLIC_API_MODE === 'api' ? 'api' : 'mock';

export const services: Services = API_MODE === 'api' ? createApiServices() : createMockServices();

export * from './interfaces';
export { MOCK_OTP } from './mock';
