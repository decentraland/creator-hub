import type { ReactNode } from 'react';

export type Props = {
  title: string;
  description?: string;
  imageUrl?: string;
  videoUrl?: string;
  content?: ReactNode;
  width?: number;
  height?: number;
  dropdownOptions?: { text: string; handler: () => void }[];
  onClick: () => void;
};
