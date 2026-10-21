import type { TranscriptionService } from '../interfaces';
import { delay } from './db';

/** Canned Egyptian Arabic sentences (one per common problem), handed out in rotation. */
export const MOCK_TRANSCRIPTS = [
  'فيه حفرة كبيرة قدام المدرسة والعربيات بتقع فيها كل يوم',
  'الزبالة متراكمة جنب العمارة بقالها أسبوع والريحة وحشة',
  'عمود النور في الشارع مطفي بقاله كام ليلة والمكان ضلمة',
  'فيه بلاعة مفتوحة في نص الشارع وخطر حد يقع فيها',
  'ماسورة المية مكسورة والمية بتطلع في الشارع من الصبح',
];

export const MOCK_TRANSCRIPT_CONFIDENCE = 0.8;

export function createMockTranscriptionService(): TranscriptionService {
  let next = 0;
  return {
    async transcribe() {
      await delay(1200);
      const text = MOCK_TRANSCRIPTS[next % MOCK_TRANSCRIPTS.length];
      next += 1;
      return { text, confidence: MOCK_TRANSCRIPT_CONFIDENCE };
    },
  };
}
