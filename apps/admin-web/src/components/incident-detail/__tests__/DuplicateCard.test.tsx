import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DuplicateCard from '../DuplicateCard';
import { ToastProvider } from '@/components/ui/Toast';
import type { AdminIncident, SimilarIncidentMatch } from '@/domain/admin-types';

describe('DuplicateCard', () => {
  it('merges the current incident into the suggested candidate', async () => {
    const onMerge = vi.fn().mockResolvedValue(undefined);
    const current = { id: 'current-incident', createdAt: '2020-01-01T00:00:00Z' } as AdminIncident;
    const match: SimilarIncidentMatch = {
      incidentId: 'suggested-incident',
      title: 'Nearby report',
      address: 'Main Street',
      distance: 42,
      priorityScore: 80,
      followersCount: 3,
    };

    render(<ToastProvider><DuplicateCard current={current} matches={[match]} canAct onMerge={onMerge} /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'ادمجهم' }));
    fireEvent.click(screen.getByRole('button', { name: 'أكّد الدمج' }));

    await waitFor(() => expect(onMerge).toHaveBeenCalledWith('suggested-incident'));
  });
});
