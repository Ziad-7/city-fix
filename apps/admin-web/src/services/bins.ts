import { http } from '@/lib/http';
import type { SmartBin, SmartBinReading } from '@/domain/admin-types';

export async function getSmartBins(): Promise<SmartBin[]> {
  return (await http<SmartBin[]>('GET', '/admin/bins')) ?? [];
}

export function getSmartBinReadings(
  binId: string,
  limit = 100,
): Promise<SmartBinReading[]> {
  const query = new URLSearchParams({ limit: String(limit) });
  return (await http<SmartBinReading[]>(
    'GET',
    `/admin/bins/${encodeURIComponent(binId)}/readings?${query.toString()}`,
  )) ?? [];
}
