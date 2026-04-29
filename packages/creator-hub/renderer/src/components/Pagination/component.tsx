import type {
  PaginationLinkProps,
  PaginationPreviousNextProps,
  PaginationRootProps,
} from './types';

import './styles.css';

function ChevronLeftIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/** Build page numbers and ellipsis for display (1-based display, ellipsis where gap) */
function getPaginationItems(totalPages: number, currentPage: number): (number | 'ellipsis')[] {
  if (totalPages <= 0) return [];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const current = currentPage + 1; // 1-based
  const out: (number | 'ellipsis')[] = [];
  out.push(1);
  if (current > 3) out.push('ellipsis');
  const lo = Math.max(2, current - 1);
  const hi = Math.min(totalPages - 1, current + 1);
  for (let i = lo; i <= hi; i++) {
    out.push(i);
  }
  if (current < totalPages - 2) out.push('ellipsis');
  if (totalPages > 1) out.push(totalPages);
  return out;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  className = '',
  children,
}: PaginationRootProps) {
  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={`PaginationRoot ${className}`.trim()}
    >
      {children}
    </nav>
  );
}

export function PaginationContent({ children }: { children: React.ReactNode }) {
  return <ul className="PaginationContent">{children}</ul>;
}

export function PaginationItem({ children }: { children: React.ReactNode }) {
  return <li className="PaginationItem">{children}</li>;
}

export function PaginationPrevious({
  disabled,
  onClick,
  label = 'Previous',
}: PaginationPreviousNextProps) {
  return (
    <button
      type="button"
      className="PaginationPrevious"
      disabled={disabled}
      onClick={onClick}
      aria-label="Go to previous page"
    >
      <ChevronLeftIcon />
      <span>{label}</span>
    </button>
  );
}

export function PaginationLink({
  page,
  isActive,
  disabled,
  onClick,
  children,
}: PaginationLinkProps) {
  return (
    <button
      type="button"
      className={`PaginationLink ${isActive ? 'PaginationLink--active' : ''}`}
      disabled={disabled}
      onClick={() => onClick(page)}
      aria-label={isActive ? `Page ${page + 1}` : `Go to page ${page + 1}`}
      aria-current={isActive ? 'page' : undefined}
    >
      {children}
    </button>
  );
}

export function PaginationEllipsis() {
  return (
    <span
      className="PaginationEllipsis"
      aria-hidden
    >
      …
    </span>
  );
}

export function PaginationNext({ disabled, onClick, label = 'Next' }: PaginationPreviousNextProps) {
  return (
    <button
      type="button"
      className="PaginationNext"
      disabled={disabled}
      onClick={onClick}
      aria-label="Go to next page"
    >
      <span>{label}</span>
      <ChevronRightIcon />
    </button>
  );
}

/** Full pagination bar: Previous, page numbers with ellipsis, Next (shadcn-style) */
export function PaginationBar({
  page,
  totalPages,
  onPageChange,
  className = '',
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  const items = getPaginationItems(totalPages, page);
  const canPrev = page > 0;
  const canNext = page < totalPages - 1;

  return (
    <Pagination
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
      className={className}
    >
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            disabled={!canPrev}
            onClick={() => onPageChange(page - 1)}
            direction="previous"
          />
        </PaginationItem>
        {items.map((item, i) =>
          item === 'ellipsis' ? (
            <PaginationItem key={`ellipsis-${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationLink
                page={item - 1}
                isActive={page === item - 1}
                onClick={onPageChange}
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext
            disabled={!canNext}
            onClick={() => onPageChange(page + 1)}
            direction="next"
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
