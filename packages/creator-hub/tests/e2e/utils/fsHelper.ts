import { promises as fs } from 'fs';
import path from 'path';

export class FsHelper {
  async hasSceneFiles(projectPath: string): Promise<boolean> {
    try {
      const requiredFiles = ['scene.json', 'package.json', 'src/game.ts'];

      for (const file of requiredFiles) {
        const filePath = path.join(projectPath, file);
        await fs.access(filePath);
      }

      return true;
    } catch {
      return false;
    }
  }

  async createTestProject(projectPath: string): Promise<void> {
    try {
      await fs.mkdir(projectPath, { recursive: true });

      // Create basic scene.json
      const sceneJson = {
        display: {
          title: 'Test Scene',
          description: 'A test scene for e2e testing',
        },
        owner: '0x0000000000000000000000000000000000000000',
        contact: {
          name: 'Test User',
          email: 'test@example.com',
        },
        main: 'src/game.ts',
        tags: ['test'],
        scene: {
          parcels: ['0,0'],
          base: '0,0',
        },
      };

      await fs.writeFile(path.join(projectPath, 'scene.json'), JSON.stringify(sceneJson, null, 2));

      // Create basic package.json
      const packageJson = {
        name: 'test-scene',
        version: '1.0.0',
        description: 'Test scene for e2e testing',
        main: 'src/game.ts',
        scripts: {
          build: 'decentraland-compiler build',
          start: 'decentraland-compiler start',
        },
        dependencies: {
          '@dcl/sdk': '^7.0.0',
        },
      };

      await fs.writeFile(
        path.join(projectPath, 'package.json'),
        JSON.stringify(packageJson, null, 2),
      );

      // Create src directory and game.ts
      await fs.mkdir(path.join(projectPath, 'src'), { recursive: true });

      const gameTs = `
import { createRoot } from '@dcl/sdk'

createRoot().addChild()
`;

      await fs.writeFile(path.join(projectPath, 'src/game.ts'), gameTs.trim());
    } catch (error) {
      console.error('Error creating test project:', error);
      throw error;
    }
  }

  async cleanupTestProject(projectPath: string): Promise<void> {
    try {
      await fs.rm(projectPath, { recursive: true, force: true });
    } catch (error) {
      console.error('Error cleaning up test project:', error);
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async readFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf-8');
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    await fs.writeFile(filePath, content, 'utf-8');
  }

  async modifySceneContent(projectPath: string, content: string): Promise<void> {
    try {
      const gameTsPath = path.join(projectPath, 'src/game.ts');
      const newContent = `
import { createRoot } from '@dcl/sdk'

createRoot().addChild()

// Custom content: ${content}
`;
      await fs.writeFile(gameTsPath, newContent.trim());
    } catch (error) {
      console.error('Error modifying scene content:', error);
      throw error;
    }
  }

  async removeRequiredFiles(projectPath: string): Promise<void> {
    try {
      const filesToRemove = ['scene.json', 'package.json', 'src/game.ts'];

      for (const file of filesToRemove) {
        const filePath = path.join(projectPath, file);
        try {
          await fs.unlink(filePath);
        } catch {
          // File might not exist, continue
        }
      }
    } catch (error) {
      console.error('Error removing required files:', error);
      throw error;
    }
  }

  async getProjectFiles(projectPath: string): Promise<string[]> {
    try {
      const files: string[] = [];
      const readDir = async (dirPath: string, relativePath: string = '') => {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          const relativeFilePath = path.join(relativePath, entry.name);

          if (entry.isDirectory()) {
            await readDir(fullPath, relativeFilePath);
          } else {
            files.push(relativeFilePath);
          }
        }
      };

      await readDir(projectPath);
      return files;
    } catch (error) {
      console.error('Error getting project files:', error);
      return [];
    }
  }
}
