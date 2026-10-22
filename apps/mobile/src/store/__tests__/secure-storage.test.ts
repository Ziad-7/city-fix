import * as SecureStore from 'expo-secure-store';
import { TOKEN_KEY, createSessionStorage } from '../secureSessionStorage';

const secure = () => (globalThis as unknown as { __secureStore: Map<string, string> }).__secureStore;
const session = (token: string | null, userId: string | null = 'u1') => JSON.stringify({ state: { userId, token }, version: 0 });

describe('session storage on native', () => {
  beforeEach(() => secure()?.clear());

  it('applies writes in order: a sign-out right after a sign-in leaves no token behind', async () => {
    const st = createSessionStorage(false);
    await Promise.all([st.setItem('s', session('tok')), st.setItem('s', session(null, null))]);
    expect(secure().has(TOKEN_KEY)).toBe(false);
  });

  it('only touches the Keystore when the token changes', async () => {
    const st = createSessionStorage(false);
    const set = jest.spyOn(SecureStore, 'setItemAsync');
    await st.setItem('s', session('tok'));
    await st.setItem('s', session('tok')); // e.g. a notice or a pref changed
    await st.setItem('s', session('tok'));
    expect(set).toHaveBeenCalledTimes(1);
    set.mockRestore();
  });

  it('does not resurrect a stale token for a signed-out session', async () => {
    const st = createSessionStorage(false);
    secure().set(TOKEN_KEY, 'old');
    await (st.setItem as (n: string, v: string) => Promise<void>)('x', session(null, null));
    secure().set(TOKEN_KEY, 'old'); // a failed delete left it there
    const raw = await st.getItem('x');
    expect(JSON.parse(raw as string).state.token).toBeNull();
  });
});
