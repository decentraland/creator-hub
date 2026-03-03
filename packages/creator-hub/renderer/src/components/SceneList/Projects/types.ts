import type { Project } from '/shared/types/projects';

export type Props = {
  projects: Project[];
  /** When false, hides the "new scene" card. Default true. */
  showNewSceneCard?: boolean;
  /** When true, cards use auto height so thumbnail + info are always visible (e.g. Scenes grid). */
  cardAutoHeight?: boolean;
};
