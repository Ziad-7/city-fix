'use client';

import { useState } from 'react';
import { Card, CardHead } from '@/components/ui/Card';
import { EmptyState, Notice } from '@/components/ui/States';
import { Icon } from '@/components/Icon';
import { formatDateTime } from '@/lib/format';
import type { AdminIncident, LinkedReport } from '@/domain/admin-types';

interface PhotosCardProps {
  incident: AdminIncident;
}

const MAX_SHOWN = 6;

/** Only real http(s) URLs are rendered; local-demo stub paths keep the placeholder tile. */
function isDisplayable(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

interface PhotoItem {
  key: string;
  url?: string;
  report: LinkedReport;
}

function photoItems(reports: LinkedReport[]): PhotoItem[] {
  const items: PhotoItem[] = [];
  for (const report of reports) {
    const urls = (report.photoUrls ?? []).filter(isDisplayable);
    if (urls.length > 0) {
      urls.forEach((url, index) => items.push({ key: `${report.id}-${index}`, url, report }));
    } else if (report.photoCount > 0) {
      items.push({ key: report.id, report });
    }
  }
  return items;
}

function PhotoTile({ item }: { item: PhotoItem }) {
  const [failed, setFailed] = useState(false);
  const caption = `${item.report.reporter} · ${formatDateTime(item.report.createdAt)}`;
  const showImage = item.url && !failed;
  return (
    <figure className="photo" data-testid="incident-photo">
      {showImage ? (
        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', width: '100%', height: '100%' }}>
          {/* Signed, short-lived Supabase URLs: next/image would need a remote pattern and caches them. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.url}
            alt={`صورة البلاغ ${item.report.id}`}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </a>
      ) : (
        <Icon name="image" size={48} />
      )}
      <figcaption>{failed ? 'الصورة مش متاحة دلوقتي، حدّث الصفحة' : caption}</figcaption>
    </figure>
  );
}

export default function PhotosCard({ incident }: PhotosCardProps) {
  const items = photoItems(incident.linkedReports);
  const shown = items.slice(0, MAX_SHOWN);
  const reportsWithPhotos = incident.linkedReports.filter(
    (r) => r.photoCount > 0 || (r.photoUrls ?? []).length > 0,
  ).length;

  return (
    <Card labelledBy="h-ph-title">
      <CardHead
        id="h-ph-title"
        icon="camera"
        title={`الصور (${reportsWithPhotos} من ${incident.linkedReports.length} بلاغات)`}
      />

      {items.length === 0 ? (
        <EmptyState icon="camera" title="مفيش صور في البلاغات دي" />
      ) : (
        <>
          <div className="photos" style={{ marginBottom: '12px' }}>
            {shown.map((item) => (
              <PhotoTile key={item.key} item={item} />
            ))}
          </div>

          <Notice tone="gold" icon="eye-off">
            الصور الأصلية ظاهرة للمشرفين بس، بروابط مؤقتة. متشاركهاش برة النظام.
          </Notice>
        </>
      )}
    </Card>
  );
}
