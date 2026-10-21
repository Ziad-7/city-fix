import { uploadAndTranscribeVoiceNote } from '@/store/actions';
import { usePrefs } from '@/store/usePrefs';
import { MOCK_TRANSCRIPTS, MOCK_TRANSCRIPTS_EN, MOCK_TRANSCRIPT_CONFIDENCE, createMockTranscriptionService } from '../mock/transcription-service';

describe('mock TranscriptionService', () => {
  it('rotates through realistic Egyptian Arabic sentences', async () => {
    const svc = createMockTranscriptionService();
    const seen: string[] = [];
    for (let i = 0; i < MOCK_TRANSCRIPTS.length + 1; i++) seen.push((await svc.transcribe('x.m4a')).text);
    expect(new Set(seen.slice(0, MOCK_TRANSCRIPTS.length)).size).toBe(MOCK_TRANSCRIPTS.length);
    expect(seen[MOCK_TRANSCRIPTS.length]).toBe(seen[0]);
    expect(MOCK_TRANSCRIPTS.length).toBeGreaterThanOrEqual(4);
  });
  it('returns text with confidence around 0.8', async () => {
    const r = await createMockTranscriptionService().transcribe('x.m4a');
    expect(r.text.length).toBeGreaterThan(10);
    expect(r.confidence).toBe(MOCK_TRANSCRIPT_CONFIDENCE);
  });
  it('answers in English when the app is in English', async () => {
    usePrefs.setState({ lang: 'en' });
    try {
      expect(MOCK_TRANSCRIPTS_EN).toHaveLength(MOCK_TRANSCRIPTS.length);
      expect((await createMockTranscriptionService().transcribe('x.m4a')).text).toBe(MOCK_TRANSCRIPTS_EN[0]);
    } finally {
      usePrefs.setState({ lang: 'ar' });
    }
  });
});

describe('uploadAndTranscribeVoiceNote', () => {
  it('uploads (mock: same uri) and returns the transcript', async () => {
    const r = await uploadAndTranscribeVoiceNote('file:///clip.m4a');
    expect(r.path).toBe('file:///clip.m4a');
    expect(r.text).toBeTruthy();
  });
});
