---
module: Auth System
date: 2026-02-20
problem_type: developer_experience
component: tooling
symptoms:
  - 'Heavy bundle size from ethers.js (~114KB min+gzip) used for minimal wallet functionality'
  - 'Deprecated decentraland-connect library leaving unsupported AuthServerProvider'
  - '@ethersproject/hash pulled in as separate dependency for ENS name hashing'
root_cause: wrong_api
resolution_type: dependency_update
severity: medium
tags: [ethers, viem, bundle-size, dependency-migration, web3]
---

# Troubleshooting: Replace ethers.js with viem for lighter bundle and modern API

## Problem

The Creator Hub used ethers.js (~114KB min+gzip) for a small subset of Ethereum functionality (ephemeral wallets, JSON-RPC calls, ENS hashing, contract reads). The `AuthServerProvider` was originally vendored from the deprecated `decentraland-connect` library, which compounded the dependency problem. Replacing ethers with viem (~28KB min+gzip) significantly reduces bundle size while providing a type-safe, tree-shakeable alternative.

## Environment

- Module: Auth System, ENS Module
- Affected Component: `renderer/src/lib/auth.ts`, `renderer/src/modules/store/ens/slice.ts`, `renderer/src/components/AuthProvider/`
- Date: 2026-02-20

## Symptoms

- Heavy bundle size from ethers.js used for minimal wallet functionality
- Deprecated `decentraland-connect` library leaving unsupported `AuthServerProvider` implementation
- `@ethersproject/hash` pulled in as a separate dependency solely for ENS `namehash`

## What didn't work

**Attempted Solution 1:** Integrate wagmi on top of viem

- **Why it failed:** wagmi's primary value is abstracting multiple wallet connectors (MetaMask, WalletConnect, Coinbase, etc.). The Creator Hub uses a single custom `AuthServerProvider` for its Auth Server sign-in flow. Adding wagmi introduced `@tanstack/react-query` as a mandatory peer dependency and added connector abstraction complexity with no product benefit.

**Direct solution after reverting wagmi:** Use viem directly for all Ethereum primitives and keep the existing custom `AuthProvider` component.

## Solution

Replaced all ethers.js usage with viem equivalents across three files:

**auth.ts — Ephemeral wallet creation:**

```typescript
// Before (ethers):
import { ethers } from 'ethers';
const ephemeral = ethers.Wallet.createRandom();

// After (viem):
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);
// account.address, account.publicKey, privateKey all available
```

**auth.ts — JSON-RPC calls:**

```typescript
// Before (ethers):
const provider = new ethers.JsonRpcProvider(rpcUrl);
const result = await provider.send('eth_chainId', []);

// After (viem):
import { createPublicClient, http } from 'viem';
const client = createPublicClient({ transport: http(rpcUrl) });
const result = await client.request({ method: 'eth_chainId' });
```

**ens/slice.ts — Contract reads and ENS hashing:**

```typescript
// Before (ethers):
import { namehash } from '@ethersproject/hash';
import { ethers } from 'ethers';
const contract = new ethers.Contract(addr, abi, provider);
const owner = await contract.owner(node);

// After (viem):
import { createPublicClient, http, zeroAddress } from 'viem';
import { namehash } from 'viem/ens';
const owner = await publicClient.readContract({
  address: addr,
  abi,
  functionName: 'owner',
  args: [node],
});
```

**package.json — Dependency changes:**

- Added: `viem`
- Removed: `ethers`, `@ethersproject/hash`

**AuthProvider types:**

- Replaced `ethers.HDNodeWallet` with custom `EphemeralAuthAccount` type (`{ address, privateKey, publicKey }`) exported from `auth.ts`.

## Why this works

1. **Root cause:** The project pulled in the full ethers.js library (~114KB min+gzip) for a small number of operations. The `@ethersproject/hash` sub-package added another dependency for a single `namehash` function.
2. **Why viem solves it:** viem is designed as a tree-shakeable, modular library. Only the functions actually imported are bundled. The same operations (wallet generation, RPC calls, contract reads, ENS hashing) are available with a much smaller footprint (~28KB min+gzip).
3. **Why wagmi was rejected:** wagmi abstracts wallet connector management. Since the Creator Hub has a single custom auth flow (Auth Server provider), wagmi's connector abstraction adds complexity and dependencies (`@tanstack/react-query`) without value.

## Prevention

- Before adding a Web3 library, evaluate whether the project needs multi-wallet connector support (use wagmi) or just Ethereum primitives (use viem directly).
- Prefer tree-shakeable libraries over monolithic ones for frontend applications where bundle size matters.
- When vendoring code from deprecated libraries, audit the dependency chain and replace heavy transitive dependencies.

## Related issues

No related issues documented yet.
