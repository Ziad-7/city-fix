import { alreadyTakenLabel } from '@/i18n/labels';
import { ApiError } from './api/http';

/** Another collector accepted the job first (HTTP 409 on accept). The message is "اتاخد خلاص" / "Already taken". */
export class AlreadyTakenError extends Error {
  constructor() {
    super(alreadyTakenLabel());
    this.name = 'AlreadyTakenError';
  }
}

/** True for the mock's `AlreadyTakenError` and for a 409 from the API. */
export const isAlreadyTaken = (e: unknown): boolean => e instanceof AlreadyTakenError || (e instanceof ApiError && e.status === 409);

/** Bad input (too little weight, nothing to complete ...). The message is already in the app language. */
export class CityCycleInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CityCycleInputError';
  }
}
