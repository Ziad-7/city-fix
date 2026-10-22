const mockRes = (status: number, body = ''): Response =>
  ({ ok: status >= 200 && status < 300, status, text: async () => body }) as unknown as Response;

describe('API by-id reads', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
  });

  const api = () => {
    jest.resetModules();
    return jest.requireActual<typeof import('../api')>('../api').createApiServices();
  };

  it('a 404 or 403 is "not found" (null), so the detail screen says so instead of offering a retry', async () => {
    const s = api();
    fetchMock.mockResolvedValue(mockRes(404, '{"detail":"مش موجود"}'));
    await expect(s.incidents.getReport('u1', 'FTC-1')).resolves.toBeNull();
    await expect(s.incidents.getIncident('INC-1')).resolves.toBeNull();
    fetchMock.mockResolvedValue(mockRes(403, '{"detail":"x"}'));
    await expect(s.serviceRequests.get('SRV-1')).resolves.toBeNull();
  });

  it('other failures still reject (network, 5xx)', async () => {
    const s = api();
    fetchMock.mockResolvedValue(mockRes(503));
    await expect(s.incidents.getReport('u1', 'FTC-1')).rejects.toMatchObject({ status: 503 });
  });
});
