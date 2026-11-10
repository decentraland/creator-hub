import { misc } from '#preload';

/** Opens a clicked https link, or a mailto link's address without its parameters; ignores others. */
export function openMarkdownLink(event: React.MouseEvent) {
  const link = (event.target as HTMLElement).closest('a');
  if (!link) return;
  event.preventDefault();
  const url = new URL(link.href, 'https://invalid');
  if (url.protocol === 'https:') void misc.openExternal(link.href);
  if (url.protocol === 'mailto:') void misc.openExternal(`mailto:${url.pathname}`);
}
