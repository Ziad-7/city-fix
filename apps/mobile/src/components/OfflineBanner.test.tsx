import NetInfo from '@react-native-community/netinfo';
import { act, create } from 'react-test-renderer';
import { OfflineBanner } from './OfflineBanner';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

describe('OfflineBanner', () => {
  it('shows only while the phone is offline', async () => {
    let cb!: (s: unknown) => void;
    (NetInfo.addEventListener as unknown as jest.Mock).mockImplementation((fn) => {
      cb = fn;
      return jest.fn();
    });
    let r!: ReturnType<typeof create>;
    await act(async () => {
      r = create(<OfflineBanner />);
    });
    expect(r.root.findAllByProps({ testID: 'offline-banner' })).toHaveLength(0);
    await act(async () => cb({ isConnected: false, isInternetReachable: false }));
    expect(r.root.findAllByProps({ testID: 'offline-banner' }).length).toBeGreaterThan(0);
    await act(async () => cb({ isConnected: true, isInternetReachable: true }));
    expect(r.root.findAllByProps({ testID: 'offline-banner' })).toHaveLength(0);
  });
});
