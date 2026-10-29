import CheckIcon from '@mui/icons-material/Check';
import type { CheckboxProps } from 'decentraland-ui2';

import { Box, Dash, FixedOnBox, MixedBox, MixedDash, OffBox, OnBox } from './SelectCheckbox.styled';

type Props = CheckboxProps & { variant?: 'primary' | 'secondary' };

/** The detail tabs' row-selection checkbox: a 20px outlined box off; on, the Primary tick (`primary`, grey when disabled; mixed, a filled Primary box with a dark dash) or a Primary-outlined box with a Primary tick and dash (`secondary`). */
export function SelectCheckbox({ variant = 'primary', ...props }: Props) {
  if (variant === 'secondary')
    return (
      <Box
        {...props}
        icon={<OffBox />}
        checkedIcon={
          <OnBox>
            <CheckIcon />
          </OnBox>
        }
        indeterminateIcon={
          <OnBox>
            <Dash />
          </OnBox>
        }
      />
    );
  return (
    <Box
      {...props}
      icon={<OffBox />}
      checkedIcon={
        props.disabled ? (
          <FixedOnBox>
            <CheckIcon />
          </FixedOnBox>
        ) : undefined
      }
      indeterminateIcon={
        <MixedBox>
          <MixedDash data-dash />
        </MixedBox>
      }
    />
  );
}
