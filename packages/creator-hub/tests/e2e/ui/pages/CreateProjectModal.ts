import type { Locator, Page } from 'playwright';

export class CreateProjectModal {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async waitForModalToBeVisible(): Promise<void> {
    await this.page.getByTestId('create-project-modal').waitFor({ state: 'visible' });
  }

  async isVisible(): Promise<boolean> {
    try {
      await this.page.getByTestId('create-project-modal').waitFor({ state: 'visible' });
      return true;
    } catch {
      return false;
    }
  }

  async fillProjectName(name: string): Promise<void> {
    await this.page.getByTestId('create-project-modal-name-input').getByRole('textbox').fill(name);
  }

  getProjectPathComponent(): Locator {
    return this.page.getByTestId('create-project-modal-path-input').getByRole('textbox');
  }

  async fillProjectPath(path: string): Promise<void> {
    await this.getProjectPathComponent().fill(path);
  }

  async clickCreateButton(): Promise<void> {
    await this.page.getByTestId('create-project-modal-create-button').click();
  }
}
