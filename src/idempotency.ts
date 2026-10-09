export function normalizeKey(key: string): string {
  // O incidente inclui um espaço final e U+200B (zero-width space).
  return key.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').trim().toLowerCase();
}
