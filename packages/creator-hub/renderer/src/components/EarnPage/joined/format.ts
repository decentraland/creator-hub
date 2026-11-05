import type { CreatorFundPlace } from '/shared/types/creator-fund';

const DECIMAL = /^-?\d+(\.\d+)?$/;

/**
 * A USDC decimal string as `1,842.50`, formatted from the string itself: going through a float
 * would round an amount like `"0.005"` or `"1.005"` on its binary value, not its decimal one.
 * Anything that isn't a plain decimal is shown as sent rather than as `NaN`.
 */
export const formatUsdc = (amount: string, locale: string) =>
  DECIMAL.test(amount)
    ? new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
        amount as Intl.StringNumericLiteral,
      )
    : amount;

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
