import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Icon } from '@/components/Icon';
import { AppText, Button, TextField } from '@/components/ui';
import { getCategory } from '@/domain/categories';
import { STATUS_LABEL_AR, type AlreadyReported, type DuplicateMatch, type Place } from '@/domain/types';
import { colors, fonts, radius } from '@/theme/tokens';
import { formatDistanceAr } from '@/utils/geo';
import type { LocationState } from './location';
import { reportedByAr } from './text';

/** Three-segment progress under the header (step 2 of 3 is filled up to). */
export function StepBar({ step }: { step: 1 | 2 | 3 }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.stepBar}>
      {[1, 2, 3].map((n) => (
        <View key={n} style={[styles.seg, { backgroundColor: n <= step ? colors.red : colors.line }]} />
      ))}
    </View>
  );
}

/** Voice-note row. Recording is a stub: it says "قريبًا" and sends the citizen to the text box. */
export function VoiceRow({ highlight }: { highlight?: boolean }) {
  const [notice, setNotice] = useState(!!highlight);
  return (
    <View style={{ gap: 6 }}>
      <Pressable
        testID="voice-note"
        accessibilityRole="button"
        accessibilityLabel="سجّل فويس نوت"
        accessibilityHint="الميزة دي قريبًا"
        onPress={() => setNotice(true)}
        style={styles.voice}
      >
        <View style={styles.micDisc}>
          <Icon name="mic" size={20} color={colors.onRed} />
        </View>
        <AppText variant="smallStrong" style={{ flex: 1 }}>سجّل فويس نوت</AppText>
        <View style={styles.soon}>
          <AppText variant="caption" color={colors.goldDeep} style={{ fontFamily: fonts.sans600 }}>قريبًا</AppText>
        </View>
      </Pressable>
      {notice ? (
        <AppText accessibilityLiveRegion="polite" variant="caption" color={colors.goldDeep}>
          تسجيل الصوت قريبًا. دلوقتي اكتب وصف المشكلة بالعامية وإحنا نفهمها.
        </AppText>
      ) : null}
    </View>
  );
}

/** Static map placeholder (no react-native-maps here): roads, a pin, the address line and "تعديل". */
export function LocationCard({
  place, state, error, onEditAddress, onRetry,
}: { place: Place; state: LocationState; error?: string; onEditAddress: (a: string) => void; onRetry: () => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.locCard}>
        <Svg accessibilityLabel="خريطة: موقع البلاغ" width="100%" height={132} viewBox="0 0 356 132" preserveAspectRatio="xMidYMid slice" style={{ backgroundColor: colors.mapGround }}>
          <Path d="M0 44h356M0 98h356M88 0v132M210 0v132M300 0v132" stroke="#FFFFFF" strokeWidth={10} />
          <Path d="M0 70h356" stroke="#FFFFFF" strokeWidth={16} />
          <Rect x={226} y={8} width={60} height={26} rx={6} fill={colors.statusResolvedBg} />
          <Circle cx={178} cy={70} r={34} fill={colors.gold} fillOpacity={0.14} stroke={colors.gold} strokeDasharray="4 4" />
          <Path d="M178 38c-9 0-16 7-16 16 0 12 16 24 16 24s16-12 16-24c0-9-7-16-16-16z" fill={colors.red} />
          <Circle cx={178} cy={54} r={6} fill={colors.surface} />
        </Svg>
        {state === 'locating' ? (
          <View style={styles.locating}>
            <ActivityIndicator color={colors.red} />
            <AppText variant="caption">بنحدد موقعك...</AppText>
          </View>
        ) : null}
        <View style={styles.addressRow}>
          <Icon name="pin" size={20} color={colors.red} />
          <AppText testID="address-line" variant="small" style={{ flex: 1 }} numberOfLines={2}>{place.address || (state === 'locating' ? 'بنحدد العنوان…' : 'العنوان لسه مش مكتوب')}</AppText>
          <Pressable testID="address-edit" accessibilityRole="button" accessibilityLabel="تعديل العنوان" onPress={() => setEditing((v) => !v)} style={styles.edit}>
            <AppText variant="smallStrong" color={colors.red} style={{ fontSize: 13 }}>{editing ? 'تم' : 'تعديل'}</AppText>
          </Pressable>
        </View>
      </View>

      {state === 'fallback' ? (
        <View style={styles.fallback}>
          <Icon name="info" size={18} color={colors.goldDeep} />
          <AppText variant="caption" color={colors.goldDeep} style={{ flex: 1 }}>
            مقدرناش نحدد موقعك بدقة، فاخترنا وسط منطقتك. اكتب العنوان الصح تحت.
          </AppText>
          <Pressable accessibilityRole="button" accessibilityLabel="حدد موقعي تاني" onPress={onRetry} style={styles.retry}>
            <Icon name="locate" size={18} color={colors.goldDeep} />
          </Pressable>
        </View>
      ) : null}

      {editing || state === 'fallback' || error ? (
        <TextField testID="address-input" label="العنوان" value={place.address} onChangeText={onEditAddress} placeholder="اسم الشارع والحي" error={error} />
      ) : null}
    </View>
  );
}

