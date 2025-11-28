import { test } from '@playwright/test';

import { ElectronUtils } from '../../utils/electron';
import { TestSetupHelper } from '../../utils/testSetup';
import { LoginTestHelper } from './helper';

test.describe('login flow', () => {
  test('should complete full login flow from home to authenticated state', async () => {
    const electronUtils = new ElectronUtils();

    try {
      const page = await electronUtils.getPage();
      const setup = await TestSetupHelper.createTestSetup(page);

      // Complete the login flow
      await LoginTestHelper.completeLoginFlow(setup);
    } finally {
      await electronUtils.cleanup();
    }
  });
});
