'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getLang, tr } from '@/i18n';
import { API_MODE } from '@/services';
import { uploadAndTranscribeVoiceNote } from '@/store';
import { MAX_VOICE_SECONDS } from '@/shared/components/report/voice';

// "سجّل بصوتك": the citizen speaks and the words land in the description box.
// - First choice, in every mode: the browser's own speech recognition (Chrome, Edge, Safari) in Egyptian Arabic
//   (US English when the app is in English). It needs no key, storage or backend, so it works in mock and api mode.
// - Fallback, only in API mode and only when the browser has no speech recognition (e.g. Firefox) but can record:
//   record, upload as a voice note, POST /ai/transcribe (the contract's path; the voice note is also attached to
//   the report). That path needs the API to have a Gemini key and private storage configured.
// - Neither available: the row says so and the citizen types.

export const MAX_SECONDS = MAX_VOICE_SECONDS;

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const canRecord = () => typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia;

export type VoiceEngine = 'server' | 'browser' | null;

export function voiceEngine(): VoiceEngine {
  if (recognitionCtor()) return 'browser';
  if (API_MODE === 'api' && canRecord()) return 'server';
  return null;
}

export type VoiceState = 'idle' | 'recording' | 'working';

const msgDenied = () => tr('محتاجين إذن المايك. فعّله من إعدادات المتصفح، أو اكتب الوصف.', 'We need microphone permission. Turn it on in your browser settings, or type the description.');
const msgSilent = () => tr('مسمعناش حاجة. قرّب من المايك وجرّب تاني.', 'We didn’t hear anything. Move closer to the microphone and try again.');
const msgFailed = () => tr('معرفناش نكتب التسجيل. جرّب تاني، أو اكتب الوصف.', 'We couldn’t turn the recording into text. Try again, or type the description.');

/**
 * `onText` gets each finished chunk of speech; `onVoiceNote` the uploaded voice note path (server engine).
 * Recording stops by itself after MAX_SECONDS.
 */
export function useVoiceNote({ onText, onVoiceNote }: { onText: (text: string) => void; onVoiceNote?: (path: string) => void }) {
  const [engine, setEngine] = useState<VoiceEngine>(null);
  const [state, setState] = useState<VoiceState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const cbs = useRef({ onText, onVoiceNote });
  useEffect(() => {
    cbs.current = { onText, onVoiceNote };
  });

  // Feature detection only on the client (the page is prerendered).
  useEffect(() => setEngine(voiceEngine()), []);

  useEffect(() => {
    if (state !== 'recording') return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [state]);

  useEffect(() => {
    if (state === 'recording' && seconds >= MAX_SECONDS) stopRef.current?.();
  }, [state, seconds]);

  // Set while mounted; a recording that finishes (or a mic permission that is granted) after leaving the page is dropped.
  const alive = useRef(true);
  const starting = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stopRef.current?.();
    };
  }, []);

  const startBrowser = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = getLang() === 'en' ? 'en-US' : 'ar-EG';
    rec.continuous = true;
    rec.interimResults = true;
    let heard = false;
    let failed = false;
    rec.onresult = (e) => {
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0]?.transcript.trim() ?? '';
        if (r.isFinal) {
          if (text) {
            heard = true;
            cbs.current.onText(text);
          }
        } else live += ` ${text}`;
      }
      setInterim(live.trim());
    };
    rec.onerror = (e) => {
      failed = true;
      setError(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? msgDenied() : e.error === 'no-speech' ? msgSilent() : e.error === 'aborted' ? null : msgFailed());
    };
    rec.onend = () => {
      stopRef.current = null;
      setInterim('');
      setState('idle');
      if (!heard && !failed) setError(msgSilent());
    };
    stopRef.current = () => rec.stop();
    try {
      rec.start();
    } catch {
      stopRef.current = null;
      setError(msgFailed());
      return;
    }
    setState('recording');
  }, []);

  const startServer = useCallback(async () => {
    if (starting.current) return;
    starting.current = true;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      starting.current = false;
      setError(msgDenied());
      return;
    }
    starting.current = false;
    const release = () => stream.getTracks().forEach((t) => t.stop());
    if (!alive.current) {
      release();
      return;
    }
    const chunks: Blob[] = [];
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onstop = async () => {
        release();
        stopRef.current = null;
        if (!alive.current) return;
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        if (!blob.size) {
          setState('idle');
          setError(msgSilent());
          return;
        }
        setState('working');
        // The shared upload + transcription (same as the app): the clip goes through /uploads/sign with a content type
        // from the contract's list (the recorder's own type minus its codec suffix), then /ai/transcribe.
        const clip = URL.createObjectURL(blob);
        try {
          const { path, text } = await uploadAndTranscribeVoiceNote(clip, blob.type.split(';')[0], (uploaded) => {
            if (alive.current) cbs.current.onVoiceNote?.(uploaded);
          });
          if (!alive.current) return;
          if (!path) setError(msgFailed());
          else if (text) cbs.current.onText(text);
          else setError(msgSilent());
        } finally {
          URL.revokeObjectURL(clip);
          if (alive.current) setState('idle');
        }
      };
      stopRef.current = () => {
        if (recorder.state !== 'inactive') recorder.stop();
      };
      recorder.start();
    } catch {
      release();
      stopRef.current = null;
      setError(msgFailed());
      return;
    }
    setState('recording');
  }, []);

  const toggle = useCallback(() => {
    if (state === 'recording') {
      stopRef.current?.();
      return;
    }
    if (state !== 'idle' || !engine || starting.current) return;
    setError(null);
    setSeconds(0);
    if (engine === 'browser') startBrowser();
    else void startServer();
  }, [state, engine, startBrowser, startServer]);

  return { engine, state, seconds, interim, error, toggle };
}
