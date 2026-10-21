import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { AppText, Button } from '@/components/ui';
import type { CatalogService } from '@/domain/services-catalog';
import { serviceSubtitle, serviceTitle, useTr } from '@/i18n';
import { colors, fonts, radius, shadows } from '@/theme/tokens';

type Props = {
  service: CatalogService;
  onPress: () => void;
  /** Inline notice shown under a service that is not available yet. */
  notice?: string;
};

/** Catalog row: icon, title, department + turnaround, chevron; "قريبًا" for services without a flow. */
export function ServiceCard({ service, onPress, notice }: Props) {
  const tr = useTr();
  const available = !!service.route;
  const title = serviceTitle(service);
  const subtitle = serviceSubtitle(service);
  return (
    <View style={[styles.card, available ? styles.featured : null]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={available ? `${title}${tr('، ', ', ')}${subtitle}` : `${title}${tr('، ', ', ')}${tr('قريبًا', 'Coming soon')}`}
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
        testID={`service-${service.id}`}
      >
        <View style={[styles.icon, available ? styles.iconBig : null]}>
          <Icon name={service.icon} size={available ? 24 : 20} color={colors.red} />
        </View>
        <View style={styles.text}>
          <AppText style={available ? styles.titleBig : styles.title}>{title}</AppText>
          <AppText variant="caption" color={colors.inkMuted}>{subtitle}</AppText>
        </View>
        {available ? null : (
          <View style={styles.badge}>
            <AppText variant="caption" color={colors.goldDeep} style={{ fontFamily: fonts.sans600 }}>{tr('قريبًا', 'Coming soon')}</AppText>
          </View>
        )}
        <Icon name="chevron" size={18} color={colors.inkMuted} />
      </Pressable>
      {available ? (
        // The schedule is not a booking: English says so (the Arabic label is unchanged, see the 2026-10-21 review).
        <Button label={tr('احجز دلوقتي', service.serviceType ? 'Book now' : 'See the times')} icon="calendar" onPress={onPress} />
      ) : null}
      {notice ? (
        <View style={styles.notice} accessibilityLiveRegion="polite">
          <Icon name="info" size={16} color={colors.goldDeep} />
          <AppText variant="caption" color={colors.goldDeep} style={styles.noticeText}>{notice}</AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, gap: 10, ...shadows.card },
  featured: { borderRadius: radius.lg, padding: 16, gap: 14, borderWidth: 2, borderColor: colors.red },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  pressed: { opacity: 0.8 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.redSoft, alignItems: 'center', justifyContent: 'center' },
  iconBig: { width: 48, height: 48, borderRadius: 24 },
  text: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.sans600, fontSize: 15, lineHeight: 24, color: colors.ink },
  titleBig: { fontFamily: fonts.display600, fontSize: 17, lineHeight: 26, color: colors.ink },
  badge: { backgroundColor: colors.goldSoft, borderRadius: radius.pill, height: 24, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.goldSoft, borderRadius: radius.sm, padding: 10 },
  noticeText: { flex: 1 },
});
