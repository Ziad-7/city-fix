import { render, screen, fireEvent } from '@testing-library/react';
import { DataTable } from '../DataTable';
import { describe, it, expect, vi } from 'vitest';

interface TestRow {
  id: string;
  name: string;
}

describe('DataTable', () => {
  const columns = [
    {
      id: 'id',
      header: 'ID',
      cell: (row: TestRow) => row.id,
      sortValue: (row: TestRow) => row.id,
    },
    {
      id: 'name',
      header: 'Name',
      cell: (row: TestRow) => row.name,
    },
  ];

  const rows: TestRow[] = [
    { id: '1', name: 'Item 1' },
    { id: '2', name: 'Item 2' },
  ];

  it('renders table with correct structure', () => {
    const { container } = render(
      <DataTable<TestRow>
        ariaLabel="Test table"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
      />,
    );

    expect(container.querySelector('table')).toBeInTheDocument();
    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
  });

  it('clicking sortable header toggles sort direction', () => {
    const onSortChange = vi.fn();
    const { rerender } = render(
      <DataTable<TestRow>
        ariaLabel="Test table"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        onSortChange={onSortChange}
        sort={undefined}
      />,
    );

    const sortButton = screen.getAllByRole('button')[0]; // First sort button (ID header)
    fireEvent.click(sortButton);

    expect(onSortChange).toHaveBeenCalledWith({ id: 'id', dir: 'asc' });

    // Rerender with sort state
    rerender(
      <DataTable<TestRow>
        ariaLabel="Test table"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        onSortChange={onSortChange}
        sort={{ id: 'id', dir: 'asc' }}
      />,
    );

    fireEvent.click(sortButton);
    expect(onSortChange).toHaveBeenCalledWith({ id: 'id', dir: 'desc' });
  });

  it('sets aria-sort on sortable header based on sort state', () => {
    const { container } = render(
      <DataTable<TestRow>
        ariaLabel="Test table"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        sort={{ id: 'id', dir: 'asc' }}
      />,
    );

    const headers = container.querySelectorAll('th');
    // Only sortable columns (those with sortValue) should have aria-sort
    expect(headers[0]).toHaveAttribute('aria-sort', 'ascending');
    // Non-sortable column may have aria-sort="none" or no attribute
    if (headers[1].hasAttribute('aria-sort')) {
      expect(headers[1]).toHaveAttribute('aria-sort', 'none');
    } else {
      expect(headers[1]).not.toHaveAttribute('aria-sort');
    }
  });

  it('only selected row has is-selected class', () => {
    const { container } = render(
      <DataTable<TestRow>
        ariaLabel="Test table"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        onSelect={() => {}}
        selectedId="1"
      />,
    );

    const tbody = container.querySelector('tbody');
    const trs = tbody?.querySelectorAll('tr');
    expect(trs?.[0]).toHaveClass('is-selected');
    expect(trs?.[1]).not.toHaveClass('is-selected');
  });

  it('clicking row calls onSelect and sets aria-selected', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <DataTable
        ariaLabel="Test table"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        onSelect={onSelect}
        selectedId="1"
      />,
    );

    const rows_elem = container.querySelectorAll('tbody tr');
    expect(rows_elem[0]).toHaveAttribute('aria-selected', 'true');
    expect(rows_elem[1]).toHaveAttribute('aria-selected', 'false');

    fireEvent.click(rows_elem[1]);
    expect(onSelect).toHaveBeenCalledWith({ id: '2', name: 'Item 2' });
  });

  it('pressing Enter on row selects it', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <DataTable
        ariaLabel="Test table"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        onSelect={onSelect}
      />,
    );

    const row = container.querySelector('tbody tr') as HTMLElement;
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalled();
  });

  it('implements client-side sorting when sortValue is defined', () => {
    // Test that sortValue callback is invoked during comparison
    let sortValueCallCount = 0;
    const testColumns = [
      {
        id: 'id',
        header: 'ID',
        cell: (row: TestRow) => row.id,
        sortValue: (row: TestRow) => {
          sortValueCallCount++;
          return row.id;
        },
      },
      {
        id: 'name',
        header: 'Name',
        cell: (row: TestRow) => row.name,
      },
    ];

    const unsortedRows: TestRow[] = [
      { id: '3', name: 'Item 3' },
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' },
    ];

    render(
      <DataTable<TestRow>
        ariaLabel="Test table"
        columns={testColumns}
        rows={unsortedRows}
        getRowId={(r) => r.id}
        sort={{ id: 'id', dir: 'asc' }}
      />,
    );

    // sortValue should be called during sorting
    expect(sortValueCallCount).toBeGreaterThan(0);
  });

  it('renders rows in the selected sort order', () => {
    const unsortedRows: TestRow[] = [
      { id: '3', name: 'Item 3' },
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' },
    ];
    const { container } = render(
      <DataTable<TestRow>
        ariaLabel="Test table"
        columns={columns}
        rows={unsortedRows}
        getRowId={(row) => row.id}
        sort={{ id: 'id', dir: 'asc' }}
      />,
    );

    expect(Array.from(container.querySelectorAll('tbody tr td:first-child')).map((cell) => cell.textContent))
      .toEqual(['1', '2', '3']);
  });

  it('updates aria-sort when sorting', () => {
    const { container, rerender } = render(
      <DataTable<TestRow>
        ariaLabel="Test table"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        sort={undefined}
      />,
    );

    let headers = container.querySelectorAll('th');
    expect(headers[0]).toHaveAttribute('aria-sort', 'none');

    // Simulate sort asc
    rerender(
      <DataTable<TestRow>
        ariaLabel="Test table"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        sort={{ id: 'id', dir: 'asc' }}
      />,
    );

    headers = container.querySelectorAll('th');
    expect(headers[0]).toHaveAttribute('aria-sort', 'ascending');

    // Simulate sort desc
    rerender(
      <DataTable<TestRow>
        ariaLabel="Test table"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        sort={{ id: 'id', dir: 'desc' }}
      />,
    );

    headers = container.querySelectorAll('th');
    expect(headers[0]).toHaveAttribute('aria-sort', 'descending');
  });
});
