import type { ReactNode } from 'react';

export type Step = {
  bulletText: ReactNode;
  name: string;
  text?: string;
  state?: 'idle' | 'pending' | 'success' | 'failed';
};
