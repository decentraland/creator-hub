import { styled } from 'decentraland-ui2';
import { Modal as BaseModal } from 'decentraland-ui2/dist/components/Modal/Modal';
import { type ModalProps } from 'decentraland-ui2/dist/components/Modal/Modal.types';

export function onBackNoop() {}

const Modal = styled(BaseModal)(props => ({
  '& > .MuiPaper-root .MuiBox-root:first-child': {
    paddingBottom: 8,
  },
  '& > .MuiPaper-root .MuiBox-root:first-child h5': {
    lineHeight: '2em',
  },
  '& > .MuiPaper-root > h6': {
    textAlign: 'center',
    color: 'var(--dcl-silver)',
  },
  '& > .MuiBackdrop-root': {
    transition: 'none!important',
  },
  '& > .MuiPaper-root': {
    backgroundColor: 'var(--darker-gray)',
    backgroundImage: 'none',
  },
  '& [aria-label="back"]':
    props.onBack !== onBackNoop
      ? {}
      : {
          opacity: 0,
          cursor: 'default',
        },
}));

export function PublishModal(props: React.PropsWithChildren<ModalProps>) {
  const { onBack, ...rest } = props;
  return (
    <Modal
      size="small"
      {...rest}
      onBack={onBack || onBackNoop}
    >
      {props.children}
    </Modal>
  );
}
