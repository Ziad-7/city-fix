'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal, Button } from '@/components/ui';
import { SelectField } from '@/components/ui/FormFields';
import { Card, CardHead } from '@/components/ui/Card';
import { Notice } from '@/components/ui/States';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/ui/Toast';
import { confirmTriage } from '@/services/incidents';
import type { AdminIncident } from '@/domain/admin-types';
import type { Severity } from '@/domain/types';
import { SEVERITY_AI_AR } from '@/lib/text';
import { CATEGORIES, getCategory } from '@/domain/categories';

interface AiSuggestionCardProps {
  triage: NonNullable<AdminIncident['triage']>;
  reviewedBy?: string;
  reviewedAt?: string;
  canAct: boolean;
  incidentId: string;
  onTriageConfirmed: () => void;
}

export default function AiSuggestionCard({
  triage,
  reviewedBy,
  reviewedAt,
  canAct,
  incidentId,
  onTriageConfirmed,
}: AiSuggestionCardProps) {
  const options = triage.options ?? (triage.categoryId
    ? [{ categoryId: triage.categoryId, confidence: triage.confidence ?? 0 }]
    : []);
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(options[0]?.categoryId || '');
  const [selectedSeverity, setSelectedSeverity] = useState<Severity>(triage.severity);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();

  const handleConfirm = async () => {
    try {
      setBusy(true);
      await confirmTriage(incidentId, {
        categoryId: options[0]?.categoryId,
        severity: triage.severity,
      });
      await queryClient.invalidateQueries({ queryKey: ['incident', incidentId] });
      await queryClient.invalidateQueries({ queryKey: ['incidents'] });
      toast.success('اتأكّد التصنيف.');
      onTriageConfirmed();
    } catch (err) {
      const errorMsg = (err instanceof Error ? err.message : null) || 'حصلت مشكلة. جرّب تاني.';
      toast.error(errorMsg);
    } finally {
      setBusy(false);
    }
  };

  const handleChangeConfirm = async () => {
    try {
      setBusy(true);
      await confirmTriage(incidentId, {
        categoryId: selectedCategory,
        severity: selectedSeverity,
      });
      await queryClient.invalidateQueries({ queryKey: ['incident', incidentId] });
      await queryClient.invalidateQueries({ queryKey: ['incidents'] });
      setChangeModalOpen(false);
      toast.success('اتغيّر التصنيف واتأكّد.');
      onTriageConfirmed();
    } catch (err) {
      const errorMsg = (err instanceof Error ? err.message : null) || 'حصلت مشكلة. جرّب تاني.';
      toast.error(errorMsg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card labelledBy="h-ai">
        <span className="lab" id="h-ai" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
          <Icon name="sparkles" size={16} />
          اقتراح الذكاء الاصطناعي
        </span>

        <div className="stack" style={{ gap: '12px', marginTop: '16px' }}>
          {options.slice(0, 3).map((option, i) => {
            const pct = Math.round(option.confidence * 100);
            const label = getCategory(option.categoryId).labelAr;
            return (
              <div
                key={option.categoryId}
                className={`opt ${i === 0 ? 'top' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <span className="nm" style={{ flex: 1 }}>
                  {i === 0 ? `${label} · ${SEVERITY_AI_AR[triage.severity]}` : label}
                </span>
                <span className="pct" style={{ minWidth: '40px', textAlign: 'right' }}>
                  {pct}%
                </span>
                <span
                  className="ftc-bar"
                  role="img"
                  aria-label={i === 0 ? `ثقة ${pct}%` : `${pct}%`}
                  style={{ flex: 0, minWidth: '100px', display: 'flex', alignItems: 'center' }}
                >
                  <span style={{ width: `${pct}%`, height: '4px', backgroundColor: 'currentColor' }} />
                </span>
              </div>
            );
          })}
        </div>

        <p style={{ fontSize: '14px', margin: '12px 0 0 0' }}>{triage.summary}</p>
        <p style={{ fontSize: '12px', margin: '8px 0 0 0', color: 'var(--ftc-red-deep)' }}>ده اقتراح بس. القرار ليك.</p>

        {triage.confirmed ? (
          <div
            className="done"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '16px',
              padding: '12px',
              backgroundColor: 'var(--ftc-status-resolved)',
              borderRadius: '4px',
              color: 'white',
            }}
          >
            <Icon name="check" size={16} />
            اتأكّد بواسطة {reviewedBy} · {reviewedAt}
          </div>
        ) : (
          canAct && (
            <div className="btn-split" style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <Button size="sm" onClick={handleConfirm} loading={busy}>
                أكّد التصنيف
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setChangeModalOpen(true)} disabled={busy}>
                غيّر التصنيف
              </Button>
            </div>
          )
        )}

        {triage.source === 'fallback' && (
          <p style={{ fontSize: '12px', margin: '8px 0 0 0' }}>اقتراح بالكلمات المفتاحية، مش من نموذج ذكاء اصطناعي.</p>
        )}
      </Card>

      <Modal
        open={changeModalOpen}
        onClose={() => setChangeModalOpen(false)}
        title="غيّر التصنيف"
        busy={busy}
        dismissible={!busy}
        actions={
          <>
            <Button variant="primary" loading={busy} onClick={handleChangeConfirm}>
              احفظ التصنيف
            </Button>
            <Button variant="ghost" onClick={() => setChangeModalOpen(false)} disabled={busy}>
              إلغاء
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <SelectField
            id="cat"
            label="النوع"
            value={selectedCategory}
            onChange={setSelectedCategory}
            options={CATEGORIES.map((c) => ({
              value: c.id,
              label: c.labelAr,
            }))}
          />
          <SelectField
            id="sev"
            label="الخطورة"
            value={selectedSeverity}
            onChange={(v) => setSelectedSeverity(v as Severity)}
            options={[
              { value: 'low', label: 'خطورة بسيطة' },
              { value: 'medium', label: 'خطورة متوسطة' },
              { value: 'high', label: 'خطورة عالية' },
              { value: 'critical', label: 'خطر' },
            ]}
          />
        </div>
      </Modal>
    </>
  );
}
