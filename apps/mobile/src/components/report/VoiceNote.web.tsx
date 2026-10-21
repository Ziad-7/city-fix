import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { AppText } from '@/components/ui';
import { useTr } from '@/i18n';
import { colors, radius } from '@/theme/tokens';
import type { VoiceNoteProps } from './VoiceNote.types';

/** Web preview: recording is native-only, so the row just says so and the citizen types. */
export function VoiceNote(_: VoiceNoteProps) {
  const tr = useTr();
  return (
    <View testID="voice-note" accessibilityLabel={tr('التسجيل بالصوت متاح على الموبايل', 'Voice recording is available on the mobile app')} style={styles.row}>
      <View style={styles.disc}>
        <Icon name="mic" size={20} color={colors.inkMuted} />
      </View>
      <AppText variant="smallStrong" color={colors.inkMuted} style={{ flex: 1 }}>{tr('التسجيل بالصوت متاح على الموبايل', 'Voice recording is available on the mobile app')}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 10, paddingVertical: 8, minHeight: 56 },
  disc: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center' },
});
