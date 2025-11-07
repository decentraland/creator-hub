export interface TestProject {
  name: string;
  path: string;
  title: string;
  description: string;
}

export interface TestUser {
  address: string;
  isAuthenticated: boolean;
}

export interface TestScene {
  id: string;
  title: string;
  description: string;
  parcels: string[];
  owner: string;
}

export interface TestDeployment {
  id: string;
  sceneId: string;
  status: 'pending' | 'complete' | 'failed';
  timestamp: Date;
}
