import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractFunctionRevertedError } from 'viem';

import type * as Viem from 'viem';
import { DCLRegistrar } from './abis';
import { ENSProvider, type ENS } from './types';

const readContractMock = vi.fn();

vi.mock('/@/config', () => ({
  config: {
    get: (key: string) =>
      ({ CHAIN_ID: '11155111', RPC_URL: 'https://rpc.example.org/sepolia' })[key],
  },
}));

vi.mock('viem', async importOriginal => ({
  ...(await importOriginal<typeof Viem>()),
  createPublicClient: () => ({ readContract: readContractMock }),
}));

const { buildSetNameContent, getNameUsage, resolveNameOwner, toDCLNameLabel } = await import(
  './names'
);

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

describe('buildSetNameContent', () => {
  describe('when pointing a NAME at a LAND redirection', () => {
    it('should call setContenthash on the resolver with the NAME node', () => {
      expect(
        buildSetNameContent(
          'foo.dcl.eth',
          '0xe3010170122065e4731d4080eb1944ae2a6cdd6a1f53af5021c7123de709349d0932c9876087',
        ),
      ).toEqual({
        to: SEPOLIA_RESOLVER,
        data: '0x304e6ade9bb7b7bd73d31b16ff599daabd868b2815d6cd9833b8321051e9dc312e20b56e00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000026e3010170122065e4731d4080eb1944ae2a6cdd6a1f53af5021c7123de709349d0932c98760870000000000000000000000000000000000000000000000000000',
      });
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

  describe('when the NAME content is a LAND redirection', () => {
    it('should return that LAND id', () => {
      expect(getNameUsage(name({ content: '0xE301AA' }), { '0xe301aa': '42' }, new Set())).toEqual({
        landId: '42',
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

  describe('when the NAME is unused', () => {
    it('should flag nothing', () => {
      expect(getNameUsage(name({ content: '0x' }), { '0xe301aa': '42' }, new Set())).toEqual({
        landId: null,
        world: false,
      });
    });
  });
});
