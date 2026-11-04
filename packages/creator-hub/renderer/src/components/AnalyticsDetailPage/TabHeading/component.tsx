import { Box, Typography } from 'decentraland-ui2';

import './styles.css';

type Props = {
  title: string;
  description: string;
};

export function TabHeading({ title, description }: Props) {
  return (
    <Box className="TabHeading">
      <Typography variant="h5">{title}</Typography>
      <Typography
        variant="body1"
        className="Description"
      >
        {description}
      </Typography>
    </Box>
  );
}
