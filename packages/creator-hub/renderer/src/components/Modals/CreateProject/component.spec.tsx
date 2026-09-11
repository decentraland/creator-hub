import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { CreateProject } from './component';

const validateProjectPath = vi.fn();

vi.mock('/@/hooks/useWorkspace', () => ({
  useWorkspace: () => ({ validateProjectPath, selectNewProjectPath: vi.fn() }),
}));

/** Only `t` is stubbed; the store's translation slice imports the rest of this module. */
vi.mock('/@/modules/store/translation/utils', async importOriginal => ({
  ...((await importOriginal()) as object),
  t: (id: string) => id,
}));

/** The ui2 modal shell reads breakpoints this environment does not populate, and the
 * bug lives in the form, not the chrome: render title, fields and actions plainly. */
vi.mock('../PublishProject/PublishModal', () => ({
  PublishModal: ({
    title,
    children,
    actions,
  }: {
    title?: string;
    children: React.ReactNode;
    actions?: React.ReactNode;
  }) => (
    <div>
      <h2>{title}</h2>
      {children}
      <div role="group">{actions}</div>
    </div>
  ),
}));

const INITIAL_VALUE = { name: 'New Scene', path: '/scenes' };

/** The Name field is the first text input; neither field carries a label. */
const getNameInput = () => screen.getAllByRole('textbox')[0];
/** Create is the second action; it has no accessible name while it shows the spinner. */
const getCreateButton = () => within(screen.getByRole('group')).getAllByRole('button')[1];

/**
 * Pressing a button while an input has focus fires blur before click
 * (mousedown → blur → mouseup → click), so both events land on one press.
 */
const pressCreateWhileNameIsFocused = () => {
  fireEvent.blur(getNameInput());
  fireEvent.click(getCreateButton());
};

describe('CreateProject', () => {
  let onSubmit: ReturnType<typeof vi.fn>;

  afterEach(cleanup);

  beforeEach(() => {
    onSubmit = vi.fn();
    render(
      <ThemeProvider theme={dark}>
        <CreateProject
          open
          initialValue={INITIAL_VALUE}
          onClose={vi.fn()}
          onSubmit={onSubmit}
        />
      </ThemeProvider>,
    );
  });

  describe('when the name is edited and Create is pressed while the input still has focus', () => {
    beforeEach(() => {
      validateProjectPath.mockResolvedValue(true);
      fireEvent.change(getNameInput(), { target: { value: 'My Scene' } });
      pressCreateWhileNameIsFocused();
    });

    it('should create the scene on that single click', async () => {
      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith({ name: 'My Scene', path: '/scenes' }),
      );
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the path is not available', () => {
    beforeEach(() => {
      validateProjectPath.mockResolvedValue('path-taken');
      pressCreateWhileNameIsFocused();
    });

    it('should show the error and disable Create without creating the scene', async () => {
      await screen.findByText('modal.create_project.errors.path_exists_or_not_writable');
      expect(getCreateButton()).toHaveProperty('disabled', true);
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('when the input loses focus without a submit', () => {
    beforeEach(() => {
      validateProjectPath.mockReturnValue(new Promise(() => {}));
      fireEvent.blur(getNameInput());
    });

    it('should keep Create clickable while the background validation runs', () => {
      expect(getCreateButton()).toHaveProperty('disabled', false);
    });
  });
});
