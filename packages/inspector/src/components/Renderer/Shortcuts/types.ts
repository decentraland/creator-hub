export interface Props {
  viewport: React.RefObject<HTMLElement>;
  onResetCamera: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}
