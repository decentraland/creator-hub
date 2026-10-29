import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  concat,
  ContractFunctionRevertedError,
  encodeFunctionData,
  stringToHex,
  zeroAddress,
} from 'viem';
import { namehash } from 'viem/ens';

import type * as Viem from 'viem';
import { DCLRegistrar, ENS as ENSRegistry, ENSResolver } from './abis';
import { ENSProvider, type ENS } from './types';

const readContractMock = vi.fn();

vi.mock('/@/config', () => ({
  config: {
    get: (key: string) =>
      ({
        CHAIN_ID: '11155111',
        RPC_URL: 'https://rpc.example.org/sepolia',
        ENVIRONMENT: 'development',
        JUMP_URL: 'https://decentraland.zone/jump',
      })[key],
  },
}));

vi.mock('viem', async importOriginal => ({
  ...(await importOriginal<typeof Viem>()),
  createPublicClient: () => ({ readContract: readContractMock }),
}));

const {
  buildLinkName,
  decodeLandRedirect,
  encodeLandRedirect,
  getNameUsage,
  resolveNameOwner,
  toDCLNameLabel,
} = await import('./names');
const { getSceneJumpInUrl } = await import('/@/modules/utils');

const SEPOLIA_REGISTRAR = '0x7518456ae93eb98f3e64571b689c626616bb7f30';
const SEPOLIA_RESOLVER = '0x8FADE66B79cC9f707aB26799354482EB93a5B7dD';
const FOO_TOKEN_ID = 29714174079724412745887019504253973571029824035614949642323418802670541573197n;

describe('toDCLNameLabel', () => {
  describe('when given a bare NAME', () => {
    it('should lowercase it', () => {
      expect(toDCLNameLabel(' Foo ')).toBe('foo');
    });
  });

  describe('when given a full .dcl.eth NAME', () => {
    it('should strip the suffix', () => {
      expect(toDCLNameLabel('Foo.dcl.eth')).toBe('foo');
    });
  });

  describe('when given something that cannot be a Decentraland NAME', () => {
    it.each(['', 'a', 'foo.eth', 'foo bar', 'abcdefghijklmnop'])(
      'should return null for %j',
      name => {
        expect(toDCLNameLabel(name)).toBeNull();
      },
    );
  });
});

describe('resolveNameOwner', () => {
  afterEach(() => {
    readContractMock.mockReset();
  });

  describe('when the NAME exists', () => {
    beforeEach(() => {
      readContractMock.mockResolvedValue('0xAbCdEf0000000000000000000000000000000001');
    });

    it('should ask the DCLRegistrar for the owner of the lowercased label token', async () => {
      await resolveNameOwner('Foo.dcl.eth');

      expect(readContractMock).toHaveBeenCalledWith({
        address: SEPOLIA_REGISTRAR,
        abi: DCLRegistrar,
        functionName: 'ownerOf',
        args: [FOO_TOKEN_ID],
      });
    });

    it('should resolve with the lowercased owner address', async () => {
      await expect(resolveNameOwner('foo')).resolves.toBe(
        '0xabcdef0000000000000000000000000000000001',
      );
    });
  });

  describe('when the NAME was never minted', () => {
    beforeEach(() => {
      readContractMock.mockRejectedValue(
        new ContractFunctionRevertedError({
          abi: DCLRegistrar,
          functionName: 'ownerOf',
          message: 'ERC721: owner query for nonexistent token',
        }),
      );
    });

    it('should resolve with null', async () => {
      await expect(resolveNameOwner('foo')).resolves.toBeNull();
    });
  });

  describe('when the RPC is unreachable', () => {
    beforeEach(() => {
      readContractMock.mockRejectedValue(new Error('network down'));
    });

    it('should reject instead of reporting the NAME as unowned', async () => {
      await expect(resolveNameOwner('foo')).rejects.toThrow('network down');
    });
  });

  describe('when the input is not a Decentraland NAME', () => {
    it('should resolve with null without calling the chain', async () => {
      await expect(resolveNameOwner('foo.eth')).resolves.toBeNull();
      expect(readContractMock).not.toHaveBeenCalled();
    });
  });
});

const SEPOLIA_REGISTRY = '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e';
const AZUL_15_2 =
  '0x3000f268747470733a2f2f646563656e7472616c616e642e7a6f6e652f6a756d702f3f706f736974696f6e3d313525324332';
