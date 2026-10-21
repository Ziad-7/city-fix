import { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View, type RefreshControlProps, type StyleProp, type ViewStyle } from 'react-native';
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
  /**
   * Screens with text inputs: lifts the body and the fixed footer above the keyboard and scrolls a
   * focused field into view. `behavior="padding"` on both platforms: with Android's mandatory edge-to-edge
   * the Android window is not reliably resized for the keyboard, and React Native's padding maths
   * (frame bottom minus keyboard top) also works when it is, because the overlap is then zero.
   */
  avoidKeyboard?: boolean;
  testID?: string;
};

/** Just the host methods used for scroll-into-view (React Native's ref types are not exported by name). */
type Measurable = { measureLayout: (relativeTo: unknown, onSuccess: (x: number, y: number) => void, onFail: () => void) => void };
type ScrollHandle = { getInnerViewRef?: () => unknown; scrollTo: (o: { y: number; animated: boolean }) => void };
type ScrollIntoView = (node: Measurable | null) => void;
const ScrollIntoViewContext = createContext<ScrollIntoView | null>(null);

/** For inputs inside `<Screen avoidKeyboard>`: call with the field's wrapper when it gets focus. */
export const useScrollIntoView = (): ScrollIntoView | null => useContext(ScrollIntoViewContext);

/** Safe area + paper background + optional scroll + fixed header/footer. */
export function Screen({
  children, scroll = true, padded = true, footer, header, edges = ['top', 'bottom'], refreshControl, gap, contentStyle, background = colors.paper, avoidKeyboard, testID,
}: ScreenProps) {
  const scrollRef = useRef<ScrollHandle>(null);
  const body: StyleProp<ViewStyle> = [padded ? { paddingHorizontal: layout.gutter } : null, gap ? { gap } : null, contentStyle];

  const scrollIntoView = useCallback<ScrollIntoView>((node) => {
    const sv = scrollRef.current;
    const inner = sv?.getInnerViewRef?.();
    if (!node || !sv || !inner) return;
    // Wait for the keyboard animation to finish and the body to shrink, then bring the field near the top.
    setTimeout(() => {
      try {
        node.measureLayout(
          inner,
          (_x: number, y: number) => sv.scrollTo({ y: Math.max(0, y - 24), animated: true }),
          () => undefined,
        );
      } catch {
        // best effort: the field stays where it is
      }
    }, 300);
  }, []);

  const content = (
    <SafeAreaView testID={testID} edges={edges} style={[styles.root, { backgroundColor: background }]}>
      {header}
      {scroll ? (
        <ScrollView
          ref={scrollRef as never}
          style={styles.flex}
          contentContainerStyle={[styles.content, body]}
          refreshControl={refreshControl}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={avoidKeyboard ? 'on-drag' : undefined}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, body]}>{children}</View>
      )}
      {footer}
    </SafeAreaView>
  );

  const provided = useMemo(() => (avoidKeyboard ? scrollIntoView : null), [avoidKeyboard, scrollIntoView]);
  if (!avoidKeyboard) return content;
  return (
    <ScrollIntoViewContext.Provider value={provided}>
      <KeyboardAvoidingView style={[styles.flex, { backgroundColor: background }]} behavior="padding">
        {content}
      </KeyboardAvoidingView>
    </ScrollIntoViewContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingBottom: 24, flexGrow: 1 },
});
