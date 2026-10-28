import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
export async function exportTextFile(
  filename: string,
  content: string,
  title: string,
  signal: AbortSignal,
): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('SHARING_UNAVAILABLE');
  if (signal.aborted) throw new Error('EXPORT_CANCELLED');
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(content);
  if (signal.aborted) {
    file.delete();
    throw new Error('EXPORT_CANCELLED');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: title,
  });
}
