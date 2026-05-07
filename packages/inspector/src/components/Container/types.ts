import type { Entity } from '@dcl/ecs';
import type { Component } from '../../lib/sdk/components';

export type Props = {
  label?: string;
  className?: string;
  rightContent?: JSX.Element;
  initialOpen?: boolean;
  indicator?: boolean | string | JSX.Element;
  border?: boolean;
  gap?: boolean;
  variant?: 'minimal';
  onRemoveContainer?: () => void;
  component?: Component<any>;
  entity?: Entity | Entity[];
};
