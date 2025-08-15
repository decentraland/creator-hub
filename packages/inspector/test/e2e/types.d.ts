/* eslint-disable @typescript-eslint/consistent-type-imports */
/// <reference types="vitest/globals" />

declare global {
  const describe: (typeof import('vitest'))['describe'];
  const test: (typeof import('vitest'))['test'];
  const it: (typeof import('vitest'))['it'];
  const expect: (typeof import('vitest'))['expect'];
  const beforeAll: (typeof import('vitest'))['beforeAll'];
  const afterAll: (typeof import('vitest'))['afterAll'];
  const beforeEach: (typeof import('vitest'))['beforeEach'];
  const afterEach: (typeof import('vitest'))['afterEach'];
}

export {};
