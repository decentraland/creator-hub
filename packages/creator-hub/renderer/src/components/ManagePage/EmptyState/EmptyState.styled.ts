import { dclColors, styled } from 'decentraland-ui2';

import { ExternalLink } from '../../ExternalLink';

const { neutral } = dclColors;

const Body = styled('p')(({ theme }) => ({
  margin: 0,
  color: neutral.gray4,
  fontSize: theme.typography.pxToRem(18),
  fontWeight: 400,
  lineHeight: 1.33,
}));

const Illustration = styled('img')({
  width: 80,
  height: 'auto',
});

const InlineLink = styled(ExternalLink)(({ theme }) => ({
  color: theme.palette.primary.main,
  textDecoration: 'underline',
  '&:hover': { color: theme.palette.primary.light },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.info.light}`,
    outlineOffset: 2,
  },
}));

const ReadMore = styled(ExternalLink)(({ theme }) => ({
  display: 'inline-block',
  marginTop: theme.spacing(1),
  color: neutral.softWhite,
  fontWeight: 600,
  textDecoration: 'underline',
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.info.light}`,
    outlineOffset: 2,
  },
}));

const Root = styled('section')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(2.5),
  width: 550,
  maxWidth: '100%',
  minHeight: 500,
  margin: '0 auto',
  textAlign: 'center',
}));

const Title = styled('h2')(({ theme }) => ({
  margin: 0,
  color: neutral.softWhite,
  fontSize: theme.typography.pxToRem(30),
  fontWeight: 600,
  lineHeight: 1,
}));

const TitleRow = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(1),
}));

export { Body, Illustration, InlineLink, ReadMore, Root, Title, TitleRow };
