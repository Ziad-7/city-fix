import { getLang, tr } from '@/i18n';

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const setApiToken = (t: string | null) => {
  token = t;
};

/** Called when an authenticated request comes back 401 (expired or revoked token). */
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export const MSG_GENERIC = 'حصلت مشكلة، جرّب تاني';
export const MSG_NETWORK = 'مفيش اتصال بالنت، جرّب تاني';
export const MSG_SERVER = 'السيرفر مش متاح دلوقتي، جرّب بعد شوية';

const msgGeneric = () => tr(MSG_GENERIC, 'Something went wrong. Try again');
const msgNetwork = () => tr(MSG_NETWORK, 'No internet connection. Try again');
const msgServer = () => tr(MSG_SERVER, "The server isn't available right now. Try again in a bit");

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Citizen-safe message from an error response: the contract's `{ detail }`, else a friendly Arabic line. */
function messageFor(status: number, raw: string): string {
  if (status >= 500) return msgServer();
  try {
    const body = JSON.parse(raw) as { detail?: unknown };
    // FastAPI 422 sends `detail` as an array of validation objects: not for citizens.
    if (typeof body?.detail === 'string' && body.detail.trim()) return body.detail;
  } catch {
    // not JSON
  }
  return msgGeneric();
}

/** `headers` are extra request headers, e.g. `Idempotency-Key` on POSTs that create something. */
export type HttpOptions = { timeoutMs?: number; headers?: Record<string, string> };

/** Minimal typed JSON fetch against NEXT_PUBLIC_API_URL. Empty bodies (204) resolve to `undefined`. */
export async function http<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  options: HttpOptions = {},
): Promise<T> {
  if (!API_URL) throw new Error(tr('NEXT_PUBLIC_API_URL مش متحدد', 'NEXT_PUBLIC_API_URL is not set'));
  const controller = options.timeoutMs ? new AbortController() : undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const request = async (): Promise<T> => {
    let res: Response;
    try {
      res = await fetch(`${API_URL}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(options.headers ?? {}),
          'Accept-Language': getLang(),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        ...(controller ? { signal: controller.signal } : {}),
      });
    } catch {
      throw new ApiError(0, controller?.signal.aborted ? msgServer() : msgNetwork());
    }

    let raw = '';
    if (res.status !== 204) {
      try {
        raw = await res.text();
      } catch {
        if (controller?.signal.aborted) throw new ApiError(0, msgServer());
      }
    }
    if (!res.ok) {
      // A 401 on a call that carried our token means the session is over. (Without a token, e.g. a wrong
      // OTP on /auth/verify, it is just an error for the form to show.)
      if (res.status === 401 && token) onUnauthorized?.();
      throw new ApiError(res.status, messageFor(res.status, raw));
    }
    if (!raw.trim()) return undefined as T;
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new ApiError(res.status, msgGeneric());
    }
  };

  if (!controller || !options.timeoutMs) return request();
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new ApiError(0, msgServer()));
    }, options.timeoutMs);
  });
  try {
    return await Promise.race([request(), deadline]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}
