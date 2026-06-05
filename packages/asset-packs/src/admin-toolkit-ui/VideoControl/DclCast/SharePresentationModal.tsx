// eslint-disable-next-line @typescript-eslint/no-unused-vars -- ReactEcs is required for JSX factory
import ReactEcs, { Input, Label, UiEntity } from '@dcl/react-ecs';
import { Color4 } from '@dcl/sdk/math';
import { Modal } from '../../Modal';
import { Button } from '../../Button';
import { getPresentationBotToken, startPresentation } from '../api';
import { getDclCastColors } from './styles';

const SharePresentationModal = ({
  onClose,
  streamingKey,
}: {
  onClose: () => void;
  streamingKey: string;
}) => {
  const colors = getDclCastColors();
  const [url, setUrl] = ReactEcs.useState('');
  const [isLoading, setIsLoading] = ReactEcs.useState(false);
  const [error, setError] = ReactEcs.useState('');

  const handleShare = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setIsLoading(true);
    setError('');

    const [tokenError, tokenData] = await getPresentationBotToken(streamingKey);
    if (tokenError || !tokenData) {
      setError(tokenError ?? 'Failed to get presentation token');
      setIsLoading(false);
      return;
    }

    const [presentationError] = await startPresentation(url.trim(), tokenData.token, tokenData.url);
    if (presentationError) {
      setError(presentationError);
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    onClose();
  };

  return (
    <Modal
      id="share-presentation"
      title="Share Presentation"
      onClose={onClose}
      width={480}
    >
      <UiEntity
        uiTransform={{
          flexDirection: 'column',
          width: '100%',
          margin: { top: 16 },
        }}
      >
        <Label
          value="Paste a URL to a PDF or PPTX file"
          fontSize={14}
          color={colors.lightGray}
          uiTransform={{ margin: { bottom: 8 } }}
        />
        <UiEntity
          uiTransform={{
            flexDirection: 'row',
            width: '100%',
            alignItems: 'center',
          }}
        >
          <Input
            onChange={value => {
              setError('');
              setUrl(value);
            }}
            value={url}
            fontSize={14}
            placeholder="https://example.com/slides.pdf"
            uiBackground={{ color: Color4.White() }}
            uiTransform={{
              width: '100%',
              borderWidth: 2,
              borderRadius: 8,
              borderColor: error ? colors.danger : colors.white,
              height: 48,
            }}
          />
        </UiEntity>
        {!!error && (
          <Label
            value={error}
            fontSize={14}
            color={colors.danger}
            uiTransform={{ margin: { top: 8 } }}
          />
        )}
        <UiEntity
          uiTransform={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            width: '100%',
            margin: { top: 16 },
          }}
        >
          <Button
            id="share_presentation_cancel"
            value="<b>Cancel</b>"
            variant="secondary"
            fontSize={16}
            color={colors.white}
            uiTransform={{
              height: 42,
              padding: { left: 16, right: 16 },
              margin: { right: 8 },
            }}
            onMouseDown={onClose}
          />
          <Button
            id="share_presentation_submit"
            value={isLoading ? '<b>Sharing...</b>' : '<b>Share</b>'}
            fontSize={16}
            color={colors.black}
            disabled={isLoading}
            uiTransform={{
              height: 42,
              padding: { left: 16, right: 16 },
            }}
            onMouseDown={handleShare}
          />
        </UiEntity>
      </UiEntity>
    </Modal>
  );
};

export default SharePresentationModal;
