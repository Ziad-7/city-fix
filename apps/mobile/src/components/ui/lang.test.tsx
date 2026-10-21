import { StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';
import { setLang } from '@/i18n';
import { fonts } from '@/theme/tokens';
import { TABS } from '../TabBar';
import { AppText } from './AppText';

const fontOf = async (variant: 'slogan' | 'body') => {
  let r!: ReturnType<typeof create>;
  await act(async () => {
    r = create(<AppText variant={variant}>x</AppText>);
  });
  return StyleSheet.flatten(r.root.findByType(Text).props.style).fontFamily;
};

describe('AppText slogan font', () => {
  afterEach(async () => {
    await act(async () => setLang('ar'));
  });
  it('uses Aref Ruqaa in Arabic and the display font in English', async () => {
    expect(await fontOf('slogan')).toBe(fonts.ruqaa);
    await act(async () => setLang('en'));
    expect(await fontOf('slogan')).toBe(fonts.display700);
  });
});

describe('tab labels', () => {
  it('have English names', () => {
    expect(Object.values(TABS).map((t) => t.en)).toEqual(['Home', 'Map', 'My requests', 'Account']);
  });
});
