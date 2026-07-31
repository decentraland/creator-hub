import { useEffect } from 'react';
import { Box, Typography } from 'decentraland-ui2';

import { useDispatch, useSelector } from '#store';
import { t } from '/@/modules/store/translation/utils';
import { actions as placeAnalyticsActions } from '/@/modules/store/placeAnalytics';
import { useAuth } from '/@/hooks/useAuth';

import emptyAnalytics from '/assets/images/analytics-empty.svg';

import { Container } from '../Container';
import { Loader } from '../Loader';
import { Navbar, NavbarItem } from '../Navbar';

import './styles.css';

export function AnalyticsPage() {
  const { isSignedIn } = useAuth();
  const { places, status } = useSelector(state => state.placeAnalytics);
  const dispatch = useDispatch();

  const isLoading = status === 'loading';

  useEffect(() => {
    if (isSignedIn) dispatch(placeAnalyticsActions.fetchPlaces());
  }, [isSignedIn]);

  return (
    <main className="AnalyticsPage">
      <Navbar active={NavbarItem.ANALYTICS} />
      <Container>
        <Typography variant="h3">{t('analytics.header.title')}</Typography>
        {isLoading ? (
          <Loader size={70} />
        ) : places.length === 0 ? (
          <Box className="EmptyContainer">
            <img
              src={emptyAnalytics}
              alt=""
            />
            <Typography variant="h5">{t('analytics.empty_list.title')}</Typography>
            <Typography variant="body1">{t('analytics.empty_list.description')}</Typography>
          </Box>
        ) : null}
      </Container>
    </main>
  );
}
