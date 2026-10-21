import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { LocationPicker } from './LocationPicker';
import { AppText, Button, TextField } from '@/components/ui';
import { getCategory } from '@/domain/categories';
import { labelOfCategory, statusLabel, useTr } from '@/i18n';
import { STATUS_LABEL_AR, type AlreadyReported, type DuplicateMatch, type Place } from '@/domain/types';
import { colors, fonts, radius } from '@/theme/tokens';
import type { LocationState } from './location';
import { distanceLabel, reportedBy } from './text';

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

/** Map pin picker (native) or static preview (web), the address line and "تعديل". */
export function LocationCard({
  place, state, error, onEditAddress, onRetry, onMove,
}: { place: Place; state: LocationState; error?: string; onEditAddress: (a: string) => void; onRetry: () => void; onMove: (lat: number, lng: number) => void }) {
  const tr = useTr();
  const [editing, setEditing] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.locCard}>
        <LocationPicker lat={place.lat} lng={place.lng} onMove={onMove} />
        {state === 'locating' ? (
          <View style={styles.locating}>
            <ActivityIndicator color={colors.red} />
            <AppText variant="caption">{tr('بنحدد موقعك...', 'Finding your location...')}</AppText>
          </View>
        ) : null}
        <View style={styles.addressRow}>
          <Icon name="pin" size={20} color={colors.red} />
          <AppText testID="address-line" variant="small" style={{ flex: 1 }} numberOfLines={2}>{place.address || (state === 'locating' ? tr('بنحدد العنوان…', 'Finding the address…') : tr('العنوان لسه مش مكتوب', 'No address yet'))}</AppText>
          <Pressable testID="address-edit" accessibilityRole="button" accessibilityLabel={tr('تعديل العنوان', 'Edit the address')} onPress={() => setEditing((v) => !v)} style={styles.edit}>
            <AppText variant="smallStrong" color={colors.red} style={{ fontSize: 13 }}>{editing ? tr('تم', 'Done') : tr('تعديل', 'Edit')}</AppText>
          </Pressable>
        </View>
      </View>

      <Button testID="use-my-location" label={tr('استخدم موقعي', 'Use my location')} icon="locate" variant="secondary" size="sm" loading={state === 'locating'} onPress={onRetry} />

      {state === 'fallback' ? (
        <View style={styles.fallback}>
          <Icon name="info" size={18} color={colors.goldDeep} />
          <AppText variant="caption" color={colors.goldDeep} style={{ flex: 1 }}>
            {tr('مقدرناش نحدد موقعك بدقة، فاخترنا وسط منطقتك. اكتب العنوان الصح تحت.', "We couldn't pinpoint your location, so we picked the centre of your area. Enter the right address below.")}
          </AppText>
          <Pressable accessibilityRole="button" accessibilityLabel={tr('حدد موقعي تاني', 'Find my location again')} onPress={onRetry} style={styles.retry}>
            <Icon name="locate" size={18} color={colors.goldDeep} />
          </Pressable>
        </View>
      ) : null}

      {editing || state === 'fallback' || error ? (
        <TextField testID="address-input" label={tr('العنوان', 'Address')} value={place.address} onChangeText={onEditAddress} placeholder={tr('اسم الشارع والحي', 'Street and district')} error={error} />
      ) : null}
    </View>
  );
}

/** Gold-bordered "ممكن تكون اتبلّغ عنها قبل كده" panel with join / dismiss actions. */
export function DuplicatePanel({
  match, busy, onJoin, onDismiss,
}: { match: DuplicateMatch; busy: boolean; onJoin: () => void; onDismiss: () => void }) {
  const tr = useTr();
  return (
    <View testID="duplicate-panel" accessibilityLabel={tr('بلاغ مشابه', 'Similar report')} style={styles.dup}>
      <View style={styles.dupHead}>
        <View style={styles.dupIcon}>
          <Icon name="users" size={18} color={colors.goldDeep} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText style={{ fontFamily: fonts.sans700, fontSize: 15, lineHeight: 24 }}>{tr('ممكن تكون اتبلّغ عنها قبل كده', 'This may already be reported')}</AppText>
          <AppText variant="small" color={colors.inkMuted}>
            {tr(
              `${getCategory(match.categoryId).labelAr} على بعد ${distanceLabel(match.distanceM)}`,
              `${labelOfCategory(getCategory(match.categoryId))}, ${distanceLabel(match.distanceM)} away`,
            )} · {reportedBy(match.followers)} · {statusLabel(match.status, STATUS_LABEL_AR[match.status])}
          </AppText>
        </View>
      </View>
      <View style={styles.dupButtons}>
        <View style={{ flex: 1 }}>
          <Button testID="dup-join" label={tr('نفس المشكلة، تابعها', 'Same problem — follow it')} variant="gold" loading={busy} onPress={onJoin} style={styles.dupBtn} />
        </View>
        <View style={{ flex: 1 }}>
          <Button testID="dup-dismiss" label={tr('لأ، مشكلة تانية', 'No, a different problem')} variant="secondary" disabled={busy} onPress={onDismiss} style={[styles.dupBtn, { borderColor: colors.line, borderWidth: 1 }]} />
        </View>
      </View>
    </View>
  );
}

/** "البلاغ ده متسجّل باسمك بالفعل": the nearest same-category problem is the citizen's own report, so there is nothing to join. */
export function AlreadyReportedNote({ own, onOpen }: { own: AlreadyReported; onOpen: () => void }) {
  const tr = useTr();
  return (
    <View testID="already-reported" accessibilityLabel={tr('البلاغ ده متسجّل باسمك بالفعل', "You've already reported this")} style={styles.own}>
      <View style={styles.dupHead}>
        <View style={styles.ownIcon}>
          <Icon name="check" size={18} color={colors.statusResolved} strokeWidth={2.5} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText style={{ fontFamily: fonts.sans700, fontSize: 15, lineHeight: 24 }}>{tr('البلاغ ده متسجّل باسمك بالفعل', "You've already reported this")}</AppText>
          <AppText variant="small" color={colors.inkMuted}>
            {tr(
              `${own.title} على بعد ${distanceLabel(own.distanceM)}. مفيش داعي لبلاغ تاني، وتقدر تتابع بلاغك.`,
              `${own.title}, ${distanceLabel(own.distanceM)} away. No need to report it again. You can follow your report.`,
            )}
          </AppText>
        </View>
      </View>
      <Button testID="open-own-report" label={tr('افتح بلاغك', 'Open your report')} variant="secondary" onPress={onOpen} style={styles.dupBtn} />
    </View>
  );
}

const styles = StyleSheet.create({
  own: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.statusResolved, borderRadius: radius.md, padding: 14, gap: 10 },
  ownIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.statusResolvedBg, alignItems: 'center', justifyContent: 'center' },
  stepBar: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingBottom: 14 },
  seg: { flex: 1, height: 4, borderRadius: 2 },
  locCard: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
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
