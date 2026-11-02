const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export function cloudCoverOwnerPrefix(owner: string) {
  if (!UUID.test(owner)) throw new Error('Invalid cached photo owner');
  return `${owner.toLowerCase()}.`;
}

export function cloudCoverCacheKey(owner: string, photoId: string, path: string) {
  if (!UUID.test(owner) || !UUID.test(photoId) || path !== `${owner}/${photoId}.jpg`)
    throw new Error('Invalid cached photo identity');
  return `${cloudCoverOwnerPrefix(owner)}${photoId.toLowerCase()}`;
}
