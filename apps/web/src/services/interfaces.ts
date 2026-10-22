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
    /** Explicit user opt-in before sending the photo to the configured AI provider. */
    photoConsent?: boolean;
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

export type Services = {
  auth: AuthService;
  incidents: IncidentService;
  serviceRequests: ServiceRequestService;
  triage: TriageService;
  uploads: UploadService;
  transcription: TranscriptionService;
};
