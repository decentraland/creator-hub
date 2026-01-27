import type { TreeNode } from '../../ProjectAssetExplorer/ProjectView';
import type { Props as TextFieldProps } from '../TextField/types';
import type { Props as DropdownProps } from '../Dropdown/types';

export type Props = Omit<TextFieldProps, 'accept' | 'type' | 'onDrop'> & {
  accept?: string[];
  onDrop?: (path: string) => void | Promise<void>;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isValidFile?: (node: TreeNode) => boolean;
  showPreview?: boolean;
  acceptURLs?: boolean;
  isEnabledFileExplorer?: boolean;
  openFileExplorerOnMount?: boolean;
  options?: DropdownProps['options'];
};

export const ACCEPTED_FILE_TYPES = {
  model: ['.gltf', '.glb'],
  image: ['.png', '.jpg', '.jpeg'],
  audio: ['.mp3', '.wav', '.ogg'],
  video: ['.mp4'],
  script: ['.ts', '.tsx'],
};
