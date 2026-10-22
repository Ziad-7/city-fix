import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StateMessage } from '@/components/requests';
import { SearchField, ServiceCard, filterServices } from '@/components/services';
import { AppText, Chip, Screen, ScreenHeader } from '@/components/ui';
import { serviceGroupLabel, useTr } from '@/i18n';
import { SERVICES, SERVICE_GROUPS, type ServiceGroup } from '@/domain/services-catalog';
import { colors, fonts } from '@/theme/tokens';

/** CityServe: catalog of city services. Only bulky-waste booking exists so far. */
export default function ServicesScreen() {
  const tr = useTr();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<ServiceGroup | 'all'>('all');
  const [noticeFor, setNoticeFor] = useState<string | null>(null);

  const visible = filterServices(SERVICES, query, group);
  const featured = visible.filter((s) => s.route);
  const others = visible.filter((s) => !s.route);

  const open = (id: string) => {
    const s = SERVICES.find((x) => x.id === id);
    if (s?.route) {
      setNoticeFor(null);
      router.push(s.route);
    } else {
      setNoticeFor(id);
    }
  };

  return (
    <Screen header={<ScreenHeader title={tr('خدمات المدينة', 'City services')} />} gap={14} contentStyle={styles.content}>
      <SearchField value={query} onChangeText={setQuery} />
      <View style={styles.chips} accessibilityRole="tablist">
        {SERVICE_GROUPS.map((g) => (
          <Chip key={g.id} label={serviceGroupLabel(g)} selected={group === g.id} onPress={() => setGroup(g.id)} />
        ))}
      </View>

      {visible.length === 0 ? (
        <StateMessage icon="search" title={tr('مفيش خدمة بالاسم ده', 'No service with that name')} body={tr('جرّب كلمة تانية أو اختار الكل.', 'Try another word, or pick All.')} />
      ) : null}

      {featured.map((s) => (
        <ServiceCard key={s.id} service={s} onPress={() => open(s.id)} />
      ))}

      {others.length > 0 ? (
        <View style={styles.others}>
          <AppText variant="bodyStrong" style={styles.sectionTitle} accessibilityRole="header">
            {featured.length > 0 ? tr('خدمات تانية', 'Other services') : tr('الخدمات', 'Services')}
          </AppText>
          {others.map((s) => (
            <ServiceCard
              key={s.id}
              service={s}
              onPress={() => open(s.id)}
              notice={noticeFor === s.id ? tr('الخدمة دي لسه مش متاحة في التطبيق. هنبلّغك أول ما تتفعّل.', 'This service isn’t in the app yet. We’ll let you know as soon as it is.') : undefined}
            />
          ))}
        </View>
      ) : null}

      <AppText variant="caption" color={colors.inkMuted}>
        {tr('الرسوم بتتحدد حسب لائحة كل حي.', 'Fees follow each district’s rates.')}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 4, paddingBottom: 32 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  others: { gap: 8 },
  sectionTitle: { fontFamily: fonts.display600, fontSize: 16, lineHeight: 24 },
});
