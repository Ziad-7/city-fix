import { useMemo } from 'react';
import { create } from 'zustand';
import {
  isActivePickup,
  type Bin,
  type Impact,
  type MaterialId,
  type MaterialPrice,
  type NewRecyclingPickupInput,
  type PickupItem,
  type RecyclingPickup,
  type ReportFullBinInput,
  type WasteClassification,
} from '@/domain/citycycle';
import { estimatedValue, hasUnpricedItems, pricesAreDemo, priceOf } from '@/domain/materials';
import { tr } from '@/i18n';
import { services } from '@/services';
import { preparePhotoUris } from '@/services/media';
import { isOffline } from '@/services/network';
import { useReports } from './useReports';
import { useSession } from './useSession';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

const msgGeneric = () => tr('حصلت مشكلة، جرّب تاني', 'Something went wrong. Try again');

/** Offline: a pickup request is not queued (the outbox holds reports only); say so clearly instead of losing it. */
export const msgPickupOffline = () =>
  tr('مفيش نت دلوقتي. جرّب تبعت الطلب لما النت يرجع.', "You're offline. Try sending the request when you're back online.");

const uid = () => {
  const id = useSession.getState().userId;
  if (!id) throw new Error(tr('لازم تسجّل دخول الأول', 'Please sign in first'));
  return id;
};

