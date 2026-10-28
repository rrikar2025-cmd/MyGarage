import { File } from 'expo-file-system';
export async function readPhoto(uri: string) {
  return new File(uri).arrayBuffer();
}
export function releasePhoto(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {}
}

// Native picker sources may refer to the user's original file. Keep them.
export function releasePickerPhoto(_uri: string) {}
