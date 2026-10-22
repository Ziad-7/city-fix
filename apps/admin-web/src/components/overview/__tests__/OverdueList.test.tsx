import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OverdueList } from '../OverdueList';

const mockOverdueList = [
  {
    incidentId: 'INC-001',
    title: 'حفرة في الطريق',
    department: 'صيانة الطرق',
    address: 'شارع النيل، الجيزة',
    priorityScore: 85,
    dueAt: '2026-10-21T12:00:00Z',
    hoursLate: 6, // positive = overdue
    external: false,
  },
  {
    incidentId: 'INC-002',
    title: 'سلك كهربائي مكشوف',
    department: 'شركة الكهرباء',
    address: 'شارع محمود بسيوني',
    priorityScore: 92,
    dueAt: '2026-10-22T18:00:00Z',
    hoursLate: -5, // negative = remaining time
    external: false,
  },
];

describe('OverdueList', () => {
  it('renders overdue items with correct labels', () => {
    render(
      <OverdueList
        overdueList={mockOverdueList}
        overdueTotal={2}
        loading={false}
      />
    );

    expect(screen.getByText(/INC-001/)).toBeInTheDocument();
    expect(screen.getByText(/INC-002/)).toBeInTheDocument();
  });

  it('shows "متأخر" for positive hoursLate', () => {
    const { container } = render(
      <OverdueList
        overdueList={mockOverdueList}
        overdueTotal={2}
        loading={false}
      />
    );

    expect(container.textContent).toContain('متأخر 6 س');
  });

  it('shows "باقي" for negative hoursLate', () => {
    const { container } = render(
      <OverdueList
        overdueList={mockOverdueList}
        overdueTotal={2}
        loading={false}
      />
    );

    expect(container.textContent).toContain('باقي 5 س');
  });

  it('renders empty state when no overdue items', () => {
    render(
      <OverdueList
        overdueList={[]}
        overdueTotal={0}
        loading={false}
      />
    );

    expect(screen.getByText('مفيش حاجة متأخرة')).toBeInTheDocument();
  });

  it('shows overdue count in action tag', () => {
    render(
      <OverdueList
        overdueList={mockOverdueList}
        overdueTotal={5}
        loading={false}
      />
    );

    expect(screen.getByText(/5 متأخرة/)).toBeInTheDocument();
  });
});
