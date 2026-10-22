import type { Incident, NewReportInput, Report } from '@/domain/types';
import { services } from '@/services';
import { prepareReportInput } from './media';

/**
 * The submit pipeline shared by the form and the offline queue: compress + upload photos and the voice note,
 * then POST /reports. `onPrepared` receives the input with uploaded paths before the POST, so a failure there
 * can be queued without uploading the files again.
 */
export async function sendReport(
  userId: string,
  input: NewReportInput,
  onPrepared?: (prepared: NewReportInput) => void,
  idempotencyKey?: string,
): Promise<{ report: Report; incident: Incident }> {
  const prepared = await prepareReportInput(input, (uri, kind, type) => services.uploads.upload(uri, kind, type));
  onPrepared?.(prepared);
  return services.incidents.submitReport(userId, prepared, idempotencyKey);
}
