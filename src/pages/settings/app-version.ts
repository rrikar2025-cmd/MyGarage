export function resolveAppVersion(readNativeVersion: () => unknown, fallback: string): string {
  try {
    const version = readNativeVersion();
    return typeof version === 'string' && version.trim() ? version : fallback;
  } catch {
    return fallback;
  }
}
