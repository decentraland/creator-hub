import { type ModalProps } from 'decentraland-ui2/dist/components/Modal/Modal.types';

import { Modal, onBackNoop } from '../..';

export function PublishModal(props: React.PropsWithChildren<ModalProps>) {
  const { onBack, onClose, ...rest } = props;

  const handleClose = (
    event: React.MouseEvent<HTMLButtonElement>,
    reason?: 'backdropClick' | 'escapeKeyDown',
  ) => {
    if (reason === 'backdropClick') return;
    onClose?.(event);
  };

  return (
    <Modal
      size="small"
      {...rest}
      onBack={onBack || onBackNoop}
      onClose={handleClose as any} // ui2 is not typing this correctly..."reason" is being provided anyway...
    >
      {props.children}
    </Modal>
  );
}
