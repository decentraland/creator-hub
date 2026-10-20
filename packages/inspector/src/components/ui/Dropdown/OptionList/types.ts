import type { Props as Option } from '../Option/types';

export type SearchInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'>;

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
  /** Listbox id; each option's id derives from it. */
  id: string;
  /** Index into `options` of the keyboard-active option, or -1. */
  activeIndex: number;
  search: string;
  onSearchChange: (search: string) => void;
  /** Combobox semantics and focus tracking for the search input. */
  searchInputProps: SearchInputProps;
  /** Reports the hovered option's index into `options`, or -1 when the pointer leaves. */
  onActiveChange: (index: number) => void;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}
