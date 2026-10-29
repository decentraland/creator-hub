import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WaitForTransactionReceiptTimeoutError, getAddress } from 'viem';

import type * as Viem from 'viem';
import type * as Auth from './auth';
import { LandType, RoleType, type Land } from './land';

const LAND_REGISTRY = '0xf87e31492faf9a91b02ee0deaad50d51d56d5d4d';
const ESTATE_REGISTRY = '0x959e104e1a4db6317fa58f8295f586e1a978c297';
const RENTALS = '0x3a1469499d0be105d4f77045ca403a5f6dc2f3f5';
const OWNER = '0x1111111111111111111111111111111111111111';
const OTHER = '0x2222222222222222222222222222222222222222';
const HASH = `0x${'ab'.repeat(32)}`;

const requestMock = vi.fn();
const waitForReceiptMock = vi.fn();

vi.mock('/@/config', () => ({
  config: {
    get: (key: string) =>
      ({
        CHAIN_ID: '11155111',
        RPC_URL: 'https://rpc.example.org/sepolia',
        LAND_REGISTRY_ADDRESS: LAND_REGISTRY,
        ESTATE_REGISTRY_ADDRESS: ESTATE_REGISTRY,
        RENTALS_ADDRESS: RENTALS,
      })[key],
  },
}));

vi.mock('./auth', async importOriginal => ({
  ...(await importOriginal<typeof Auth>()),
  AuthServerProvider: class {
    request = requestMock;
  },
}));

vi.mock('viem', async importOriginal => ({
  ...(await importOriginal<typeof Viem>()),
  createPublicClient: () => ({ waitForTransactionReceipt: waitForReceiptMock }),
}));

const {
  buildSetEstateParcelsOperator,
  buildSetLandOperator,
  buildSetUpdateManager,
  buildTransferLand,
  buildUpdateLandMetadata,
  encodeTokenId,
  sendLandTransaction,
} = await import('./landTransactions');

const PARCEL_TOKEN_ID =
  '115792089237316195423570985008687907849867160996431179404823837933595447525381';

const parcel = (overrides: Partial<Land> = {}): Land => ({
  id: '-10,5',
  tokenId: PARCEL_TOKEN_ID,
  type: LandType.PARCEL,
  roles: [RoleType.OWNER],
  role: RoleType.OWNER,
  x: -10,
  y: 5,
  name: 'Parcel',
  description: null,
  owner: OWNER,
  operators: [],
  ...overrides,
});

const estate = (overrides: Partial<Land> = {}): Land => ({
  id: '42',
  tokenId: '42',
  type: LandType.ESTATE,
  roles: [RoleType.OWNER],
  role: RoleType.OWNER,
  parcels: [
    { x: -10, y: 5, id: '-10,5', updateOperator: null },
    { x: -9, y: 5, id: '-9,5', updateOperator: null },
  ],
  name: 'Estate 42',
  description: null,
  owner: OWNER,
  operators: [],
  ...overrides,
});

describe('encodeTokenId', () => {
  describe('when the coordinates are negative', () => {
    it('should match LANDRegistry.encodeTokenId on mainnet', () => {
      expect(encodeTokenId(-10, 5).toString()).toBe(PARCEL_TOKEN_ID);
    });
  });
});

describe('buildTransferLand', () => {
  describe('when the land is a parcel', () => {
    it('should call LANDRegistry.transferFrom with the parcel token id', () => {
      expect(buildTransferLand(parcel(), OWNER, OTHER)).toEqual({
        to: LAND_REGISTRY,
        data: '0x23b872dd00000000000000000000000011111111111111111111111111111111111111110000000000000000000000002222222222222222222222222222222222222222fffffffffffffffffffffffffffffff600000000000000000000000000000005',
      });
    });
  });

  describe('when the land is an estate', () => {
    it('should call EstateRegistry.transferFrom with the estate id', () => {
      expect(buildTransferLand(estate(), OWNER, OTHER)).toEqual({
        to: ESTATE_REGISTRY,
        data: '0x23b872dd00000000000000000000000011111111111111111111111111111111111111110000000000000000000000002222222222222222222222222222222222222222000000000000000000000000000000000000000000000000000000000000002a',
      });
    });
  });
});

