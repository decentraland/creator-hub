import type { Page } from 'playwright';

export class SceneDomain {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async createTestScene(): Promise<void> {
    // Navigate to templates and create a basic scene
    await this.page.click('.new-scene');
    await this.page.waitForSelector('[data-testid="template-basic"]');
    await this.page.click('[data-testid="template-basic"]');
    await this.page.waitForSelector('[data-testid="create-project-button"]');
    await this.page.click('[data-testid="create-project-button"]');

    // Wait for project creation to complete
    await this.page.waitForSelector('[data-testid="project-created"]', { timeout: 30000 });
  }

  async hasAvailableTemplates(): Promise<boolean> {
    try {
      await this.page.waitForSelector('[data-testid="template-item"]', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async selectBasicTemplate(): Promise<void> {
    await this.page.click('[data-testid="template-basic"]');
    await this.page.click('[data-testid="create-project-button"]');
  }

  async waitForProjectCreation(): Promise<boolean> {
    try {
      await this.page.waitForSelector('[data-testid="project-created"]', { timeout: 30000 });
      return true;
    } catch {
      return false;
    }
  }

  async getCurrentProjectPath(): Promise<string> {
    // This would typically get the project path from the app state
    // For now, return a mock path
    return '/mock/project/path';
  }

  async isInPreviewMode(): Promise<boolean> {
    try {
      await this.page.waitForSelector('[data-testid="preview-mode"]', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async hasSceneContent(): Promise<boolean> {
    try {
      await this.page.waitForSelector('[data-testid="scene-content"]', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async hasSceneTitle(): Promise<boolean> {
    try {
      await this.page.waitForSelector('[data-testid="scene-title"]', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async hasCustomContent(content: string): Promise<boolean> {
    try {
      const element = await this.page.$('[data-testid="scene-content"]');
      if (element) {
        const text = await element.textContent();
        return text?.includes(content) || false;
      }
      return false;
    } catch {
      return false;
    }
  }

  async isDeployModalOpen(): Promise<boolean> {
    try {
      await this.page.waitForSelector('[data-testid="deploy-modal"]', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async hasDeploymentOptions(): Promise<boolean> {
    try {
      await this.page.waitForSelector('[data-testid="deployment-options"]', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async deployScene(): Promise<boolean> {
    try {
      await this.page.click('[data-testid="deploy-button"]');
      await this.page.waitForSelector('[data-testid="deployment-success"]', { timeout: 60000 });
      return true;
    } catch {
      return false;
    }
  }

  async isDeploymentSuccessful(): Promise<boolean> {
    try {
      await this.page.waitForSelector('[data-testid="deployment-success"]', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async isSceneDeployed(): Promise<boolean> {
    try {
      await this.page.waitForSelector('[data-testid="scene-deployed"]', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async hasDeploymentTimestamp(): Promise<boolean> {
    try {
      await this.page.waitForSelector('[data-testid="deployment-timestamp"]', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async hasValidationErrors(): Promise<boolean> {
    try {
      await this.page.waitForSelector('[data-testid="validation-errors"]', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async canDeploy(): Promise<boolean> {
    try {
      const deployButton = await this.page.$('[data-testid="deploy-button"]');
      if (deployButton) {
        const isDisabled = await deployButton.getAttribute('disabled');
        return !isDisabled;
      }
      return false;
    } catch {
      return false;
    }
  }
}
