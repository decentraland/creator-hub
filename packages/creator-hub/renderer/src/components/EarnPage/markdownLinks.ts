import { misc } from '#preload';

/** Opens a clicked Markdown link in the system browser when it is https; other links do nothing. */
export function openMarkdownLink(event: React.MouseEvent) {
  const link = (event.target as HTMLElement).closest('a');
  if (!link) return;
  event.preventDefault();
  if (new URL(link.href, 'https://invalid').protocol === 'https:')
    void misc.openExternal(link.href);
}
