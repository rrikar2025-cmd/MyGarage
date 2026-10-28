import { useEffect, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import type { MessageKey } from '@/shared/i18n';
import { pickPhoto, releasePhoto, type PreparedPhoto } from '../api/pick-photo';
export type VehiclePhotoDraft = PreparedPhoto & { id: string };
export function useVehiclePhotoDraft() {
  const [photo, setPhoto] = useState<VehiclePhotoDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const current = useRef<VehiclePhotoDraft | null>(null),
    active = useRef(true),
    lock = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      if (current.current) releasePhoto(current.current.uri);
    };
  }, []);
  function clear() {
    if (lock.current) return;
    if (current.current) releasePhoto(current.current.uri);
    current.current = null;
    setPhoto(null);
    setError(null);
  }
  async function choose(camera: boolean) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const prepared = await pickPhoto(camera);
      if (!prepared) return;
      if (!active.current) {
        releasePhoto(prepared.uri);
        return;
      }
      const next = { ...prepared, id: randomUUID() };
      if (current.current) releasePhoto(current.current.uri);
      current.current = next;
      setPhoto(next);
    } catch (failure) {
      if (active.current)
        setError(
          failure instanceof Error && failure.message === 'PHOTO_PERMISSION'
            ? 'photoPermissionDenied'
            : failure instanceof Error && failure.message === 'PHOTO_TOO_LARGE'
              ? 'photoTooLarge'
              : 'photoPickFailed',
        );
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }
  return { photo, busy, error, choose, clear };
}