describe('buildUpdateLandMetadata', () => {
  describe('when the land is a parcel', () => {
    it('should call LANDRegistry.updateLandData with escaped Builder metadata', () => {
      expect(buildUpdateLandMetadata(parcel(), 'My "Land"', 'Hi')).toEqual({
        to: LAND_REGISTRY,
        data: '0xd4dd1594fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff6000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000015302c224d79205c224c616e645c22222c224869222c0000000000000000000000',
      });
    });
  });

  describe('when the land is an estate', () => {
    it('should call EstateRegistry.updateMetadata', () => {
      expect(buildUpdateLandMetadata(estate(), 'My "Land"', 'Hi')).toEqual({
        to: ESTATE_REGISTRY,
        data: '0x53c8388e000000000000000000000000000000000000000000000000000000000000002a00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000015302c224d79205c224c616e645c22222c224869222c0000000000000000000000',
      });
    });
  });
});

describe('buildSetLandOperator', () => {
  describe('when the land is a parcel the user owns', () => {
    it('should call LANDRegistry.setManyUpdateOperator with a one-item array', () => {
      expect(buildSetLandOperator(parcel(), OTHER)).toEqual({
        to: LAND_REGISTRY,
        data: '0x72554ff5000000000000000000000000000000000000000000000000000000000000004000000000000000000000000022222222222222222222222222222222222222220000000000000000000000000000000000000000000000000000000000000001fffffffffffffffffffffffffffffff600000000000000000000000000000005',
      });
    });
  });

  describe('when the operator is revoked', () => {
    it('should set the zero address', () => {
      expect(buildSetLandOperator(parcel(), null).data).toBe(
        '0x72554ff5000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001fffffffffffffffffffffffffffffff600000000000000000000000000000005',
      );
    });
  });

  describe('when the land is an estate the user owns', () => {
    it('should call EstateRegistry.setManyUpdateOperator with a one-item array', () => {
      expect(buildSetLandOperator(estate(), OTHER)).toEqual({
        to: ESTATE_REGISTRY,
        data: '0x72554ff5000000000000000000000000000000000000000000000000000000000000004000000000000000000000000022222222222222222222222222222222222222220000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002a',
      });
    });
  });

  describe('when the user rents the parcel', () => {
    it('should call Rentals.setUpdateOperator for the LAND registry', () => {
      const rented = parcel({ roles: [RoleType.TENANT], role: RoleType.TENANT });

      expect(buildSetLandOperator(rented, OTHER)).toEqual({
        to: RENTALS,
        data: '0x37f81abb000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000001000000000000000000000000f87e31492faf9a91b02ee0deaad50d51d56d5d4d0000000000000000000000000000000000000000000000000000000000000001fffffffffffffffffffffffffffffff60000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000010000000000000000000000002222222222222222222222222222222222222222',
      });
    });
  });
});

describe('buildSetEstateParcelsOperator', () => {
  describe('when two parcels of an estate get one operator', () => {
    it('should call EstateRegistry.setManyLandUpdateOperator with their token ids', () => {
      expect(
        buildSetEstateParcelsOperator(
          '42',
          [
            { x: -10, y: 5 },
            { x: -9, y: 5 },
          ],
          OTHER,
        ),
      ).toEqual({
        to: ESTATE_REGISTRY,
        data: '0x3dcbeb00000000000000000000000000000000000000000000000000000000000000002a000000000000000000000000000000000000000000000000000000000000006000000000000000000000000022222222222222222222222222222222222222220000000000000000000000000000000000000000000000000000000000000002fffffffffffffffffffffffffffffff600000000000000000000000000000005fffffffffffffffffffffffffffffff700000000000000000000000000000005',
      });
    });
  });
});

