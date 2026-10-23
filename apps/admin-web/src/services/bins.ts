import { ApiError, http, isMissingRoute, MSG_GENERIC } from '@/lib/http';
import type { BinForecast, CreateBinInput, RegisteredBin, SmartBin, SmartBinReading } from '@/domain/admin-types';

export async function getSmartBins(): Promise<SmartBin[]> {
  return (await http<SmartBin[]>('GET', '/admin/bins')) ?? [];
}

export async function getSmartBinReadings(
  binId: string,
  limit = 100,
): Promise<SmartBinReading[]> {
  const query = new URLSearchParams({ limit: String(limit) });
  return (await http<SmartBinReading[]>(
    'GET',
    `/admin/bins/${encodeURIComponent(binId)}/readings?${query.toString()}`,
  )) ?? [];
}

/** null only when this server has no forecast route; every other failure is thrown. */
export async function getBinForecast(horizonHours = 24): Promise<BinForecast | null> {
  try {
    return (await http<BinForecast>('GET', `/admin/bins/forecast?horizonHours=${horizonHours}`)) ?? null;
  } catch (e) {
    if (isMissingRoute(e)) return null;
    throw e;
  }
}

/** Admin only. The returned deviceKey is shown once; callers must not store it. */
export async function registerBin(input: CreateBinInput): Promise<RegisteredBin> {
  const r = await http<RegisteredBin>('POST', '/admin/bins', input);
  if (!r) throw new ApiError(500, MSG_GENERIC);
  return r;
}
