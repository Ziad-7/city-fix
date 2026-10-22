'use client';

import { Card, CardHead } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { formatDateTime, formatNumber } from '@/lib/format';
import { SOURCE_LABEL_AR } from '@/lib/text';
import type { AdminIncident } from '@/domain/admin-types';

interface LinkedReportsCardProps {
  incident: AdminIncident;
}

export default function LinkedReportsCard({ incident }: LinkedReportsCardProps) {
  const { linkedReports } = incident;

  return (
    <Card labelledBy="h-rep-title" padded={false}>
      <div style={{ padding: '16px' }}>
        <CardHead
          id="h-rep-title"
          title={`البلاغات المربوطة (${linkedReports.length})`}
          subtitle={'بنعرض "مواطن" أو "بلاغ بدون اسم". الأسماء وأرقام التليفونات مش ظاهرة في لوحة الحي.'}
        />
      </div>

      <div className="tablewrap" style={{ overflowX: 'auto' }}>
        <table className="ftc-table" style={{ minWidth: '680px' }}>
          <thead>
            <tr>
              <th>البلاغ</th>
              <th>المُبلِّغ</th>
              <th>الوقت</th>
              <th>من</th>
              <th>الوصف</th>
              <th>صور</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {linkedReports.map((report, idx) => (
              <tr key={report.id}>
                <td>
                  <strong className="num">{report.id}</strong>
                </td>
                <td>{report.reporter}</td>
                <td className="num">{formatDateTime(report.createdAt)}</td>
                <td>{SOURCE_LABEL_AR[report.source]}</td>
                <td>{report.description}</td>
                <td className="num">{formatNumber(report.photoCount)}</td>
                <td style={{ textAlign: 'center' }}>
                  {idx === 0 && linkedReports.length > 1 && <span className="mini">الأقدم</span>}
                  {idx === linkedReports.length - 1 && linkedReports.length > 1 && <Tag tone="danger">الأحدث</Tag>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
