const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/**
 * Escape text for HTML (and XML) content or a quoted attribute.
 * Everything that comes from scraped data goes through this.
 */
export const esc = (value: string | number | null | undefined = ''): string =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ESCAPES[char]!);
