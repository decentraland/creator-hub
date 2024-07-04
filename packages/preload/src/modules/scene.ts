export type Coords = {
  x: number;
  y: number;
};

/**
 * Parses a string representing coordinates and returns an object with x and y properties.
 * @param {string} coords - A string representing coordinates in the format "x,y".
 * @returns {Coords} An object with numeric x and y properties.
 */
export function parseCoords(coords: string): Coords {
  const [x, y] = coords.split(',');
  return { x: parseInt(x, 10), y: parseInt(y, 10) };
}

/**
 * Calculates the number of rows and columns needed to encompass the given parcels.
 * @param {Coords[]} parcels - An array of coordinate objects.
 * @returns {{ rows: number, cols: number }} An object with the number of rows and columns.
 */
export function getRowsAndCols(parcels: Coords[]): {
  rows: number;
  cols: number;
} {
  if (!parcels.length) return { rows: 0, cols: 0 };

  const limits: { min: Coords; max: Coords } = {
    min: { x: Infinity, y: Infinity },
    max: { x: -Infinity, y: -Infinity },
  };

  parcels.forEach((parcel) => {
    const { x, y } = parcel;

    if (limits.min.y >= y) {
      limits.min = { x: Math.min(limits.min.x, x), y };
    }

    if (y >= limits.max.y) {
      limits.max = { x: Math.max(limits.max.x, x), y };
    }

    return { x, y };
  });

  return {
    rows: Math.abs(limits.max.x) - Math.abs(limits.min.x) + 1,
    cols: Math.abs(limits.max.y) - Math.abs(limits.min.y) + 1,
  };
}
