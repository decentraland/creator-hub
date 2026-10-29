import CheckIcon from '@mui/icons-material/Check';
import type { CheckboxProps } from 'decentraland-ui2';

import { Box, Dash, OffBox, OnBox } from './SelectCheckbox.styled';

type Props = CheckboxProps & { variant?: 'primary' | 'secondary' };

/** The detail tabs' row-selection checkbox: a 20px outlined box off; on, the Primary tick (`primary`) or a Primary-outlined box with a Primary tick and dash (`secondary`). */
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
    />
  );
}
