import type { Project } from '/shared/types/projects';
import type { Coordinate } from './types';

export function parseCoords(coords: string) {
  return coords.split(',').map(coord => parseInt(coord, 10)) as [number, number];
}

export function calculateParcels(project: Project, point: Coordinate): Coordinate[] {
  const [baseX, baseY] = parseCoords(project.scene.base);
  return project.scene.parcels.map(parcel => {
    const [x, y] = parseCoords(parcel);
    return { x: x - baseX + point.x, y: y - baseY + point.y };
  });
}
