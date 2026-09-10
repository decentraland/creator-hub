import type { ReactNode } from 'react';
import { Box, Typography } from 'decentraland-ui2';

import './styles.css';

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
};

/** A titled panel wrapping one chart or stat block. */
export function ChartCard({ title, description, children }: Props) {
  return (
    <Box className="ChartCard">
      <Typography variant="h6">{title}</Typography>
      {description && (
        <Typography
          variant="body2"
          className="Description"
        >
          {description}
        </Typography>
      )}
      <Box className="ChartCardBody">{children}</Box>
    </Box>
  );
}
