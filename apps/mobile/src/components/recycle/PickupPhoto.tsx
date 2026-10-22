import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { AppText, Button } from '@/components/ui';
import { pickFromGallery, takePhoto, type PhotoResult } from '@/components/report/photo';
import { useTr } from '@/i18n';
import { colors, radius } from '@/theme/tokens';

type Props = { uri: string | null; onChange: (uri: string | null) => void; quality?: number };

/** One optional photo of the materials: camera or gallery, retake and remove. Uses the report photo helpers. */
export function PickupPhoto({ uri, onChange, quality = 0.6 }: Props) {
  const tr = useTr();
  const [problem, setProblem] = useState<'denied' | 'failed' | null>(null);

  const handle = (res: PhotoResult) => {
    if (res.kind === 'photo') {
      setProblem(null);
      onChange(res.uri);
    } else if (res.kind === 'denied' || res.kind === 'failed') {
      setProblem(res.kind);
    }
  };

  return (
    <View style={styles.wrap}>
      {uri ? (
        <View style={styles.filled}>
          <Image source={{ uri }} accessibilityLabel={tr('صورة الخامات', 'Photo of the materials')} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <Pressable testID="pickup-photo-remove" accessibilityRole="button" accessibilityLabel={tr('امسح الصورة', 'Remove the photo')} onPress={() => onChange(null)} hitSlop={10} style={styles.remove}>
            <Icon name="x" size={16} color={colors.onRed} strokeWidth={2.5} />
          </Pressable>
        </View>
      ) : null}
      <View style={styles.actions}>
        <View style={styles.half}>
          <Button testID="pickup-photo-camera" label={uri ? tr('صوّر تاني', 'Retake') : tr('صوّر الخامات', 'Take a photo')} icon="camera" variant="secondary" size="sm" fullWidth onPress={async () => handle(await takePhoto(quality))} />
        </View>
        <View style={styles.half}>
          <Button testID="pickup-photo-gallery" label={tr('من المعرض', 'From gallery')} icon="image" variant="secondary" size="sm" fullWidth onPress={async () => handle(await pickFromGallery(quality))} />
        </View>
      </View>
      {problem ? (
        <View accessibilityRole="alert" style={styles.problem}>
          <AppText variant="small" color={colors.goldDeep}>
            {problem === 'denied'
              ? tr('محتاجين إذن الكاميرا. ممكن تسمح بيه من إعدادات الموبايل، أو تختار صورة من المعرض.', 'We need camera permission. You can allow it in your phone settings, or choose a photo from your gallery.')
              : tr('مقدرناش نفتح الكاميرا. اختار صورة من المعرض أو كمّل من غير صورة.', "We couldn't open the camera. Choose a photo from your gallery, or continue without one.")}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  filled: { height: 160, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.statusReceivedBg },
  remove: { position: 'absolute', top: 8, end: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(22,22,22,0.72)', alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
  problem: { backgroundColor: colors.goldSoft, borderRadius: radius.md, padding: 12 },
});
