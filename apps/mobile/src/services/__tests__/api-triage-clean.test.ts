const mockRes = (body: unknown): Response =>
  ({ ok: true, status: 200, text: async () => JSON.stringify(body) }) as unknown as Response;

describe('API triage mapping', () => {
  it('cleans a raw severity word from the server summary', async () => {
    const fetchMock = jest.fn().mockResolvedValue(mockRes({
      options: [{ categoryId: 'open_manhole', confidence: 0.9 }],
      severity: 'high',
      summary: 'الغالب إنها "بالوعة مفتوحة" — high، وهتروح لـالصرف الصحي.',
      source: 'fallback',
    }));
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
    jest.resetModules();
    const s = jest.requireActual<typeof import('../api')>('../api').createApiServices();
    const out = await s.triage.analyze({ userId: 'u', description: 'بالوعة' } as never);
    expect(out.summary).toContain('خطورة عالية');
    expect(out.summary).not.toContain('high');
    expect(out.duplicates).toEqual([]);
  });
});
