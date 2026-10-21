import { services } from '@/services';
import { setUnauthorizedHandler } from '@/services/api/http';
import { useNotifications } from './useNotifications';
import { useReports } from './useReports';
import { useServiceRequests } from './useServiceRequests';
import { useSession } from './useSession';

export const SESSION_EXPIRED_MSG = 'الجلسة خلصت، سجّل دخول تاني.';

/** Loads reports, incidents and service requests (call once the user is signed in). */
export async function refreshAll(): Promise<void> {
  await Promise.all([useReports.getState().refresh(), useServiceRequests.getState().refresh()]);
}

export async function signOutAll(): Promise<void> {
  try {
    await services.auth.signOut();
  } finally {
    useReports.getState().reset();
    useNotifications.getState().reset();
    useServiceRequests.getState().reset();
    useSession.getState().clear();
  }
}

/** The API said 401: leave a short notice for the sign-in screen and sign out (the guard routes to /sign-in). */
let expiring = false;
export async function expireSession(): Promise<void> {
  if (expiring || !useSession.getState().userId) return;
  expiring = true;
  try {
    await signOutAll();
    useSession.getState().setNotice(SESSION_EXPIRED_MSG);
  } finally {
    expiring = false;
  }
}

setUnauthorizedHandler(() => void expireSession());
