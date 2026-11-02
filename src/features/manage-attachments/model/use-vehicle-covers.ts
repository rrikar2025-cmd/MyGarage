import { useCallback, useEffect, useRef, useState } from 'react';
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
  const cachedView = useRef<(LocalVehicleCovers & { scope: string }) | null>(null);
  useEffect(
    () => () => {
      if (cachedView.current?.scope === scope) {
        cachedView.current.release();
        cachedView.current = null;
      }
    },
    [scope],
  );
  useFocusEffect(
    useCallback(() => {
      let active = true,
        pending = false,
        retryTimer: ReturnType<typeof setTimeout> | undefined;
      const ids = idsKey ? idsKey.split(',') : [];
      async function refresh() {
        if (!active || pending || !ids.length) return;
        pending = true;
        let loaded: LocalVehicleCovers | undefined;
        try {
          const cloud = owner ? await loadCloudVehicleCovers(owner, ids) : undefined;
          loaded = cloud ?? (await loadLocalVehicleCovers(ids));
          if (!active) {
            loaded?.release();
            return;
          }
          const previous = cachedView.current;
          cachedView.current = { ...loaded, scope };
          setResult({ scope, urls: loaded.urls });
          previous?.release();
          if (retryTimer) clearTimeout(retryTimer);
          if (cloud?.retrySoon)
            retryTimer = setTimeout(() => {
              if (AppState.currentState === 'active') void refresh();
            }, 45000);
        } catch {
          loaded?.release(); /* The card retains its illustration when a photo is unavailable. */
        } finally {
          pending = false;
        }
      }
      void refresh();
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') void refresh();
      });
      return () => {
        active = false;
        if (retryTimer) clearTimeout(retryTimer);
        sub.remove();
      };
    }, [owner, idsKey, scope]),
  );
  return result.scope === scope ? result.urls : {};
}
