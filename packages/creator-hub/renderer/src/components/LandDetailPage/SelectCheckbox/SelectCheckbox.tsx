import type { CheckboxProps } from 'decentraland-ui2';

import { Box, OffBox } from './SelectCheckbox.styled';

/** The detail tabs' row-selection checkbox: a 20px outlined box off, the Primary tick on. */
export function SelectCheckbox(props: CheckboxProps) {
  return (
    <Box
      {...props}
      icon={<OffBox />}
    />
  );
}
