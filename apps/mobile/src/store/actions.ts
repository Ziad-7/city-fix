import { services } from '@/services';
import { useReports } from './useReports';
import { useServiceRequests } from './useServiceRequests';
import { useSession } from './useSession';

/** Loads reports, incidents and service requests (call once the user is signed in). */
export async function refreshAll(): Promise<void> {
  await Promise.all([useReports.getState().refresh(), useServiceRequests.getState().refresh()]);
}

export async function signOutAll(): Promise<void> {
  try {
    await services.auth.signOut();
  } finally {
    useReports.getState().reset();
    useServiceRequests.getState().reset();
    useSession.getState().clear();
  }
}
