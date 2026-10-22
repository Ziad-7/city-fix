import type {
  Bin,
  Collector,
  CollectorJob,
  CollectorJobsQuery,
  CompletePickupInput,
  Earnings,
  EarningsQuery,
  Impact,
  MaterialPrice,
  NewRecyclingPickupInput,
  RecyclingPickup,
  ReportFullBinInput,
  WasteClassification,
  Weighing,
  WeighingInput,
} from '@/domain/citycycle';
import type {
  CategoryId,
  Incident,
  LatLng,
  MapPin,
  NewReportInput,
  NewServiceRequestInput,
  OtpChannel,
  Report,
  ServiceRequest,
  Session,
  Transcript,
  TriageSuggestion,
  UploadKind,
} from '@/domain/types';

export interface AuthService {
  /** Sends a 6-digit code by SMS/WhatsApp (mock: nothing is sent; code is 123456). */
  requestCode(phone: string, channel: OtpChannel): Promise<void>;
  /** Mock accepts any 6 digits. */
  verifyCode(phone: string, code: string): Promise<Session>;
  signOut(): Promise<void>;
}

export interface IncidentService {
  /** POST /reports. Creates a report and a new incident, or links to `linkToIncidentId`. */
  submitReport(userId: string, input: NewReportInput): Promise<{ report: Report; incident: Incident }>;
  /** GET /reports (mine), newest first. */
  listMyReports(userId: string): Promise<Report[]>;
  getReport(id: string): Promise<Report | null>;
  /** GET /incidents */
  listIncidents(): Promise<Incident[]>;
  /** GET /incidents/{id} */
  getIncident(id: string): Promise<Incident | null>;
  /** GET /map/incidents */
  listMapPins(): Promise<MapPin[]>;
  /** Ids of the incidents the user follows (own reports are included once reported). Contract proposal: `Incident.isFollowing`. */
  listFollowing(userId: string): Promise<string[]>;
  /** "أنا كمان": adds the user as a follower (once per user). */
  followIncident(userId: string, incidentId: string): Promise<Incident>;
  /** Dev only: advance the incident to its next status. */
  simulateProgress(incidentId: string): Promise<Incident>;
  /** POST /incidents/{id}/reopen (proposed): "لسه المشكلة موجودة" on a resolved incident; back to received with a timeline note. */
  reopenIncident(userId: string, incidentId: string, note: string): Promise<Incident>;
}

export interface ServiceRequestService {
  /** POST /service-requests */
  book(userId: string, input: NewServiceRequestInput): Promise<ServiceRequest>;
  /** GET /service-requests (mine), newest first. */
  listMine(userId: string): Promise<ServiceRequest[]>;
  get(id: string): Promise<ServiceRequest | null>;
  /** Dev only: advance to the next status. */
  simulateProgress(id: string): Promise<ServiceRequest>;
}

export interface TriageService {
  /**
   * AI suggestion (mock: keyword classifier). Includes duplicates when `location` is given.
   * `userId` lets the service leave out incidents the caller reported or follows (the backend does this
   * from the auth token). Own nearby incidents come back as `alreadyReported`.
   */
  analyze(input: {
    userId: string;
    description: string;
    categoryId?: CategoryId;
    photoUri?: string;
    location?: LatLng;
  }): Promise<TriageSuggestion>;
}

export interface UploadService {
  /**
   * API mode: POST /uploads/sign, then PUT the file to the signed URL; returns the storage `path` to send in
   * `photoUris` / `voiceNoteUri`. Mock mode: returns the local URI unchanged.
   */
  upload(localUri: string, kind: UploadKind, contentType: string): Promise<string>;
}

export interface TranscriptionService {
  /** POST /ai/transcribe with an uploaded voice note path (mock: a canned Egyptian Arabic sentence). */
  transcribe(path: string): Promise<Transcript>;
}

