import React from 'react';

/**
 * TODO: integrate with creator-hub snackbar system via RPC
 * Snackbar hook for inspector package.
 * It relies on creator-hub snackbar system via RPC.
 */
const useSnackbar = () => {
  const snackbar = {
    notifications: [],
  };

  const dismiss = React.useCallback(() => {}, [snackbar.notifications]);

  const close = React.useCallback(() => {}, []);

  const push = React.useCallback(() => {}, []);

  const pushGeneric = React.useCallback((type: string, message: string) => {
    console.log('SNACKBAR:', { type, message });
  }, []);

  const pushCustom = React.useCallback((type: string, message: string) => {
    console.log('SNACKBAR:', { type, message });
  }, []);

  return {
    ...snackbar,
    close,
    dismiss,
    push,
    pushGeneric,
    pushCustom,
  };
};

export default useSnackbar;
