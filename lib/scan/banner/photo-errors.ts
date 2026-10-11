// lib/scan/banner/photo-errors.ts — user-facing messages for photos the browser can't open. The common case: iPhone
// photos are HEIC, which Chrome and Firefox can't decode (Safari can); createImageBitmap's own error ("The source image
// could not be decoded.") doesn't tell the user what to do. No HEIC decoder dependency on purpose (owner call).
export interface PhotoFileLike { type: string; name: string }

/** HEIC/HEIF by MIME type or file extension (browsers often leave the type empty for HEIC). */
export function isHeicPhoto(f: PhotoFileLike): boolean {
  return /^image\/hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name);
}

export function describeDecodeFailure(f: PhotoFileLike): string {
  if (isHeicPhoto(f)) {
    return "This is a HEIC photo (the iPhone's default format), which this browser can't open. Use Safari, or export the photo as JPEG and try again.";
  }
  return "Couldn't open this photo. Try a JPEG or PNG.";
}