const setContenthash = (content: string) =>
  encodeFunctionData({
    abi: ENSResolver,
    functionName: 'setContenthash',
    args: [namehash('foo.dcl.eth'), content as `0x${string}`],
  });

describe('encodeLandRedirect', () => {
  describe('when given the base parcel 15,2 on dev', () => {
    it("should be 0x3000f2 followed by the parcel's jump-in URL", () => {
      expect(getSceneJumpInUrl({ x: 15, y: 2 })).toBe(
        'https://decentraland.zone/jump?position=15,2',
      );
      expect(encodeLandRedirect({ x: 15, y: 2 })).toBe(
        concat(['0x3000f2', stringToHex(getSceneJumpInUrl({ x: 15, y: 2 }))]),
      );
    });
  });
});

describe('decodeLandRedirect', () => {
  describe('when the contenthash is a 0x3000f2 jump URL', () => {
    it("should read the parcel from its position, azul.dcl.eth's %2C form included", () => {
      expect(decodeLandRedirect(AZUL_15_2)).toEqual({ x: 15, y: 2 });
      expect(decodeLandRedirect(encodeLandRedirect({ x: -100, y: 120 }))).toEqual({
        x: -100,
        y: 120,
      });
    });
  });

  describe('when the contenthash is anything else', () => {
    it('should read no parcel', () => {
      expect(decodeLandRedirect('0xe3010170122065e4731d4080eb1944ae2a6cdd6a1f53af50')).toBeNull();
      expect(decodeLandRedirect('0x')).toBeNull();
      expect(decodeLandRedirect('')).toBeNull();
      expect(decodeLandRedirect('0x3000f2' + '68747470733a2f2f6578616d706c652e6f7267')).toBeNull();
    });
  });
});

describe('buildLinkName', () => {
  const RESOLVER = '0x1234567890123456789012345678901234567890';

  describe('when the NAME has a resolver', () => {
    it('should set the contenthash on it, in one transaction', () => {
      expect(buildLinkName({ subdomain: 'foo.dcl.eth', resolver: RESOLVER }, AZUL_15_2)).toEqual([
        { to: RESOLVER, data: setContenthash(AZUL_15_2) },
      ]);
    });
  });

  describe('when the NAME has no resolver', () => {
    it('should set the public resolver on the registry first, then the contenthash on it', () => {
      expect(buildLinkName({ subdomain: 'foo.dcl.eth', resolver: zeroAddress }, AZUL_15_2)).toEqual(
        [
          {
            to: SEPOLIA_REGISTRY,
            data: encodeFunctionData({
              abi: ENSRegistry,
              functionName: 'setResolver',
              args: [namehash('foo.dcl.eth'), SEPOLIA_RESOLVER],
            }),
          },
          { to: SEPOLIA_RESOLVER, data: setContenthash(AZUL_15_2) },
        ],
      );
    });
  });

  describe('when the link is removed', () => {
    it('should clear the contenthash on the NAME resolver', () => {
      expect(buildLinkName({ subdomain: 'foo.dcl.eth', resolver: RESOLVER }, '0x')).toEqual([
        { to: RESOLVER, data: setContenthash('0x') },
      ]);
    });
  });
});

describe('getNameUsage', () => {
  const name = (overrides: Partial<ENS>): ENS => ({
    name: 'foo',
    subdomain: 'foo.dcl.eth',
    provider: ENSProvider.DCL,
    tokenId: '1',
    nftOwnerAddress: '0x1',
    ensOwnerAddress: '0x1',
    resolver: '0x2',
    content: '',
    ...overrides,
  });

  describe('when the NAME redirects to a parcel of a LAND', () => {
    it('should return that LAND id', () => {
      expect(getNameUsage(name({ content: AZUL_15_2 }), { '15,2': '42' }, new Set())).toEqual({
        landId: '42',
        world: false,
      });
    });
  });

  describe('when the NAME still points at an old IPFS redirection', () => {
    it('should count as not linked', () => {
      expect(getNameUsage(name({ content: '0xe301aa' }), { '15,2': '42' }, new Set())).toEqual({
        landId: null,
        world: false,
      });
    });
  });

  describe('when the NAME has a published World', () => {
    it('should flag the World', () => {
      expect(getNameUsage(name({}), {}, new Set(['foo.dcl.eth']))).toEqual({
        landId: null,
        world: true,
      });
    });
  });
});
