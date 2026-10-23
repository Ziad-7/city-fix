import { useState, useMemo } from 'react';
import { Icon } from '../Icon';

export interface Column<T> {
  id: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  sortValue?: (row: T) => number | string;
  className?: string;
  nowrap?: boolean;
}

export interface DataTableProps<T> {
  ariaLabel: string;
  columns: Column<T>[];
  rows: T[];
  getRowId: (r: T) => string;
  selectedId?: string | null;
  onSelect?: (r: T) => void;
  sort?: { id: string; dir: 'asc' | 'desc' };
  onSortChange?: (s: { id: string; dir: 'asc' | 'desc' } | undefined) => void;
  rowClassName?: (r: T) => string | undefined;
  loading?: boolean;
  skeletonRows?: number;
  empty?: React.ReactNode;
  minWidth?: number;
  tableClassName?: string;
}

export function DataTable<T>({
  ariaLabel,
  columns,
  rows,
  getRowId,
  selectedId,
  onSelect,
  sort,
  onSortChange,
  rowClassName,
  loading = false,
  skeletonRows = 6,
  empty,
  minWidth,
  tableClassName,
}: DataTableProps<T>) {
  // Internal sort state for uncontrolled mode
  const [internalSort, setInternalSort] = useState<{ id: string; dir: 'asc' | 'desc' } | undefined>();
  const isControlled = onSortChange !== undefined || sort !== undefined;
  const activeSort = isControlled ? sort : internalSort;

  const handleSort = (colId: string) => {
    if (!activeSort || activeSort.id !== colId) {
      const newSort = { id: colId, dir: 'asc' as const };
      if (isControlled) {
        onSortChange?.(newSort);
      } else {
        setInternalSort(newSort);
      }
    } else if (activeSort.dir === 'asc') {
      const newSort = { id: colId, dir: 'desc' as const };
      if (isControlled) {
        onSortChange?.(newSort);
      } else {
        setInternalSort(newSort);
      }
    } else {
      if (isControlled) {
        onSortChange?.(undefined);
      } else {
        setInternalSort(undefined);
      }
    }
  };

  // Sort rows based on active sort
  const sortedRows = useMemo(() => {
    if (loading || !activeSort) {
      return rows;
    }

    const col = columns.find((c) => c.id === activeSort.id);
    if (!col || !col.sortValue) {
      return rows;
    }

    const sorted = [...rows].sort((a, b) => {
      const aVal = col.sortValue!(a);
      const bVal = col.sortValue!(b);

      if (aVal < bVal) return activeSort.dir === 'asc' ? -1 : 1;
      if (aVal > bVal) return activeSort.dir === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [rows, activeSort, columns, loading]);

  const displayRows = loading ? Array(skeletonRows).fill(null) : sortedRows;

  const focusSibling = (e: React.KeyboardEvent<HTMLTableRowElement>, offset: number) => {
    const rows = Array.from((e.currentTarget.parentNode as HTMLTableSectionElement).querySelectorAll('tr'));
    const idx = rows.indexOf(e.currentTarget as HTMLTableRowElement);
    const next = rows[idx + offset];
    if (next) {
      (next as HTMLTableRowElement).focus();
    }
  };

  return (
    <div className="tablewrap" aria-busy={loading} role={loading ? 'status' : undefined}>
      {loading && <span className="sr-only">جاري التحميل…</span>}
      <table
        className={['ftc-table', onSelect && 'is-clickable', tableClassName].filter(Boolean).join(' ')}
        style={{ minWidth }}
        aria-label={ariaLabel}
      >
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.id}
                scope="col"
                {...(c.sortValue
                  ? {
                      'aria-sort': activeSort && activeSort.id === c.id ? (activeSort.dir === 'asc' ? 'ascending' : 'descending') : 'none',
                    }
                  : {})}
              >
                {c.sortValue ? (
                  <button
                    type="button"
                    className="th-sort"
                    data-dir={activeSort && activeSort.id === c.id ? activeSort.dir : undefined}
                    onClick={() => handleSort(c.id)}
                  >
                    {c.header}
                    <Icon name="chevron-down" size={14} className={activeSort && activeSort.id === c.id && activeSort.dir === 'asc' ? 'rotate-180' : ''} />
                  </button>
                ) : (
                  c.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            displayRows.map((_, idx) => (
              <tr key={idx}>
                {columns.map((c) => (
                  <td key={c.id}>
                    <span className="ftc-skel ftc-skel--line" />
                  </td>
                ))}
              </tr>
            ))
          ) : sortedRows.length === 0 && empty ? (
            <tr>
              <td colSpan={columns.length}>{empty}</td>
            </tr>
          ) : (
            sortedRows.map((r) => {
              const id = getRowId(r);
              const selected = selectedId === id;
              return (
                <tr
                  key={id}
                  tabIndex={onSelect ? 0 : undefined}
                  aria-selected={onSelect ? selected : undefined}
                  className={[selected && 'is-selected', rowClassName?.(r)].filter(Boolean).join(' ')}
                  onClick={() => onSelect?.(r)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect?.(r);
                    }
                    if (e.key === 'ArrowDown') focusSibling(e, 1);
                    if (e.key === 'ArrowUp') focusSibling(e, -1);
                  }}
                >
                  {columns.map((c) => (
                    <td key={c.id} className={[c.className, c.nowrap && 'nowrap'].filter(Boolean).join(' ')}>
                      {c.cell(r)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
