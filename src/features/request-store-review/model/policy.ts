export const REVIEW_MIN_AGE_MS = 3 * 24 * 60 * 60 * 1000;
export const REVIEW_RETRY_MS = 120 * 24 * 60 * 60 * 1000;

export type ReviewState = { installedAt: number; lastAttemptAt: number | null };

export function canRequestReview(state: ReviewState | null, now: number): boolean {
  return Boolean(
    state &&
    now - state.installedAt >= REVIEW_MIN_AGE_MS &&
    (state.lastAttemptAt === null || now - state.lastAttemptAt >= REVIEW_RETRY_MS),
  );
}
