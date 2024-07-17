import { type Project } from '/shared/types/projects';

export type Props = {
  open: boolean;
  project: Project;
  onClose: () => void;
};

export type Step = 'initial' | 'alternative-servers';
export type InitialTarget = 'worlds' | 'land';
export type AlternativeTarget = 'test' | 'custom';

export type Target = InitialTarget | AlternativeTarget;
export type StepValue = { target: Target; value?: string };
export type StepProps = { onClick: (target: StepValue) => void };
