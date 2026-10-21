'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_MODE } from '@/services';
import { transcribe, uploadFile } from '@/services/api/upload';

// "سجّل بصوتك": the citizen speaks and the words land in the description box.
// - API mode with MediaRecorder: record, upload as a voice note, POST /ai/transcribe (the contract's path;
//   the voice note is also attached to the report).
// - Otherwise, the browser's own speech recognition (Chrome, Edge, Safari) in Egyptian Arabic, which needs
//   no backend, so it also works in mock mode.
// - Neither available (e.g. Firefox in mock mode): the row says so and the citizen types.

export const MAX_SECONDS = 60;

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
  if (API_MODE === 'api' && canRecord()) return 'server';
  if (recognitionCtor()) return 'browser';
  return null;
}

export type VoiceState = 'idle' | 'recording' | 'working';

const MSG_DENIED = 'محتاجين إذن المايك. فعّله من إعدادات المتصفح، أو اكتب الوصف.';
const MSG_SILENT = 'مسمعناش حاجة. قرّب من المايك وجرّب تاني.';
const MSG_FAILED = 'معرفناش نكتب التسجيل. جرّب تاني، أو اكتب الوصف.';

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
    rec.lang = 'ar-EG';
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
      setError(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? MSG_DENIED : e.error === 'no-speech' ? MSG_SILENT : e.error === 'aborted' ? null : MSG_FAILED);
    };
    rec.onend = () => {
      stopRef.current = null;
      setInterim('');
      setState('idle');
      if (!heard && !failed) setError(MSG_SILENT);
    };
    stopRef.current = () => rec.stop();
    try {
      rec.start();
    } catch {
      stopRef.current = null;
      setError(MSG_FAILED);
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
      setError(MSG_DENIED);
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
          setError(MSG_SILENT);
          return;
        }
        setState('working');
        try {
          const path = await uploadFile(blob, 'voice_note', blob.type);
          if (alive.current) cbs.current.onVoiceNote?.(path);
          const { text } = await transcribe(path);
          if (!alive.current) return;
          if (text.trim()) cbs.current.onText(text.trim());
          else setError(MSG_SILENT);
        } catch {
          if (alive.current) setError(MSG_FAILED);
        } finally {
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
      setError(MSG_FAILED);
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
