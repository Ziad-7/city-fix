export const MSG_GENERIC = 'حصلت مشكلة، جرّب تاني';
export const MSG_NETWORK = 'مفيش اتصال بالنت، جرّب تاني';
export const MSG_SERVER = 'السيرفر مش متاح دلوقتي، جرّب بعد شوية';
export const MSG_FORBIDDEN = 'مش مسموح';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const setApiToken = (t: string | null) => {
  token = t;
};

export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

/**
 * Extract citizen-safe message from error response.
 * The contract's { detail } string, else a friendly Arabic line.
 */
function messageFor(status: number, raw: string): string {
  if (status === 403) return MSG_FORBIDDEN;
  if (status >= 500) return MSG_SERVER;
  try {
    const body = JSON.parse(raw) as { detail?: unknown };
    // FastAPI 422 sends `detail` as an array: not for citizens.
    if (typeof body?.detail === 'string' && body.detail.trim()) return body.detail;
  } catch {
    // not JSON
  }
  return MSG_GENERIC;
}

/**
 * Minimal typed JSON fetch against NEXT_PUBLIC_API_URL.
 * GET/POST/PATCH with Bearer token, Accept-Language: ar, handle 204 as undefined.
 */
export async function http<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<T | undefined> {
  let res: Response;
  try {
    res = await fetch(`${apiUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Language': 'ar',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, MSG_NETWORK);
  }

  const raw = res.status === 204 ? '' : await res.text().catch(() => '');

  if (!res.ok) {
    // A 401 on a call that carried our token means the session is over.
    if (res.status === 401 && token) {
      onUnauthorized?.();
    }
    throw new ApiError(res.status, messageFor(res.status, raw));
  }

  if (!raw.trim()) return undefined as T;

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new ApiError(res.status, MSG_GENERIC);
  }
}
