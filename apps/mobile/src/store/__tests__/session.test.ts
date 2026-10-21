const mockRes = (status: number, body = ''): Response =>
  ({ ok: status >= 200 && status < 300, status, text: async () => body }) as unknown as Response;

type AsyncStore = typeof import('@react-native-async-storage/async-storage').default;

async function boot() {
  jest.resetModules();
  process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
  const http = jest.requireActual<typeof import('@/services/api/http')>('@/services/api/http');
  const store = jest.requireActual<typeof import('@/store')>('@/store');
  const mod = jest.requireMock<{ default?: AsyncStore } & AsyncStore>('@react-native-async-storage/async-storage');
  const AsyncStorage = mod.default ?? mod;
  return { http, AsyncStorage, ...store };
}

describe('session token', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
  });

  it('is persisted with the session and handed to the http client', async () => {
    const { http, useSession, AsyncStorage } = await boot();
    useSession.getState().startSession({ userId: 'u1', phone: '01012345678', token: 'tok-1' });
    fetchMock.mockResolvedValue(mockRes(200, '[]'));
    await http.http('GET', '/reports');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok-1');
    await new Promise((r) => setTimeout(r, 0));
    expect(await AsyncStorage.getItem('ftc.session.v1')).toContain('tok-1');
  });

  it('is restored on hydration after an app restart (no more tokenless 401s)', async () => {
    const first = await boot();
    first.useSession.getState().startSession({ userId: 'u1', phone: '01012345678', token: 'tok-2' });
    await new Promise((r) => setTimeout(r, 0));

    const saved = await first.AsyncStorage.getItem('ftc.session.v1');
    expect(saved).toContain('tok-2');

    const { http, useSession, AsyncStorage } = await boot(); // fresh modules = a new app process
    await AsyncStorage.setItem('ftc.session.v1', saved as string); // the disk survives the restart
    expect(useSession.getState().token).toBeNull();
    await useSession.persist.rehydrate();
    expect(useSession.getState().token).toBe('tok-2');
    fetchMock.mockResolvedValue(mockRes(200, '[]'));
    await http.http('GET', '/reports');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok-2');
  });

  it('a 401 signs the user out and leaves the Arabic notice for the sign-in screen', async () => {
    const { http, useSession, SESSION_EXPIRED_MSG } = await boot();
    useSession.getState().startSession({ userId: 'u1', phone: '01012345678', token: 'old' });
    fetchMock.mockResolvedValue(mockRes(401, '{"detail":"x"}'));
    await expect(http.http('GET', '/reports')).rejects.toMatchObject({ status: 401 });
    await new Promise((r) => setTimeout(r, 10));
    const s = useSession.getState();
    expect(s.userId).toBeNull();
    expect(s.token).toBeNull();
    expect(s.notice).toBe(SESSION_EXPIRED_MSG);
    // the next call no longer carries the dead token
    fetchMock.mockResolvedValue(mockRes(200, '[]'));
    await http.http('GET', '/incidents');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBeUndefined();
  });

  it('starting a new session clears the notice', async () => {
    const { useSession } = await boot();
    useSession.getState().setNotice('x');
    useSession.getState().startSession({ userId: 'u2', phone: '01012345678' });
    expect(useSession.getState().notice).toBeNull();
  });
});
