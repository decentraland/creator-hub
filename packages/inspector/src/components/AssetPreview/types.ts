export interface Props {
  value: File;
  resources?: File[];
  /** Called exactly once per preview, without a value when no thumbnail could be produced. */
  onScreenshot: (value?: string) => void;
  onLoad?: () => void;
  isEmote?: boolean;
}
