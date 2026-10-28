import type { Attachment } from './types';
/** Latest completed vehicle photo is the cover; receipts and pending uploads never qualify. */
export function latestVehiclePhotos(owner: string, vehicleIds: string[], rows: Attachment[]) {
  const allowed = new Set(vehicleIds),
    covers = new Map<string, Attachment>();
  for (const row of rows) {
    if (
      row.owner_id !== owner ||
      row.kind !== 'vehicle' ||
      row.state !== 'ready' ||
      !allowed.has(row.vehicle_id)
    )
      continue;
    const previous = covers.get(row.vehicle_id);
    if (
      !previous ||
      row.created_at > previous.created_at ||
      (row.created_at === previous.created_at && row.id > previous.id)
    )
      covers.set(row.vehicle_id, row);
  }
  return [...covers.values()];
}
