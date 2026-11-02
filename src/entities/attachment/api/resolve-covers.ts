import { validPreparedPhoto, type Attachment } from '../model/types';

type Identity = { owner: string; id: string; path: string };
type Reference = { uri: string; release: () => void };
type Dependencies = {
  guard(owner: string): Promise<void>;
  sign(owner: string, items: Attachment[]): Promise<Record<string, string>>;
  read(identity: Identity): Promise<Reference | null>;
  write(identity: Identity, bytes: ArrayBuffer): Promise<Reference>;
  remove(identity: Identity): Promise<void>;
  download(url: string): Promise<ArrayBuffer>;
};

export async function resolveCloudCovers(owner: string, covers: Attachment[], deps: Dependencies) {
  const urls: Record<string, string> = {};
  const releases: (() => void)[] = [];
  let retrySoon = false;
  try {
    const missing: Attachment[] = [];
    for (const row of covers) {
      const identity = { owner, id: row.id, path: row.path };
      const cached = await deps.read(identity).catch(() => null);
      if (cached) {
        urls[row.vehicle_id] = cached.uri;
        releases.push(cached.release);
      } else missing.push(row);
    }
    await deps.guard(owner);
    const signed = missing.length ? await deps.sign(owner, missing) : {};
    for (const row of missing) {
      const url = signed[row.path];
      if (!url) continue;
      try {
        const bytes = await deps.download(url);
        if (!validPreparedPhoto(bytes)) throw new Error('Invalid photo');
        await deps.guard(owner);
        const identity = { owner, id: row.id, path: row.path };
        const cached = await deps.write(identity, bytes);
        releases.push(cached.release);
        try {
          await deps.guard(owner);
        } catch (error) {
          await deps.remove(identity).catch(() => {});
          throw error;
        }
        urls[row.vehicle_id] = cached.uri;
      } catch {
        urls[row.vehicle_id] = url;
        retrySoon = true;
      }
    }
    await deps.guard(owner);
    return { urls, release: () => releases.forEach((release) => release()), retrySoon };
  } catch (error) {
    releases.forEach((release) => release());
    throw error;
  }
}
