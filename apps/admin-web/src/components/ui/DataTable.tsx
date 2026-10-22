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
  const displayRows = loading ? Array(skeletonRows).fill(null) : rows;

  const handleSort = (colId: string) => {
    if (!sort || sort.id !== colId) {
      onSortChange?.({ id: colId, dir: 'asc' });
    } else if (sort.dir === 'asc') {
      onSortChange?.({ id: colId, dir: 'desc' });
    } else {
      onSortChange?.(undefined);
    }
  };

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
                      'aria-sort': sort && sort.id === c.id ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none',
                    }
                  : {})}
              >
                {c.sortValue ? (
                  <button
                    type="button"
                    className="th-sort"
                    data-dir={sort && sort.id === c.id ? sort.dir : undefined}
                    onClick={() => handleSort(c.id)}
                  >
                    {c.header}
                    <Icon name="chevron-down" size={14} className={sort && sort.id === c.id && sort.dir === 'asc' ? 'rotate-180' : ''} />
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
          ) : rows.length === 0 && empty ? (
            <tr>
              <td colSpan={columns.length}>{empty}</td>
            </tr>
          ) : (
            rows.map((r) => {
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
