import type { Page } from 'playwright';
import { HomePage } from '../ui/pages/HomePage';
import { ScenesPage } from '../ui/pages/ScenesPage';
import { SignInPage } from '../ui/pages/SignInPage';
import { TemplatesPage } from '../ui/pages/TemplatesPage';
import { EditorPage } from '../ui/pages/EditorPage';
import { CreateProjectModal } from '../ui/pages/CreateProjectModal';
import { PublishModal } from '../ui/pages/PublishModal';
import { SceneDomain } from '../domain/Scene';
import { UserDomain } from '../domain/User';
import { FsHelper } from './fsHelper';

export interface TestSetup {
  page: Page;
  homePage: HomePage;
  scenesPage: ScenesPage;
  signInPage: SignInPage;
  templatesPage: TemplatesPage;
  editorPage: EditorPage;
  createProjectModal: CreateProjectModal;
  publishModal: PublishModal;
  sceneDomain: SceneDomain;
  userDomain: UserDomain;
  fsHelper: FsHelper;
  testProjectPath: string;
}

export class TestSetupHelper {
  static async createTestSetup(page: Page): Promise<TestSetup> {
    const homePage = new HomePage(page);
    const scenesPage = new ScenesPage(page);
    const signInPage = new SignInPage(page);
    const templatesPage = new TemplatesPage(page);
    const editorPage = new EditorPage(page);
    const createProjectModal = new CreateProjectModal(page);
    const publishModal = new PublishModal(page);
    const sceneDomain = new SceneDomain(page);
    const userDomain = new UserDomain(page);
    const fsHelper = new FsHelper();
    const testProjectPath = `/tmp/test-scene-${Date.now()}`;

    return {
      page,
      homePage,
      scenesPage,
      signInPage,
      templatesPage,
      editorPage,
      createProjectModal,
      publishModal,
      sceneDomain,
      userDomain,
      fsHelper,
      testProjectPath,
    };
  }

  static async setupAuthenticatedUser(setup: TestSetup): Promise<void> {
    await setup.homePage.navigate();
    await setup.userDomain.authenticate();
  }

  static async setupTestScene(setup: TestSetup): Promise<void> {
    await setup.homePage.navigate();
    await setup.homePage.navigateToScenes();
    await setup.sceneDomain.createTestScene();
    await setup.scenesPage.waitForPageLoad();
  }

  static async setupAuthenticatedUserWithScene(setup: TestSetup): Promise<void> {
    // First authenticate the user
    await this.setupAuthenticatedUser(setup);

    // Then create a test scene
    await this.setupTestScene(setup);
  }

  static async cleanupTestSetup(setup: TestSetup): Promise<void> {
    if (setup.testProjectPath) {
      await setup.fsHelper.cleanupTestProject(setup.testProjectPath);
    }
  }

  static async createSceneWithCustomContent(setup: TestSetup, content: string): Promise<void> {
    await this.setupTestScene(setup);

    // Modify the scene content
    const projectPath = await setup.sceneDomain.getCurrentProjectPath();
    await setup.fsHelper.modifySceneContent(projectPath, content);
  }

  static async createInvalidScene(setup: TestSetup): Promise<void> {
    await this.setupTestScene(setup);

    // Remove required files to make the scene invalid
    const projectPath = await setup.sceneDomain.getCurrentProjectPath();
    await setup.fsHelper.removeRequiredFiles(projectPath);
  }
}
