import type { Project, ProjectDeployment } from '/shared/types/projects';

import { type Coords, Lands } from '/@/lib/land';
import { Worlds } from '/@/lib/worlds';

const WORLD_SCENES_LIMIT = 100;

type TargetRecord = ProjectDeployment & { path: string };

type Lookup = { records: TargetRecord[]; active: Set<string> | null };

const toCoords = (parcel: string) => parcel.split(',').map(Number) as Coords;

async function lookUpLand(records: TargetRecord[]): Promise<Lookup> {
  try {
    const scenes = await new Lands().fetchLandPublishedScenes(
      records.map(record => toCoords(record.parcel)),
    );
    return { records, active: new Set(scenes.map(scene => scene.id)) };
  } catch {
    return { records, active: null };
  }
}

async function lookUpWorld(worldName: string, records: TargetRecord[]): Promise<Lookup> {
  const coords = records.map(record => toCoords(record.parcel));
  const xs = coords.map(([x]) => x);
  const ys = coords.map(([, y]) => y);
  const result = await new Worlds().fetchWorldScenes(worldName, {
    limit: WORLD_SCENES_LIMIT,
    offset: 0,
    x1: Math.min(...xs),
    x2: Math.max(...xs),
    y1: Math.min(...ys),
    y2: Math.max(...ys),
  });
  const complete = result && result.scenes.length < WORLD_SCENES_LIMIT;
  return { records, active: complete ? new Set(result.scenes.map(scene => scene.entityId)) : null };
}

/** Paths of the scenes still live at a recorded target; a failed lookup trusts its records. */
export async function findPublishedPaths(projects: Project[]): Promise<Set<string>> {
  const records = projects.flatMap(project =>
    Object.values(project.info.deployments ?? {}).map(record => ({
      ...record,
      path: project.path,
    })),
  );
  const land = records.filter(record => !record.worldName);
  const byWorld = new Map<string, TargetRecord[]>();
  for (const record of records) {
    if (record.worldName)
      byWorld.set(record.worldName, [...(byWorld.get(record.worldName) ?? []), record]);
  }
  const lookups = await Promise.all([
    ...(land.length ? [lookUpLand(land)] : []),
    ...[...byWorld].map(([worldName, worldRecords]) => lookUpWorld(worldName, worldRecords)),
  ]);
  return new Set(
    lookups.flatMap(({ records: looked, active }) =>
      looked
        .filter(record => !active || active.has(record.deploymentHash))
        .map(record => record.path),
    ),
  );
}
