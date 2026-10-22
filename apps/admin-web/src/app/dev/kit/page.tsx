'use client';

import {
  Button,
  Card,
  CardHead,
  StatusChip,
  Tag,
  ScoreBadge,
  FilterChip,
  FilterChipGroup,
  PageHead,
  KpiCard,
  Delta,
  TextField,
  SelectField,
  TextArea,
  Checkbox,
  DataTable,
  PriorityBreakdown,
  Timeline,
  HBarChart,
  StackBar,
  LegendRows,
  Notice,
  CitizenPreview,
  EmptyState,
  ErrorState,
  Skeleton,
  KvList,
} from '@/components/ui';
import { computePriority } from '@/logic/priority';

export default function DevKitPage() {
  const priority = computePriority({
    severity: 'high',
    nearSensitivePlace: true,
    reporters: 5,
    daysOpen: 2,
    targetDays: 3,
    areaUnderserved: true,
  });

  interface Row {
    id: string;
    name: string;
    status: 'received' | 'in_progress';
  }

  const columns = [
    {
      id: 'id',
      header: 'ID',
      cell: (row: Row) => row.id,
      sortValue: (row: Row) => row.id,
    },
    {
      id: 'name',
      header: 'Name',
      cell: (row: Row) => row.name,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row: Row) => <StatusChip kind="incident" status={row.status} />,
      sortValue: (row: Row) => row.status,
    },
  ];

  const rows: Row[] = [
    { id: '1', name: 'Test Row 1', status: 'received' },
    { id: '2', name: 'Test Row 2', status: 'in_progress' },
  ];

  return (
    <div style={{ padding: '32px', background: 'var(--ftc-paper)', minHeight: '100vh' }}>
      <h1>UI Kit Demo</h1>

      <section style={{ marginTop: '32px' }}>
        <h2>Buttons</h2>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '16px' }}>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="gold">Gold</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="primary" size="sm">Small Primary</Button>
          <Button variant="primary" loading>Loading</Button>
          <Button variant="primary" disabled>Disabled</Button>
          <Button variant="primary" icon="check">With Icon</Button>
          <Button variant="primary" block>Block Button</Button>
        </div>
      </section>

      <section style={{ marginTop: '32px' }}>
        <h2>Cards</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginTop: '16px' }}>
          <Card>
            <CardHead title="Card Title" subtitle="Optional subtitle" icon="info" />
            Card content here
          </Card>
          <Card>
            <KpiCard label="Open Incidents" value="42" size="lg" />
          </Card>
          <Card>
            <KpiCard label="Resolved" value="156" valueTone="default" note={<Delta value={12} />} />
          </Card>
          <Card>
            <KpiCard label="Loading" value="—" loading />
          </Card>
        </div>
      </section>

      <section style={{ marginTop: '32px' }}>
        <h2>Status Chips</h2>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
          <StatusChip kind="incident" status="received" />
          <StatusChip kind="incident" status="assigned" />
          <StatusChip kind="incident" status="in_progress" />
          <StatusChip kind="incident" status="resolved" />
          <StatusChip kind="workorder" status="open" />
          <StatusChip kind="workorder" status="done" />
          <StatusChip kind="critical" />
          <StatusChip kind="priority" score={85} />
          <StatusChip kind="priority" score={65} />
          <StatusChip kind="priority" score={35} />
        </div>
      </section>

      <section style={{ marginTop: '32px' }}>
        <h2>Tags</h2>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
          <Tag tone="danger">Danger Tag</Tag>
          <Tag tone="gold">Gold Tag</Tag>
          <Tag tone="muted">Muted Tag</Tag>
          <Tag tone="ext">External</Tag>
        </div>
      </section>

      <section style={{ marginTop: '32px' }}>
        <h2>Score Badges</h2>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
          <ScoreBadge score={85} />
          <ScoreBadge score={65} />
          <ScoreBadge score={35} />
          <ScoreBadge score={85} size="lg" />
        </div>
      </section>

      <section style={{ marginTop: '32px' }}>
        <h2>Filter Chips</h2>
        <FilterChipGroup ariaLabel="Status filters">
          <FilterChip label="All" pressed={true} onClick={() => {}} />
          <FilterChip label="Open" pressed={false} onClick={() => {}} count={23} />
          <FilterChip label="Closed" pressed={false} onClick={() => {}} count={5} />
          <FilterChip label="Disabled" pressed={false} onClick={() => {}} disabled />
        </FilterChipGroup>
      </section>

      <section style={{ marginTop: '32px' }}>
        <h2>Form Fields</h2>
        <div style={{ maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
          <TextField id="text-field" label="Text Field" value="" onChange={() => {}} help="Help text" />
          <TextField id="text-error" label="With Error" value="" onChange={() => {}} error="This field is required" />
          <SelectField
            id="select-field"
            label="Select Field"
            value="opt1"
            onChange={() => {}}
            options={[
              { value: 'opt1', label: 'Option 1' },
              { value: 'opt2', label: 'Option 2' },
            ]}
          />
          <TextArea id="textarea" label="Text Area" value="" onChange={() => {}} maxLength={500} />
          <Checkbox id="checkbox" label="I agree to terms" checked={true} />
          <Checkbox id="checkbox-disabled" label="Disabled checkbox" checked={false} disabled />
        </div>
      </section>

      <section style={{ marginTop: '32px' }}>
        <h2>Page Head</h2>
        <PageHead
          title="Sample Page Title"
          subtitle="Optional subtitle text"
          actions={<Button variant="secondary" size="sm">Action</Button>}
          search={{
            value: '',
            onChange: () => {},
            onSubmit: () => {},
            placeholder: 'Search...',
            ariaLabel: 'Search',
          }}
        />
      </section>

      <section style={{ marginTop: '32px' }}>
        <h2>Priority Breakdown</h2>
        <Card>
          <PriorityBreakdown priority={priority} variant="full" reason="High priority due to location near school" />
        </Card>
      </section>

      <section style={{ marginTop: '32px' }}>
        <h2>Timeline</h2>
        <Card>
          <Timeline
            items={[
              {
                id: '1',
                title: <StatusChip kind="incident" status="received" />,
                who: 'المواطن',
                body: 'Report submitted',
                state: 'done',
              },
              {
                id: '2',
                title: <StatusChip kind="incident" status="in_progress" />,
                who: 'Team Lead',
                body: 'Investigation started',
                state: 'current',
                ai: true,
              },
              {
                id: '3',
                title: <StatusChip kind="incident" status="resolved" />,
                who: 'Pending',
                state: 'pending',
              },
            ]}
          />
        </Card>
      </section>

      <section style={{ marginTop: '32px' }}>
        <h2>Charts</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '16px', marginTop: '16px' }}>
          <Card>
            <h3>HBarChart</h3>
            <HBarChart
              ariaLabel="Priority distribution"
              rows={[
                { key: 'high', label: 'High Priority', value: 45 },
                { key: 'medium', label: 'Medium Priority', value: 32 },
                { key: 'low', label: 'Low Priority', value: 18 },
              ]}
            />
          </Card>
          <Card>
            <h3>StackBar</h3>
            <StackBar
              ariaLabel="Status breakdown"
              segments={[
                { key: 'received', value: 44 },
                { key: 'assigned', value: 31 },
                { key: 'progress', value: 53 },
                { key: 'resolved', value: 72 },
              ]}
            />
            <LegendRows
              segments={[
                { key: 'received', value: 44 },
                { key: 'assigned', value: 31 },
                { key: 'progress', value: 53 },
                { key: 'resolved', value: 72 },
              ]}
            />
          </Card>
        </div>
      </section>

      <section style={{ marginTop: '32px' }}>
        <h2>Data Table</h2>
        <Card padded={false}>
          <DataTable<Row> ariaLabel="Sample table" columns={columns} rows={rows} getRowId={(r) => r.id} />
        </Card>
      </section>

      <section style={{ marginTop: '32px' }}>
        <h2>States</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginTop: '16px' }}>
          <Card>
            <Notice tone="gold" icon="alert-triangle">
              This is a gold notice
            </Notice>
          </Card>
          <Card>
            <Notice tone="danger" icon="alert-triangle">
              This is a danger notice
            </Notice>
          </Card>
          <Card>
            <Notice tone="ai" icon="sparkles">
              This is an AI notice
            </Notice>
          </Card>
          <Card>
            <CitizenPreview status="in_progress" note="Team is working on your issue" />
          </Card>
          <Card>
            <EmptyState icon="info" title="No items found" message="There are no items to display" />
          </Card>
          <Card>
            <ErrorState variant="error" onRetry={() => {}} />
          </Card>
        </div>
      </section>

      <section style={{ marginTop: '32px' }}>
        <h2>Skeleton</h2>
        <div style={{ display: 'flex', gap: '16px', marginTop: '16px', flexDirection: 'column' }}>
          <Skeleton variant="line" width="100%" />
          <Skeleton variant="title" />
          <Skeleton variant="metric" />
          <div style={{ display: 'flex', gap: '8px' }}>
            <Skeleton variant="block" width={100} height={100} />
            <Skeleton variant="block" width={100} height={100} />
          </div>
        </div>
      </section>

      <section style={{ marginTop: '32px' }}>
        <h2>KvList</h2>
        <Card>
          <KvList
            items={[
              { label: 'Status', value: <StatusChip kind="incident" status="in_progress" /> },
              { label: 'Priority', value: '75', numeric: true },
              { label: 'Department', value: 'Engineering' },
              { label: 'Created', value: '2026-10-21', numeric: true },
            ]}
          />
        </Card>
      </section>
    </div>
  );
}
