import type { ReactNode } from 'react';
import { type TypographyProps } from 'decentraland-ui2';

import type { Status } from '/shared/types/async';

import type { Option } from '../Dropdown/types';

export type Props = {
  title: string;
  description?: string;
  imageUrl?: string;
  videoUrl?: string;
  content?: ReactNode;
  width?: number;
  height?: number;
  publishedAt?: number;
  dropdownOptions?: Option[];
  titleVariant?: TypographyProps['variant'];
  status?: Status;
  'data-testid'?: string;
  onClick: () => void;
};
