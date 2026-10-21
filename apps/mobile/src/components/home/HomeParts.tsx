import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { LogoLockup, Skyline } from '@/components/brand';
import { Icon } from '@/components/Icon';
import { AppText, Button, Card, InlineNotice, StatusChip, useTransientNotice } from '@/components/ui';
import { getCategory } from '@/domain/categories';
import type { IconName, Incident } from '@/domain/types';
import { isCriticalIncident } from '@/logic/priority';
import { colors, fonts, radius, shadows } from '@/theme/tokens';
import { formatDistanceAr } from '@/utils/geo';
import { neighboursAr } from '../report/text';

/** Logo at the start, notification bell at the end (notifications arrive later: the bell says so). */
export function HomeHeader() {
  const { notice, show } = useTransientNotice(3000);
  return (
    <View>
      <View style={styles.header}>
        <LogoLockup height={36} />
        <Pressable accessibilityRole="button" accessibilityLabel="الإشعارات" onPress={() => show('الإشعارات قريبًا. لحد ما تنزل، تابع طلباتك من تبويب طلباتي.')} style={styles.bell}>
          <Icon name="bell" size={22} />
        </Pressable>
      </View>
      {notice ? (
        <View style={styles.notice}>
          <InlineNotice text={notice} />
        </View>
      ) : null}
    </View>
  );
}

/** Ruqaa greeting in red + "القاهرة · حي ..." with a "غيّر" link to the profile tab. */
export function Greeting({ greeting, name, area }: { greeting: string; name: string | null; area: string }) {
  return (
    <View style={styles.greeting}>
      <AppText accessibilityRole="header" color={colors.red} style={styles.ruqaa}>
        {name ? `${greeting} يا ${name}` : greeting}
      </AppText>
      <View style={styles.areaRow}>
        <Icon name="pin" size={16} color={colors.inkMuted} />
        <AppText variant="small" color={colors.inkMuted}>{area}</AppText>
        <Pressable accessibilityRole="link" accessibilityLabel="غيّر المنطقة" onPress={() => router.navigate('/profile')} hitSlop={10} style={styles.change}>
          <AppText variant="smallStrong" color={colors.red} style={{ fontSize: 13 }}>غيّر</AppText>
        </Pressable>
      </View>
    </View>
  );
}

/** The red call-to-action card with the Cairo skyline along its bottom edge. */
export function HeroCard() {
  return (
    <View style={styles.hero}>
      <Skyline height={138} style={styles.skyline} />
      <AppText accessibilityRole="header" color={colors.onRed} style={styles.heroTitle}>شايف مشكلة في الشارع؟</AppText>
      <AppText variant="small" color={colors.redSoft} style={styles.heroBody}>صوّرها، وإحنا هنحدد نوعها ونوصّلها للجهة المسؤولة ونتابعها معاك.</AppText>
      <Button testID="home-report" label="بلّغ دلوقتي" icon="camera" variant="gold" onPress={() => router.push('/report/category')} style={styles.heroButton} />
    </View>
  );
}

