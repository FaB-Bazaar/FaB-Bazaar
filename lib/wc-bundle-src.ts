import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

const PATH = '/wc/fabbazaar-ui.js';

const readBundle = () => readFileSync(join(process.cwd(), 'public', PATH));

let cached: string | null = null;

/**
 * The web-component <script> URL, stamped with a hash of the bundle. The file
 * is served with a 4h cache and a fixed name, so without the stamp a deploy's
 * component fixes reached browsers up to 4h late. The stamp is only on this
 * internal script URL — shared page links are untouched — and the server
 * ignores the query, so a stale page's older stamp still loads the file.
 * Falls back to the plain URL if the file can't be read.
 */
export function wcBundleSrc(read: () => Buffer = readBundle): string {
  if (read === readBundle && cached) return cached; // hash once per server process
  let src = PATH;
  try {
    src = `${PATH}?v=${createHash('sha256').update(read()).digest('hex').slice(0, 12)}`;
  } catch {
    // unreadable → plain URL (the old behaviour), never a broken tag
  }
  if (read === readBundle) cached = src;
  return src;
}
