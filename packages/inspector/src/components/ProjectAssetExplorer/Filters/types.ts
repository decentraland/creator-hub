export enum Filter {
  All = 'all',
  Recents = 'recents',
  Models = 'models',
  Emotes = 'emotes',
  Images = 'images',
  Video = 'video',
  Audio = 'audio',
  Scripts = 'scripts',
  Other = 'other',
}

export type PropTypes = {
  filters: Filter[];
  active?: Filter;
  onClick(type: Filter): void;
};
