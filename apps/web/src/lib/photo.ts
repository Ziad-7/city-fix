/**
 * Reads a picked image and re-encodes it as a JPEG data URL, scaled down like the app's camera quality
 * setting (data saver: smaller and lighter). In mock mode the data URL is the photo; in API mode it is
 * uploaded through POST /uploads/sign first (shared services/api/uploads.ts, called by sendReport).
 */
export async function compressImage(file: File, dataSaver: boolean): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('not-image');
  const maxSide = dataSaver ? 1024 : 1600;
  const quality = dataSaver ? 0.5 : 0.7; // docs/api-contract.md: 1600 px, JPEG 0.7
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no-canvas');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}