/** Citizen side of CityCycle: price list, recyclables pickups, impact, smart bins, AI photo check. Contract: docs/api-contract.md#citycycle--proposed */
export interface CityCycleService {
  /** GET /recycling/materials?district= . One row per material; `priceEgpPerKg` is null where no price is set. */
  listPrices(district: string): Promise<MaterialPrice[]>;
  /** POST /recycling/pickups (status `requested`; `estimatedValueEgp` computed from the price list). */
  createPickup(userId: string, input: NewRecyclingPickupInput): Promise<RecyclingPickup>;
  /** GET /recycling/pickups (mine), newest first. */
  listMyPickups(userId: string): Promise<RecyclingPickup[]>;
  /** GET /recycling/pickups/{id}. null when missing or not the caller's. */
  getPickup(id: string): Promise<RecyclingPickup | null>;
  /** POST /recycling/pickups/{id}/cancel . Only while `requested`. */
  cancelPickup(userId: string, id: string, note?: string): Promise<RecyclingPickup>;
  /** POST /recycling/pickups/{id}/confirm . The household acknowledges the weighing (sets `confirmedAt`). */
  confirmPickup(userId: string, id: string): Promise<RecyclingPickup>;
  /** GET /me/impact . The caller's own impact. */
  getMyImpact(userId: string): Promise<Impact>;
  /**
   * GET /bins . Mock: with `poll` (the map's timer) the filling bins gain a few points, and a bin that stayed full for a
   * few polls is emptied by a simulated collection. Without it the readings stay as they are.
   */
  listBins(opts?: { poll?: boolean }): Promise<Bin[]>;
  /** POST /bins/{id}/report-full . Creates a garbage report linked to the bin. */
  reportFullBin(userId: string, binId: string, input?: ReportFullBinInput): Promise<void>;
  /** POST /ai/waste-classify with an uploaded photo path. A suggestion; never throws (falls back to `source: "fallback"`). */
  classifyWaste(path: string): Promise<WasteClassification>;
  /** Dev only: advance a pickup to its next status as the demo collector would. */
  simulatePickupProgress(id: string): Promise<RecyclingPickup>;
}

/** Collector mode. Contract: `/collectors/*` and `/collector/*`. In API mode the backend knows the caller from the token. */
export interface CollectorService {
  /** GET /collectors/me . Rejects when the caller has no collector profile. */
  getProfile(userId: string): Promise<Collector>;
  /** GET /collector/jobs . Open pickups near a point, nearest first, without citizen details (approximate pin). */
  listNearbyJobs(userId: string, query: CollectorJobsQuery): Promise<CollectorJob[]>;
  /** Proposed: GET /collector/pickups . The caller's accepted jobs (active first) and finished ones, with exact pins. */
  listMyJobs(userId: string): Promise<RecyclingPickup[]>;
  /** POST /collector/jobs/{id}/accept . First accept wins: rejects with `AlreadyTakenError` (409). */
  acceptJob(userId: string, jobId: string): Promise<RecyclingPickup>;
  /** Proposed: POST /collector/jobs/{id}/start . "On my way": adds a timeline entry and `startedAt`. */
  startJob(userId: string, jobId: string): Promise<RecyclingPickup>;
  /** POST /collector/jobs/{id}/weighings . Idempotent on `clientId`. Sets the pickup to `weighed`. */
  recordWeighing(userId: string, jobId: string, input: WeighingInput): Promise<Weighing>;
  /** POST /collector/jobs/{id}/complete . Needs at least one weighing. Omit the amount for a free pickup. */
  completeJob(userId: string, jobId: string, input?: CompletePickupInput): Promise<RecyclingPickup>;
  /** GET /collector/earnings?from&to */
  getEarnings(userId: string, query: EarningsQuery): Promise<Earnings>;
}

export type Services = {
  auth: AuthService;
  incidents: IncidentService;
  serviceRequests: ServiceRequestService;
  triage: TriageService;
  uploads: UploadService;
  transcription: TranscriptionService;
  cityCycle: CityCycleService;
  collector: CollectorService;
};
