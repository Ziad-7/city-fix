import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { AppText, Button } from '@/components/ui';
import { useTr } from '@/i18n';
import { colors, fonts, radius } from '@/theme/tokens';
import { pickFromGallery, takePhoto, type PhotoResult } from './photo';

export type PhotoPair = [string | null, string | null];

type Props = {
  photos: PhotoPair;
  onChange: (next: PhotoPair) => void;
  /** JPEG quality 0..1 (lower when the data saver is on). */
  quality: number;
};


/** Main close-up photo (2/3 width) + a second "wider view" slot. Tap = camera, long-press or the small link = gallery. */
export function PhotoSlots({ photos, onChange, quality }: Props) {
  const tr = useTr();
  const slotLabel = [tr('صورة ١ · قريبة', 'Photo 1 · Close-up'), tr('صورة ٢ · أوسع', 'Photo 2 · Wider')] as const;
  const [problem, setProblem] = useState<'denied' | 'failed' | null>(null);
  const [problemSlot, setProblemSlot] = useState<0 | 1>(0);

  const set = (slot: 0 | 1, uri: string | null) => {
    const next: PhotoPair = [...photos] as PhotoPair;
    next[slot] = uri;
    onChange(next);
  };

  const handle = (slot: 0 | 1, res: PhotoResult) => {
    if (res.kind === 'photo') {
      setProblem(null);
      set(slot, res.uri);
    } else if (res.kind === 'denied' || res.kind === 'failed') {
      setProblem(res.kind);
      setProblemSlot(slot);
    }
  };

  const camera = async (slot: 0 | 1) => handle(slot, await takePhoto(quality));
  const gallery = async (slot: 0 | 1) => handle(slot, await pickFromGallery(quality));

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.main}>
          {photos[0] ? (
            <Filled uri={photos[0]} label={slotLabel[0]} onRemove={() => set(0, null)} onRetake={() => camera(0)} />
          ) : (
            <Pressable
              testID="photo-main"
              accessibilityRole="button"
              accessibilityLabel={tr('صوّر المشكلة بالكاميرا', 'Take a photo of the problem')}
              accessibilityHint={tr('اضغط مطوّلًا لاختيار صورة من المعرض', 'Press and hold to choose a photo from your gallery')}
              onPress={() => camera(0)}
              onLongPress={() => gallery(0)}
              style={styles.emptyMain}
            >
              <View style={styles.cameraDisc}>
                <Icon name="camera" size={26} color={colors.onRed} />
              </View>
              <AppText variant="smallStrong">{tr('صوّر المشكلة', 'Photograph the problem')}</AppText>
              <Pressable accessibilityRole="button" accessibilityLabel={tr('اختار صورة من المعرض', 'Choose a photo from your gallery')} onPress={() => gallery(0)} hitSlop={8} style={styles.galleryLink}>
                <Icon name="image" size={16} color={colors.red} />
                <AppText variant="caption" color={colors.red} style={{ fontFamily: fonts.sans600 }}>{tr('أو من المعرض', 'or from gallery')}</AppText>
              </Pressable>
            </Pressable>
          )}
        </View>

        <View style={styles.side}>
          {photos[1] ? (
            <Filled uri={photos[1]} label={slotLabel[1]} compact onRemove={() => set(1, null)} onRetake={() => camera(1)} />
          ) : (
            <Pressable
              testID="photo-wide"
              accessibilityRole="button"
              accessibilityLabel={tr('صورة أوسع للمكان', 'A wider photo of the place')}
              accessibilityHint={tr('اضغط مطوّلًا لاختيار صورة من المعرض', 'Press and hold to choose a photo from your gallery')}
              onPress={() => camera(1)}
              onLongPress={() => gallery(1)}
              style={styles.emptySide}
            >
              <Icon name="plus" size={22} color={colors.red} />
              <AppText variant="caption" color={colors.red} center style={{ fontFamily: fonts.sans600 }}>{tr('صورة أوسع للمكان', 'A wider photo of the place')}</AppText>
            </Pressable>
          )}
        </View>
      </View>

      {problem ? (
        <View accessibilityRole="alert" style={styles.problem}>
          <AppText variant="small" color={colors.goldDeep}>
            {problem === 'denied'
              ? tr('محتاجين إذن الكاميرا عشان نصوّر من هنا. ممكن تسمح بيه من إعدادات الموبايل، أو تختار صورة من المعرض.', 'We need camera permission to take photos here. You can allow it in your phone settings, or choose a photo from your gallery.')
              : tr('مقدرناش نفتح الكاميرا على الجهاز ده. اختار صورة من المعرض، أو كمّل بوصف المشكلة.', "We couldn't open the camera on this device. Choose a photo from your gallery, or just describe the problem.")}
          </AppText>
          <Button label={tr('اختار من المعرض', 'Choose from gallery')} icon="image" size="sm" variant="secondary" onPress={() => gallery(problemSlot)} />
        </View>
      ) : null}
    </View>
  );
}

function Filled({ uri, label, compact, onRemove, onRetake }: { uri: string; label: string; compact?: boolean; onRemove: () => void; onRetake: () => void }) {
  const tr = useTr();
  return (
    <View style={styles.filled}>
      <Image source={{ uri }} accessibilityLabel={label} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <Pressable accessibilityRole="button" accessibilityLabel={tr(`صوّر ${label} تاني`, `Retake ${label}`)} onPress={onRetake} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.badge}>
        <AppText color={colors.onRed} style={styles.badgeText} numberOfLines={1}>{compact ? tr('صورة ٢', 'Photo 2') : label}</AppText>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={tr(`امسح ${label}`, `Remove ${label}`)} onPress={onRemove} hitSlop={10} style={styles.remove}>
        <Icon name="x" size={16} color={colors.onRed} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  row: { flexDirection: 'row', gap: 8, height: 150 },
  main: { flex: 2 },
  side: { flex: 1 },
  emptyMain: { flex: 1, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.red, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8 },
  cameraDisc: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  galleryLink: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32, paddingHorizontal: 8 },
  emptySide: { flex: 1, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.red, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8 },
  filled: { flex: 1, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.statusReceived },
  badge: { position: 'absolute', bottom: 8, start: 8, height: 24, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: 'rgba(22,22,22,0.72)', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.sans500, fontSize: 11, lineHeight: 16 },
  remove: { position: 'absolute', top: 8, end: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(22,22,22,0.72)', alignItems: 'center', justifyContent: 'center' },
  problem: { backgroundColor: colors.goldSoft, borderRadius: radius.md, padding: 12, gap: 8 },
});
