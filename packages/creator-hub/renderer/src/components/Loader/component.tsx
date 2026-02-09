import { Backdrop, CircularProgress, type CircularProgressProps } from 'decentraland-ui2';

import './styles.css';

type Props = CircularProgressProps & {
  overlay?: boolean;
};

export function Loader({ overlay, ...props }: Props) {
  if (overlay) {
    return (
      <Backdrop
        open
        sx={{ position: 'absolute', zIndex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      >
        <CircularProgress {...props} />
      </Backdrop>
    );
  }

  return (
    <div className="Loader">
      <CircularProgress {...props} />
    </div>
  );
}
