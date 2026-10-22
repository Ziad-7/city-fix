import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { AppText, InlineNotice } from '@/components/ui';
import { useTr, tr as trNow } from '@/i18n';
import { API_MODE } from '@/services';
import { colors, radius } from '@/theme/tokens';
import { MAX_VOICE_SECONDS, formatTimer } from './voice';
import type { VoiceNoteProps } from './VoiceNote.types';

type Phase = 'idle' | 'recording' | 'recorded';

const deniedMsg = () => trNow('مفيش إذن للميكروفون. تقدر تكتب وصف المشكلة بنفسك، أو تفعّل الإذن من إعدادات الموبايل.', 'Microphone access is off. You can type the description yourself, or allow the microphone in your phone settings.');
const failedRecordMsg = () => trNow('مقدرناش نسجّل دلوقتي، جرّب تاني أو اكتب الوصف بنفسك.', "We couldn't record right now. Try again, or type the description yourself.");

/** WhatsApp-style voice note: tap to record (live timer, stop), then play / delete / re-record. */
export function VoiceNote({ highlight, status, onRecorded, onRemoved }: VoiceNoteProps) {
  const tr = useTr();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder, 250);
  const [phase, setPhase] = useState<Phase>('idle');
  const [clipUri, setClipUri] = useState<string | null>(null);
  const [clipSeconds, setClipSeconds] = useState(0);
  const [notice, setNotice] = useState<string | null>(highlight ? tr('سجّل بصوتك أو اكتب وصف المشكلة بالعامية وإحنا نفهمها.', 'Record your voice or type the problem in your own words and we’ll make sense of it.') : null);
  const stopping = useRef(false);
  const starting = useRef(false);
  const recordingRef = useRef(false);
  const limitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const player = useAudioPlayer(clipUri);
  const playerStatus = useAudioPlayerStatus(player);

  const seconds = Math.floor(recState.durationMillis / 1000);

  const stop = useCallback(async () => {
    if (stopping.current) return;
    stopping.current = true;
    if (limitTimer.current) clearTimeout(limitTimer.current);
    try {
      const secs = Math.max(1, Math.round(recorder.currentTime));
      recordingRef.current = false;
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = recorder.uri;
      if (!uri) throw new Error('no uri');
      setClipUri(uri);
      setClipSeconds(Math.min(secs, MAX_VOICE_SECONDS));
      setPhase('recorded');
      onRecorded(uri);
    } catch {
      setPhase('idle');
      setNotice(failedRecordMsg());
    } finally {
      stopping.current = false;
    }
  }, [recorder, onRecorded]);

  // Hard stop at the limit (a timer armed when recording starts; cleared on stop and on unmount). Leaving the screen
  // mid-recording also hands the audio session back (otherwise iOS keeps playback on the earpiece).
  useEffect(() => () => {
    if (limitTimer.current) clearTimeout(limitTimer.current);
    if (recordingRef.current) {
      try {
        void recorder.stop().catch(() => undefined);
      } catch {
        // already released with the screen
      }
      void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
    }
  }, [recorder]);

  // Back to the start of the clip once it has played through.
  useEffect(() => {
    if (playerStatus.didJustFinish) void player.seekTo(0);
  }, [playerStatus.didJustFinish, player]);

  const start = async () => {
    if (starting.current || recordingRef.current) return; // a double tap must not prepare two recordings
    starting.current = true;
    setNotice(null);
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setNotice(deniedMsg());
        return;
      }
      if (clipUri) {
        player.pause();
        onRemoved();
        setClipUri(null);
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recordingRef.current = true;
      limitTimer.current = setTimeout(() => void stop(), MAX_VOICE_SECONDS * 1000);
      setPhase('recording');
    } catch {
      setPhase('idle');
      setNotice(failedRecordMsg());
    } finally {
      starting.current = false;
    }
  };

  const remove = () => {
    player.pause();
    setClipUri(null);
    setPhase('idle');
    onRemoved();
  };

  const togglePlay = () => {
    if (playerStatus.playing) player.pause();
    else player.play();
  };

  return (
    <View style={{ gap: 6 }}>
      {phase === 'idle' ? (
        <Pressable testID="voice-note" accessibilityRole="button" accessibilityLabel={tr('سجّل فويس نوت', 'Record a voice note')} onPress={start} style={styles.row}>
          <View style={[styles.disc, { backgroundColor: colors.red }]}>
            <Icon name="mic" size={20} color={colors.onRed} />
          </View>
          <AppText variant="smallStrong" style={{ flex: 1 }}>{tr('سجّل فويس نوت', 'Record a voice note')}</AppText>
          <AppText variant="caption" color={colors.inkMuted}>{tr('لحد ', 'Up to ')}{formatTimer(MAX_VOICE_SECONDS)}</AppText>
        </Pressable>
      ) : null}
      {API_MODE === 'api' ? <AppText variant="caption" color={colors.inkMuted}>{tr('التسجيل هيرتفع بشكل خاص ويتبعت لـ Gemini لتحويله لنص. النسخة المجانية ممكن تستخدم التسجيلات لتحسين منتجات Google؛ التسجيل اختياري وتقدر تكتب بدلًا منه.', 'The recording is uploaded privately and sent to Gemini for transcription. Google may use content submitted on its free tier to improve its products. Recording is optional; you can type instead.')}</AppText> : null}

      {phase === 'recording' ? (
        <View testID="voice-recording" accessibilityLabel={tr('بنسجّل', 'Recording')} accessibilityLiveRegion="polite" style={[styles.row, { borderColor: colors.red }]}>
          <Pressable testID="voice-stop" accessibilityRole="button" accessibilityLabel={tr('وقّف التسجيل', 'Stop recording')} onPress={stop} style={[styles.disc, { backgroundColor: colors.red }]}>
            <View style={styles.stopSquare} />
          </Pressable>
          <View style={styles.dot} />
          <AppText testID="voice-timer" style={styles.timer}>{formatTimer(seconds)}</AppText>
          <AppText variant="caption" color={colors.inkMuted} style={{ flex: 1 }}>{tr('بنسجّل... دوس للإيقاف', 'Recording... tap to stop')}</AppText>
        </View>
      ) : null}

      {phase === 'recorded' ? (
        <View testID="voice-clip" style={styles.row}>
          <Pressable
            testID="voice-play"
            accessibilityRole="button"
            accessibilityLabel={playerStatus.playing ? tr('وقّف الصوت مؤقتًا', 'Pause') : tr('شغّل التسجيل', 'Play the recording')}
            onPress={togglePlay}
            style={[styles.disc, { backgroundColor: colors.red }]}
          >
            {playerStatus.playing ? (
              <View style={styles.pauseBars}>
                <View style={styles.bar} />
                <View style={styles.bar} />
              </View>
            ) : (
              <Icon name="play" size={18} color={colors.onRed} />
            )}
          </Pressable>
          <View style={{ flex: 1 }}>
            <AppText variant="smallStrong">{tr('فويس نوت', 'Voice note')}</AppText>
            <AppText variant="caption" color={colors.inkMuted}>{formatTimer(clipSeconds)}</AppText>
          </View>
          <Pressable testID="voice-rerecord" accessibilityRole="button" accessibilityLabel={tr('سجّل تاني', 'Record again')} onPress={start} style={styles.action}>
            <Icon name="mic" size={20} color={colors.red} />
          </Pressable>
          <Pressable testID="voice-delete" accessibilityRole="button" accessibilityLabel={tr('امسح التسجيل', 'Delete the recording')} onPress={remove} style={styles.action}>
            <Icon name="trash" size={20} color={colors.urgent} />
          </Pressable>
        </View>
      ) : null}

      {status === 'transcribing' ? (
        <View testID="voice-transcribing" accessibilityLiveRegion="polite" style={styles.status}>
          <ActivityIndicator color={colors.red} size="small" />
          <AppText variant="caption" color={colors.redDeep}>{tr('بنكتب كلامك...', 'Turning your voice into text...')}</AppText>
        </View>
      ) : null}
      {status === 'failed' ? <InlineNotice testID="voice-failed" text={tr('مقدرناش نكتب الصوت، تقدر تكتب الوصف بنفسك', "We couldn't turn your voice into text. You can type the description yourself.")} /> : null}
      {status === 'done' ? (
        <AppText variant="caption" color={colors.inkMuted}>{tr('كتبنا كلامك في الوصف. راجعه وعدّل فيه براحتك.', 'We wrote your words in the description. Check it and edit as you like.')}</AppText>
      ) : null}
      {notice ? <InlineNotice testID="voice-notice" text={notice} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 10, paddingVertical: 8, minHeight: 56 },
  disc: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stopSquare: { width: 14, height: 14, borderRadius: 3, backgroundColor: colors.onRed },
  pauseBars: { flexDirection: 'row', gap: 4 },
  bar: { width: 4, height: 14, borderRadius: 2, backgroundColor: colors.onRed },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.red },
  timer: { fontSize: 18, lineHeight: 26, minWidth: 56 },
  action: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
