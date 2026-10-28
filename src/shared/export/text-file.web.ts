export async function exportTextFile(
  filename: string,
  content: string,
  _title: string,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) throw new Error('EXPORT_CANCELLED');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Let the browser consume the blob before releasing it.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
