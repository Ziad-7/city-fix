import { ScrollView, StyleSheet, View, type RefreshControlProps, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, layout } from '@/theme/tokens';

export type ScreenProps = {
  children: React.ReactNode;
  /** Scrollable body (default true). */
  scroll?: boolean;
  /** 16 px side gutter (default true). */
  padded?: boolean;
  /** Fixed footer outside the scroll area (primary action bar). */
  footer?: React.ReactNode;
  /** Fixed header above the scroll area (e.g. ScreenHeader). */
  header?: React.ReactNode;
  /** Safe-area edges to respect; tab screens pass ['top'] because the tab bar handles the bottom. */
  edges?: Edge[];
  refreshControl?: React.ReactElement<RefreshControlProps>;
  gap?: number;
  contentStyle?: StyleProp<ViewStyle>;
  background?: string;
  testID?: string;
};

/** Safe area + paper background + optional scroll + fixed header/footer. */
export function Screen({
  children, scroll = true, padded = true, footer, header, edges = ['top', 'bottom'], refreshControl, gap, contentStyle, background = colors.paper, testID,
}: ScreenProps) {
  const body: StyleProp<ViewStyle> = [padded ? { paddingHorizontal: layout.gutter } : null, gap ? { gap } : null, contentStyle];
  return (
    <SafeAreaView testID={testID} edges={edges} style={[styles.root, { backgroundColor: background }]}>
      {header}
      {scroll ? (
        <ScrollView style={styles.flex} contentContainerStyle={[styles.content, body]} refreshControl={refreshControl} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, body]}>{children}</View>
      )}
      {footer}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingBottom: 24, flexGrow: 1 },
});
