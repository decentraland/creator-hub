import type { ReactNode } from 'react';

export type RowProps = {
  title: string;
  description?: string;
  children: ReactNode;
  onClickTitle?: () => void;
};

export type HomeCardProps = {
  title: string;
  description?: string;
  imageUrl?: string;
  videoUrl?: string;
  icon?: ReactNode;
  meta?: ReactNode;
  onClick?: () => void;
};

export type NewProjectPayload = {
  name: string;
  path: string;
  repo?: string;
};
