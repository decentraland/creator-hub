import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as CatalystClient from 'dcl-catalyst-client';
import { Scene } from '@dcl/schemas';

import { Env } from '/shared/types/env';

type ContentClientOptions = {
  url: string;
  fetcher: { fetch: (url: string, init?: RequestInit) => Promise<Response> };
};

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  deploy: vi.fn(),
  createContentClient: vi.fn(),
  realClient: { value: null as null | ((options: ContentClientOptions) => unknown) },
  env: { value: null as string | null },
}));

vi.mock('electron', () => ({ net: { fetch: mocks.fetch } }));

vi.mock('../src/modules/electron', () => ({ getEnvOverride: () => mocks.env.value }));

vi.mock('dcl-catalyst-client', async importOriginal => ({
  ...((await importOriginal()) as object),
  createContentClient: (options: ContentClientOptions) => {
    mocks.createContentClient(options);
    return mocks.realClient.value ? mocks.realClient.value(options) : { deploy: mocks.deploy };
  },
}));

import {
  buildEmptyScene,
  deployEmptyScene,
  prepareEmptyScene,
} from '../src/modules/land-unpublish';

const decodeEntity = (files: Map<string, Uint8Array>, entityId: string) =>
  JSON.parse(new TextDecoder().decode(files.get(entityId)));

const signedBy = (entityId: string) => [
  { type: 'SIGNER', payload: '0x1234567890123456789012345678901234567890', signature: '' },
  { type: 'ECDSA_EPHEMERAL', payload: 'Ephemeral address: 0xabc', signature: '0xsig1' },
  { type: 'ECDSA_SIGNED_ENTITY', payload: entityId, signature: '0xsig2' },
];

describe('buildEmptyScene', () => {
  describe('when building the empty scene for a parcel', () => {
    let entity: any;

    beforeEach(async () => {
      const { entityId, files } = await buildEmptyScene('4,-2', 1_700_000_000_000);
      entity = decodeEntity(files, entityId);
    });

    it('should be a scene over that one parcel only, at the given time', () => {
      expect(entity.type).toBe('scene');
      expect(entity.pointers).toEqual(['4,-2']);
      expect(entity.timestamp).toBe(1_700_000_000_000);
      expect(entity.metadata.scene).toEqual({ base: '4,-2', parcels: ['4,-2'] });
    });

    it('should be an SDK7 scene whose main file is part of the deployment', () => {
      expect(entity.metadata.runtimeVersion).toBe('7');
      expect(entity.content.map((file: { file: string }) => file.file)).toContain(
        entity.metadata.main,
      );
    });

    it('should mark itself as empty, so it never reads as a published scene', () => {
      expect(entity.metadata.source).toMatchObject({ origin: 'creator-hub', isEmpty: true });
    });

    it('should carry metadata the catalyst accepts', () => {
      expect(Scene.validate(entity.metadata)).toBe(true);
    });
  });

  describe('when building the same parcel at the same time twice', () => {
    it('should produce the same entity id', async () => {
      const [first, second] = await Promise.all([
        buildEmptyScene('4,-2', 1_700_000_000_000),
        buildEmptyScene('4,-2', 1_700_000_000_000),
      ]);

      expect(first.entityId).toBe(second.entityId);
    });
  });
});

describe('prepareEmptyScene', () => {
  describe('when the parcel is valid', () => {
    it('should return the id of the empty scene built at the returned time', async () => {
      const draft = await prepareEmptyScene('4,-2');

      expect((await buildEmptyScene('4,-2', draft.timestamp)).entityId).toBe(draft.entityId);
    });
  });

  describe.each(['', '4;-2', 'a,b', '4,-2,1', ' 4,-2', '500,0', '0,-500'])(
    'when the parcel is %j',
    parcel => {
      it('should refuse to build anything', async () => {
        await expect(prepareEmptyScene(parcel)).rejects.toThrow('Invalid parcel');
      });
    },
  );

  describe('when the parcel is not a string', () => {
    it('should refuse to build anything', async () => {
      await expect(prepareEmptyScene(42 as unknown as string)).rejects.toThrow('Invalid parcel');
    });
  });
});

