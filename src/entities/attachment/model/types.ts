export const attachmentKinds = ['vehicle', 'fuel', 'service'] as const;
export type AttachmentKind = (typeof attachmentKinds)[number];
export type AttachmentTarget = { kind: AttachmentKind; id: string; vehicleId: string };
export type Attachment = {
  id: string;
  owner_id: string;
  vehicle_id: string;
  kind: AttachmentKind;
  modification_id: string | null;
  build_id: string | null;
  fuel_id: string | null;
  service_id: string | null;
  path: string;
  caption: string;
  state: 'uploading' | 'ready';
  created_at: string;
};
export const PRIVATE_MEDIA_BUCKET = 'mygarage-private';
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export function targetColumns(target: AttachmentTarget) {
  return {
    kind: target.kind,
    vehicle_id: target.vehicleId,
    modification_id: null,
    build_id: null,
    fuel_id: target.kind === 'fuel' ? target.id : null,
    service_id: target.kind === 'service' ? target.id : null,
  };
}
export function photoPath(owner: string, id: string) {
  return `${owner}/${id}.jpg`;
}
export function validPreparedPhoto(bytes: ArrayBuffer) {
  const data = new Uint8Array(bytes);
  return (
    data.length > 3 &&
    data.length <= MAX_PHOTO_BYTES &&
    data[0] === 255 &&
    data[1] === 216 &&
    data[2] === 255
  );
}
