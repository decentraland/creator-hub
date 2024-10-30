import { type Project } from '/shared/types/projects';

export type Props = {
  open: boolean;
  project: Project;
  onClose: () => void;
  onTarget: (value: TargetValue) => void;
};

export type Step =
  | 'initial'
  | 'alternative-servers'
  | 'publish-to-world'
  | 'publish-to-land'
  | 'deploy';
export type InitialTarget = 'worlds' | 'land';
export type AlternativeTarget = 'test' | 'custom';

export type Target = InitialTarget | AlternativeTarget;
export type TargetValue = { target: Target; value?: string };
export type TargetProps = { onTarget: (value: TargetValue) => void };
