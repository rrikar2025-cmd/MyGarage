import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { loadCloudVehicleCovers } from '@/entities/attachment';
import { loadLocalVehicleCovers, type LocalVehicleCovers } from '@/shared/media';
export function useVehicleCovers(owner: string | null, vehicleIds: string[]) {
  const idsKey = [...new Set(vehicleIds)].sort().join(',');
  const scope = `${owner ?? 'guest'}:${idsKey}`;
  const [result, setResult] = useState<{ scope: string; urls: Record<string, string> }>({
    scope: '',
    urls: {},
  });
  useFocusEffect(
    useCallback(() => {
      let active = true,
        pending = false,
        local: LocalVehicleCovers | undefined;
      const ids = idsKey ? idsKey.split(',') : [];
      setResult({ scope, urls: {} });
      async function refresh() {
        if (!active || pending || !ids.length) return;
        pending = true;
        let loaded: LocalVehicleCovers | undefined;
        try {
          const urls = owner
            ? await loadCloudVehicleCovers(owner, ids)
            : (loaded = await loadLocalVehicleCovers(ids)).urls;
          if (!active) {
            loaded?.release();
            return;
          }
          const previous = local;
          local = loaded;
          setResult({ scope, urls });
          previous?.release();
        } catch {
          loaded?.release(); /* The card retains its illustration when a photo is unavailable. */
        } finally {
          pending = false;
        }
      }
      void refresh();
      const timer = owner
        ? setInterval(() => {
            if (AppState.currentState === 'active') void refresh();
          }, 45000)
        : undefined;
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') void refresh();
      });
      return () => {
        active = false;
        if (timer) clearInterval(timer);
        sub.remove();
        local?.release();
      };
    }, [owner, idsKey, scope]),
  );
  return result.scope === scope ? result.urls : {};
}
