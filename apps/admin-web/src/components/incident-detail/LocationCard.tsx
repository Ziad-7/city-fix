'use client';

import Link from 'next/link';
import { Card, CardHead } from '@/components/ui/Card';
import { Icon } from '@/components/Icon';
import type { AdminIncident } from '@/domain/admin-types';

interface LocationCardProps {
  incident: AdminIncident;
}

export default function LocationCard({ incident }: LocationCardProps) {
  return (
    <Card labelledBy="h-mp-title">
      <CardHead
        id="h-mp-title"
        title="الموقع"
        action={
          <Link href={`/map?focus=${incident.id}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'inherit' }}>
            الخريطة
            <Icon name="chevron-left" size={16} />
          </Link>
        }
      />

      {/* Map placeholder - non-interactive */}
      <div
        className="mapsnip"
        style={{
          width: '100%',
          height: '220px',
          backgroundColor: 'var(--ftc-paper)',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '12px',
        }}
      >
        <Icon name="map" size={48} style={{ color: 'var(--ftc-ink-muted)' }} />
      </div>

      <p className="mini" style={{ margin: 0, color: 'var(--ftc-ink-muted)' }}>
        الدايرة المنقّطة = نطاق 250 م لكشف التكرار. الدبوس الرمادي = بلاغات قريبة.
      </p>
    </Card>
  );
}