describe('deployEmptyScene', () => {
  const TIMESTAMP = 1_700_000_000_000;
  let entityId: string;

  beforeEach(async () => {
    entityId = (await buildEmptyScene('4,-2', TIMESTAMP)).entityId;
    mocks.deploy.mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
    mocks.env.value = null;
  });

  describe('when the signature covers the empty scene main builds', () => {
    beforeEach(async () => {
      mocks.env.value = Env.PROD;
      await deployEmptyScene({
        parcel: '4,-2',
        timestamp: TIMESTAMP,
        authChain: signedBy(entityId),
      });
    });

    it("should deploy to the catalyst of the app's environment", () => {
      expect(mocks.createContentClient).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://peer.decentraland.org/content' }),
      );
    });

    it('should deploy that entity with the signature it was given', () => {
      const [deployment] = mocks.deploy.mock.calls[0];

      expect(deployment.entityId).toBe(entityId);
      expect(deployment.authChain).toEqual(signedBy(entityId));
      expect(decodeEntity(deployment.files, entityId).pointers).toEqual(['4,-2']);
    });
  });

  describe('when the app runs against the development environment', () => {
    it('should deploy to the development catalyst', async () => {
      mocks.env.value = Env.DEV;
      await deployEmptyScene({
        parcel: '4,-2',
        timestamp: TIMESTAMP,
        authChain: signedBy(entityId),
      });

      expect(mocks.createContentClient).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://peer.decentraland.zone/content' }),
      );
    });
  });

  describe.each([
    ['the parcel is malformed', () => ({ parcel: '4;-2' }), 'Invalid parcel'],
    ['the parcel is outside the world', () => ({ parcel: '500,0' }), 'Invalid parcel'],
    ['the timestamp is not a whole number', () => ({ timestamp: 1.5 }), 'Invalid timestamp'],
    ['the timestamp is a string', () => ({ timestamp: String(TIMESTAMP) }), 'Invalid timestamp'],
    ['the timestamp is negative', () => ({ timestamp: -1 }), 'Invalid timestamp'],
    ['the auth chain is not a chain', () => ({ authChain: 'signed' }), 'Invalid auth chain'],
    [
      'an auth chain link is malformed',
      () => ({ authChain: [{ type: 'SIGNER', payload: 1 }] }),
      'Invalid auth chain',
    ],
    [
      'the signature covers another entity',
      () => ({ authChain: signedBy('bafkreiotherentity') }),
      'does not match',
    ],
    [
      'the signature covers the scene at another time',
      () => ({ timestamp: TIMESTAMP + 1 }),
      'does not match',
    ],
  ])('when %s', (_name, override, message) => {
    it('should refuse without contacting the catalyst', async () => {
      const request = {
        parcel: '4,-2',
        timestamp: TIMESTAMP,
        authChain: signedBy(entityId),
        ...override(),
      };

      await expect(deployEmptyScene(request as never)).rejects.toThrow(message);
      expect(mocks.createContentClient).not.toHaveBeenCalled();
      expect(mocks.deploy).not.toHaveBeenCalled();
    });
  });

  describe('when the content client sends the deployment', () => {
    let post: { url: string; init: RequestInit };

    beforeEach(async () => {
      const actual = await vi.importActual<typeof CatalystClient>('dcl-catalyst-client');
      mocks.realClient.value = options => actual.createContentClient(options as never);
      mocks.fetch.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes('/available-content')) return new Response('[]');
        post = { url, init: init! };
        return new Response('{}');
      });
      await deployEmptyScene({
        parcel: '4,-2',
        timestamp: TIMESTAMP,
        authChain: signedBy(entityId),
      });
    });

    afterEach(() => {
      mocks.realClient.value = null;
    });

    it('should post a multipart body whose boundary the request declares', () => {
      const contentType = new Headers(post.init.headers).get('content-type') ?? '';
      const boundary = contentType.match(/^multipart\/form-data; boundary=(.+)$/)?.[1];
      const body = Buffer.from(post.init.body as Uint8Array).toString('utf8');

      expect(post.url).toBe('https://peer.decentraland.zone/content/entities');
      expect(boundary).toBeTruthy();
      expect(body).toContain(`--${boundary}`);
      expect(body).toContain(`name="entityId"\r\n\r\n${entityId}`);
      expect(body).toContain('name="authChain[2][payload]"');
    });
  });

  describe('when the catalyst answers with an error status', () => {
    let fetcher: ContentClientOptions['fetcher'];

    beforeEach(async () => {
      mocks.fetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Invalid pointers'),
      });
      await deployEmptyScene({
        parcel: '4,-2',
        timestamp: TIMESTAMP,
        authChain: signedBy(entityId),
      });
      fetcher = mocks.createContentClient.mock.calls[0][0].fetcher;
    });

    it('should fail with what the catalyst said, rather than read it as deployed', async () => {
      await expect(fetcher.fetch('https://peer.example.org/content/entities')).rejects.toThrow(
        'Invalid pointers',
      );
    });
  });

  describe('when the catalyst rejects the deployment', () => {
    it('should fail with the catalyst error', async () => {
      mocks.deploy.mockRejectedValue(new Error('Catalyst answered 400'));

      await expect(
        deployEmptyScene({ parcel: '4,-2', timestamp: TIMESTAMP, authChain: signedBy(entityId) }),
      ).rejects.toThrow('Catalyst answered 400');
    });
  });
});
