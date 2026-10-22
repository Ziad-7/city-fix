import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText, Chip } from '@/components/ui';
import { CATEGORIES } from '@/domain/categories';
import type { CategoryId } from '@/domain/types';
import { useTr } from '@/i18n';
import { labelOfCategory } from '@/i18n/labels';
import { colors, fonts } from '@/theme/tokens';
import { Legend } from './Legend';
import { MAP_STATUS_FILTERS, type MapStatusFilter } from './filters';

type Props = {
  status: MapStatusFilter;
  onStatus: (s: MapStatusFilter) => void;
  category: CategoryId | 'all';
  onCategory: (c: CategoryId | 'all') => void;
  /** Layer toggle shown under the title. */
  layerToggle?: React.ReactNode;
};

/** Title + status chips + category chips + legend above the map. */
export function TopBar({ status, onStatus, category, onCategory, layerToggle }: Props) {
  const tr = useTr();
  return (
    <View style={styles.bar}>
      <AppText accessibilityRole="header" style={styles.title}>{tr('الخريطة', 'Map')}</AppText>
      {layerToggle}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="tablist">
        {MAP_STATUS_FILTERS.map((f) => (
          <Chip key={f.id} label={tr(f.labelAr, f.labelEn)} selected={status === f.id} onPress={() => onStatus(f.id)} testID={`map-status-${f.id}`} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label={tr('كل الأنواع', 'All types')} selected={category === 'all'} onPress={() => onCategory('all')} testID="map-cat-all" />
        {CATEGORIES.map((c) => (
          <Chip key={c.id} label={labelOfCategory(c)} icon={c.icon} selected={category === c.id} onPress={() => onCategory(c.id)} testID={`map-cat-${c.id}`} />
        ))}
      </ScrollView>
      <Legend active={status} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.paper, borderBottomWidth: 1, borderBottomColor: colors.line },
  title: { fontFamily: fonts.display700, fontSize: 20, lineHeight: 30, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, color: colors.ink },
  chips: { paddingHorizontal: 16, paddingVertical: 4, gap: 8 },
});
