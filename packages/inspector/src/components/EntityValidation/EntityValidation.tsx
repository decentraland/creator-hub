import { useCallback, useEffect, useRef } from 'react';
import { CrdtMessageType } from '@dcl/ecs';

import { withSdk } from '../../hoc/withSdk';
import { useChange } from '../../hooks/sdk/useChange';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { selectAssetCatalog } from '../../redux/app';
import { setEntitiesWithErrors } from '../../redux/entity-validation';
import { validateAllEntities } from '../../lib/sdk/validation/entity-validators';

const DEBOUNCE_MS = 100;

export const EntityValidation = withSdk(({ sdk }) => {
  const dispatch = useAppDispatch();
  const assetCatalog = useAppSelector(selectAssetCatalog);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runValidation = useCallback(() => {
    const result = validateAllEntities(sdk, assetCatalog);
    dispatch(setEntitiesWithErrors(result));
  }, [sdk, assetCatalog, dispatch]);

  const debouncedValidation = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(runValidation, DEBOUNCE_MS);
  }, [runValidation]);

  // Re-validate when asset catalog loads or changes
  useEffect(() => {
    runValidation();
  }, [assetCatalog]);

  // Re-validate on ECS component changes
  useChange(
    ({ operation }) => {
      if (
        operation === CrdtMessageType.PUT_COMPONENT ||
        operation === CrdtMessageType.DELETE_COMPONENT
      ) {
        debouncedValidation();
      }
    },
    [debouncedValidation],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return null;
});
