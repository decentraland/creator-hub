import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';
import type { Page } from 'playwright';

const devConfig = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../renderer/src/config/env/dev.json'),
    'utf8',
  ),
) as { ENS_SUBGRAPH: string };

/** True when the `.zone` ENS subgraph (the World name list's dependency) answers. */
export async function ensSubgraphAvailable(): Promise<boolean> {
  try {
    const response = await fetch(devConfig.ENS_SUBGRAPH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ _meta { block { number } } }' }),
    });
    if (!response.ok) return false;
    const body = await response.json();
    return !('error' in body) && !('errors' in body);
  } catch {
    return false;
  }
}

const SCENE_READY_TIMEOUT = 300_000;
const PUBLISH_PREPARE_TIMEOUT = 300_000;
const DEPLOY_ACCEPT_TIMEOUT = 600_000;
const DEPLOY_MAX_ATTEMPTS = 3;

/** Creates a blank scene and waits until the editor is interactive. */
export async function createScene(page: Page): Promise<void> {
  await page.locator('[data-testid="navbar-menu-scenes"]').click();
  await page.locator('[data-testid="scene-list-new-scene-button"]').click();
  await page.locator('[data-testid="templates-page-new-scene-button"]').click();
  await page.locator('[data-testid="create-project-modal-create-button"]').click();

  await expect(page.locator('[data-testid="editor-page"]')).toBeVisible({
    timeout: SCENE_READY_TIMEOUT,
  });
  await expect(page.locator('[data-testid="editor-page-iframe"]')).toBeVisible();
  await expect(page.locator('.MuiBackdrop-root:visible')).toHaveCount(0, {
    timeout: SCENE_READY_TIMEOUT,
  });
}

/** Opens the publish modal from the editor and waits for its target options. */
export async function openPublishModal(page: Page): Promise<void> {
  await page.locator('[data-testid="editor-page-publish-button"]').click();
  await expect(page.locator('[data-testid="publish-modal-initial-options"]')).toBeVisible({
    timeout: PUBLISH_PREPARE_TIMEOUT,
  });
}

/**
 * Runs the shared deploy step until the content server has accepted the deployment.
 *
 * @remarks Stops at the upload step turning `complete`, not at
 * `publish-modal-deploy-success`. Retries a transient catalyst rejection via the modal's own
 * Retry button (up to `DEPLOY_MAX_ATTEMPTS`) — see docs/testing-standards.md.
 */
export async function deployToAccepted(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="publish-modal-deploy"]')).toBeVisible({
    timeout: PUBLISH_PREPARE_TIMEOUT,
  });

  await page
    .locator('[data-testid="publish-modal-deploy-publish-button"] button')
    .click({ timeout: PUBLISH_PREPARE_TIMEOUT });

  const warningContinue = page.locator(
    '[data-testid="publish-modal-deploy-warning-continue-button"]',
  );
  if (await warningContinue.isVisible()) await warningContinue.click();

  const accepted = page.locator(
    [
      '[data-testid="publish-modal-deploy-step-uploading"][data-state="complete"]',
      '[data-testid="publish-modal-deploy-deploying-jump"]',
      '[data-testid="publish-modal-deploy-success"]',
    ].join(', '),
  );
  const failed = page.locator('[data-testid="publish-modal-deploy-error"]');
  const retry = page.locator('[data-testid="publish-modal-deploy-error-retry"]');

  for (let attempt = 1; attempt <= DEPLOY_MAX_ATTEMPTS; attempt++) {
    await expect(
      accepted.or(failed).first(),
      'the deploy step never reported an outcome',
    ).toBeVisible({ timeout: DEPLOY_ACCEPT_TIMEOUT });
    if (!(await failed.isVisible())) return;
    if (attempt < DEPLOY_MAX_ATTEMPTS) await retry.click();
  }

  throw new Error(
    `the content server rejected the deployment on all ${DEPLOY_MAX_ATTEMPTS} attempts`,
  );
}
