export type IncidentStatus = 'received' | 'triaged' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type CategoryId =
  | 'pothole'
  | 'open_manhole'
  | 'sewage_overflow'
  | 'water_pipe_burst'
  | 'garbage'
  | 'streetlight_out'
  | 'exposed_wire'
  | 'road_obstruction'
  | 'stray_dogs'
  | 'fallen_tree'
  | 'broken_sidewalk'
  | 'other';

export type IconName =
  | 'home' | 'map' | 'camera' | 'clipboard' | 'user' | 'bell'
  | 'arrow-back' | 'arrow-forward' | 'chevron' | 'chevron-down'
  | 'alert-triangle' | 'trash' | 'tree' | 'bulb' | 'mic' | 'play'
  | 'pin' | 'shield-check' | 'wifi' | 'users' | 'share' | 'check' | 'plus'
  | 'search' | 'clock' | 'zap' | 'droplets' | 'pipe' | 'manhole' | 'pothole'
  | 'cone' | 'paw' | 'sidewalk' | 'more' | 'phone' | 'sparkles' | 'eye-off'
  | 'whatsapp' | 'x' | 'image' | 'locate' | 'info' | 'flame' | 'calendar' | 'refresh';

export type LatLng = { lat: number; lng: number };

export type Place = LatLng & {
  address: string;
  /** Free-text landmark, e.g. "قدام مدرسة النصر الإعدادية". */
  landmark?: string;
};

export type TimelineEntry = {
  status: IncidentStatus;
  note: string;
  actor: string;
  /** ISO timestamp */
  at: string;
};

export type PriorityFactor = { key: string; label: string; points: number; max: number };
export type Priority = { score: number; factors: PriorityFactor[] };

export type Category = {
  id: CategoryId;
  labelAr: string;
  icon: IconName;
  /** Life-threatening: shows the "خطر" tag and jumps the priority queue. */
  danger: boolean;
  defaultSeverity: Severity;
  department: string;
  /** External body (utility); shown with its hotline. */
  externalHotline?: string;
  /** Working-day response target used by the priority score. */
  targetDays: number;
  /** Rough repair cost used for the budget view (EGP). */
  estimatedCostEgp: number;
};

export type Incident = {
  id: string;
  categoryId: CategoryId;
  title: string;
  severity: Severity;
  priority: Priority;
  status: IncidentStatus;
  department: string;
  estimatedCostEgp: number;
  linkedReportIds: string[];
  followers: number;
  location: Place;
  /** Name of a school/hospital/etc. within ~150 m, if any. */
  sensitivePlace?: string;
  areaUnderserved: boolean;
  workOrderId?: string;
  /** Human ETA, e.g. "خلال ٣ أيام". */
  eta?: string;
  timeline: TimelineEntry[];
  createdAt: string;
  updatedAt: string;
  /** For the authenticated caller: they reported or follow this incident (backend proposal; the mock keeps a per-user list). */
  isFollowing?: boolean;
};

export type Report = {
  id: string;
  reporterId: string;
  incidentId: string;
  categoryId: CategoryId;
  description: string;
  photoUris: string[];
  location: Place;
  anonymous: boolean;
  blurFaces: boolean;
  createdAt: string;
  voiceNoteUri?: string;
};

export type NewReportInput = {
  categoryId: CategoryId;
  description: string;
  photoUris: string[];
  location: Place;
  anonymous: boolean;
  blurFaces: boolean;
  voiceNoteUri?: string;
  /** When set, the report is linked to this existing incident ("نفس المشكلة، تابعها"). */
  linkToIncidentId?: string;
  severity?: Severity;
  governorate?: string;
  district?: string;
};

export type DuplicateMatch = {
  incidentId: string;
  title: string;
  categoryId: CategoryId;
  distanceM: number;
  followers: number;
  status: IncidentStatus;
};

/** An open, nearby, same-category incident that the caller has already reported themselves. */
export type AlreadyReported = {
  incidentId: string;
  /** The caller's own report on that incident (links to /requests/{reportId}). */
  reportId: string;
  title: string;
  categoryId: CategoryId;
  distanceM: number;
};

export type TriageOption = { categoryId: CategoryId; confidence: number };
export type TriageSuggestion = {
  /** Top-3, sorted by confidence desc; confidences sum <= 1. */
  options: TriageOption[];
  severity: Severity;
  /** One-line Arabic summary. */
  summary: string;
  /** Joinable duplicates only: never an incident the caller reported or already follows. */
  duplicates: DuplicateMatch[];
  /** Nearby incidents the caller reported themselves (shown as "البلاغ ده متسجّل باسمك بالفعل", not as a join offer). */
  alreadyReported?: AlreadyReported[];
  /** "model" or "fallback" (keyword classifier). */
  source?: 'model' | 'fallback';
  /** The text mentions gas, fire, injury or a collapse: show the emergency numbers first. */
  emergency?: boolean;
};

/** Result of POST /ai/transcribe (Egyptian Arabic speech to text). */
export type Transcript = { text: string; confidence: number };

export type UploadKind = 'report_photo' | 'voice_note';

/** In-app notification (status changes on the citizen's reports and service requests). */
export type AppNotification = {
  id: string;
  entityType: 'report' | 'service_request';
  /** Report id (FTC-…) or service request id (SRV-…): opens /requests/{entityId}. */
  entityId: string;
  status: IncidentStatus;
  title: string;
  body: string;
  at: string;
  read: boolean;
};

export type ServiceType = 'bulky_waste' | 'tree_maintenance';
export type PaymentMethod = 'cash' | 'fawry' | 'instapay' | 'wallet';
export type SlotId = 'morning' | 'afternoon';

export type ServiceRequest = {
  id: string;
  citizenId: string;
  serviceType: ServiceType;
  details: {
    items: string[];
    /** ISO date (YYYY-MM-DD) */
    day: string;
    slot: SlotId;
    /** Absent for free district services (tree maintenance). */
    payment?: PaymentMethod;
    note?: string;
    /** Tree maintenance: what is needed (تقليم، إزالة …). */
    workType?: string;
    photoUris?: string[];
  };
  location: Place;
  status: IncidentStatus;
  timeline: TimelineEntry[];
  createdAt: string;
};

export type NewServiceRequestInput = Omit<ServiceRequest, 'id' | 'citizenId' | 'status' | 'timeline' | 'createdAt'>;

/** Lightweight pin for GET /map/incidents. */
export type MapPin = {
  id: string;
  categoryId: CategoryId;
  title: string;
  status: IncidentStatus;
  severity: Severity;
  lat: number;
  lng: number;
  /** Severity is critical or the priority score is urgent (client-computed when the server sends only severity). */
  critical?: boolean;
};

export type Session = {
  userId: string;
  phone: string;
  name?: string;
  /** Bearer token from /auth/verify (API mode). Persisted with the session. */
  token?: string;
};

export type OtpChannel = 'sms' | 'whatsapp';

export const STATUS_LABEL_AR: Record<IncidentStatus, string> = {
  received: 'وصل',
  triaged: 'اتصنّف',
  assigned: 'اتحوّل',
  in_progress: 'جاري التنفيذ',
  resolved: 'اتصلّح',
  closed: 'اتقفل',
};

export const SEVERITY_LABEL_AR: Record<Severity, string> = {
  low: 'خطورة بسيطة',
  medium: 'خطورة متوسطة',
  high: 'خطورة عالية',
  critical: 'خطر',
};

export const isOpenStatus = (s: IncidentStatus) => s !== 'resolved' && s !== 'closed';
