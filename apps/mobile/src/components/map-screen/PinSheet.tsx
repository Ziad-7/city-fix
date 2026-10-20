import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { AppText, Button, StatusChip } from '@/components/ui';
import { getCategory } from '@/domain/categories';
import type { Incident } from '@/domain/types';
import { priorityReason } from '@/logic/priority';
import { colors, fonts, radius, shadows } from '@/theme/tokens';
import { toArabicDigits } from '@/utils/digits';
import { formatDistanceAr } from '@/utils/geo';
import { relativeTimeAr } from '@/utils/time';

type Props = {
  incident: Incident;
  distanceM: number;
  /** The user already follows this incident (own report or tapped "أنا كمان"). */
  following: boolean;
  followBusy?: boolean;
  /** Id of the user's own report linked to this incident, if any. */
  myReportId?: string;
  expanded: boolean;
  onFollow: () => void;
  onDetails: () => void;
  onClose: () => void;
};

/** Bottom card for the selected pin. */
export function PinSheet({ incident, distanceM, following, followBusy, myReportId, expanded, onFollow, onDetails, onClose }: Props) {
  const cat = getCategory(incident.categoryId);
  return (
    <View style={styles.sheet} testID="pin-sheet">
      <View style={styles.top}>
        <View style={styles.icon}>
          <Icon name={cat.icon} size={22} color={colors.red} />
        </View>
        <View style={styles.text}>
          <AppText style={styles.title} numberOfLines={2}>{incident.title}</AppText>
          <AppText variant="caption" color={colors.inkMuted}>{cat.labelAr}</AppText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="إغلاق" onPress={onClose} style={styles.close} hitSlop={6}>
          <Icon name="x" size={18} color={colors.inkMuted} />
        </Pressable>
      </View>

      <View style={styles.meta}>
        <StatusChip status={incident.status} />
        <View style={styles.metaItem}>
          <Icon name="users" size={16} color={colors.inkMuted} />
          <AppText variant="caption" color={colors.inkMuted}>{toArabicDigits(incident.followers)} متابع</AppText>
        </View>
        <View style={styles.metaItem}>
          <Icon name="pin" size={16} color={colors.inkMuted} />
          <AppText variant="caption" color={colors.inkMuted}>{formatDistanceAr(distanceM)} من منطقتك</AppText>
        </View>
      </View>

      {expanded && !myReportId ? (
        <View style={styles.details}>
          <Row label="الجهة المسؤولة" value={incident.department} />
          <Row label="الأولوية" value={priorityReason(incident.priority, incident.linkedReportIds.length, incident.sensitivePlace)} />
          <Row label="المكان" value={incident.location.address} />
          <Row label="آخر تحديث" value={relativeTimeAr(incident.updatedAt)} />
        </View>
      ) : null}

      <View style={styles.actions}>
        <View style={styles.action}>
          <Button
            label={following ? 'بتتابعه' : 'أنا كمان'}
            icon={following ? 'check' : 'plus'}
            size="sm"
            fullWidth
            variant={following ? 'secondary' : 'primary'}
            disabled={following}
            loading={followBusy}
            onPress={onFollow}
            testID="pin-follow"
          />
        </View>
        <View style={styles.action}>
          <Button label={expanded && !myReportId ? 'إخفاء التفاصيل' : 'التفاصيل'} size="sm" fullWidth variant="secondary" onPress={onDetails} testID="pin-details" />
        </View>
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText variant="caption" color={colors.inkMuted} style={styles.rowLabel}>{label}</AppText>
      <AppText variant="caption" style={styles.rowValue}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 10, ...shadows.float },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.redSoft, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.sans600, fontSize: 15, lineHeight: 24, color: colors.ink },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  details: { backgroundColor: colors.paper, borderRadius: radius.sm, padding: 10, gap: 4 },
  row: { flexDirection: 'row', gap: 8 },
  rowLabel: { width: 88 },
  rowValue: { flex: 1, fontFamily: fonts.sans600 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
});
