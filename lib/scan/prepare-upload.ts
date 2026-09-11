// lib/scan/prepare-upload.ts — browser-side photo downscale (EXIF-aware) before upload.
import { fitWithin } from './scan-session';

export const UPLOAD_MAX_EDGE = 1000;

export async function prepareUpload(file: File | Blob): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  } catch {
    return file; // let the server try the original
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height, UPLOAD_MAX_EDGE);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.85));
}
