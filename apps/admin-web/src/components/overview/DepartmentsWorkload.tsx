import { Card, CardHead, DataTable, Tag } from '@/components/ui';
import type { Column } from '@/components/ui/DataTable';
import { formatDays, formatNumber } from '@/lib/format';

interface DepartmentsWorkloadProps {
  departments: {
    department: string;
    external: boolean;
    externalHotline?: string;
    open: number;
    overdue: number;
    avgResolutionDays: number;
    loadPct: number;
  }[];
  loading: boolean;
}

export function DepartmentsWorkload({ departments, loading }: DepartmentsWorkloadProps) {
  if (loading) {
    return (
      <Card>
        <CardHead
          id="h-dep"
          title="الشغل على كل جهة"
          subtitle="الحِمل = المفتوح مقابل طاقة الفرق الأسبوعية"
        />
      </Card>
    );
  }

  const columns: Column<typeof departments[0]>[] = [
    {
      id: 'department',
      header: 'الجهة',
      cell: (row) => (
        <div>
          <span className="strong">{row.department}</span>
          {row.external && (
            <span className="mini" style={{ display: 'block' }}>
              جهة خارجية · {row.externalHotline}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'open',
      header: 'مفتوحة',
      cell: (row) => formatNumber(row.open),
      sortValue: (row) => row.open,
    },
    {
      id: 'overdue',
      header: 'متأخرة',
      cell: (row) =>
        row.overdue > 0 ? (
          <Tag tone="danger">{formatNumber(row.overdue)}</Tag>
        ) : (
          '0'
        ),
      sortValue: (row) => row.overdue,
    },
    {
      id: 'avg',
      header: 'متوسط الحل',
      cell: (row) => formatDays(row.avgResolutionDays),
      sortValue: (row) => row.avgResolutionDays,
    },
    {
      id: 'load',
      header: 'الحِمل',
      cell: (row) => (
        <div className="load">
          <div className="ftc-bar">
            <span style={{ width: `${row.loadPct}%` }} />
          </div>
          <span className="mini num" style={{ width: '32px', textAlign: 'end' }}>
            {formatNumber(row.loadPct)}%
          </span>
        </div>
      ),
      sortValue: (row) => row.loadPct,
    },
  ];

  return (
    <Card>
      <CardHead
        id="h-dep"
        title="الشغل على كل جهة"
        subtitle="الحِمل = المفتوح مقابل طاقة الفرق الأسبوعية"
      />
      <DataTable
        ariaLabel="عدد البلاغات المفتوحة والمتأخرة حسب الجهة"
        columns={columns}
        rows={departments}
        getRowId={(row) => row.department}
        minWidth={520}
        loading={loading}
      />
    </Card>
  );
}
