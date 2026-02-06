import { type Project } from '/shared/types/projects';

export type Coordinate = { x: number; y: number };

export type Props = {
  open: boolean;
  project: Project;
  initialStep?: Step;
  disableGoBack?: boolean;
  previousStep?: Step;
  onClose: () => void;
  onBack?: () => void;
  onStep: (step: Step, opts?: { resetHistory?: boolean }) => void;
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

export const COLORS = Object.freeze({
  occupiedParcel: '#774642',
  freeParcel: '#ff9990',
  selected: '#ff9990',
  selectedStroke: '#ff0044',
  indicator: '#716b7abb',
  indicatorStroke: '#3a3541',
});
