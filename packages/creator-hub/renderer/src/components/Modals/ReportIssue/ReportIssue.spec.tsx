import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import {
  FEEDBACK_MESSAGE_MAX_LENGTH,
  type FeedbackDelivery,
  type FeedbackReport,
} from '/shared/types/feedback';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';
import { HELP_FAQ_URL } from '/@/modules/utils';

const mocks = vi.hoisted(() => ({
  send: vi.fn<[FeedbackReport], Promise<FeedbackDelivery>>(),
  openExternal: vi.fn(),
  track: vi.fn(),
}));

vi.mock('#preload', () => ({
  analytics: { track: mocks.track },
  env: { getEnv: () => 'dev' },
  feedback: { send: mocks.send },
  misc: { openExternal: mocks.openExternal },
}));

import { ReportIssue } from '.';

type Props = Parameters<typeof ReportIssue>[0];

function renderDialog({ open: initiallyOpen = true, ...props }: Partial<Props> = {}) {
  const onClose = vi.fn();
  const dialog = (open: boolean) => (
    <ThemeProvider theme={dark}>
      <ReportIssue
        open={open}
        source="logo-menu"
        onClose={onClose}
        {...props}
      />
    </ThemeProvider>
  );
  const { rerender } = render(dialog(initiallyOpen));
  const reopen = () => {
    rerender(dialog(false));
    rerender(dialog(true));
  };
  return { onClose, rerender: (open: boolean) => rerender(dialog(open)), reopen };
}

const description = () => screen.getByRole('textbox', { name: 'What went wrong?' });
const contact = () => screen.getByRole('textbox', { name: 'How can we reach you? (optional)' });
const logs = () => screen.getByRole('checkbox', { name: 'Include app logs' });
const sendButton = () => screen.getByRole('button', { name: 'Send' });
const counter = () => document.getElementById(description().getAttribute('aria-describedby')!)!;
const precedes = (a: Node, b: Node) =>
  !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
const closeButton = () => screen.getByText('Close', { selector: 'button' });
const tracked = (event: string) => mocks.track.mock.calls.filter(([name]) => name === event);

async function sendWith(delivery: FeedbackDelivery | Error) {
  if (delivery instanceof Error) mocks.send.mockRejectedValueOnce(delivery);
  else mocks.send.mockResolvedValueOnce(delivery);
  await act(async () => fireEvent.click(sendButton()));
}

function fillForm() {
  type(description(), 'Publishing failed');
  type(contact(), 'jane.doe@example.com');
  fireEvent.click(logs());
}

function expectFormFilled() {
  expect((description() as HTMLTextAreaElement).value).toBe('Publishing failed');
  expect((contact() as HTMLInputElement).value).toBe('jane.doe@example.com');
  expect((logs() as HTMLInputElement).checked).toBe(false);
}

