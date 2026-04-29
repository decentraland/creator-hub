import type { ReactNode } from 'react';

export interface PaginationRootProps {
  /** Current page index (0-based) */
  page: number;
  /** Total number of pages */
  totalPages: number;
  /** Called when user selects a page (0-based) */
  onPageChange: (page: number) => void;
  className?: string;
  children: ReactNode;
}

export interface PaginationLinkProps {
  page: number;
  isActive?: boolean;
  disabled?: boolean;
  onClick: (page: number) => void;
  children: ReactNode;
}

export interface PaginationPreviousNextProps {
  disabled?: boolean;
  onClick: () => void;
  direction: 'previous' | 'next';
  label?: string;
}
