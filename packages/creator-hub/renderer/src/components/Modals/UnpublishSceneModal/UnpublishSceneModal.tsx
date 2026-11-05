import { useState, type ReactNode } from 'react';

import { useSnackbar } from '/@/hooks/useSnackbar';
import type { LandScene } from '/@/modules/store/management/utils';
import { t } from '/@/modules/store/translation/utils';

import { DefaultModal } from '../DefaultModal';
import { ErrorText, Notice, Progress } from './UnpublishSceneModal.styled';

export type UnpublishTarget =
  | { kind: 'one'; scene: LandScene }
  | { kind: 'many'; scenes: LandScene[] };

type Props = {
  open: boolean;
  target: UnpublishTarget;
  placeName: string;
  unpublishScene: (scene: LandScene) => Promise<unknown>;
  notice?: ReactNode;
  onClose: () => void;
  onUnpublished: (sceneIds: string[]) => void;
};

const bold = (chunks: string) => <b>{chunks}</b>;

/** Confirms and runs the unpublish of one or several scenes of a LAND or World, one after another. */
export function UnpublishSceneModal({
  open,
  target,
  placeName,
  unpublishScene,
  notice,
  onClose,
  onUnpublished,
}: Props) {
  const { pushGeneric } = useSnackbar();
  const [pending, setPending] = useState(target.kind === 'one' ? [target.scene] : target.scenes);
  const [progress, setProgress] = useState<number | null>(null);
  const [failed, setFailed] = useState<LandScene | null>(null);
  const count = target.kind === 'many' ? target.scenes.length : 1;

  const unpublish = async () => {
    setFailed(null);
    const done: string[] = [];
    let firstFailure: LandScene | null = null;
    const left: LandScene[] = [];
    for (const [index, scene] of pending.entries()) {
      setProgress(index + 1);
      try {
        await unpublishScene(scene);
        done.push(scene.id);
      } catch {
        firstFailure ??= scene;
        left.push(scene);
      }
    }
    setProgress(null);
    if (done.length) onUnpublished(done);
    if (firstFailure) {
      setPending(left);
      setFailed(firstFailure);
      return;
    }
    pushGeneric(
      'success',
      count > 1 ? t('unpublish_scene.done_many', { count }) : t('unpublish_scene.done'),
    );
    onClose();
  };

  const body =
    target.kind === 'one'
      ? t('unpublish_scene.body', { scene: target.scene.title, land: placeName, b: bold })
      : t('unpublish_scene.body_many', { count, land: placeName });

  return (
    <DefaultModal
      open={open}
      title={t(count > 1 ? 'unpublish_scene.title_many' : 'unpublish_scene.title')}
      onClose={onClose}
      body={body}
      secondary={{ label: t('modal.cancel'), onClick: onClose }}
      primary={{
        label: failed
          ? t('tx.try_again')
          : count > 1
            ? t('unpublish_scene.confirm_many', { count })
            : t('unpublish_scene.confirm'),
        state: progress === null ? 'idle' : 'busy',
        onClick: () => void unpublish(),
      }}
    >
      {notice && <Notice>{notice}</Notice>}
      {progress !== null && count > 1 && (
        <Progress role="status">
          {t('unpublish_scene.progress', { done: progress, count })}
        </Progress>
      )}
      {failed && (
        <ErrorText role="alert">{t('unpublish_scene.error', { scene: failed.title })}</ErrorText>
      )}
    </DefaultModal>
  );
}
