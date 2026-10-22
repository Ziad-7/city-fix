import { Card, CardHead, HBarChart, EmptyState } from '@/components/ui';
import type { HBarRow } from '@/components/ui/Charts';
import { getCategory } from '@/domain/categories';
import type { CategoryId } from '@/domain/types';

interface OpenByCategoryProps {
  data: { categoryId: CategoryId; count: number }[];
  open: number;
  loading: boolean;
}

export function OpenByCategory({ data, open, loading }: OpenByCategoryProps) {
  if (loading) {
    return (
      <Card>
        <CardHead
          id="h-cat"
          title="البلاغات المفتوحة حسب النوع"
          subtitle={`إجمالي ${open} بلاغ مفتوح · مرتّبة من الأكتر للأقل`}
        />
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHead
          id="h-cat"
          title="البلاغات المفتوحة حسب النوع"
          subtitle={`إجمالي 0 بلاغ مفتوح · مرتّبة من الأكتر للأقل`}
        />
        <EmptyState
          icon="check"
          title="مفيش بلاغات مفتوحة"
          message="كل البلاغات اتحلّت. عاش."
        />
      </Card>
    );
  }

  // Show top 10 rows, combine rest into "باقي الأنواع"
  const rows: HBarRow[] = data.slice(0, 10).map((item) => {
    const category = getCategory(item.categoryId);
    return {
      key: item.categoryId,
      label: category.labelAr,
      value: item.count,
      danger: category.danger,
    };
  });

  if (data.length > 10) {
    const rest = data.slice(10).reduce((sum, item) => sum + item.count, 0);
    rows.push({
      key: 'other',
      label: 'باقي الأنواع',
      value: rest,
      danger: false,
    });
  }

  return (
    <Card>
      <CardHead
        id="h-cat"
        title="البلاغات المفتوحة حسب النوع"
        subtitle={`إجمالي ${open} بلاغ مفتوح · مرتّبة من الأكتر للأقل`}
      />
      <HBarChart
        rows={rows}
        ariaLabel="عدد البلاغات المفتوحة حسب النوع"
      />
    </Card>
  );
}
