import { ApiError } from './http';

/** GET by id: 404 (missing) or 403 (someone else's) means "not found" on the detail screen, not a load error with a retry. */
export async function orNull<T>(p: Promise<T | null>): Promise<T | null> {
  try {
    return (await p) ?? null;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) return null;
    throw e;
  }
}
