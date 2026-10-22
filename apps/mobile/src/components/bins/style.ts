import { BIN_CHIP_KIND, type BinDisplayState } from '@/domain/bins';
import { STATUS_COLORS } from '../ui/StatusChip';
import { tr } from '@/i18n';
import { localDigits } from '@/utils/digits';

/** Foreground and background per bin state (the same green / amber / red / grey language as status chips). */
export const binColors = (s: BinDisplayState): { fg: string; bg: string } => STATUS_COLORS[BIN_CHIP_KIND[s]];

/** "٨٥٪" in Arabic, "85%" in English. Reads the current language when called. */
export const pctText = (n: number): string => tr(`${localDigits(n)}٪`, `${n}%`);

/** "٣٧°م" / "37 °C". */
export const tempText = (c: number): string => tr(`${localDigits(Math.round(c))}° م`, `${Math.round(c)} °C`);

/** "٣٫٧ فولت" / "3.7 V" (one decimal). */
export const voltText = (v: number): string => {
  const s = v.toFixed(1);
  return tr(`${localDigits(s).replace('.', '٫')} فولت`, `${s} V`);
};
