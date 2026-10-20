import { Children } from 'react';
import { StyleSheet, View } from 'react-native';

/** Three equal columns with a 10 px gap; the last row is padded so tiles keep their width. */
export function Grid3({ children }: { children: React.ReactNode }) {
  const items = Children.toArray(children);
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < items.length; i += 3) rows.push(items.slice(i, i + 3));
  return (
    <View style={styles.grid}>
      {rows.map((row, r) => (
        <View key={r} style={styles.row}>
          {row}
          {Array.from({ length: 3 - row.length }, (_, k) => <View key={`pad-${k}`} style={styles.cell} />)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  cell: { flex: 1 },
});
