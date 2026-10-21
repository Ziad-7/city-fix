import { create } from 'zustand';
import type { NewServiceRequestInput, ServiceRequest } from '@/domain/types';
import { services } from '@/services';
import { useSession } from './useSession';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

type ServiceRequestsState = {
  status: LoadStatus;
  error: string | null;
  requests: ServiceRequest[];
  refresh: () => Promise<void>;
  bookService: (input: NewServiceRequestInput) => Promise<ServiceRequest>;
  /** Dev only. */
  simulateProgress: (id: string) => Promise<void>;
  reset: () => void;
};

const uid = () => {
  const id = useSession.getState().userId;
  if (!id) throw new Error('لازم تسجّل دخول الأول');
  return id;
};

export const useServiceRequests = create<ServiceRequestsState>((set, get) => ({
  status: 'idle',
  error: null,
  requests: [],

  async refresh() {
    set({ status: get().status === 'ready' ? 'ready' : 'loading', error: null });
    try {
      set({ requests: await services.serviceRequests.listMine(uid()), status: 'ready' });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : 'حصلت مشكلة، جرّب تاني' });
    }
  },

  async bookService(input) {
    const userId = uid();
    const req = await services.serviceRequests.book(userId, input);
    set((s) => ({ requests: [req, ...s.requests] }));
    return req;
  },

  async simulateProgress(id) {
    const req = await services.serviceRequests.simulateProgress(id);
    set((s) => ({ requests: s.requests.map((r) => (r.id === id ? req : r)) }));
  },

  reset: () => set({ status: 'idle', error: null, requests: [] }),
}));
