import { dclColors, styled } from 'decentraland-ui2';

const { neutral } = dclColors;

const AtlasBlock = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.25),
}));

const Count = styled('p')(({ theme }) => ({
  margin: 0,
  color: neutral.gray3,
  fontSize: theme.typography.pxToRem(14),
  fontWeight: 400,
  lineHeight: 'normal',
}));

const Description = styled('p')(({ theme }) => ({
  margin: 0,
  color: neutral.gray4,
  fontSize: theme.typography.pxToRem(16),
  fontWeight: 400,
  lineHeight: 'normal',
}));

const MapFrame = styled('div')(({ theme }) => ({
  position: 'relative',
  overflow: 'hidden',
  borderRadius: 12,
  '&:focus': { outline: 'none' },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.info.light}`,
    outlineOffset: 2,
  },
}));

const VisuallyHidden = styled('span')({
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
});

export { AtlasBlock, Count, Description, MapFrame, VisuallyHidden };
