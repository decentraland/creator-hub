import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import type { FeedbackDelivery, FeedbackReport } from '/shared/types/feedback';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';
import { HELP_FAQ_URL } from '/@/modules/utils';

const mocks = vi.hoisted(() => ({
  send: vi.fn<[FeedbackReport], Promise<FeedbackDelivery>>(),
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
const contact = () => screen.getByRole('textbox', { name: 'How can we reach you? (optional)' });
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

    it('should ask for a Discord username or email in one box', () => {
      renderDialog();
      expect(screen.queryByRole('combobox')).toBeNull();
      expect((contact() as HTMLInputElement).placeholder).toBe('Discord username or email');
      expect(
        screen.getByText("Leave your Discord username or email if you'd like us to follow up."),
      ).toBeTruthy();
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

    describe.each([
      ['fixture_user', 'discord', 'fixture_user'],
      ['@Fixture_User', 'discord', 'fixture_user'],
      ['ab', 'discord', 'ab'],
      ['a'.repeat(32), 'discord', 'a'.repeat(32)],
      ['jane.doe@example.com', 'email', 'jane.doe@example.com'],
    ])('and the contact is "%s"', (input, method, value) => {
      it(`should keep Send enabled and send it as ${method} "${value}"`, async () => {
        mocks.send.mockResolvedValue('sent');
        renderDialog();
        type(description(), 'Publishing failed');
        type(contact(), input);
        fireEvent.blur(contact());

        expect(screen.queryByText('Enter a valid Discord username.')).toBeNull();
        expect(screen.queryByText('Enter a valid email address.')).toBeNull();
        await act(async () => fireEvent.click(sendButton()));

        expect(mocks.send.mock.calls[0][0].contact).toEqual({ method, value });
      });
    });

    describe.each([
      ['jane.doe@', 'Enter a valid email address.'],
      ['fixture..user', 'Enter a valid Discord username.'],
      ['a', 'Enter a valid Discord username.'],
      ['a'.repeat(33), 'Enter a valid Discord username.'],
      ['fixture-user', 'Enter a valid Discord username.'],
    ])('and the contact is the invalid "%s"', (input, error) => {
      it(`should disable Send and say "${error}" once it loses focus`, () => {
        renderDialog();
        type(description(), 'Publishing failed');
        type(contact(), input);

        expect(screen.queryByText(error)).toBeNull();
        fireEvent.blur(contact());

        expect((sendButton() as HTMLButtonElement).disabled).toBe(true);
        expect(screen.getByText(error)).toBeTruthy();
      });
    });
  });

  describe('when the report is sent', () => {
    it('should send the description, email contact, logs choice, source and event id', async () => {
      mocks.send.mockResolvedValue('sent');
      renderDialog({ source: 'publish-failure', associatedEventId: 'deploy-event-id' });
      type(description(), '  Publishing failed  ');
      type(contact(), ' jane.doe@example.com ');
      fireEvent.click(logs());

      await act(async () => fireEvent.click(sendButton()));

      expect(mocks.send).toHaveBeenCalledWith({
        message: 'Publishing failed',
        contact: { method: 'email', value: 'jane.doe@example.com' },
        includeLogs: false,
        associatedEventId: 'deploy-event-id',
        source: 'publish-failure',
      });
    });

    it('should leave the contact out when none was given', async () => {
      mocks.send.mockResolvedValue('sent');
      renderDialog();
      type(description(), 'Publishing failed');
      type(contact(), '   ');

      await act(async () => fireEvent.click(sendButton()));

      expect(mocks.send.mock.calls[0][0]).not.toHaveProperty('contact');
    });

    it('should show the sending state until the send settles', async () => {
      let resolve: (delivery: FeedbackDelivery) => void = () => {};
      mocks.send.mockReturnValue(new Promise(r => (resolve = r)));
      renderDialog();
      type(description(), 'Publishing failed');

      await act(async () => fireEvent.click(sendButton()));

      expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
      expect((description() as HTMLTextAreaElement).disabled).toBe(true);
      await act(async () => resolve('sent'));
    });

    it('should thank the user', async () => {
      mocks.send.mockResolvedValue('sent');
      renderDialog();
      type(description(), 'Publishing failed');

      await act(async () => fireEvent.click(sendButton()));

      expect(screen.getByText('Thanks! We got your report and will look into it.')).toBeTruthy();
    });
  });

  describe('when the report is saved to send later', () => {
    it('should say it will be sent once back online, with no retry', async () => {
      mocks.send.mockResolvedValue('queued');
      renderDialog();
      type(description(), 'Publishing failed');

      await act(async () => fireEvent.click(sendButton()));

      expect(
        screen.getByText("We saved your report and will send it as soon as you're back online."),
      ).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
    });
  });

  describe('when the send fails', () => {
    it('should say so and offer a retry that sends again', async () => {
      mocks.send.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('sent');
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
