import { create } from 'zustand';
import type { Impact, MaterialPrice, NewRecyclingPickupInput, RecyclingPickup } from '@/domain/citycycle';
import { tr } from '@/i18n';
import { services } from '@/services';
import { useSession } from './useSession';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

type RecyclingState = {
  status: LoadStatus;
  error: string | null;
  /** My pickups, newest first. */
  pickups: RecyclingPickup[];
  /** The district price list (null price = not set yet). */
  prices: MaterialPrice[];
  pricesStatus: LoadStatus;
  impact: Impact | null;
  impactStatus: LoadStatus;
  refresh: () => Promise<void>;
  loadPrices: () => Promise<void>;
  /** Pass the same `idempotencyKey` when retrying the same request after a failure. */
  createPickup: (input: NewRecyclingPickupInput, idempotencyKey?: string) => Promise<RecyclingPickup>;
  /** Deep link / uncached id: fetches one pickup. Resolves false when it does not exist. */
  loadPickup: (id: string) => Promise<boolean>;
  cancelPickup: (id: string, note?: string) => Promise<void>;
  confirmPickup: (id: string) => Promise<void>;
  loadImpact: () => Promise<void>;
  reset: () => void;
};

const uid = () => {
  const id = useSession.getState().userId;
  if (!id) throw new Error(tr('لازم تسجّل دخول الأول', 'Please sign in first'));
  return id;
};

const errText = (e: unknown) => (e instanceof Error && e.message ? e.message : tr('حصلت مشكلة، جرّب تاني', 'Something went wrong. Try again'));

const replace = (list: RecyclingPickup[], p: RecyclingPickup): RecyclingPickup[] =>
  list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [p, ...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export const useRecycling = create<RecyclingState>((set, get) => ({
  status: 'idle',
  error: null,
  pickups: [],
  prices: [],
  pricesStatus: 'idle',
  impact: null,
  impactStatus: 'idle',

  async refresh() {
    set({ status: get().status === 'ready' ? 'ready' : 'loading', error: null });
    try {
      set({ pickups: await services.recycling.listMine(uid()), status: 'ready' });
    } catch (e) {
      set({ status: 'error', error: errText(e) });
    }
  },

  async loadPrices() {
    set({ pricesStatus: get().pricesStatus === 'ready' ? 'ready' : 'loading' });
    try {
      set({ prices: await services.recycling.materials(useSession.getState().district), pricesStatus: 'ready' });
    } catch {
      set({ pricesStatus: 'error' });
    }
  },

  async createPickup(input, idempotencyKey) {
    const p = await services.recycling.create(uid(), input, idempotencyKey);
    set((s) => ({ pickups: replace(s.pickups, p), status: 'ready' }));
    return p;
  },

  async loadPickup(id) {
    const p = await services.recycling.get(id);
    if (!p) return false;
    set((s) => ({ pickups: replace(s.pickups, p) }));
    return true;
  },

  async cancelPickup(id, note) {
    const p = await services.recycling.cancel(uid(), id, note);
    set((s) => ({ pickups: replace(s.pickups, p) }));
  },

  async confirmPickup(id) {
    const p = await services.recycling.confirm(uid(), id);
    set((s) => ({ pickups: replace(s.pickups, p), impactStatus: 'idle' }));
  },

  async loadImpact() {
    set({ impactStatus: get().impactStatus === 'ready' ? 'ready' : 'loading' });
    try {
      set({ impact: await services.recycling.impact(uid()), impactStatus: 'ready' });
    } catch {
      set({ impactStatus: 'error' });
    }
  },

  reset: () => set({ status: 'idle', error: null, pickups: [], prices: [], pricesStatus: 'idle', impact: null, impactStatus: 'idle' }),
}));
