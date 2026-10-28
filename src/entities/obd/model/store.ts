import { create } from 'zustand';
import type { Metrics } from '@/shared/types';
import { appendSample, type TelemetrySample } from '../lib/metrics';
export type { Metrics } from '@/shared/types';
export type OBDState = {
  status: 'disconnected' | 'connecting' | 'connected';
  deviceName: string | null;
  metrics: Metrics;
  updatedAt: string | null;
  reading: boolean;
  error: boolean;
  samples: TelemetrySample[];
  scanPending: boolean;
  codesClearedAt: string | null;
};
export const useOBD = create<OBDState>(() => ({
  status: 'disconnected',
  deviceName: null,
  metrics: {},
  updatedAt: null,
  reading: false,
  error: false,
  samples: [],
  scanPending: false,
  codesClearedAt: null,
}));
export function resetOBD() {
  useOBD.setState({
    status: 'disconnected',
    deviceName: null,
    metrics: {},
    updatedAt: null,
    reading: false,
    error: false,
    samples: [],

    codesClearedAt: null,
  });
}

export function publishTelemetry(metrics: Metrics) {
  const at = new Date().toISOString();
  useOBD.setState((state) => ({
    metrics,
    updatedAt: at,
    error: false,
    samples: appendSample(state.samples, { at, metrics }),
  }));
}
