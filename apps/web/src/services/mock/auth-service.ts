import type { AuthService } from '../interfaces';
import { DEMO_USER_ID } from './seed';
import { delay } from './db';

export const MOCK_OTP = '123456';

export function createMockAuthService(): AuthService {
  return {
    async requestCode() {
      await delay(400);
    },
    async verifyCode(phone, code) {
      await delay(400);
      if (!/^\d{6}$/.test(code)) throw new Error('الكود ٦ أرقام');
      return { userId: DEMO_USER_ID, phone };
    },
    async signOut() {
      await delay(100);
    },
  };
}
