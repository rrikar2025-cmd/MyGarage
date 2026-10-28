export async function readPhoto(uri: string) {
  if (!uri.startsWith('data:image/') && !uri.startsWith('blob:'))
    throw new Error('Invalid local image');
  const response = await fetch(uri);
  return response.arrayBuffer();
}
export function releasePhoto(uri: string) {
  if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
}

export const releasePickerPhoto = releasePhoto;
