export interface Props {
  content: React.ReactNode;
  /** Accessible name of the remove button — say what it removes, not just "Remove". */
  removeLabel: string;
  className?: string;
  onRemove: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
}
