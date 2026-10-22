import type { Incident, TriageSuggestion, IncidentStatus, CategoryId, ServiceRequest } from './types';

export type WorkOrderStatus = 'open' | 'assigned' | 'in_progress' | 'done';

export interface StaffSession {
  userId: string;
  name: string;
  title: string;
  role: 'staff' | 'admin';
  department?: string;
  district: string;
  token: string;
}

export interface Department {
  id: string;
  nameAr: string;
  external: boolean;
  externalHotline?: string;
}

export interface LinkedReport {
  id: string;
  reporter: 'مواطن' | 'بلاغ بدون اسم';
  description: string;
  source: 'app' | 'web';
  photoCount: number;
  createdAt: string;
}

export interface AdminIncident extends Incident {
  linkedReports: LinkedReport[];
  triage?: TriageSuggestion & { source: 'model' | 'fallback'; confirmed: boolean };
  dueAt: string;
  overdue: boolean;
  external: boolean;
  externalHotline?: string;
  inBudgetPlan: boolean;
  lastReviewedBy?: string;
  lastReviewedAt?: string;
}

export interface WorkOrderTask {
  label: string;
  done: boolean;
}

export interface WorkOrderUpdate {
  status: WorkOrderStatus;
  note: string;
  actor: string;
  at: string;
}

export interface WorkOrder {
  id: string;
  incidentId?: string;
  serviceRequestId?: string;
  title: string;
  address: string;
  department: string;
  external: boolean;
  externalHotline?: string;
  team?: string;
  teamSize?: number;
  supervisor?: string;
  status: WorkOrderStatus;
  dueAt: string;
  overdue: boolean;
  estimatedCostEgp: number;
  priorityScore?: number;
  followers?: number;
  tasks: WorkOrderTask[];
  updates: WorkOrderUpdate[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface AdminServiceRequest extends ServiceRequest {
  department: string;
  paid: boolean;
  assignee?: string;
  workOrderId?: string;
}

export interface DashboardStats {
  open: number;
  openDelta: number;
  overdue: number;
  resolvedThisWeek: number;
  resolvedDelta: number;
  avgResolutionDays: number;
  avgResolutionDeltaDays: number;
  byCategory: { categoryId: CategoryId; count: number }[];
  byStatus: { status: IncidentStatus; count: number }[];
  overdueList: {
    incidentId: string;
    title: string;
    department: string;
    address: string;
    priorityScore: number;
    dueAt: string;
    hoursLate: number;
    external: boolean;
    externalHotline?: string;
  }[];
  overdueTotal: number;
  departments: {
    department: string;
    external: boolean;
    externalHotline?: string;
    open: number;
    overdue: number;
    avgResolutionDays: number;
    loadPct: number;
  }[];
  activity: { actor: string; text: string; entityId?: string; status?: IncidentStatus; at: string }[];
  nav: { incidentsOpen: number; serviceRequestsOpen: number };
}

export interface BudgetItem {
  incidentId: string;
  title: string;
  categoryId: CategoryId;
  costEgp: number;
  priorityScore: number;
  followers: number;
  reason: string;
}

export interface BudgetPlan {
  budgetEgp: number;
  selected: BudgetItem[];
  skipped: BudgetItem[];
  totalCost: number;
  remaining: number;
  coveredPriority: number;
  totalPriority: number;
  citizensServed: number;
  citizensTotal: number;
}

export interface Insights {
  summary: string;
  hotspots: { address: string; count: number }[];
  risingCategories: { categoryId: CategoryId; delta: number }[];
  overdueDepartments: string[];
}

export interface Team {
  name: string;
  department: string;
  size: number;
}

export type SmartBinStatus = 'offline' | 'full' | 'heat' | 'low_battery' | 'normal';

export interface SmartBin {
  id: string;
  name: string;
  district: string;
  departmentId?: string;
  lat: number;
  lng: number;
  isActive: boolean;
  isSimulated: boolean;
  fullPct: number;
  heatC: number;
  intervalMin: number;
  lastSeq: number;
  fillPct?: number;
  tempC?: number | null;
  batteryV?: number | null;
  isFull: boolean;
  isHot: boolean;
  lastSeenAt?: string;
  status: SmartBinStatus;
}

export interface SmartBinReading {
  id: number;
  binId: string;
  seq: number;
  recordedAt: string;
  receivedAt: string;
  fillPct: number;
  distanceCm?: number;
  tempC: number | null;
  batteryV: number | null;
  rssi?: number;
  firmware?: string;
  deviceAt: string | null;
  clockUnsynced: boolean | null;
  isFull: boolean;
  isHot: boolean;
}
