import type { InputHTMLAttributes } from 'react';
import type { Entity } from '@dcl/ecs';
import type { ConfigComponentType } from '../../../../lib/sdk/components/Config';

export type Props = {
  entity: Entity;
  initialOpen?: boolean;
};

export type Section = NonNullable<ConfigComponentType['sections']>[0];
export type SectionItem = NonNullable<Section>['items'][0];
export type WidgetProps = {
  entity: Entity;
  inputProps: Pick<InputHTMLAttributes<HTMLElement>, 'value' | 'onChange' | 'onFocus' | 'onBlur'>;
  widget: string;
  label?: string;
  constraints?: any;
  props?: any;
  transform?: any;
  dataSource?: any;
  basicViewId?: string;
};
