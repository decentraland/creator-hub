import ReactEcs, { UiEntity, Label } from '@dcl/react-ecs';
import { Color4 } from '@dcl/sdk/math';
import { startTimeout, stopTimeout } from '../timer';
import { Button, ButtonVariant, type CompositeButtonProps } from './Button';
import { state } from '.';

const FEEDBACK_TIMEOUT_ACTION_PREFIX = 'feedback_button_';

interface FeedbackButtonProps extends CompositeButtonProps {
  feedbackLabel?: string;
  feedbackDurationSeconds?: number;
}

const getUiBackgroundColor = (variant?: ButtonVariant) => {
  switch (variant) {
    case 'primary':
      return Color4.fromHexString('#FFFFFF');
    default:
      return Color4.fromHexString('#43404A');
  }
};

const getLabelTextColor = (variant?: ButtonVariant) => {
  switch (variant) {
    case 'primary':
      return Color4.Black();
    default:
      return Color4.White();
  }
};

export const FeedbackButton = (props: FeedbackButtonProps) => {
  const {
    id,
    feedbackLabel = '<b>Link Copied</b>',
    feedbackDurationSeconds = 2,
    onMouseDown,
    ...buttonProps
  } = props;

  const [showFeedback, setShowFeedback] = ReactEcs.useState(false);
  const timeoutAction = `${FEEDBACK_TIMEOUT_ACTION_PREFIX}${id}`;

  const handleClick = () => {
    // Stop any existing timeout
    stopTimeout(state.adminToolkitUiEntity, timeoutAction);

    // Show feedback
    setShowFeedback(true);

    // Start timeout to hide feedback
    startTimeout(state.adminToolkitUiEntity, timeoutAction, feedbackDurationSeconds, () => {
      setShowFeedback(false);
    });

    // Call original onMouseDown handler
    if (onMouseDown) onMouseDown();
  };

  ReactEcs.useEffect(() => {
    return () => {
      stopTimeout(state.adminToolkitUiEntity, timeoutAction);
    };
  }, []);

  return (
    <UiEntity
      uiTransform={{
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      {showFeedback && (
        <UiEntity
          uiTransform={buttonProps.uiTransform}
          uiBackground={{ color: getUiBackgroundColor(buttonProps.variant) }}
        >
          <Label
            value={feedbackLabel}
            color={getLabelTextColor(buttonProps.variant)}
            fontSize={buttonProps.fontSize}
          />
        </UiEntity>
      )}
      {!showFeedback && (
        <Button
          id={id}
          onMouseDown={handleClick}
          {...buttonProps}
        />
      )}
    </UiEntity>
  );
};
