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
  /** When true, do not set a fixed height so the card can size to content (e.g. in grid with thumbnail + info). */
  autoHeight?: boolean;
  publishedAt?: number;
  dropdownOptions?: Option[];
  dropdownIcon?: ReactNode;
  dropdownIconTitle?: string;
  dropdownIconClick?: () => void;
  titleVariant?: TypographyProps['variant'];
  status?: Status;
  onClick: () => void;
};
