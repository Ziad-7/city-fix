import type { Services } from '../interfaces';
import { createMockAuthService } from './auth-service';
import { createMockIncidentService } from './incident-service';
import { createMockServiceRequestService } from './service-request-service';
import { createMockTranscriptionService } from './transcription-service';
import { createMockTriageService } from './triage-service';
import { createMockUploadService } from './upload-service';

export { MOCK_OTP } from './auth-service';
export { resetMockDb } from './db';

export function createMockServices(): Services {
  return {
    auth: createMockAuthService(),
    incidents: createMockIncidentService(),
    serviceRequests: createMockServiceRequestService(),
    triage: createMockTriageService(),
    uploads: createMockUploadService(),
    transcription: createMockTranscriptionService(),
  };
}
