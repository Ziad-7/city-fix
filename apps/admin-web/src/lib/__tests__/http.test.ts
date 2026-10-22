import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, setApiToken, setUnauthorizedHandler, ApiError } from '../http';

describe('http client', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    setApiToken(null);
    setUnauthorizedHandler(null);
  });

  describe('200 OK with JSON', () => {
    it('should parse and return JSON response', async () => {
      const data = { id: '123', name: 'Test' };
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(data),
      });

      const result = await http<typeof data>('GET', '/test');
      expect(result).toEqual(data);
    });
  });

  describe('204 No Content', () => {
    it('should return undefined', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 204,
        text: async () => '',
      });

      const result = await http('GET', '/test');
      expect(result).toBeUndefined();
    });
  });

  describe('400 Bad Request', () => {
    it('should throw with detail message if present', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ detail: 'Invalid field' }),
      });

      await expect(http('GET', '/test')).rejects.toThrow('Invalid field');
    });

    it('should throw with generic message if no detail', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => '{}',
      });

      await expect(http('GET', '/test')).rejects.toThrow('حصلت مشكلة');
    });
  });

  describe('422 Unprocessable Entity', () => {
    it('should throw with generic message for array detail', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 422,
        text: async () => JSON.stringify({ detail: [{ loc: ['field'] }] }),
      });

      await expect(http('GET', '/test')).rejects.toThrow('حصلت مشكلة');
    });

    it('should use detail if it is a string', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 422,
        text: async () => JSON.stringify({ detail: 'String detail' }),
      });

      await expect(http('GET', '/test')).rejects.toThrow('String detail');
    });
  });

  describe('403 Forbidden', () => {
    it('should throw with "مش مسموح"', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => '{}',
      });

      await expect(http('GET', '/test')).rejects.toThrow('مش مسموح');
    });
  });

  describe('500 Server Error', () => {
    it('should throw with server message', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ detail: 'Internal error' }),
      });

      await expect(http('GET', '/test')).rejects.toThrow('السيرفر مش متاح');
    });
  });

  describe('401 Unauthorized', () => {
    it('should call handler and throw when token is present', async () => {
      const handler = vi.fn();
      setUnauthorizedHandler(handler);
      setApiToken('some-token');

      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => '{}',
      });

      await expect(http('GET', '/test')).rejects.toThrow(ApiError);
      expect(handler).toHaveBeenCalled();
    });

    it('should not call handler when no token', async () => {
      const handler = vi.fn();
      setUnauthorizedHandler(handler);
      setApiToken(null);

      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => '{}',
      });

      await expect(http('GET', '/test')).rejects.toThrow(ApiError);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Network error', () => {
    it('should throw with network message', async () => {
      fetchMock.mockRejectedValue(new Error('Network failed'));

      await expect(http('GET', '/test')).rejects.toThrow('مفيش اتصال بالنت');
    });
  });

  describe('Bearer token header', () => {
    it('should include Authorization header when token is set', async () => {
      setApiToken('test-token-123');
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '{"data":"test"}',
      });

      await http('GET', '/test');

      const callArgs = fetchMock.mock.calls[0];
      expect(callArgs[1].headers.Authorization).toBe('Bearer test-token-123');
    });

    it('should not include Authorization header when no token', async () => {
      setApiToken(null);
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '{"data":"test"}',
      });

      await http('GET', '/test');

      const callArgs = fetchMock.mock.calls[0];
      expect(callArgs[1].headers.Authorization).toBeUndefined();
    });
  });

  describe('Methods', () => {
    it('should support GET, POST, PATCH', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '{}',
      });

      await http('GET', '/test');
      expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: 'GET' }));

      await http('POST', '/test', { data: 1 });
      expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: 'POST' }));

      await http('PATCH', '/test', { data: 2 });
      expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: 'PATCH' }));
    });
  });

  describe('Accept-Language header', () => {
    it('should set Accept-Language to ar', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '{}',
      });

      await http('GET', '/test');

      const callArgs = fetchMock.mock.calls[0];
      expect(callArgs[1].headers['Accept-Language']).toBe('ar');
    });
  });
});
