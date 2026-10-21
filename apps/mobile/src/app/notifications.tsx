import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { StateMessage } from '@/components/requests';
import { AppText, Button, Screen, ScreenHeader, statusColor } from '@/components/ui';
import type { AppNotification } from '@/domain/types';
import { useTr } from '@/i18n';
import { useNotifications, useUnreadCount } from '@/store';
import { colors, fonts, radius } from '@/theme/tokens';
import { relativeTime } from '@/utils/time';

/** مركز الإشعارات: status changes on the citizen's reports and service requests, newest first. */
export default function NotificationsScreen() {
  const tr = useTr();
  const items = useNotifications((s) => s.items);
  const markRead = useNotifications((s) => s.markRead);
  const markAllRead = useNotifications((s) => s.markAllRead);
  const unread = useUnreadCount();

  const open = (n: AppNotification) => {
    markRead(n.id);
    router.push(`/requests/${n.entityId}`);
  };

  return (
    <Screen
      scroll={false}
      header={<ScreenHeader title={tr('الإشعارات', 'Notifications')} />}
    >
      {items.length === 0 ? (
        <StateMessage icon="bell" title={tr('مفيش إشعارات لسه', 'No notifications yet')} body={tr('هنبلّغك هنا أول ما حالة بلاغ أو طلب من بتوعك تتغيّر.', "We'll tell you here when one of your reports or requests changes.")} actionLabel={tr('طلباتي', 'My requests')} onAction={() => router.replace('/requests')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            unread > 0 ? (
              <Button testID="mark-all-read" label={tr('علّم الكل مقروء', 'Mark all as read')} icon="check" variant="secondary" size="sm" onPress={markAllRead} style={styles.markAll} />
            ) : null
          }
          renderItem={({ item }) => <Row n={item} onPress={() => open(item)} />}
        />
      )}
    </Screen>
  );
}

function Row({ n, onPress }: { n: AppNotification; onPress: () => void }) {
  const tr = useTr();
  return (
    <Pressable
      testID={`notification-${n.entityId}`}
      accessibilityRole="button"
      accessibilityLabel={`${n.read ? '' : `${tr('جديد', 'New')}. `}${n.title}. ${n.body}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, n.read ? null : styles.unread, pressed ? { opacity: 0.85 } : null]}
    >
      <View style={[styles.dot, { backgroundColor: n.read ? colors.line : statusColor(n.status) }]} />
      <View style={styles.text}>
        <AppText style={[styles.title, n.read ? null : { fontFamily: fonts.sans700 }]}>{n.title}</AppText>
        <AppText variant="small" color={colors.inkMuted}>{n.body}</AppText>
        <AppText variant="caption" color={colors.inkMuted}>{relativeTime(n.at)}</AppText>
      </View>
      <Icon name="chevron" size={18} color={colors.inkMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32, gap: 10 },
  markAll: { alignSelf: 'flex-start', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: colors.line },
  unread: { backgroundColor: colors.goldSoft, borderColor: colors.gold },
  dot: { width: 10, height: 10, borderRadius: 5 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: fonts.sans600, fontSize: 15, lineHeight: 24, color: colors.ink },
});
