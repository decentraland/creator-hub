import { describe, it, expect, beforeEach } from 'vitest';
import { hasCustomCode } from '../scene-parser';

describe('when parsing scene files', () => {
  describe('and the scene has custom imports', () => {
    let sceneContent: string;

    beforeEach(() => {
      sceneContent = `
        import {} from '@dcl/sdk/math'
        import { engine } from '@dcl/sdk/ecs'
        import { MyCustomLib } from 'custom-lib'

        export function main() {}
      `;
    });

    it('should detect custom code', () => {
      expect(hasCustomCode(sceneContent)).toBe(true);
    });
  });

  describe('and the scene has only default imports', () => {
    let sceneContent: string;

    beforeEach(() => {
      sceneContent = `
        import {} from '@dcl/sdk/math'
        import { engine } from '@dcl/sdk/ecs'

        export function main() {}
      `;
    });

    it('should not detect custom code', () => {
      expect(hasCustomCode(sceneContent)).toBe(false);
    });
  });

  describe('and the main function has code', () => {
    let sceneContent: string;

    beforeEach(() => {
      sceneContent = `
        import {} from '@dcl/sdk/math'
        import { engine } from '@dcl/sdk/ecs'

        export function main() {
            console.log('custom code')
        }
      `;
    });

    it('should detect custom code', () => {
      expect(hasCustomCode(sceneContent)).toBe(true);
    });
  });

  describe('and the main function is empty', () => {
    let sceneContent: string;

    beforeEach(() => {
      sceneContent = `
        import {} from '@dcl/sdk/math'
        import { engine } from '@dcl/sdk/ecs'

        export function main() {}
      `;
    });

    it('should not detect custom code', () => {
      expect(hasCustomCode(sceneContent)).toBe(false);
    });
  });

  describe('and the scene matches the new empty template', () => {
    let sceneContent: string;

    beforeEach(() => {
      sceneContent = `
        import {} from '@dcl/sdk/math'
        import { engine } from '@dcl/sdk/ecs'
        import { setupUi } from './ui'

        export function main() {
            // uncomment the line below to initialize UI from ui.tsx
            //setupUi()

            // your scene code here
        }
      `;
    });

    it('should not detect custom code', () => {
      expect(hasCustomCode(sceneContent)).toBe(false);
    });
  });

  describe('and the scene has the ui import but setupUi is called in main', () => {
    let sceneContent: string;

    beforeEach(() => {
      sceneContent = `
        import {} from '@dcl/sdk/math'
        import { engine } from '@dcl/sdk/ecs'
        import { setupUi } from './ui'

        export function main() {
            setupUi()
        }
      `;
    });

    it('should detect custom code', () => {
      expect(hasCustomCode(sceneContent)).toBe(true);
    });
  });

  describe('and the content is null', () => {
    it('should return false', () => {
      expect(hasCustomCode(null)).toBe(false);
    });
  });

  describe('and the content has syntax errors', () => {
    let invalidContent: string;

    beforeEach(() => {
      invalidContent = 'this is { not valid typescript';
    });

    it('should return false safely', () => {
      expect(hasCustomCode(invalidContent)).toBe(false);
    });
  });
});