/** Gold-bordered "ممكن تكون اتبلّغ عنها قبل كده" panel with join / dismiss actions. */
export function DuplicatePanel({
  match, busy, onJoin, onDismiss,
}: { match: DuplicateMatch; busy: boolean; onJoin: () => void; onDismiss: () => void }) {
  return (
    <View testID="duplicate-panel" accessibilityLabel="بلاغ مشابه" style={styles.dup}>
      <View style={styles.dupHead}>
        <View style={styles.dupIcon}>
          <Icon name="users" size={18} color={colors.goldDeep} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText style={{ fontFamily: fonts.sans700, fontSize: 15, lineHeight: 24 }}>ممكن تكون اتبلّغ عنها قبل كده</AppText>
          <AppText variant="small" color={colors.inkMuted}>
            {getCategory(match.categoryId).labelAr} على بعد {formatDistanceAr(match.distanceM)} · {reportedByAr(match.followers)} · {STATUS_LABEL_AR[match.status]}
          </AppText>
        </View>
      </View>
      <View style={styles.dupButtons}>
        <View style={{ flex: 1 }}>
          <Button testID="dup-join" label="نفس المشكلة، تابعها" variant="gold" loading={busy} onPress={onJoin} style={styles.dupBtn} />
        </View>
        <View style={{ flex: 1 }}>
          <Button testID="dup-dismiss" label="لأ، مشكلة تانية" variant="secondary" disabled={busy} onPress={onDismiss} style={[styles.dupBtn, { borderColor: colors.line, borderWidth: 1 }]} />
        </View>
      </View>
    </View>
  );
}

/** "البلاغ ده متسجّل باسمك بالفعل": the nearest same-category problem is the citizen's own report, so there is nothing to join. */
export function AlreadyReportedNote({ own, onOpen }: { own: AlreadyReported; onOpen: () => void }) {
  return (
    <View testID="already-reported" accessibilityLabel="البلاغ ده متسجّل باسمك بالفعل" style={styles.own}>
      <View style={styles.dupHead}>
        <View style={styles.ownIcon}>
          <Icon name="check" size={18} color={colors.statusResolved} strokeWidth={2.5} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText style={{ fontFamily: fonts.sans700, fontSize: 15, lineHeight: 24 }}>البلاغ ده متسجّل باسمك بالفعل</AppText>
          <AppText variant="small" color={colors.inkMuted}>
            {own.title} على بعد {formatDistanceAr(own.distanceM)}. مفيش داعي لبلاغ تاني، وتقدر تتابع بلاغك.
          </AppText>
        </View>
      </View>
      <Button testID="open-own-report" label="افتح بلاغك" variant="secondary" onPress={onOpen} style={styles.dupBtn} />
    </View>
  );
}

const styles = StyleSheet.create({
  own: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.statusResolved, borderRadius: radius.md, padding: 14, gap: 10 },
  ownIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.statusResolvedBg, alignItems: 'center', justifyContent: 'center' },
  stepBar: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingBottom: 14 },
  seg: { flex: 1, height: 4, borderRadius: 2 },
  voice: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 10, paddingVertical: 8, minHeight: 56 },
  micDisc: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  soon: { height: 24, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.goldSoft, justifyContent: 'center' },
  locCard: { backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  locating: { position: 'absolute', top: 8, start: 8, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingStart: 12, paddingEnd: 4, minHeight: 52 },
  edit: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  fallback: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.goldSoft, borderRadius: radius.sm, paddingStart: 12, paddingVertical: 6 },
  retry: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dup: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.gold, borderRadius: radius.md, padding: 14, gap: 10 },
  dupHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dupIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.goldSoft, alignItems: 'center', justifyContent: 'center' },
  dupButtons: { flexDirection: 'row', gap: 8 },
  dupBtn: { minHeight: 44, paddingHorizontal: 8, borderRadius: radius.md },
});