const upsert = (list: RecyclingPickup[], p: RecyclingPickup) =>
  list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [p, ...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

const FALLBACK: WasteClassification = { materials: [], size: 'medium', source: 'fallback' };

type CityCycleState = {
  status: LoadStatus;
  error: string | null;
  /** District price list (one row per material). Rows may be demo prices: see `usePricesAreDemo`. */
  prices: MaterialPrice[];
  /** My pickups, newest first. */
  pickups: RecyclingPickup[];
  impact: Impact | null;
  /** Smart bins for the map layer. Fill levels drift in mock mode on every refresh. */
  bins: Bin[];
  /** Loads prices, pickups, impact and bins (call after sign-in and on pull-to-refresh). */
  refresh: () => Promise<void>;
  refreshPickups: () => Promise<void>;
  refreshImpact: () => Promise<void>;
  /** Bins only (the map's own refresh). */
  refreshBins: () => Promise<void>;
  /** Deep link / uncached id. Resolves false when it does not exist. */
  loadPickup: (id: string) => Promise<boolean>;
  /**
   * Creates a pickup: photos are compressed and uploaded first. Rejects with a clear message when offline (no queue)
   * or when the input is not valid; the message is in the app language.
   */
  createPickup: (input: NewRecyclingPickupInput) => Promise<RecyclingPickup>;
  cancelPickup: (id: string, note?: string) => Promise<RecyclingPickup>;
  confirmPickup: (id: string) => Promise<RecyclingPickup>;
  /** Creates a garbage report linked to the bin, then reloads the reports. */
  reportFullBin: (binId: string, input?: ReportFullBinInput) => Promise<void>;
  /** AI photo check on a local photo. Never rejects: any failure gives `source: "fallback"` with no materials. */
  classifyPhoto: (localUri: string) => Promise<WasteClassification>;
  /** Dev only: advance a pickup as the demo collector would (mock mode). */
  simulatePickupProgress: (id: string) => Promise<void>;
  reset: () => void;
};

export const useCityCycle = create<CityCycleState>((set, get) => ({
  status: 'idle',
  error: null,
  prices: [],
  pickups: [],
  impact: null,
  bins: [],

  async refresh() {
    set({ status: get().status === 'ready' ? 'ready' : 'loading', error: null });
    try {
      const userId = uid();
      const district = useSession.getState().district;
      const [prices, pickups, impact, bins] = await Promise.allSettled([
        services.cityCycle.listPrices(district),
        services.cityCycle.listMyPickups(userId),
        services.cityCycle.getMyImpact(userId),
        services.cityCycle.listBins(),
      ]);
      // Prices and pickups are the core: if both failed show the error. Impact and bins just stay as they were.
      if (prices.status === 'rejected' && pickups.status === 'rejected') {
        const e = pickups.reason as unknown;
        throw e instanceof Error ? e : new Error(msgGeneric());
      }
      set((s) => ({
        status: 'ready',
        prices: prices.status === 'fulfilled' ? prices.value : s.prices,
        pickups: pickups.status === 'fulfilled' ? pickups.value : s.pickups,
        impact: impact.status === 'fulfilled' ? impact.value : s.impact,
        bins: bins.status === 'fulfilled' ? bins.value : s.bins,
      }));
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : msgGeneric() });
    }
  },

  async refreshPickups() {
    try {
      set({ pickups: await services.cityCycle.listMyPickups(uid()) });
    } catch {
      // keep what we have; the list screen has its own pull-to-refresh error state
    }
  },

  async refreshImpact() {
    try {
      set({ impact: await services.cityCycle.getMyImpact(uid()) });
    } catch {
      // keep the previous numbers
    }
  },

  async refreshBins() {
    try {
      set({ bins: await services.cityCycle.listBins() });
    } catch {
      // the map keeps the bins it has
    }
  },

  async loadPickup(id) {
    const pickup = await services.cityCycle.getPickup(id);
    if (!pickup) return false;
    set((s) => ({ pickups: upsert(s.pickups, pickup) }));
    return true;
  },

  async createPickup(input) {
    const userId = uid();
    if (await isOffline()) throw new Error(msgPickupOffline());
    const photoUris = await preparePhotoUris(input.photoUris ?? [], (uri, kind, type) => services.uploads.upload(uri, kind, type));
    const pickup = await services.cityCycle.createPickup(userId, { ...input, photoUris });
    set((s) => ({ pickups: upsert(s.pickups, pickup) }));
    return pickup;
  },

  async cancelPickup(id, note) {
    const pickup = await services.cityCycle.cancelPickup(uid(), id, note);
    set((s) => ({ pickups: upsert(s.pickups, pickup) }));
    return pickup;
  },

  async confirmPickup(id) {
    const pickup = await services.cityCycle.confirmPickup(uid(), id);
    set((s) => ({ pickups: upsert(s.pickups, pickup) }));
    return pickup;
  },

  async reportFullBin(binId, input) {
    await services.cityCycle.reportFullBin(uid(), binId, input);
    await useReports.getState().refresh();
  },

  async classifyPhoto(localUri) {
    try {
      const [path] = await preparePhotoUris([localUri], (uri, kind, type) => services.uploads.upload(uri, kind, type));
      const res = await services.cityCycle.classifyWaste(path);
      return res?.materials ? res : FALLBACK;
    } catch {
      return FALLBACK;
    }
  },

  async simulatePickupProgress(id) {
    const pickup = await services.cityCycle.simulatePickupProgress(id);
    set((s) => ({ pickups: upsert(s.pickups, pickup) }));
    if (pickup.status === 'completed') await get().refreshImpact();
  },

  reset: () => set({ status: 'idle', error: null, prices: [], pickups: [], impact: null, bins: [] }),
}));

// ---- Selectors ----

/** True when any price on screen is a demo price: show `demoPricesLabel()` next to prices and values. */
export const usePricesAreDemo = (): boolean => useCityCycle((s) => pricesAreDemo(s.prices));

/** `priceEgpPerKg` of one material (`null` = "price to be set"), or `undefined` while prices are not loaded. */
export const usePrice = (id: MaterialId): number | null | undefined => useCityCycle((s) => (s.prices.length ? priceOf(s.prices, id) : undefined));

/** Pickups still moving, newest first. */
export function useActivePickups(): RecyclingPickup[] {
  const pickups = useCityCycle((s) => s.pickups);
  return useMemo(() => pickups.filter((p) => isActivePickup(p.status)), [pickups]);
}

/** Estimated value of the items in the request form, from the loaded price list. `valueEgp` is undefined when nothing has a price. */
export function useEstimate(items: readonly PickupItem[]): { valueEgp: number | undefined; partial: boolean; demo: boolean } {
  const prices = useCityCycle((s) => s.prices);
  return useMemo(
    () => ({ valueEgp: estimatedValue(items, prices), partial: hasUnpricedItems(items, prices), demo: pricesAreDemo(prices) }),
    [items, prices],
  );
}