describe('buildSetUpdateManager', () => {
  describe('when a manager is approved', () => {
    it('should call setUpdateManager on both registries', () => {
      const data =
        '0xef1db762000000000000000000000000111111111111111111111111111111111111111100000000000000000000000022222222222222222222222222222222222222220000000000000000000000000000000000000000000000000000000000000001';

      expect(buildSetUpdateManager(OWNER, OTHER, true)).toEqual([
        { to: LAND_REGISTRY, data },
        { to: ESTATE_REGISTRY, data },
      ]);
    });
  });

  describe('when a manager is removed', () => {
    it('should pass approved = false', () => {
      expect(buildSetUpdateManager(OWNER, OTHER, false)[1].data).toBe(
        '0xef1db762000000000000000000000000111111111111111111111111111111111111111100000000000000000000000022222222222222222222222222222222222222220000000000000000000000000000000000000000000000000000000000000000',
      );
    });
  });
});

describe('sendLandTransaction', () => {
  const tx = { to: LAND_REGISTRY, data: '0x1234' } as const;

  beforeEach(() => {
    requestMock.mockImplementation(async ({ method }: { method: string }) =>
      method === 'eth_sendTransaction' ? HASH : undefined,
    );
  });

  afterEach(() => {
    requestMock.mockReset();
    waitForReceiptMock.mockReset();
  });

  describe('when the transaction is mined successfully on the target contract', () => {
    beforeEach(() => {
      waitForReceiptMock.mockResolvedValue({ status: 'success', to: getAddress(LAND_REGISTRY) });
    });

    it('should switch CH to the configured chain before sending', async () => {
      await sendLandTransaction(tx);

      expect(requestMock.mock.calls.map(([payload]) => payload)).toEqual([
        { method: 'wallet_switchEthereumChain', params: [{ chainId: '0xaa36a7' }] },
        { method: 'eth_sendTransaction', params: [{ to: LAND_REGISTRY, data: '0x1234' }] },
      ]);
    });

    it('should report the hash as soon as the relay returns it, before the receipt', async () => {
      const order: string[] = [];
      waitForReceiptMock.mockImplementation(async () => {
        order.push('receipt');
        return { status: 'success', to: getAddress(LAND_REGISTRY) };
      });

      await sendLandTransaction(tx, { onSent: hash => order.push(`sent ${hash}`) });

      expect(order).toEqual([`sent ${HASH}`, 'receipt']);
    });

    it('should wait for the receipt of the returned hash', async () => {
      await sendLandTransaction(tx, { receiptTimeoutMs: 1000 });

      expect(waitForReceiptMock).toHaveBeenCalledWith({ hash: HASH, timeout: 1000 });
    });

    it('should resolve as confirmed', async () => {
      await expect(sendLandTransaction(tx)).resolves.toEqual({ hash: HASH, status: 'confirmed' });
    });
  });

  describe('when the transaction reverts', () => {
    beforeEach(() => {
      waitForReceiptMock.mockResolvedValue({ status: 'reverted', to: LAND_REGISTRY });
    });

    it('should resolve as failed', async () => {
      await expect(sendLandTransaction(tx)).resolves.toEqual({ hash: HASH, status: 'failed' });
    });
  });

  describe('when the receipt is for another contract', () => {
    beforeEach(() => {
      waitForReceiptMock.mockResolvedValue({ status: 'success', to: OTHER });
    });

    it('should resolve as failed rather than confirmed', async () => {
      await expect(sendLandTransaction(tx)).resolves.toEqual({ hash: HASH, status: 'failed' });
    });
  });

  describe('when no receipt arrives within the wait', () => {
    beforeEach(() => {
      waitForReceiptMock.mockRejectedValue(
        new WaitForTransactionReceiptTimeoutError({ hash: HASH as `0x${string}` }),
      );
    });

    it('should resolve as unconfirmed', async () => {
      await expect(sendLandTransaction(tx)).resolves.toEqual({
        hash: HASH,
        status: 'unconfirmed',
      });
    });
  });

  describe('when the relay returns something that is not a transaction hash', () => {
    beforeEach(() => {
      requestMock.mockImplementation(async ({ method }: { method: string }) =>
        method === 'eth_sendTransaction' ? 'nope' : undefined,
      );
    });

    it('should reject without waiting for a receipt', async () => {
      await expect(sendLandTransaction(tx)).rejects.toThrow('nope');
      expect(waitForReceiptMock).not.toHaveBeenCalled();
    });
  });
});
