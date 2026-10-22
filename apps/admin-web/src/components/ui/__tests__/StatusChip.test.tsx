import { render } from '@testing-library/react';
import { StatusChip, STATUS_CHIP } from '../StatusChip';
import type { IncidentStatus } from '@/domain/types';
import type { WorkOrderStatus } from '@/domain/admin-types';
import { describe, it, expect } from 'vitest';

describe('StatusChip', () => {
  it('renders incident statuses with correct label and class', () => {
    const statuses: IncidentStatus[] = ['received', 'triaged', 'assigned', 'in_progress', 'resolved', 'closed'];

    statuses.forEach((status) => {
      const { unmount, container } = render(<StatusChip kind="incident" status={status} />);
      const mapping = STATUS_CHIP[`incident-${status}`];

      const chip = container.querySelector(`.ftc-chip--${mapping.tone}`);
      expect(chip).toBeTruthy();
      expect(chip?.textContent).toBe(mapping.label);
      unmount();
    });
  });

  it('renders workorder statuses with correct label and class', () => {
    const statuses: WorkOrderStatus[] = ['open', 'assigned', 'in_progress', 'done'];

    statuses.forEach((status) => {
      const { unmount, container } = render(<StatusChip kind="workorder" status={status} />);
      const mapping = STATUS_CHIP[`workorder-${status}`];

      const chip = container.querySelector(`.ftc-chip--${mapping.tone}`);
      expect(chip).toBeTruthy();
      expect(chip?.textContent).toBe(mapping.label);
      unmount();
    });
  });

  it('renders critical chip', () => {
    const { container } = render(<StatusChip kind="critical" />);
    const chip = container.querySelector('.ftc-chip--critical');
    expect(chip).toBeTruthy();
    expect(chip?.textContent).toBe('خطر');
  });

  it('renders priority chip with score', () => {
    const { container: c1 } = render(<StatusChip kind="priority" score={85} />);
    expect(c1.textContent).toContain('أولوية عاجلة');
    expect(c1.textContent).toContain('85');

    const { container: c2 } = render(<StatusChip kind="priority" score={65} />);
    expect(c2.textContent).toContain('أولوية عالية');

    const { container: c3 } = render(<StatusChip kind="priority" score={35} />);
    expect(c3.textContent).toContain('أولوية عادية');
  });

  it('renders priority chip levelOnly', () => {
    const { container } = render(<StatusChip kind="priority" score={85} levelOnly />);
    expect(container.textContent).not.toContain('85');
    expect(container.textContent).toContain('أولوية عاجلة');
  });
});
