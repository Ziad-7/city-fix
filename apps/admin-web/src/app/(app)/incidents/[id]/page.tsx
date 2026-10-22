'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useSession } from '@/lib/session';
import { getIncident, getSimilarIncidents } from '@/services/incidents';
import { getWorkOrder as getWorkOrderService } from '@/services/workOrders';
import { getDepartments, getTeams } from '@/services/departments';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { Card } from '@/components/ui/Card';
import IncidentDetailContent from '@/components/incident-detail/IncidentDetailContent';

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const session = useSession();

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
    const status = (error as { status?: number }).status;
    if (status === 404) {
      return (
        <div className="ftc-admin-main">
          <div className="page">
            <ErrorState variant="notfound" onRetry={() => refetch()} />
          </div>
        </div>
      );
    }
    if (status === 403) {
      return (
        <div className="ftc-admin-main">
          <div className="page">
            <ErrorState variant="forbidden" />
          </div>
        </div>
      );
    }
    return (
      <div className="ftc-admin-main">
        <div className="page">
          <ErrorState variant="error" onRetry={() => refetch()} />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="ftc-admin-main">
        <div className="page" aria-busy="true">
          <nav className="crumbs">
            <Skeleton variant="line" width="200px" />
          </nav>
          <h1>
            <Skeleton variant="title" width="300px" />
          </h1>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 380px', gap: '16px' }}>
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
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="ftc-admin-main">
        <div className="page">
          <ErrorState variant="notfound" />
        </div>
      </div>
    );
  }

  const canAct = session?.role === 'admin' || incident.department === session?.department;

  return (
    <div className="ftc-admin-main">
      <div className="page">
        <IncidentDetailContent
          incident={incident}
          similarIncidents={similarIncidents}
          workOrder={workOrder}
          departments={departments}
          teams={teams}
          canAct={canAct}
          session={session ?? undefined}
        />
      </div>
    </div>
  );
}
