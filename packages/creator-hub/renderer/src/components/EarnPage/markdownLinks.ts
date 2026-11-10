import { misc } from '#preload';

const OPENABLE_PROTOCOLS = new Set(['https:', 'mailto:']);

/** Opens a clicked Markdown link through the system when it is https or mailto; other links do nothing. */
export function openMarkdownLink(event: React.MouseEvent) {
  const link = (event.target as HTMLElement).closest('a');
  if (!link) return;
  event.preventDefault();
  if (OPENABLE_PROTOCOLS.has(new URL(link.href, 'https://invalid').protocol))
    void misc.openExternal(link.href);
}
