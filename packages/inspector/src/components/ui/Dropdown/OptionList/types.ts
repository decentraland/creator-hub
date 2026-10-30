import type { Props as Option } from '../Option/types';

export interface Props {
  options: Option[];
  empty?: string;
  multiple?: boolean;
  searchable?: boolean;
  selectedValue?: Option | Option[];
  minWidth?: number;
  isField?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** Panel scope inherited from the anchor's ancestors, so panel styles reach the portalled menu. */
  scope?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}
