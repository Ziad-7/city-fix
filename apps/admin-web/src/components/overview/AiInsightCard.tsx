import { Icon } from '@/components/Icon';
import { getCategory } from '@/domain/categories';
import { formatNumber } from '@/lib/format';
import type { Insights } from '@/domain/admin-types';

interface AiInsightCardProps {
  insights: Insights;
}

export function AiInsightCard({ insights }: AiInsightCardProps) {
  return (
    <div className="ftc-notice ftc-notice--ai" style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Icon name="sparkles" size={20} />
        <span className="strong">اقتراح الذكاء الاصطناعي</span>
      </div>

      <p style={{ marginBottom: '12px' }}>{insights.summary}</p>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {/* Hotspots */}
        {insights.hotspots.map((hotspot) => (
          <span key={hotspot.address} className="ftc-chip">
            {hotspot.address} · {formatNumber(hotspot.count)} بلاغ
          </span>
        ))}

        {/* Rising Categories */}
        {insights.risingCategories.map((cat) => {
          const category = getCategory(cat.categoryId);
          return (
            <span key={cat.categoryId} className="ftc-chip">
              {category.labelAr} +{formatNumber(cat.delta)}
            </span>
          );
        })}

        {/* Overdue Departments */}
        {insights.overdueDepartments.map((dept) => (
          <span key={dept} className="ftc-chip">
            {dept} متأخرة
          </span>
        ))}
      </div>

      <p className="mini" style={{ color: '#666' }}>
        ده ملخص بيتحسب من البيانات. القرار ليك.
      </p>
    </div>
  );
}
