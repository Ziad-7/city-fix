import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OpenByCategory } from '../OpenByCategory';

const mockData = [
  { categoryId: 'pothole' as const, count: 15 },
  { categoryId: 'open_manhole' as const, count: 8 },
  { categoryId: 'garbage' as const, count: 5 },
];

describe('OpenByCategory', () => {
  it('renders category labels', () => {
    const { container } = render(
      <OpenByCategory
        data={mockData}
        open={28}
        loading={false}
      />
    );

    expect(container.textContent).toContain('حفرة أو مطب عشوائي');
  });

  it('displays counts correctly', () => {
    render(
      <OpenByCategory
        data={mockData}
        open={28}
        loading={false}
      />
    );

    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    render(
      <OpenByCategory
        data={[]}
        open={0}
        loading={false}
      />
    );

    expect(screen.getByText('مفيش بلاغات مفتوحة')).toBeInTheDocument();
  });

  it('combines extra rows into "باقي الأنواع"', () => {
    const manyCategories = Array.from({ length: 12 }, (_, i) => ({
      categoryId: 'pothole' as const,
      count: i + 1,
    }));

    render(
      <OpenByCategory
        data={manyCategories}
        open={100}
        loading={false}
      />
    );

    expect(screen.getByText('باقي الأنواع')).toBeInTheDocument();
  });

  it('does not reuse the real "other" category key for the "rest" row (React duplicate-key warning)', () => {
    const ids = ['other', 'pothole', 'open_manhole', 'garbage', 'sewage_overflow', 'water_pipe_burst', 'streetlight_out', 'exposed_wire', 'road_obstruction', 'stray_dogs', 'fallen_tree', 'broken_sidewalk'] as const;
    const many = ids.map((categoryId, i) => ({ categoryId, count: 20 - i }));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<OpenByCategory data={many} open={200} loading={false} />);
    const duplicateKey = error.mock.calls.some((c) => String(c[0]).includes('two children with the same key'));
    error.mockRestore();
    expect(duplicateKey).toBe(false);
  });
});
