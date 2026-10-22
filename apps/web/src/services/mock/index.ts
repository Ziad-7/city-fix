import type { Services } from '../interfaces';
import { createMockAuthService } from './auth-service';
import { resetCityCycleDb } from './citycycle-db';
import { createMockBinService, createMockCollectorService, createMockRecyclingService, createMockWasteAiService } from './citycycle-services';
import { createMockIncidentService } from './incident-service';
import { createMockServiceRequestService } from './service-request-service';
import { createMockTranscriptionService } from './transcription-service';
import { createMockTriageService } from './triage-service';
import { createMockUploadService } from './upload-service';
import { resetMockDb as resetFixFirstMockDb } from './db';

export { MOCK_OTP } from './auth-service';
/** Wipes every persisted mock database (FixFirst and CityCycle); the next load re-seeds. */
export async function resetMockDb(): Promise<void> {
  await Promise.all([resetFixFirstMockDb(), resetCityCycleDb()]);
}

export function createMockServices(): Services {
  return {
    auth: createMockAuthService(),
    incidents: createMockIncidentService(),
    serviceRequests: createMockServiceRequestService(),
    triage: createMockTriageService(),
    uploads: createMockUploadService(),
    transcription: createMockTranscriptionService(),
    recycling: createMockRecyclingService(),
    collector: createMockCollectorService(),
    bins: createMockBinService(),
    waste: createMockWasteAiService(),
  };
}
