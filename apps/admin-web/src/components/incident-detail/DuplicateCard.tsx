'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button, ConfirmModal } from '@/components/ui';
import { Icon } from '@/components/Icon';
import type { AdminIncident } from '@/domain/admin-types';
import type { DuplicateMatch } from '@/domain/types';

interface DuplicateCardProps {
  current: AdminIncident;
  matches: (DuplicateMatch & { createdAt?: string })[];
  canAct: boolean;
  onMerge: (sourceId: string, targetId: string) => Promise<void>;
}

export default function DuplicateCard({ current, matches, canAct, onMerge }: DuplicateCardProps) {
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!matches.length) return null;

  const firstMatch = matches[0];
  const otherCount = matches.length - 1;

  // Determine which is older and should be the merge target
  const currentIsOlder =
    !firstMatch.createdAt || new Date(current.createdAt) <= new Date(firstMatch.createdAt);
  const targetId = currentIsOlder ? current.id : firstMatch.incidentId;
  const sourceId = currentIsOlder ? firstMatch.incidentId : current.id;

  const handleMergeConfirm = async () => {
    try {
      setBusy(true);
      await onMerge(sourceId, targetId);
      setMergeModalOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleReject = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`ftc.dup.dismissed:${current.id}:${firstMatch.incidentId}`, '1');
    }
    setRejectModalOpen(false);
  };

  return (
    <>
      <Card labelledBy="h-dup">
        <span className="lab" id="h-dup" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
          <Icon name="merge" size={16} />
          اقتراح دمج · محتاج موافقتك
        </span>

        <div
          className="box"
          style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: 'var(--ftc-paper)',
            borderRadius: '4px',
            lineHeight: 1.6,
          }}
        >
          <Link href={`/incidents/${firstMatch.incidentId}`} style={{ color: 'var(--ftc-primary)' }}>
            <strong className="num">{firstMatch.incidentId}</strong>
          </Link>{' '}
          · {firstMatch.title}
          <br />
          <span style={{ fontSize: '12px', color: 'var(--ftc-ink-muted)' }}>
            على بعد {firstMatch.distanceM} م · {firstMatch.followers} مواطنين بيتابعوه · نفس النوع
          </span>
        </div>

        <p style={{ fontSize: '14px', margin: '12px 0 0 0' }}>
          الذكاء الاصطناعي شايف إنهم نفس المشكلة. الدمج بيضم المتابعين للبلاغ الأقدم وبيجمّع الأولوية.
        </p>

        {canAct && (
          <div className="btn-split" style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <Button size="sm" icon="merge" onClick={() => setMergeModalOpen(true)} loading={busy}>
              ادمجهم
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setRejectModalOpen(true)} disabled={busy}>
              مش نفس المشكلة
            </Button>
          </div>
        )}

        <p style={{ fontSize: '12px', margin: '12px 0 0 0', color: 'var(--ftc-gold-deep)' }}>
          مفيش دمج تلقائي أبدًا. أي دمج بيتسجّل باسمك.
        </p>

        {otherCount > 0 && (
          <p style={{ fontSize: '12px', margin: '8px 0 0 0', color: 'var(--ftc-ink-muted)' }}>
            وفيه {otherCount} بلاغات قريبة تانية
          </p>
        )}
      </Card>

      <ConfirmModal
        open={mergeModalOpen}
        title="تأكيد دمج البلاغات"
        body={`هيتدمج ${sourceId} في ${targetId}. المتابعين والبلاغات المربوطة هتتنقل للبلاغ الأقدم، والبلاغ التاني هيتقفل برسالة للمواطنين. الدمج بيتسجّل باسمك ومينفعش يتراجع.`}
        confirmLabel="أكّد الدمج"
        busy={busy}
        onConfirm={handleMergeConfirm}
        onCancel={() => setMergeModalOpen(false)}
      />

      <ConfirmModal
        open={rejectModalOpen}
        title="تأكيد"
        body="هيتم إخفاء الاقتراح ده. يمكنك تغييره بعدين من إعدادات البلاغ."
        confirmLabel="نعم، إخفاء"
        busy={false}
        onConfirm={handleReject}
        onCancel={() => setRejectModalOpen(false)}
      />
    </>
  );
}
