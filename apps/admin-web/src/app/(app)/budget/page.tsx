'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  PageHead,
  KpiCard,
  Button,
  EmptyState,
  ErrorState,
  ScoreBadge,
  Modal,
} from '@/components/ui';
import { BudgetSlider } from '@/components/budget/BudgetSlider';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/lib/session';
import { optimizeBudget, commitBudgetPlan } from '@/services/budget';
import { formatEgp } from '@/lib/format';

export default function BudgetPage() {
  const router = useRouter();
  const session = useSession();
  const toast = useToast();

  const [budgetValue, setBudgetValue] = useState(300000);
  const [debouncedBudget, setDebouncedBudget] = useState(300000);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedBudget(budgetValue), 400);
    return () => clearTimeout(timer);
  }, [budgetValue]);

  if (!session || session.role !== 'admin') {
    return (
      <main className="ftc-admin-main">
        <div className="page">
          <PageHead title="الميزانية" />
          <ErrorState
            variant="forbidden"
            message="ميزانية الإصلاحات متاحة للمشرفين بس."
            action={
              <Button variant="secondary" size="sm" href="/incidents">
                ارجع للبلاغات
              </Button>
            }
          />
        </div>
      </main>
    );
  }

  const { data: budgetPlan, isLoading, error, refetch } = useQuery({
    queryKey: ['budget', debouncedBudget],
    queryFn: () => optimizeBudget(debouncedBudget),
  });

  const commitMutation = useMutation({
    mutationFn: () => commitBudgetPlan(budgetPlan!.selected.map((i) => i.incidentId)),
    onSuccess: (result) => {
      setShowConfirmModal(false);
      const count = result.length;
      toast.success(`اتعمل ${count} أمر شغل من الخطة.`);
      router.push('/work-orders');
    },
    onError: (error: any) => {
      toast.error(error.message || 'حصلت مشكلة. جرّب تاني.');
    },
  });

  const selectedCount = budgetPlan?.selected.length ?? 0;
  const isLoaded = !isLoading && budgetPlan;

  return (
    <main className="ftc-admin-main">
      <div className="page">
        <PageHead
          title="ميزانية الإصلاحات"
          subtitle="أحسن خطة إصلاح تجيب أعلى أولوية بالميزانية المتاحة · التكاليف تقديرية للمحاكاة"
          action={
            <Button
              variant="primary"
              onClick={() => setShowConfirmModal(true)}
              disabled={!isLoaded || selectedCount === 0 || isLoading}
            >
              حوّل الخطة لأوامر شغل
            </Button>
          }
        />

        <BudgetSlider
          valueEgp={budgetValue}
          onChange={setBudgetValue}
          unlimitedEgp={undefined}
          busy={isLoading}
        />

        {isLoading && !budgetPlan ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 24 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ height: 120, background: '#f5f5f5', animation: 'pulse 2s' }} />
            ))}
          </div>
        ) : error ? (
          <ErrorState
            message="حصلت مشكلة في تحميل الخطة"
            action={
              <Button variant="secondary" size="sm" onClick={() => refetch()}>
                جرّب تاني
              </Button>
            }
          />
        ) : budgetPlan ? (
          <>
            <div className="kpis kpis--auto">
              <KpiCard
                label="تكلفة الخطة"
                value={formatEgp(budgetPlan.totalCost)}
                sub={`${selectedCount} إصلاحات من ${selectedCount + budgetPlan.skipped.length}`}
                size="md"
              />
              <KpiCard
                label="المتبقي"
                value={formatEgp(budgetPlan.remaining)}
                sub={
                  budgetPlan.skipped.length > 0
                    ? 'مفيش إصلاح تاني يكفّيه'
                    : 'كل الإصلاحات داخلة في الخطة.'
                }
                size="md"
              />
              <KpiCard
                label="الأولوية المغطّاة"
                value={`${Math.round((budgetPlan.coveredPriority / budgetPlan.totalPriority) * 100)}%`}
                sub={
                  <span style={{ display: 'block', marginTop: 8, height: 4, background: '#e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${(budgetPlan.coveredPriority / budgetPlan.totalPriority) * 100}%`, background: 'var(--ftc-red)' }} />
                  </span>
                }
                size="md"
              />
              <KpiCard
                label="مواطنين هيشوفوا حل"
                value={budgetPlan.citizensServed}
                sub={`من ${budgetPlan.citizensTotal} بلّغوا`}
                size="md"
              />
            </div>

            <div className="plan-grid">
              <section aria-label="إصلاحات في الخطة" className="ftc-card">
                <h2 className="sec-title">
                  <span className="plan-dot" aria-hidden />
                  في الخطة ({budgetPlan.selected.length})
                </h2>
                <div className="plan-list">
                  {budgetPlan.selected.length === 0 ? (
                    <p className="mini">مفيش إصلاحات في الخطة.</p>
                  ) : (
                    budgetPlan.selected.map((item) => (
                      <div key={item.incidentId} className="plan-row plan-row--in">
                        <ScoreBadge score={item.priorityScore} />
                        <div className="t">
                          <Link href={`/incidents/${item.incidentId}`}>{item.title}</Link>
                          <span>{item.reason}</span>
                        </div>
                        <span className="cost">{formatEgp(item.costEgp)}</span>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section aria-label="إصلاحات خارج الخطة" className="ftc-card">
                <h2 className="sec-title">
                  <span className="plan-dot plan-dot--out" aria-hidden />
                  مؤجّلة ({budgetPlan.skipped.length})
                </h2>
                <div className="plan-list">
                  {budgetPlan.skipped.length === 0 ? (
                    <p className="mini">كل الإصلاحات داخلة في الخطة.</p>
                  ) : (
                    budgetPlan.skipped.map((item) => (
                      <div key={item.incidentId} className="plan-row plan-row--out">
                        <ScoreBadge score={item.priorityScore} />
                        <div className="t">
                          <Link href={`/incidents/${item.incidentId}`}>{item.title}</Link>
                          <span>{item.reason}</span>
                        </div>
                        <span className="cost">{formatEgp(item.costEgp)}</span>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </>
        ) : (
          <EmptyState
            icon="wallet"
            title="مفيش بلاغات مفتوحة تتحط في خطة"
            message="لما يوصل بلاغات جديدة هتظهر هنا."
          />
        )}

        <Modal
          open={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          title="تحويل الخطة لأوامر شغل"
        >
          <p>
            هنعمل أمر شغل لكل إصلاح من الـ {selectedCount} إصلاحات اللي في الخطة (تكلفة {budgetPlan ? formatEgp(budgetPlan.totalCost) : '…'}). البلاغات اللي ليها أمر شغل بالفعل مش هتتكرر.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
            <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              onClick={() => commitMutation.mutate()}
              disabled={commitMutation.isPending}
            >
              حوّل الخطة
            </Button>
          </div>
        </Modal>
      </div>
    </main>
  );
}
