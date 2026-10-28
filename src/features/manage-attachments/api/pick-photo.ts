import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { validPreparedPhoto } from '@/entities/attachment';
import { readPhoto, releasePhoto, releasePickerPhoto } from './read-photo';
export type PreparedPhoto = { uri: string; bytes: ArrayBuffer };
export async function pickPhoto(camera = false, receipt = false): Promise<PreparedPhoto | null> {
  if (camera) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('PHOTO_PERMISSION');
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: false,
    allowsMultipleSelection: false,
    exif: false,
    quality: 1,
  };
  const selected = camera
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  if (selected.canceled) return null;
  const asset = selected.assets[0];
  if (!asset) return null;
  let context: ReturnType<typeof ImageManipulator.manipulate> | undefined;
  let image:
    Awaited<ReturnType<ReturnType<typeof ImageManipulator.manipulate>['renderAsync']>> | undefined;
  try {
    if ((asset.fileSize ?? 0) > 20 * 1024 * 1024 || asset.width > 12000 || asset.height > 12000)
      throw new Error('PHOTO_TOO_LARGE');
    context = ImageManipulator.manipulate(asset.uri);
    const longest = Math.max(asset.width, asset.height);
    const maxEdge = receipt ? 2400 : 1600;
    if (longest > maxEdge)
      context.resize(asset.width >= asset.height ? { width: maxEdge } : { height: maxEdge });
    image = await context.renderAsync();
    const result = await image.saveAsync({
      format: SaveFormat.JPEG,
      compress: receipt ? 0.9 : 0.82,
    });
    try {
      const bytes = await readPhoto(result.uri);
      if (!validPreparedPhoto(bytes)) throw new Error('PHOTO_TOO_LARGE');
      return { uri: result.uri, bytes };
    } catch (error) {
      releasePhoto(result.uri);
      throw error;
    }
  } finally {
    image?.release();
    context?.release();
    releasePickerPhoto(asset.uri);
  }
}
export { releasePhoto };
