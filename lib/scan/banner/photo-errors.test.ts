import { describe, it, expect } from 'vitest';
import { isHeicPhoto, describeDecodeFailure } from './photo-errors';

describe('isHeicPhoto', () => {
  it('recognises HEIC/HEIF by type or file name (browsers often leave the type empty)', () => {
    expect(isHeicPhoto({ type: 'image/heic', name: 'x' })).toBe(true);
    expect(isHeicPhoto({ type: 'image/heif', name: 'x' })).toBe(true);
    expect(isHeicPhoto({ type: '', name: 'IMG_5940.HEIC' })).toBe(true);
    expect(isHeicPhoto({ type: '', name: 'photo.heif' })).toBe(true);
    expect(isHeicPhoto({ type: 'image/jpeg', name: 'IMG_5940.jpg' })).toBe(false);
  });
});

describe('describeDecodeFailure', () => {
  it('explains a HEIC photo the browser cannot open, instead of the raw decoder error', () => {
    const msg = describeDecodeFailure({ type: '', name: 'IMG_5940.HEIC' });
    expect(msg).toMatch(/HEIC/);
    expect(msg).toMatch(/Safari|JPEG/);
  });
  it('gives a plain message for any other unreadable file', () => {
    expect(describeDecodeFailure({ type: 'image/png', name: 'broken.png' })).toMatch(/couldn.t open this photo/i);
  });
});
