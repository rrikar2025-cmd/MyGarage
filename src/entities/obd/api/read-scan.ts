import type { Metrics, ReadStatus, ScanContext, ScanMode } from '@/shared/types';
import { normalizeDtc, normalizeVin, validDtc } from '../lib/codes';
type ReadBridge = {
  readDTCs(): Promise<void>;
  getDTCs(): Promise<string[]>;
  readPendingDTCs(): Promise<void>;
  getPendingDTCs(): Promise<string[]>;
  readPermanentDTCs(): Promise<void>;
  getPermanentDTCs(): Promise<string[]>;
  readVIN(): Promise<void>;
  getVIN(): Promise<string>;
};
export async function executeDiagnosticRead(
  bridge: ReadBridge,
  mode: ScanMode,
  includeVin: boolean,
  assertActive: () => Promise<void>,
  readMetrics: () => Promise<Metrics>,
) {
  const started = Date.now();
  const codes: Record<'stored' | 'pending' | 'permanent', string[]> = {
    stored: [],
    pending: [],
    permanent: [],
  };
  const statuses: Record<'stored' | 'pending' | 'permanent', ReadStatus> = {
    stored: 'not_requested',
    pending: 'not_requested',
    permanent: 'not_requested',
  };
  const reads = {
    stored: async () => {
      await bridge.readDTCs();
      return bridge.getDTCs();
    },
    pending: async () => {
      await bridge.readPendingDTCs();
      return bridge.getPendingDTCs();
    },
    permanent: async () => {
      await bridge.readPermanentDTCs();
      return bridge.getPermanentDTCs();
    },
  };
  for (const kind of mode === 'confirmed'
    ? (['stored'] as const)
    : (['stored', 'pending', 'permanent'] as const)) {
    await assertActive();
    try {
      const result = await reads[kind]();
      if (result.some((code) => !validDtc(code))) throw new Error('Malformed codes');
      codes[kind] = [...new Set(result.map(normalizeDtc))];
      statuses[kind] = 'read';
    } catch {
      await assertActive();
      statuses[kind] = 'unavailable';
    }
  }
  if (!Object.values(statuses).includes('read')) throw new Error('No readable DTC groups');
  let vin: string | undefined;
  let vinStatus: ReadStatus = includeVin ? 'unavailable' : 'not_requested';
  if (includeVin) {
    await assertActive();
    try {
      await bridge.readVIN();
      vin = normalizeVin(await bridge.getVIN()) ?? undefined;
      if (vin) vinStatus = 'read';
    } catch {
      await assertActive();
    }
  }
  let metrics: Metrics = {};
  let telemetryAt: string | null = null;
  await assertActive();
  try {
    metrics = await readMetrics();
    if (Object.keys(metrics).length) telemetryAt = new Date().toISOString();
  } catch {
    await assertActive();
  }
  await assertActive();
  const context: ScanContext = {
    mode,
    statuses,
    vin_status: vinStatus,
    ...(vin ? { vin } : {}),
    telemetry_at: telemetryAt,
    duration_ms: Date.now() - started,
  };
  return { ...codes, metrics, context };
}