function expectFormEmpty() {
  expect((description() as HTMLTextAreaElement).value).toBe('');
  expect((contact() as HTMLInputElement).value).toBe('');
  expect((logs() as HTMLInputElement).checked).toBe(true);
}

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
    mocks.track.mockReset();
  });

  describe('when it opens', () => {
    it('should be titled "Report an issue"', () => {
      renderDialog();
      expect(screen.getByRole('dialog', { name: 'Report an issue' })).toBeTruthy();
    });

    it('should track that it opened, once, with its source', () => {
      const { rerender } = renderDialog({ open: false, source: 'publish-failure' });
      expect(tracked('Report Issue Opened')).toHaveLength(0);

      rerender(true);
      rerender(true);

      expect(mocks.track.mock.calls).toEqual([
        ['Report Issue Opened', { source: 'publish-failure' }],
      ]);
    });

    it('should track another opening each time it reopens', () => {
      const { reopen } = renderDialog();
      reopen();
      expect(tracked('Report Issue Opened')).toHaveLength(2);
    });

    it('should mark "What went wrong?" as required with a hidden asterisk', () => {
      renderDialog();
      const asterisk = screen.getByText('*', { exact: false, selector: 'label span' });
      expect(asterisk.getAttribute('aria-hidden')).toBe('true');
      expect(asterisk.closest('label')?.htmlFor).toBe(description().id);
    });

    it('should show the contact hint above its box', () => {
      renderDialog();
      const hint = screen.getByText(
        "Leave your Discord username or email if you'd like us to follow up.",
      );
      expect(precedes(hint, contact())).toBe(true);
    });

    it('should end the Help Center link with a hidden arrow', () => {
      renderDialog();
      const link = screen.getByRole('link', { name: 'Visit the Help Center' });
      expect(link.querySelector('[aria-hidden]')?.textContent).toBe(' →');
    });

    it('should leave the counter blank', () => {
      renderDialog();
      fireEvent.blur(description());
      expect(counter().textContent).toBe('');
    });

    it('should use one native textarea that never sizes itself', () => {
      renderDialog();
      type(description(), 'line\n'.repeat(40));
      expect(screen.getByRole('dialog').querySelectorAll('textarea')).toHaveLength(1);
      expect((description() as HTMLTextAreaElement).style.height).toBe('');
    });

    it('should let the description be resized vertically only', () => {
      renderDialog();
      expect(getComputedStyle(description()).resize).toBe('vertical');
    });

    it('should ask for a Discord username or email in one box', () => {
      renderDialog();
      expect(screen.queryByRole('combobox')).toBeNull();
      expect((contact() as HTMLInputElement).placeholder).toBe('Discord username or email');
      expect(contact().getAttribute('spellcheck')).toBe('false');
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

    it('should track the Help Center click with its source', () => {
      renderDialog({ source: 'publish-failure' });
      fireEvent.click(screen.getByRole('link', { name: 'Visit the Help Center' }));
      expect(tracked('Report Issue Help Center Clicked')).toEqual([
        ['Report Issue Help Center Clicked', { source: 'publish-failure' }],
      ]);
    });
  });

  describe('when the description is focused', () => {
    it('should count from "0/4096" while it is empty', () => {
      renderDialog();
      fireEvent.focus(description());
      expect(counter().textContent).toBe('0/4096');
    });

    it('should count the characters against the limit', () => {
      renderDialog();
      fireEvent.focus(description());
      type(description(), 'Publishing failed');
      expect(counter().textContent).toBe('17/4096');
      expect(description().getAttribute('aria-describedby')).toBe(counter().id);
    });

    it('should blank the counter again once it loses focus', () => {
      renderDialog();
      fireEvent.focus(description());
      type(description(), 'Publishing failed');
      fireEvent.blur(description());
      expect(counter().textContent).toBe('');
    });
  });

  describe('when the description is pasted past the limit', () => {
    it('should keep the whole paste, warn in the counter and block Send', () => {
      renderDialog();
      fireEvent.focus(description());
      type(description(), 'a'.repeat(FEEDBACK_MESSAGE_MAX_LENGTH + 1));

      expect((description() as HTMLTextAreaElement).value).toHaveLength(4097);
      expect((description() as HTMLTextAreaElement).maxLength).toBe(-1);
      expect(counter().textContent).toBe('4097/4096');
      expect(counter().querySelector('svg')).not.toBeNull();
      expect(description().getAttribute('aria-invalid')).toBe('true');
      expect((sendButton() as HTMLButtonElement).disabled).toBe(true);
    });

    it('should keep warning once the box loses focus', () => {
      renderDialog();
      fireEvent.focus(description());
      type(description(), 'a'.repeat(4097));
      fireEvent.blur(description());
      expect(counter().textContent).toBe('4097/4096');
      expect(counter().querySelector('svg')).not.toBeNull();
    });

    it('should enable Send again at exactly the limit', () => {
      renderDialog();
      fireEvent.focus(description());
      type(description(), 'a'.repeat(4097));
      type(description(), 'a'.repeat(4096));

      expect(counter().textContent).toBe('4096/4096');
      expect(counter().querySelector('svg')).toBeNull();
      expect(description().getAttribute('aria-invalid')).toBe('false');
      expect((sendButton() as HTMLButtonElement).disabled).toBe(false);
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
        expect(screen.getAllByRole('alert')).toHaveLength(1);
        expect(screen.getByRole('alert').textContent).toBe(error);
        const line = screen.getByText(error);
        expect(line.querySelector('svg')).not.toBeNull();
        expect(precedes(contact(), line)).toBe(true);
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
  });

  describe('when the report is delivered', () => {
    it('should say it was submitted, offer only Close, and track it as sent', async () => {
      renderDialog({ source: 'publish-failure' });
      fillForm();

      await sendWith('sent');

      expect(screen.getByRole('dialog', { name: 'Issue Report Submitted' })).toBeTruthy();
      expect(
        screen.getByText(
          "Thanks for helping us improve the Creator Hub! We've received your report and our team will investigate the issue and work on a fix.",
        ),
      ).toBeTruthy();
      expect(closeButton()).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
      expect(tracked('Report Issue Submitted')).toEqual([
        ['Report Issue Submitted', { source: 'publish-failure', result: 'sent' }],
      ]);
    });

    it('should clear the form once closed', async () => {
      const { onClose, reopen } = renderDialog();
      fillForm();
      await sendWith('sent');

      fireEvent.click(closeButton());
      reopen();

      expect(onClose).toHaveBeenCalledTimes(1);
      expectFormEmpty();
    });
  });

  describe('when the report is saved to send later', () => {
    it('should say it was saved, offer only Close, and track it as queued', async () => {
      renderDialog();
      fillForm();

      await sendWith('queued');

      expect(screen.getByRole('dialog', { name: 'Issue Report Saved' })).toBeTruthy();
      expect(
        screen.getByText("We saved your report and will send it as soon as you're back online."),
      ).toBeTruthy();
      expect(closeButton()).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
      expect(tracked('Report Issue Submitted')).toEqual([
        ['Report Issue Submitted', { source: 'logo-menu', result: 'queued' }],
      ]);
    });

    it('should clear the form once closed', async () => {
      const { reopen } = renderDialog();
      fillForm();
      await sendWith('queued');

      fireEvent.click(closeButton());
      reopen();

      expectFormEmpty();
    });
  });

  describe('when the delivery cannot be confirmed', () => {
    it('should say so, offer only Close, and track it as unknown', async () => {
      renderDialog();
      fillForm();

      await sendWith('unknown');

      expect(screen.getByRole('dialog', { name: "Couldn't Confirm Your Report" })).toBeTruthy();
      expect(
        screen.getByText(
          "We sent your report but couldn't confirm it arrived. If the problem continues, report it again.",
        ),
      ).toBeTruthy();
      expect(closeButton()).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
      expect(tracked('Report Issue Submitted')).toEqual([
        ['Report Issue Submitted', { source: 'logo-menu', result: 'unknown' }],
      ]);
    });

    it('should clear the form once closed', async () => {
      const { onClose, reopen } = renderDialog();
      fillForm();
      await sendWith('unknown');

      fireEvent.click(closeButton());
      reopen();

      expect(onClose).toHaveBeenCalledTimes(1);
      expectFormEmpty();
    });
  });

  describe('when the send fails', () => {
    it('should say something went wrong, offer Cancel and Try again, and track it as failed', async () => {
      renderDialog();
      fillForm();

      await sendWith(new Error('offline'));

      expect(screen.getByRole('dialog', { name: 'Something went wrong' })).toBeTruthy();
      expect(
        screen.getByText("We couldn't send your report. Check your connection and try again."),
      ).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.queryByRole('textbox')).toBeNull();
      expect(tracked('Report Issue Submitted')).toEqual([
        ['Report Issue Submitted', { source: 'logo-menu', result: 'failed' }],
      ]);
    });

    describe('and the user tries again', () => {
      it('should return to the filled form without sending or tracking an opening', async () => {
        renderDialog();
        fillForm();
        await sendWith(new Error('offline'));

        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

        expectFormFilled();
        expect((sendButton() as HTMLButtonElement).disabled).toBe(false);
        expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
        expect(mocks.send).toHaveBeenCalledTimes(1);
        expect(tracked('Report Issue Opened')).toHaveLength(1);
      });

      it('should track a second submission when sent again', async () => {
        renderDialog();
        fillForm();
        await sendWith(new Error('offline'));
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

        await sendWith('sent');

        expect(screen.getByRole('dialog', { name: 'Issue Report Submitted' })).toBeTruthy();
        expect(tracked('Report Issue Submitted').map(([, payload]) => payload)).toEqual([
          { source: 'logo-menu', result: 'failed' },
          { source: 'logo-menu', result: 'sent' },
        ]);
      });
    });

    describe('and the user cancels', () => {
      it('should close and keep every field for the next open', async () => {
        const { onClose, reopen } = renderDialog();
        fillForm();
        await sendWith(new Error('offline'));

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        reopen();

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('dialog', { name: 'Report an issue' })).toBeTruthy();
        expectFormFilled();
      });
    });
  });
});
