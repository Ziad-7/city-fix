const mockRes = (status: number, body = ''): Response =>
  ({ ok: status >= 200 && status < 300, status, text: async () => body }) as unknown as Response;

type Failure = { status: number; message: string };
const fail = async (p: Promise<unknown>) => (await p.then(() => null, (e: unknown) => e)) as Failure;

async function load() {
  jest.resetModules();
  process.env.EXPO_PUBLIC_API_URL = 'http://api.test/';
  return jest.requireActual<typeof import('../api/http')>('../api/http');
}

describe('http client', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
  });

  it('resolves undefined on 204 without reading a body (POST /auth/otp)', async () => {
    const { http } = await load();
    fetchMock.mockResolvedValue(mockRes(204));
    await expect(http('POST', '/auth/otp', { phone: '01012345678', channel: 'sms' })).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/auth/otp');
  });

  it('resolves undefined on an empty 200 body', async () => {
    const { http } = await load();
    fetchMock.mockResolvedValue(mockRes(200, ''));
    await expect(http('GET', '/x')).resolves.toBeUndefined();
  });

  it('parses a JSON body and sends the bearer token', async () => {
    const { http, setApiToken } = await load();
    setApiToken('tok');
    fetchMock.mockResolvedValue(mockRes(200, '[{"id":"INC-0001"}]'));
    await expect(http('GET', '/incidents')).resolves.toEqual([{ id: 'INC-0001' }]);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
    expect(fetchMock.mock.calls[0][1].headers['Accept-Language']).toBe('ar');
  });

  it('turns a 4xx into an ApiError carrying the contract detail', async () => {
    const { http, ApiError } = await load();
    fetchMock.mockResolvedValue(mockRes(404, '{"detail":"البلاغ مش موجود"}'));
    const err = await fail(http('GET', '/incidents/x'));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
    expect(err.message).toBe('البلاغ مش موجود');
  });

  it('never shows "HTTP 500" or validation arrays to citizens', async () => {
    const { http, MSG_SERVER, MSG_GENERIC } = await load();
    fetchMock.mockResolvedValueOnce(mockRes(500, 'boom'));
    expect((await fail(http('GET', '/x'))).message).toBe(MSG_SERVER);
    fetchMock.mockResolvedValueOnce(mockRes(422, '{"detail":[{"loc":["body"],"msg":"bad"}]}'));
    expect((await fail(http('GET', '/x'))).message).toBe(MSG_GENERIC);
  });

  it('maps a network failure to a friendly ApiError(0)', async () => {
    const { http, MSG_NETWORK } = await load();
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    const err = await fail(http('GET', '/x'));
    expect(err.status).toBe(0);
    expect(err.message).toBe(MSG_NETWORK);
  });

  it('401 with a token calls the unauthorized handler; without a token it does not', async () => {
    const { http, setApiToken, setUnauthorizedHandler } = await load();
    const handler = jest.fn();
    setUnauthorizedHandler(handler);
    fetchMock.mockResolvedValue(mockRes(401, '{"detail":"الجلسة خلصت"}'));

    const noToken = await fail(http('POST', '/auth/verify', {}));
    expect(noToken.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();

    setApiToken('tok');
    const withToken = await fail(http('GET', '/reports'));
    expect(withToken.status).toBe(401);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
