import type { Server } from 'node:http';

export type MockOptions = {
  ineligible?: string;
  termsVersion?: number;
  enrollment?: string;
  noClosedCycle?: boolean;
  noRunning?: boolean;
  payoutWallet?: boolean;
  emailVerified?: boolean;
  noPayouts?: boolean;
  resendMs?: number;
  codeTtlMs?: number;
  clock?: () => number;
  latency?: [number, number];
};

export function createMockServer(options?: MockOptions): Server;

export function mockConfigFromEnv(env: NodeJS.ProcessEnv): { port: number; options: MockOptions };
