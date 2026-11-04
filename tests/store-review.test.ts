import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canRequestReview,
  REVIEW_MIN_AGE_MS,
  REVIEW_RETRY_MS,
} from '../src/features/request-store-review/model/policy';

test('review eligibility begins three days after installation and waits 120 days after an attempt', () => {
  const installedAt = 1_000_000_000;
  const state = { installedAt, lastAttemptAt: null };
  assert.equal(canRequestReview(null, installedAt), false);
  assert.equal(canRequestReview(state, installedAt + REVIEW_MIN_AGE_MS - 1), false);
  assert.equal(canRequestReview(state, installedAt + REVIEW_MIN_AGE_MS), true);
  const attempted = { ...state, lastAttemptAt: installedAt + REVIEW_MIN_AGE_MS };
  assert.equal(canRequestReview(attempted, attempted.lastAttemptAt + REVIEW_RETRY_MS - 1), false);
  assert.equal(canRequestReview(attempted, attempted.lastAttemptAt + REVIEW_RETRY_MS), true);
});
