import { AppState, Platform } from 'react-native';
import { storage } from '@/shared/lib';
import { canRequestReview, type ReviewState } from './policy';

const KEY = 'mygarage.store-review.v2';
const LEGACY_KEY = 'mygarage.store-review.v1';
let queue: Promise<void> = Promise.resolve();

function runSerial(task: () => Promise<void>): Promise<void> {
  const next = queue.then(task, task);
  queue = next.catch(() => {});
  return next;
}

async function readState(): Promise<ReviewState | null> {
  const raw = await storage.getItem(KEY);
  if (!raw) return null;
  try {
    const state = JSON.parse(raw) as ReviewState;
    return state &&
      Number.isFinite(state.installedAt) &&
      (state.lastAttemptAt === null || Number.isFinite(state.lastAttemptAt))
      ? state
      : null;
  } catch {
    return null;
  }
}

async function createState(): Promise<ReviewState> {
  const now = Date.now();
  let installedAt = now;
  let lastAttemptAt: number | null = null;
  try {
    // Guard loading for older builds that may not contain the native module.
    const application = require('expo-application') as typeof import('expo-application');
    const installed = (await application.getInstallationTimeAsync()).getTime();
    if (Number.isFinite(installed) && installed > 0 && installed <= now) installedAt = installed;
  } catch {
    // When installation time is unavailable, start counting at first launch instead.
  }
  try {
    const raw = await storage.getItem(LEGACY_KEY);
    if (raw) {
      const previous = JSON.parse(raw) as { lastAttemptAt?: unknown };
      if (typeof previous.lastAttemptAt === 'number' && Number.isFinite(previous.lastAttemptAt))
        lastAttemptAt = previous.lastAttemptAt;
    }
  } catch {
    // A corrupt old value must not prevent initialization.
  }
  const state = { installedAt, lastAttemptAt };
  await storage.setItem(KEY, JSON.stringify(state));
  return state;
}

export function initializeReview(): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  return runSerial(async () => {
    if (!(await readState())) await createState();
  });
}

export function requestReviewIfEligible(isFocused: () => boolean): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  return runSerial(async () => {
    const state = (await readState()) ?? (await createState());
    if (!canRequestReview(state, Date.now()) || !isFocused() || AppState.currentState !== 'active')
      return;
    try {
      const review = require('expo-store-review') as typeof import('expo-store-review');
      if (!(await review.isAvailableAsync()) || !isFocused() || AppState.currentState !== 'active')
        return;
      // The store does not disclose whether its sheet was shown or a review submitted.
      await storage.setItem(KEY, JSON.stringify({ ...state, lastAttemptAt: Date.now() }));
      if (!isFocused() || AppState.currentState !== 'active') return;
      await review.requestReview();
    } catch {
      // Rating must never interrupt the user's workflow.
    }
  });
}
