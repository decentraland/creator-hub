import { type Project } from '/shared/types/projects';

export type Props = {
  open: boolean;
  project: Project;
  onClose: () => void;
  onTarget: (value: Target) => void;
};

export type Step =
  | 'initial'
  | 'alternative-servers'
  | 'publish-to-world'
  | 'publish-to-land'
  | 'deploy';
export type InitialTarget = 'worlds' | 'land';
export type AlternativeTarget = 'test' | 'custom';

export type TargetType = InitialTarget | AlternativeTarget;
export type Target = { target: TargetType; value?: string };
