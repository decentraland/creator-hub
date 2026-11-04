import { useCallback, useState } from 'react';
import { Box, Button, TextField, Typography } from 'decentraland-ui2';

import { t } from '/@/modules/store/translation/utils';

/** Where the user pastes the code an agent's sign-in page shows when the browser can't hand the
 *  sign-in back to the app on its own. */
export function SignInCodeField({ onSubmit }: { onSubmit: (code: string) => void }) {
  const [code, setCode] = useState('');
  const submit = useCallback(() => {
    if (code.trim() === '') return;
    onSubmit(code);
    setCode('');
  }, [code, onSubmit]);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography
        variant="caption"
        color="text.secondary"
      >
        {t('editor.ai.setup.signin_code_hint')}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          size="small"
          fullWidth
          value={code}
          placeholder={t('editor.ai.setup.signin_code_placeholder')}
          inputProps={{ 'aria-label': t('editor.ai.setup.signin_code_placeholder') }}
          onChange={e => setCode(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submit();
          }}
        />
        <Button
          color="secondary"
          size="small"
          disabled={code.trim() === ''}
          onClick={submit}
        >
          {t('editor.ai.setup.signin_code_submit')}
        </Button>
      </Box>
    </Box>
  );
}
