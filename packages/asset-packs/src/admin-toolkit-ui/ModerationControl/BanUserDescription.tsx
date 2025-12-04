import ReactEcs, { UiEntity } from '@dcl/react-ecs';
import { getAddUserInputStyles, getBanUserTextStyles } from './styles/AddUserInputStyles';

type Props = {
  scaleFactor: number;
};

export function BanUserDescription({ scaleFactor }: Props) {
  const styles = getAddUserInputStyles(scaleFactor);
  const textStyles = getBanUserTextStyles(scaleFactor);

  return (
    <UiEntity uiTransform={styles.bannedInfoContainer}>
      <UiEntity
        uiText={{
          value:
            "<b>Banned users CAN'T:</b> See your scene, send messages in the Nearby chat, or be seen by other users.",
          ...textStyles,
        }}
        uiTransform={styles.marginBottomMedium}
      />
      <UiEntity
        uiText={{
          value:
            '<b>Banned users CAN still:</b> See other users and see the messages in the Nearby chat.</b>',
          ...textStyles,
        }}
      />
    </UiEntity>
  );
}
