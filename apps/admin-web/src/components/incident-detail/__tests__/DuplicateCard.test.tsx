import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DuplicateCard from '../DuplicateCard';
import { ToastProvider } from '@/components/ui/Toast';
import type { AdminIncident } from '@/domain/admin-types';
import type { DuplicateMatch } from '@/domain/types';

const match: DuplicateMatch & { createdAt?: string } = {
  incidentId: 'suggested-incident',
  title: 'Nearby report',
  categoryId: 'pothole',
  distanceM: 42,
  followers: 3,
  status: 'received',
};

function mergeFrom(currentCreatedAt: string, matchCreatedAt: string) {
  const onMerge = vi.fn().mockResolvedValue(undefined);
  const current = { id: 'current-incident', createdAt: currentCreatedAt } as AdminIncident;
  render(
    <ToastProvider>
      <DuplicateCard current={current} matches={[{ ...match, createdAt: matchCreatedAt }]} canAct onMerge={onMerge} />
    </ToastProvider>,
  );
  fireEvent.click(screen.getAllByRole('button')[0]);
  fireEvent.click(screen.getByRole('button', { name: 'أكّد الدمج' }));
  return onMerge;
}

describe('DuplicateCard merge direction', () => {
  it('merges the newer incident into the older one (current is older)', async () => {
    const onMerge = mergeFrom('2020-01-01T00:00:00Z', '2021-01-01T00:00:00Z');
    await waitFor(() => expect(onMerge).toHaveBeenCalledWith('suggested-incident', 'current-incident'));
  });

  it('merges the current incident into the suggested one when that is older', async () => {
    const onMerge = mergeFrom('2022-01-01T00:00:00Z', '2021-01-01T00:00:00Z');
    await waitFor(() => expect(onMerge).toHaveBeenCalledWith('current-incident', 'suggested-incident'));
  });
});
