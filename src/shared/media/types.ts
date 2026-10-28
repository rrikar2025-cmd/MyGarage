export type LocalVehicleCovers = { urls: Record<string, string>; release: () => void };
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export const COVER_PREFIX = 'mygarage.guest-cover.v1.';
export function coverKey(vehicleId: string) {
  if (!UUID.test(vehicleId)) throw new Error('Invalid local vehicle');
  return COVER_PREFIX + vehicleId;
}
export function coverFilename(vehicleId: string, photoId: string) {
  coverKey(vehicleId);
  coverKey(photoId);
  return `${vehicleId}.${photoId}.jpg`;
}
export function validCoverFilename(name: string, vehicleId: string) {
  return (
    name.startsWith(`${vehicleId}.`) &&
    name.endsWith('.jpg') &&
    UUID.test(name.slice(vehicleId.length + 1, -4))
  );
}
