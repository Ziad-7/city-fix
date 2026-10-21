import { getLang } from '@/i18n';
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

/** The same sentences in English: like the rest of the mock backend, it answers in the app language. */
export const MOCK_TRANSCRIPTS_EN = [
  'There’s a big pothole in front of the school and cars fall into it every day',
  'Garbage has been piling up next to the building for a week and it smells bad',
  'The streetlight on our street has been out for several nights and it’s dark',
  'There’s an open manhole in the middle of the street and someone could fall in',
  'A water pipe burst and water has been running into the street since morning',
];

export const MOCK_TRANSCRIPT_CONFIDENCE = 0.8;

export function createMockTranscriptionService(): TranscriptionService {
  let next = 0;
  return {
    async transcribe() {
      await delay(1200);
      const list = getLang() === 'en' ? MOCK_TRANSCRIPTS_EN : MOCK_TRANSCRIPTS;
      const text = list[next % list.length];
      next += 1;
      return { text, confidence: MOCK_TRANSCRIPT_CONFIDENCE };
    },
  };
}
