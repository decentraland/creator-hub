import type { CompositeEntry } from '/shared/types/composites';

export type Props = {
  composites: CompositeEntry[];
  selected: string;
  projectTitle: string;
  onSelect: (relativePath: string) => void;
  onManage: () => void;
  onCreate: () => void;
};
