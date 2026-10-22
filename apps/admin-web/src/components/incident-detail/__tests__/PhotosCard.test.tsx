import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PhotosCard from '../PhotosCard';
import type { AdminIncident, LinkedReport } from '@/domain/admin-types';

const base: Omit<LinkedReport, 'id' | 'photoCount'> = {
  reporter: 'مواطن',
  description: 'حفرة',
  source: 'app',
  createdAt: '2026-10-10T10:00:00.000Z',
};

function incident(linkedReports: LinkedReport[]): AdminIncident {
  return { id: 'INC-1', linkedReports } as AdminIncident;
}

describe('PhotosCard', () => {
  it('renders signed photo URLs as images', () => {
    const url = 'https://project.supabase.co/storage/v1/object/sign/report-media/u1/a.jpg?token=t';
    render(<PhotosCard incident={incident([{ ...base, id: 'R1', photoCount: 1, photoUrls: [url] }])} />);
    const img = screen.getByRole('img', { name: 'صورة البلاغ R1' });
    expect(img).toHaveAttribute('src', url);
    expect(img.closest('a')).toHaveAttribute('href', url);
  });

  it('shows every photo of a report, not one per report', () => {
    const urls = ['https://x.supabase.co/a.jpg', 'https://x.supabase.co/b.jpg'];
    render(<PhotosCard incident={incident([{ ...base, id: 'R1', photoCount: 2, photoUrls: urls }])} />);
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });

  it('keeps a placeholder for stub paths and for a list without URLs', () => {
    render(
      <PhotosCard
        incident={incident([
          { ...base, id: 'R1', photoCount: 1, photoUrls: ['photos/u1/a.jpg'] },
          { ...base, id: 'R2', photoCount: 1 },
        ])}
      />,
    );
    expect(screen.queryAllByRole('img')).toHaveLength(0);
    expect(screen.getAllByTestId('incident-photo')).toHaveLength(2);
  });

  it('falls back when a signed URL has expired', () => {
    render(<PhotosCard incident={incident([{ ...base, id: 'R1', photoCount: 1, photoUrls: ['https://x/a.jpg'] }])} />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByText('الصورة مش متاحة دلوقتي، حدّث الصفحة')).toBeInTheDocument();
  });

  it('shows the empty state without photos', () => {
    render(<PhotosCard incident={incident([{ ...base, id: 'R1', photoCount: 0 }])} />);
    expect(screen.getByText('مفيش صور في البلاغات دي')).toBeInTheDocument();
  });
});
