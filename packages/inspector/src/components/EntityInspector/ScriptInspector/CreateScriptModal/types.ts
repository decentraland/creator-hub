export interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (scriptName: string) => void;
  isValid?: (scriptName: string) => string | undefined;
}
