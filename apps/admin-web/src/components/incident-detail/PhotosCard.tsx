'use client';

import { Card, CardHead } from '@/components/ui/Card';
import { EmptyState, Notice } from '@/components/ui/States';
import { Icon } from '@/components/Icon';
import { formatDateTime } from '@/lib/format';
import type { AdminIncident } from '@/domain/admin-types';

interface PhotosCardProps {
  incident: AdminIncident;
}

export default function PhotosCard({ incident }: PhotosCardProps) {
  // Count total photos
  const reportsWithPhotos = incident.linkedReports.filter((r) => r.photoCount > 0);
  const totalPhotos = reportsWithPhotos.length;
  const shown = Math.min(3, totalPhotos);

  return (
    <Card labelledBy="h-ph-title">
      <CardHead
        id="h-ph-title"
        icon="camera"
        title={`الصور (${shown} من ${incident.linkedReports.length} بلاغات)`}
      />

      {totalPhotos === 0 ? (
        <EmptyState icon="camera" title="مفيش صور في البلاغات دي" />
      ) : (
        <>
          <div
            className="photos"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px',
              marginBottom: '12px',
            }}
          >
            {reportsWithPhotos.slice(0, 3).map((report) => (
              <figure key={report.id} className="photo" style={{ textAlign: 'center', margin: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'var(--ftc-status-received)',
                    borderRadius: '4px',
                    minHeight: '150px',
                  }}
                >
                  <Icon name="image" size={48} style={{ color: 'white' }} />
                </div>
                <figcaption style={{ fontSize: '12px', marginTop: '8px', color: 'var(--ftc-ink-muted)' }}>
                  {report.reporter} · {formatDateTime(report.createdAt)}
                </figcaption>
              </figure>
            ))}
          </div>

          <Notice tone="gold" icon="eye-off">
            الوجوه وأرقام العربيات اتغطّت تلقائيًا قبل النشر للمواطنين. الصور الأصلية ظاهرة للمشرفين بس.
          </Notice>
        </>
      )}
    </Card>
  );
}
