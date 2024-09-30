import { type Project } from '/shared/types/projects';

export type Props = {
  open: boolean;
  project: Project;
  onClose: () => void;
  onSubmit: (value: StepValue) => void;
};

export type Step = 'initial' | 'alternative-servers' | 'publish-to-world';
export type InitialTarget = 'worlds' | 'land';
export type AlternativeTarget = 'test' | 'custom';

export type Target = InitialTarget | AlternativeTarget;
export type StepValue = { target: Target; value?: string };
export type StepProps = { onClick: (value: StepValue) => void };
