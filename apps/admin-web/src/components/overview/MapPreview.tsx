import Link from 'next/link';
import { Card, CardHead } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { formatNumber } from '@/lib/format';
import type { AdminIncident } from '@/domain/admin-types';

interface MapPreviewProps {
  open: number;
  incidents: AdminIncident[];
  loading: boolean;
}

export function MapPreview({ open, incidents, loading }: MapPreviewProps) {
  if (loading) {
    return (
      <Card>
        <CardHead
          id="h-map"
          title="خريطة الحي"
          subtitle="البلاغات المفتوحة حسب الحالة · التجمّعات بتبيّن العدد"
          action={
            <Link href="/map" className="ftc-link">
              افتح الخريطة
              <Icon name="chevron-left" size={16} />
            </Link>
          }
        />
        <div className="mapprev" style={{ height: '300px', background: '#f0f0f0' }} />
      </Card>
    );
  }

  return (
    <Card>
      <CardHead
        id="h-map"
        title="خريطة الحي"
        subtitle="البلاغات المفتوحة حسب الحالة · التجمّعات بتبيّن العدد"
        action={
          <Link href="/map" className="ftc-link">
            افتح الخريطة
            <Icon name="chevron-left" size={16} />
          </Link>
        }
      />
      <Link href="/map">
        <div className="mapprev" style={{ height: '300px', background: '#f0f0f0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <Icon name="pin" size={32} />
            <p style={{ marginTop: '8px' }}>{formatNumber(open)} بلاغ مفتوح</p>
          </div>
        </div>
      </Link>
    </Card>
  );
}
