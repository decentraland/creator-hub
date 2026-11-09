import type { CreatorFundPlace } from '/shared/types/creator-fund';

const DECIMAL = /^-?\d+(\.\d+)?$/;

/** The USDC token's precision; no amount has more decimals. */
const USDC_DECIMALS = 6;

/**
 * Formats a USDC decimal string without rounding: `22`, `1,842.50`, `0.004`.
 * @returns the input unchanged when it is not a plain decimal.
 */
export const formatUsdc = (amount: string, locale: string) => {
  if (!DECIMAL.test(amount)) return amount;
  const whole = !/\.\d*[1-9]/.test(amount);
  return new Intl.NumberFormat(
    locale,
    whole
      ? { maximumFractionDigits: 0 }
      : { minimumFractionDigits: 2, maximumFractionDigits: USDC_DECIMALS },
  ).format(amount as Intl.StringNumericLiteral);
};

/** A date as `Oct 30, 2026`. */
export const formatDate = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso));

/**
 * Where a place is: Genesis City coordinates as `23,-14`, a World's name, or, in a World of more
 * than one scene, `world - x,y`.
 * @param scenesInWorld - the World's scene count, when known.
 */
export const placeLocation = (place: CreatorFundPlace, scenesInWorld = 0) => {
  if (!place.world || !place.world_name) return place.base_position;
  return scenesInWorld > 1 ? `${place.world_name} - ${place.base_position}` : place.world_name;
};

/** A place's title, or its location when Places has none. */
export const placeTitle = (place: CreatorFundPlace) => place.title ?? placeLocation(place);

/** The jump-in target for a place. */
export const jumpInLocation = (place: CreatorFundPlace) => {
  const [x, y] = place.base_position.split(',').map(Number);
  return { world: place.world ? (place.world_name ?? undefined) : undefined, x, y };
};
