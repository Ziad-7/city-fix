import type { Services } from '../interfaces';
import { createMockAuthService } from './auth-service';
import { createMockCityCycleService } from './citycycle-service';
import { createMockCollectorService } from './collector-service';
import { createMockIncidentService } from './incident-service';
import { createMockServiceRequestService } from './service-request-service';
import { createMockTranscriptionService } from './transcription-service';
import { createMockTriageService } from './triage-service';
import { createMockUploadService } from './upload-service';

export { MOCK_OTP } from './auth-service';
export { resetMockDb } from './db';
export { DEMO_COLLECTOR_USER_ID, OTHER_COLLECTOR_USER_ID } from './citycycle-seed';

export function createMockServices(): Services {
  return {
    auth: createMockAuthService(),
    incidents: createMockIncidentService(),
    serviceRequests: createMockServiceRequestService(),
    triage: createMockTriageService(),
    uploads: createMockUploadService(),
    transcription: createMockTranscriptionService(),
    cityCycle: createMockCityCycleService(),
    collector: createMockCollectorService(),
  };
}
