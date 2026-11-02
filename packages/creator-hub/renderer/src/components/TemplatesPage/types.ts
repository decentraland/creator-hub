export enum SortBy {
  DEFAULT = 'Default',
  NEWEST = 'Newest',
}

export type ModalType = { type: 'create-project'; payload: CreateProjectValue };

export type CreateProjectValue = {
  name: string;
  path: string;
  repo?: string;
};
