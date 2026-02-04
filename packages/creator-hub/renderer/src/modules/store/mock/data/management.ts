/**
 * Mock data for the management slice.
 * Used to populate the Manage page with sample projects during development.
 */

import type { ManagedProject } from '/shared/types/manage';
import { ManagedProjectType } from '/shared/types/manage';
import { WorldRoleType } from '/@/lib/worlds';

export const MOCK_MANAGEMENT_PROJECTS: ManagedProject[] = [
  {
    id: 'mock-world-1.dcl.eth',
    displayName: 'mock-world-1.dcl.eth',
    type: ManagedProjectType.WORLD,
    role: WorldRoleType.OWNER,
    deployment: {
      title: 'Mock World One',
      description: 'A mock world for testing the Manage page',
      thumbnail: '',
      lastPublishedAt: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
      scenes: [
        {
          id: 'mock-scene-1',
          publishedAt: Date.now() - 1000 * 60 * 60 * 24,
          parcels: ['0,0', '0,1', '1,0', '1,1'],
        },
      ],
    },
  },
  {
    id: 'mock-world-2.dcl.eth',
    displayName: 'mock-world-2.dcl.eth',
    type: ManagedProjectType.WORLD,
    role: WorldRoleType.COLLABORATOR,
    deployment: {
      title: 'Mock World Two',
      description: 'Another mock world with multiple scenes',
      thumbnail: '',
      lastPublishedAt: Date.now() - 1000 * 60 * 60 * 48, // 2 days ago
      scenes: [
        {
          id: 'mock-scene-2a',
          publishedAt: Date.now() - 1000 * 60 * 60 * 48,
          parcels: ['5,5', '5,6'],
        },
        {
          id: 'mock-scene-2b',
          publishedAt: Date.now() - 1000 * 60 * 60 * 72,
          parcels: ['10,10'],
        },
      ],
    },
  },
  {
    id: 'mock-empty-world.dcl.eth',
    displayName: 'mock-empty-world.dcl.eth',
    type: ManagedProjectType.WORLD,
    role: WorldRoleType.OWNER,
    // No deployment - represents an undeployed world
  },
  {
    id: 'mock-land-parcel',
    displayName: '-10,25',
    type: ManagedProjectType.LAND,
    role: 'owner' as any, // LandRoleType
    deployment: {
      title: 'Mock Land Scene',
      description: 'A deployed scene on mock land',
      thumbnail: '',
      lastPublishedAt: Date.now() - 1000 * 60 * 60 * 12, // 12 hours ago
      scenes: [
        {
          id: 'mock-land-scene-1',
          publishedAt: Date.now() - 1000 * 60 * 60 * 12,
          parcels: ['-10,25'],
        },
      ],
    },
  },
  {
    id: 'mock-estate',
    displayName: 'Mock Estate',
    type: ManagedProjectType.LAND,
    role: 'operator' as any, // LandRoleType
    // No deployment - empty estate
  },
];
