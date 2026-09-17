import type { Locator } from 'playwright';
import { sleep } from './sleep';

export interface RetryOptions {
  retries?: number;
  gap?: number;
}

/** Run `action`, await `verify`, and retry the pair up to `retries` times with linear backoff. */
export async function actUntil(
  action: () => Promise<unknown>,
  verify: () => Promise<unknown>,
  { retries = 3, gap = 150 }: RetryOptions = {},
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await action();
    } catch (error) {
      lastError = error;
    }
    try {
      await verify();
      return;
    } catch (error) {
      lastError = error;
    }
    if (attempt < retries) {
      await sleep(gap * (attempt + 1));
    }
  }
  throw new Error(
    `actUntil: outcome not observed after ${retries + 1} attempt(s): ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

export interface OpenThenSelectOptions extends RetryOptions {
  opened?: () => Promise<unknown>;
  triggerButton?: 'left' | 'right';
  reset?: () => Promise<unknown>;
}

/** Click `trigger`, click `item`, and retry the open+select until `effect` is observed. */
export async function openThenSelect(
  trigger: Locator,
  item: Locator,
  effect: () => Promise<unknown>,
  { opened, triggerButton = 'left', reset, retries, gap }: OpenThenSelectOptions = {},
): Promise<void> {
  await actUntil(
    async () => {
      if (reset) await reset();
      await trigger.click({ button: triggerButton });
      if (opened) await opened();
      await item.click();
    },
    effect,
    { retries, gap },
  );
}

/** Hover `row` to reveal `button`, click it, and retry until `effect` is observed. */
export async function revealThenClick(
  row: Locator,
  button: Locator,
  effect: () => Promise<unknown>,
  { retries, gap }: RetryOptions = {},
): Promise<void> {
  await actUntil(
    async () => {
      await row.hover();
      await button.click();
    },
    effect,
    { retries, gap },
  );
}
