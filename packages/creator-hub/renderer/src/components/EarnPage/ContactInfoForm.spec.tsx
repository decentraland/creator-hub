import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { ContactInfoForm } from './ContactInfoForm';
import { WelcomePaper, WelcomeRoot } from './EarnModal.styled';

type Props = Partial<React.ComponentProps<typeof ContactInfoForm>>;

const renderForm = (props: Props = {}) => {
  const onSubmit = props.onSubmit ?? vi.fn();
  const onCancel = props.onCancel ?? vi.fn();
  const view = render(
    <ThemeProvider theme={dark}>
      <ContactInfoForm
        onSubmit={onSubmit}
        onCancel={onCancel}
        {...props}
      />
    </ThemeProvider>,
  );
  return { ...view, onSubmit, onCancel };
};

const field = (name: RegExp) => screen.getByLabelText<HTMLInputElement>(name);
const submit = () => screen.getByRole('button', { name: 'Submit' }) as HTMLButtonElement;
const type = (name: RegExp, value: string) => fireEvent.change(field(name), { target: { value } });

function fillValid() {
  type(/First Name/, '  Jane ');
  type(/Last Name/, 'Doe');
  type(/Email/, 'jane.doe@example.com');
}

/*
 * Each case renders MUI modals and queries them by role and accessible name, which takes seconds
 * on a loaded CI runner; vitest's default 5 s cut cases off there while they were passing.
 */
vi.setConfig({ testTimeout: 15_000 });

describe('ContactInfoForm', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(() => {
    cleanup();
  });

  describe('when it opens', () => {
    it('should require all three fields and focus the first name', () => {
      renderForm();

      expect(field(/First Name/).required).toBe(true);
      expect(field(/Last Name/).required).toBe(true);
      expect(field(/Email/).required).toBe(true);
      expect(document.activeElement).toBe(field(/First Name/));
      expect(field(/First Name/).placeholder).toBe('First Name');
      expect(field(/Last Name/).placeholder).toBe('Last Name');
      expect(field(/Email/).placeholder).toBe('name@email.com');
    });

    it('should focus the first name inside the modal under StrictMode', () => {
      const opener = document.createElement('button');
      document.body.append(opener);
      opener.focus();

      render(
        <StrictMode>
          <ThemeProvider theme={dark}>
            <WelcomeRoot open>
              <WelcomePaper>
                <ContactInfoForm
                  onSubmit={vi.fn()}
                  onCancel={vi.fn()}
                />
              </WelcomePaper>
            </WelcomeRoot>
          </ThemeProvider>
        </StrictMode>,
      );

      expect(document.activeElement).toBe(field(/First Name/));
      opener.remove();
    });

    it('should reserve a 15-tall helper row under every field, so an error moves nothing', () => {
      renderForm();
      const rows = () =>
        [/First Name/, /Last Name/, /Email/].map(name => {
          const row = document.getElementById(`${field(name).id}-error`)!;
          return [getComputedStyle(row).position === 'absolute', getComputedStyle(row).height];
        });

      expect(rows()).toEqual(Array(3).fill([false, '15px']));

      type(/Email/, 'not-an-email');
      fireEvent.blur(field(/Email/));

      expect(rows()).toEqual(Array(3).fill([false, '15px']));
      expect(document.getElementById(`${field(/Email/).id}-error`)!.textContent).toBe(
        'Invalid email',
      );
    });

    it('should keep SUBMIT disabled', () => {
      renderForm();
      expect(submit().disabled).toBe(true);
    });
  });

  describe('when the browser offers autofill', () => {
    it('should tag each field with its autocomplete purpose and not spellcheck the email', () => {
      renderForm();

      expect(field(/First Name/).getAttribute('autocomplete')).toBe('given-name');
      expect(field(/Last Name/).getAttribute('autocomplete')).toBe('family-name');
      expect(field(/Email/).getAttribute('autocomplete')).toBe('email');
      expect(field(/Email/).getAttribute('spellcheck')).toBe('false');
    });
  });

  describe('when the submit is in flight', () => {
    it('should disable SUBMIT and mark it busy', () => {
      renderForm({ status: 'submitting' });

      expect(submit().disabled).toBe(true);
      expect(submit().getAttribute('aria-busy')).toBe('true');
    });
  });

  describe('when typing', () => {
    it('should cap the names at 100 characters and the email at 254, with no visible counter', () => {
      renderForm();

      expect(field(/First Name/).maxLength).toBe(100);
      expect(field(/Last Name/).maxLength).toBe(100);
      expect(field(/Email/).maxLength).toBe(254);
      type(/First Name/, 'Jane');
      expect(screen.queryByText(/^\d+\/(100|254)$/)).toBeNull();
    });
  });

  describe('when the email is invalid', () => {
    it('should flag it only after blur', () => {
      renderForm();
      type(/Email/, 'nope');
      expect(screen.queryByText('Invalid email')).toBeNull();

      fireEvent.blur(field(/Email/));

      const error = screen.getByText('Invalid email');
      expect(field(/Email/).getAttribute('aria-invalid')).toBe('true');
      expect(field(/Email/).getAttribute('aria-describedby')).toContain(error.id);
    });
  });

  describe('when every field is valid', () => {
    it('should submit the trimmed values', () => {
      const { onSubmit } = renderForm();
      fillValid();

      expect(submit().disabled).toBe(false);
      fireEvent.click(submit());

      expect(onSubmit).toHaveBeenCalledWith({
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane.doe@example.com',
      });
    });
  });

  describe('when a name is only spaces', () => {
    it('should keep SUBMIT disabled', () => {
      renderForm();
      fillValid();
      type(/Last Name/, '   ');
      expect(submit().disabled).toBe(true);
    });
  });

  describe('when the service refused the submit', () => {
    it('should show each line above the buttons', () => {
      renderForm({
        errors: ['email must be a valid address', 'Something went wrong. Please try again.'],
      });

      const alert = screen.getByRole('alert');
      expect(within(alert).getByText('email must be a valid address')).toBeTruthy();
      expect(within(alert).getByText('Something went wrong. Please try again.')).toBeTruthy();
    });
  });

  describe('when cancelling', () => {
    it('should report it', () => {
      const { onCancel } = renderForm();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onCancel).toHaveBeenCalled();
    });
  });
});
