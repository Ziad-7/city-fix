/**
 * Offline queue of collector actions (weighings and "complete"), pure part: the shape of an item and the helpers that
 * read it. The store and the sync are in ./useCollectorQueue.
 */
import type { CompletePickupInput, WeighingInput } from '@/domain/citycycle';
import type { PendingWeighing } from './logic';

export type QueuedAction =
  | { kind: 'weighing'; id: string; userId: string; jobId: string; at: string; attempts: number; input: WeighingInput }
  | { kind: 'complete'; id: string; userId: string; jobId: string; at: string; attempts: number; input: CompletePickupInput };

export const forJob = (items: readonly QueuedAction[], userId: string | null, jobId: string): QueuedAction[] =>
  items.filter((i) => i.userId === userId && i.jobId === jobId);

export const pendingWeighingsOf = (items: readonly QueuedAction[], userId: string | null, jobId: string): PendingWeighing[] =>
  forJob(items, userId, jobId).flatMap((i) =>
    i.kind === 'weighing' ? [{ clientId: i.input.clientId, materialId: i.input.materialId, kg: i.input.kg, source: i.input.source, scaleId: i.input.scaleId, at: i.at }] : [],
  );

export const pendingCompleteOf = (items: readonly QueuedAction[], userId: string | null, jobId: string): Extract<QueuedAction, { kind: 'complete' }> | null =>
  (forJob(items, userId, jobId).find((i) => i.kind === 'complete') as Extract<QueuedAction, { kind: 'complete' }> | undefined) ?? null;

/** How many actions of this person wait for the network. */
export const waitingCount = (items: readonly QueuedAction[], userId: string | null): number => items.filter((i) => i.userId === userId).length;
