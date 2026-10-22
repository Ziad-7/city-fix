'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/session';
import { getIncident, getSimilarIncidents } from '@/services/incidents';
import { getWorkOrder as getWorkOrderService } from '@/services/workOrders';
import { getDepartments, getTeams } from '@/services/departments';
import { getCategory } from '@/domain/categories';
import { ErrorState, SkeletonTable, Skeleton } from '@/components/ui/States';
import { Card, CardHead } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import IncidentDetailContent from '@/components/incident-detail/IncidentDetailContent';

export const generateStaticParams = async () => {
  return [];
};

export default function IncidentDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const session = useSession();
  const queryClient = useQueryClient();

  const { data: incident, isLoading, error, refetch } = useQuery({
    queryKey: ['incident', params.id],
    queryFn: () => getIncident(params.id),
    retry: 1,
  });

  const { data: similarIncidents = [] } = useQuery({
    queryKey: ['similar', params.id],
    queryFn: () => getSimilarIncidents(params.id),
    retry: 1,
    enabled: !!incident,
  });

  const { data: workOrder } = useQuery({
    queryKey: ['work-order', incident?.workOrderId],
    queryFn: () => (incident?.workOrderId ? getWorkOrderService(incident.workOrderId) : Promise.resolve(undefined)),
    enabled: !!incident?.workOrderId,
    retry: 1,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: getDepartments,
    staleTime: Infinity,
    retry: 1,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: getTeams,
    staleTime: Infinity,
    retry: 1,
  });

  if (error) {
    const errorObj = error as any;
    const status = errorObj?.response?.status;
    if (status === 404) {
      return (
        <main className="ftc-admin-main">
          <div className="page">
            <ErrorState variant="notfound" onRetry={() => refetch()} />
          </div>
        </main>
      );
    }
    if (status === 403) {
      return (
        <main className="ftc-admin-main">
          <div className="page">
            <ErrorState variant="forbidden" />
          </div>
        </main>
      );
    }
    return (
      <main className="ftc-admin-main">
        <div className="page">
          <ErrorState variant="error" onRetry={() => refetch()} />
        </div>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="ftc-admin-main">
        <div className="page" aria-busy="true">
          <nav className="crumbs">
            <Skeleton variant="line" width="200px" />
          </nav>
          <h1>
            <Skeleton variant="title" width="300px" />
          </h1>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 380px', gap: '24px', maxWidth: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <Card>
                <Skeleton variant="block" height={300} />
              </Card>
              <Card>
                <Skeleton variant="block" height={250} />
              </Card>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <Card>
                <Skeleton variant="block" height={200} />
              </Card>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!incident) {
    return (
      <main className="ftc-admin-main">
        <div className="page">
          <ErrorState variant="notfound" />
        </div>
      </main>
    );
  }

  const canAct = (session as any)?.role === 'admin' || incident.department === (session as any)?.department;

  return (
    <main className="ftc-admin-main">
      <div className="page">
        <IncidentDetailContent
          incident={incident}
          similarIncidents={similarIncidents}
          workOrder={workOrder}
          departments={departments}
          teams={teams}
          canAct={canAct}
          session={session as any}
        />
      </div>
    </main>
  );
}
