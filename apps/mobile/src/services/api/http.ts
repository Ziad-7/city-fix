let token: string | null = null;

export const setApiToken = (t: string | null) => {
  token = t;
};

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Minimal typed JSON fetch against EXPO_PUBLIC_API_URL. */
export async function http<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  if (!API_URL) throw new Error('EXPO_PUBLIC_API_URL مش متحدد');
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Language': 'ar',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`);
  return (await res.json()) as T;
}
