describe('AI API request deadlines', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    fetchMock.mockReset();
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const createApiServices = () => {
    jest.resetModules();
    return jest.requireActual<typeof import('../api')>('../api').createApiServices();
  };

  const abortingFetch = (_url: string, options: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    });

  it.each([
    ['triage', 6000],
    ['transcription', 25000],
  ] as const)('%s aborts its request at %i ms', async (kind, timeoutMs) => {
    fetchMock.mockImplementation(abortingFetch);
    const services = createApiServices();
    const request =
      kind === 'triage'
        ? services.triage.analyze({ userId: 'citizen-1', description: 'حفرة في الشارع' })
        : services.transcription.transcribe('citizen-1/voice.m4a');
    const requestFailure = request.then(
      () => null,
      (error: unknown) => error,
    );
    const signal = (fetchMock.mock.calls[0][1] as RequestInit).signal;

    await jest.advanceTimersByTimeAsync(timeoutMs - 1);
    expect(signal?.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await expect(requestFailure).resolves.toMatchObject({ status: 0 });
    expect(signal?.aborted).toBe(true);
  });
});
