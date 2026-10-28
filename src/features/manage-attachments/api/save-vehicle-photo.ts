import { uploadAttachment } from '@/entities/attachment';
import { useSession } from '@/entities/session';
import { saveLocalVehicleCover } from '@/shared/media';
import type { VehiclePhotoDraft } from '../model/use-vehicle-photo-draft';
export async function saveVehiclePhoto(
  owner: string | null,
  vehicleId: string,
  photo: VehiclePhotoDraft,
) {
  if ((useSession.getState().session?.user.id ?? null) !== owner)
    throw new Error('Photo session changed');
  if (owner)
    await uploadAttachment(
      owner,
      { kind: 'vehicle', id: vehicleId, vehicleId },
      photo.id,
      photo.bytes,
      '',
    );
  else await saveLocalVehicleCover(vehicleId, photo.id, photo.bytes);
  if ((useSession.getState().session?.user.id ?? null) !== owner)
    throw new Error('Photo session changed');
}
