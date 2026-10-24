/** Resolve a file under `web-3d/lib/pieces/` or `web-3d/lib/maps/` for the hosting game's base URL. */
export function sharedLibAssetUrl(category: 'pieces' | 'maps', filename: string): string {
  const meta = import.meta as unknown as { env?: { BASE_URL?: string } };
  const base = meta.env?.BASE_URL ?? './';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  const origin =
    typeof document !== 'undefined' && document.baseURI
      ? document.baseURI
      : (globalThis.location?.href ?? 'http://127.0.0.1/');
  return new URL(`${prefix}lib/${category}/${filename}`, origin).href;
}

export function pieceUrl(filename: string): string {
  return sharedLibAssetUrl('pieces', filename);
}

export function mapUrl(filename: string): string {
  return sharedLibAssetUrl('maps', filename);
}
