import type { PopperProps } from '@mui/material/Popper';

export type Props = PopperProps & {
  onClose: (event: MouseEvent | TouchEvent) => void;
};
