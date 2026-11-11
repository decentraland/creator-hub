import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import type { FeedbackReport } from '/shared/types/feedback';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';
import { HELP_FAQ_URL } from '/@/modules/utils';

const mocks = vi.hoisted(() => ({
  send: vi.fn<[FeedbackReport], Promise<boolean>>(),
  openExternal: vi.fn(),
}));

vi.mock('#preload', () => ({
  env: { getEnv: () => 'dev' },
  feedback: { send: mocks.send },
  misc: { openExternal: mocks.openExternal },
}));

import { ReportIssue } from '.';

function renderDialog(props: Partial<Parameters<typeof ReportIssue>[0]> = {}) {
  const onClose = vi.fn();
  render(
    <ThemeProvider theme={dark}>
      <ReportIssue
        open
        source="logo-menu"
        onClose={onClose}
        {...props}
      />
    </ThemeProvider>,
  );
  return { onClose };
}

const description = () => screen.getByRole('textbox', { name: 'What happened?' });
const email = () => screen.getByRole('textbox', { name: 'Contact email (optional)' });
const logs = () => screen.getByRole('checkbox', { name: 'Include app logs' });
const sendButton = () => screen.getByRole('button', { name: 'Send' });

function type(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

describe('ReportIssue', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(() => {
    cleanup();
    mocks.send.mockReset();
    mocks.openExternal.mockReset();
  });

  describe('when it opens', () => {
    it('should be titled "Tell us what went wrong"', () => {
      renderDialog();
      expect(screen.getByRole('dialog', { name: 'Tell us what went wrong' })).toBeTruthy();
    });

    it('should tick "Include app logs" and say what the logs contain', () => {
      renderDialog();
      expect((logs() as HTMLInputElement).checked).toBe(true);
      expect(screen.getByText('Logs include your wallet address and scene names.')).toBeTruthy();
    });

    it('should disable Send while the description is empty', () => {
      renderDialog();
      expect((sendButton() as HTMLButtonElement).disabled).toBe(true);
    });

    it('should open the Help Center from its link', () => {
      renderDialog();
      fireEvent.click(screen.getByRole('link', { name: 'Visit the Help Center' }));
      expect(mocks.openExternal).toHaveBeenCalledWith(HELP_FAQ_URL);
    });
  });

  describe('when the description is filled', () => {
    it('should enable Send', () => {
      renderDialog();
      type(description(), 'Publishing failed');
      expect((sendButton() as HTMLButtonElement).disabled).toBe(false);
    });

    describe('and the email is invalid', () => {
      it('should disable Send and flag the email once it loses focus', () => {
        renderDialog();
        type(description(), 'Publishing failed');
        type(email(), 'jane.doe@');
        fireEvent.blur(email());

        expect((sendButton() as HTMLButtonElement).disabled).toBe(true);
        expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
      });
    });
  });

  describe('when the report is sent', () => {
    it('should send the description, email, logs choice, source and event id', async () => {
      mocks.send.mockResolvedValue(true);
      renderDialog({ source: 'publish-failure', associatedEventId: 'deploy-event-id' });
      type(description(), '  Publishing failed  ');
      type(email(), 'jane.doe@example.com');
      fireEvent.click(logs());

      await act(async () => fireEvent.click(sendButton()));

      expect(mocks.send).toHaveBeenCalledWith({
        message: 'Publishing failed',
        email: 'jane.doe@example.com',
        includeLogs: false,
        associatedEventId: 'deploy-event-id',
        source: 'publish-failure',
      });
    });

    it('should leave the email out when none was given', async () => {
      mocks.send.mockResolvedValue(true);
      renderDialog();
      type(description(), 'Publishing failed');

      await act(async () => fireEvent.click(sendButton()));

      expect(mocks.send.mock.calls[0][0].email).toBeUndefined();
    });

    it('should show the sending state until the send settles', async () => {
      let resolve: (queued: boolean) => void = () => {};
      mocks.send.mockReturnValue(new Promise(r => (resolve = r)));
      renderDialog();
      type(description(), 'Publishing failed');

      await act(async () => fireEvent.click(sendButton()));

      expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
      expect((description() as HTMLTextAreaElement).disabled).toBe(true);
      await act(async () => resolve(true));
    });

    it('should thank the user', async () => {
      mocks.send.mockResolvedValue(true);
      renderDialog();
      type(description(), 'Publishing failed');

      await act(async () => fireEvent.click(sendButton()));

      expect(screen.getByText('Thanks! We got your report and will look into it.')).toBeTruthy();
    });
  });

  describe('when the send fails', () => {
    it('should say so and offer a retry that sends again', async () => {
      mocks.send.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(true);
      renderDialog();
      type(description(), 'Publishing failed');

      await act(async () => fireEvent.click(sendButton()));

      expect(
        screen.getByText("We couldn't send your report. Check your connection and try again."),
      ).toBeTruthy();

      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Try again' })));

      expect(mocks.send).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Thanks! We got your report and will look into it.')).toBeTruthy();
    });
  });
});
