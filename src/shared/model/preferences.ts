import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getLocales } from 'expo-localization';
import {
  normalizeMetricSelection,
  defaultDashboardMetrics,
  type MetricKey,
  type TelemetryUnits,
} from '@/shared/types';
import { storage } from '@/shared/lib';
export type Locale = 'uk' | 'en';
export type ThemePreference = 'system' | 'light' | 'dark';
type Preferences = {
  locale: Locale;
  units: TelemetryUnits;
  dashboardMetrics: MetricKey[];
  setUnits: (units: TelemetryUnits) => void;
  setDashboardMetrics: (keys: MetricKey[]) => void;
  theme: ThemePreference;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemePreference) => void;
};
export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      locale: getLocales()[0]?.languageCode === 'en' ? 'en' : 'uk',
      theme: 'system',
      units: 'metric',
      dashboardMetrics: defaultDashboardMetrics,
      setUnits: (units) => set({ units }),
      setDashboardMetrics: (keys) => set({ dashboardMetrics: normalizeMetricSelection(keys) }),
      setLocale: (locale) => set({ locale }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'mygarage.preferences.v1',
      storage: createJSONStorage(() => storage),
      merge: (saved, current) => {
        const value = saved as Partial<Preferences> | null;
        return {
          ...current,
          locale: value?.locale === 'en' ? 'en' : value?.locale === 'uk' ? 'uk' : current.locale,
          theme: ['light', 'dark', 'system'].includes(value?.theme ?? '')
            ? value!.theme!
            : current.theme,
          units: value?.units === 'imperial' ? 'imperial' : 'metric',
          dashboardMetrics: normalizeMetricSelection(value?.dashboardMetrics),
        };
      },
    },
  ),
);
