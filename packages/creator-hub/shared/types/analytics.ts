export type Events = {
  'Open Editor': {
    version: string;
  };
  'Auto Update Editor': {
    version: string;
  };
  'Scene created': {
    projectType: 'github-repo';
    url: string;
    project_id: string;
  };
  'Create Project': {
    project_id: string;
    project_name: string;
    template: string;
    rows: number;
    cols: number;
  };
  'Open Project': {
    project_id: string;
    project_name: string;
  };
  'Save Project Success': {
    project_id: string;
    project_name: string;
  };
  'Preview Scene': {
    project_id: string;
  };
  'Publish Scene': {
    project_id: string;
    target: string;
    targetContent: string;
  };
  'Execute Scene Deployment': {
    project_id: string;
    scene_size: number;
    file_count: number;
    base_parcel: string;
    parcels: string[];
    is_world: boolean;
    world_name?: string;
    existing_world_scenes: Array<{
      entity_id: string;
      parcels: string[];
      size: number;
    }>;
  };
  'Open Code': undefined;
  'Worlds Your Storage Modal Action': {
    action: string;
  };
  'Manage Worlds External Action': {
    action: string;
  };
  'Add World Permissions': {
    world_name: string;
    wallet_address: string;
    permission_name: string;
  };
  'Remove World Permissions': {
    world_name: string;
    wallet_address: string;
    permission_name: string;
  };
  'Add Collaborator Parcel Permissions': {
    world_name: string;
    wallet_address: string;
    permission_name: string;
    parcels_count: number;
  };
  'Remove Collaborator Parcel Permissions': {
    world_name: string;
    wallet_address: string;
    permission_name: string;
    parcels_count: number;
  };
  'Update World Settings': {
    world_name: string;
    world_settings: object;
    changed_fields: {
      title: boolean;
      description: boolean;
      thumbnail: boolean;
      content_rating: boolean;
      categories: boolean;
    };
    scenes_list: Array<{
      entityId: string;
      deployer: string;
      parcels_count: number;
      size: string;
      created_at: string;
    }>;
  };
  'Unpublish World Scene': {
    world_name: string;
    scene_coord: string;
  };
  'Unpublish Entire World': {
    world_name: string;
  };
};