export function SectionTitle({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionRow}>
      <AppText accessibilityRole="header" variant="h3" style={{ flex: 1 }}>{title}</AppText>
      {actionLabel ? (
        <Pressable accessibilityRole="link" onPress={onAction} hitSlop={10} style={styles.sectionAction}>
          <AppText variant="smallStrong" color={colors.red}>{actionLabel}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ServiceTile({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, shadows.card, pressed ? { opacity: 0.85 } : null]}
    >
      <View style={styles.tileIcon}>
        <Icon name={icon} size={22} color={colors.red} />
      </View>
      <AppText variant="caption" center style={styles.tileLabel}>{label}</AppText>
    </Pressable>
  );
}

/** One "حوالين بيتك" row with the "أنا كمان" follow button. */
export function NearbyCard({
  incident, distanceM, followed, busy, onFollow,
}: { incident: Incident; distanceM: number; followed: boolean; busy: boolean; onFollow: () => void }) {
  const cat = getCategory(incident.categoryId);
  return (
    <Card padding={12} style={styles.rowCard}>
      <View style={styles.nearIcon}>
        <Icon name={cat.icon} size={20} color={colors.redDeep} />
      </View>
      <View style={styles.rowText}>
        <AppText style={styles.rowTitle} numberOfLines={2}>{incident.title}</AppText>
        <AppText variant="caption" color={colors.inkMuted}>
          على بعد {formatDistanceAr(distanceM)} · {neighboursAr(incident.followers)}
        </AppText>
        {isCriticalIncident(incident) ? (
          <View style={styles.criticalChip}>
            <StatusChip status="critical" />
          </View>
        ) : null}
      </View>
      {followed ? (
        <View accessibilityLabel="متابَع" style={styles.followed}>
          <Icon name="check" size={16} color={colors.statusResolved} strokeWidth={2.5} />
          <AppText variant="smallStrong" color={colors.statusResolved} style={{ fontSize: 13 }}>متابَع</AppText>
        </View>
      ) : (
        <Button label="أنا كمان" size="sm" variant="secondary" loading={busy} onPress={onFollow} />
      )}
    </Card>
  );
}

export function SkeletonRow() {
  return (
    <View style={[styles.rowCard, styles.skeleton]}>
      <View style={styles.skeletonDot} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={[styles.skeletonLine, { width: '70%' }]} />
        <View style={[styles.skeletonLine, { width: '45%', height: 10 }]} />
      </View>
    </View>
  );
}

export function EmptyNote({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.empty}>
      <Icon name={icon} size={20} color={colors.inkMuted} />
      <AppText variant="small" color={colors.inkMuted} style={{ flex: 1 }}>{text}</AppText>
    </View>
  );
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View accessibilityRole="alert" style={styles.errorCard}>
      <Icon name="alert-triangle" size={22} color={colors.urgentDeep} />
      <AppText variant="smallStrong" color={colors.urgentDeep} center>{message}</AppText>
      <Button label="حاول تاني" icon="refresh" variant="secondary" size="sm" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  bell: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  notice: { marginHorizontal: 16, marginTop: 4 },
  greeting: { gap: 2 },
  ruqaa: { fontFamily: fonts.ruqaa, fontSize: 28, lineHeight: 42 },
  areaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  change: { minHeight: 32, justifyContent: 'center', marginStart: 4 },
  hero: { backgroundColor: colors.red, borderRadius: radius.lg, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 136, gap: 12, overflow: 'hidden' },
  skyline: { position: 'absolute', bottom: 0, start: 0, end: 0 },
  heroTitle: { fontFamily: fonts.display700, fontSize: 22, lineHeight: 32, maxWidth: 290 },
  heroBody: { maxWidth: 250 },
  heroButton: { alignSelf: 'flex-start', minHeight: 48, paddingHorizontal: 20 },
  sectionRow: { flexDirection: 'row', alignItems: 'center' },
  sectionAction: { minHeight: 44, justifyContent: 'center' },
  tile: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, paddingTop: 14, paddingBottom: 12, paddingHorizontal: 8, alignItems: 'center', gap: 8, minHeight: 100 },
  tileIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.redSoft, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontFamily: fonts.sans600, fontSize: 13, lineHeight: 20 },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontFamily: fonts.sans600, fontSize: 15, lineHeight: 24 },
  nearIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.redSoft, alignItems: 'center', justifyContent: 'center' },
  criticalChip: { alignSelf: 'flex-start', marginTop: 2 },
  followed: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.statusResolvedBg },
  skeleton: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 12 },
  skeletonDot: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.statusReceivedBg },
  skeletonLine: { height: 14, borderRadius: 7, backgroundColor: colors.statusReceivedBg },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.md, padding: 14 },
  errorCard: { alignItems: 'center', gap: 10, backgroundColor: colors.urgentSoft, borderRadius: radius.md, padding: 16 },
});
