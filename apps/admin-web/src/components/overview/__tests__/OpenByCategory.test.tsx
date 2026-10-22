import { describe, it, expect } from 'vitest';
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
});
