import { getContentUrl } from './constants';

// Line icons for the admin toolkit, rasterized to white glyphs (tinted via
// uiBackground.color). Sources live in
// packs/smart_items/assets/admin_toolkit/assets/icons/reskin and are served
// from the asset bucket.
export type IconName =
  | 'users'
  | 'tv'
  | 'bolt'
  | 'message'
  | 'chevron'
  | 'play'
  | 'broadcast'
  | 'clock'
  | 'mic'
  | 'copy'
  | 'eye'
  | 'volume'
  | 'presentation'
  | 'star'
  | 'power'
  | 'refresh'
  | 'plus'
  | 'shield'
  | 'ban'
  | 'eyeoff'
  | 'trash'
  | 'send'
  | 'help'
  | 'pause'
  | 'loop'
  | 'arrowL'
  | 'arrowR'
  | 'stop';

export function icon(name: IconName): string {
  return `${getContentUrl()}/admin_toolkit/assets/icons/reskin/${name}.png`;
}
